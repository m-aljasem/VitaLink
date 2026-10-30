import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import {
  IonContent, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonChip, IonText, IonRefresher, IonRefresherContent, IonIcon, IonSearchbar, IonButton, ToastController
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { 
  people, pulse, addCircle, warning, person, timeOutline, chevronForward, 
  peopleOutline, heart, water, speedometer, thermometer, scale, searchOutline, closeOutline,
  notifications, alertCircle, moonOutline
} from 'ionicons/icons';
import { AuthService, Profile } from '../../../core/auth.service';
import { SharingService, ProviderLink } from '../../../core/sharing.service';
import { ProfileService } from '../../../core/profile.service';
import { ObservationService, MetricType } from '../../../core/observation.service';
import { DateFormatService } from '../../../core/date-format.service';
import { I18nService } from '../../../core/i18n.service';
import { AlertsService, ReadingAlert } from '../../../core/alerts.service';
import { MetricFormatService } from '../../../core/metric-format.service';

/** Days without a reading after which a patient is shown as inactive. */
const INACTIVE_AFTER_DAYS = 3;

interface PatientInfo {
  link: ProviderLink;
  profile: Profile;
  lastSeen: string | null;
  sharedMetrics: string[];
  /** Has an abnormal or critical reading in the last 7 days. */
  needsAttention: boolean;
  /** No reading for INACTIVE_AFTER_DAYS days. */
  inactive: boolean;
}

interface Stats {
  totalPatients: number;
  activeThisWeek: number;
  newLinks: number;
  exceptions: number;
}

@Component({
  selector: 'app-provider-home',
  templateUrl: './provider-home.page.html',
  styleUrls: ['./provider-home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonChip, IonText, IonRefresher, IonRefresherContent, IonIcon, IonSearchbar, IonButton, TranslateModule
  ],
})
export class ProviderHomePage implements OnInit, OnDestroy {
  profile: Profile | null = null;
  loading = true;
  stats: Stats = {
    totalPatients: 0,
    activeThisWeek: 0,
    newLinks: 0,
    exceptions: 0,
  };
  patients: PatientInfo[] = [];
  filteredPatients: PatientInfo[] = [];
  searchTerm: string = '';
  isRTL: boolean = false;
  greeting = 'HOME.GREETING_MORNING';
  /** Unread alerts, newest first. */
  alerts: ReadingAlert[] = [];
  private alertSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private sharingService: SharingService,
    private profileService: ProfileService,
    private observationService: ObservationService,
    private router: Router,
    private dateFormatService: DateFormatService,
    private translate: TranslateService,
    private i18nService: I18nService,
    private alertsService: AlertsService,
    private toastController: ToastController,
    public format: MetricFormatService
  ) {
    addIcons({ 
      people, pulse, addCircle, warning, person, timeOutline, chevronForward, 
      peopleOutline, heart, water, speedometer, thermometer, scale, searchOutline, closeOutline,
      notifications, alertCircle, moonOutline
    });
  }

  async ngOnInit() {
    this.profile = await this.authService.getCurrentProfile();
    this.isRTL = this.i18nService.isRTL();
    const hour = new Date().getHours();
    this.greeting = hour < 12 ? 'HOME.GREETING_MORNING' : hour < 18 ? 'HOME.GREETING_AFTERNOON' : 'HOME.GREETING_EVENING';
    await this.loadData();

    const user = this.authService.getCurrentUser();
    if (user) {
      this.alertSubscription = this.alertsService.watch(user.id).subscribe(alert => this.onNewAlert(alert));
    }
  }

  ngOnDestroy() {
    this.alertSubscription?.unsubscribe();
    this.alertsService.stopWatching();
  }

  private async onNewAlert(alert: ReadingAlert) {
    this.alerts = [alert, ...this.alerts.filter(a => a.id !== alert.id)];
    const toast = await this.toastController.create({
      message: `${this.patientName(alert.patient_id)}: ${this.alertText(alert)}`,
      duration: 4000,
      color: alert.severity === 'critical' ? 'danger' : 'warning',
      position: 'top',
    });
    await toast.present();
    // Refresh flags and counts
    this.loadData(false);
  }

  patientName(patientId: string): string {
    const patient = this.patients.find(p => p.profile.id === patientId);
    const name = `${patient?.profile.first_name || ''} ${patient?.profile.last_name || ''}`.trim();
    return name || this.translate.instant('PROVIDER.PATIENT');
  }

  alertText(alert: ReadingAlert): string {
    const metric = this.translate.instant('METRICS.' + alert.metric.toUpperCase());
    return `${metric} – ${this.format.severityLabel({ severity: alert.severity })}`;
  }

  async openAlert(alert: ReadingAlert) {
    await this.alertsService.markRead([alert.id]);
    this.alerts = this.alerts.filter(a => a.id !== alert.id);
    this.router.navigate(['/provider/patient', alert.patient_id, 'metric', alert.metric]);
  }

  async markAllAlertsRead() {
    await this.alertsService.markRead(this.alerts.map(a => a.id));
    this.alerts = [];
  }

  async loadData(showLoading = true) {
    if (showLoading) this.loading = true;
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.loading = false;
      return;
    }

    // Load provider links
    const { data: links } = await this.sharingService.getProviderLinks(user.id);
    if (!links) {
      this.loading = false;
      return;
    }

    this.stats.totalPatients = links.length;
    this.stats.activeThisWeek = 0;

    // Calculate active this week (patients with observations in last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const inactiveSince = new Date();
    inactiveSince.setDate(inactiveSince.getDate() - INACTIVE_AFTER_DAYS);

    // Load patient profiles and calculate stats
    const patientResults = await Promise.all(
      links.map(async (link) => {
        const { data: patientProfile, error } = await this.profileService.getProfile(link.patient_id);
        if (error || !patientProfile) {
          console.error('Error loading patient profile:', error);
          return null;
        }
        
        // Get latest observation for each shared metric
        const sharedMetrics: string[] = [];
        if (link.share_bp) sharedMetrics.push('bp');
        if (link.share_glucose) sharedMetrics.push('glucose');
        if (link.share_spo2) sharedMetrics.push('spo2');
        if (link.share_hr) sharedMetrics.push('hr');
        if (link.share_pain) sharedMetrics.push('pain');
        if (link.share_weight) sharedMetrics.push('weight');

        const { data: latest } = await this.observationService.getLatestTimestamp(
          link.patient_id,
          sharedMetrics as MetricType[]
        );
        const lastSeen = latest || null;

        return {
          link,
          profile: patientProfile!,
          lastSeen,
          sharedMetrics,
          needsAttention: false,
          inactive: sharedMetrics.length > 0 && (!lastSeen || new Date(lastSeen) < inactiveSince),
        };
      })
    );
    
    // Filter out any null entries (profiles that couldn't be loaded)
    this.patients = patientResults.filter((p): p is PatientInfo => p !== null);
    this.stats.activeThisWeek = this.patients.filter(
      p => p.lastSeen && new Date(p.lastSeen) > weekAgo
    ).length;

    // Patients with out-of-range readings this week come first, then inactive ones.
    const [flagged, alertsResult] = await Promise.all([
      this.observationService.getUsersWithOutOfRangeReadings(this.patients.map(p => p.profile.id), weekAgo),
      this.alertsService.getAlerts(user.id, 50),
    ]);
    for (const patient of this.patients) {
      patient.needsAttention = flagged.has(patient.profile.id);
    }
    this.stats.exceptions = flagged.size;
    this.patients.sort((a, b) =>
      Number(b.needsAttention) - Number(a.needsAttention) || Number(b.inactive) - Number(a.inactive)
    );
    this.alerts = (alertsResult.data || []).filter(a => !a.read_at);
    this.filterPatients();

    // Calculate new links (created in last 7 days)
    this.stats.newLinks = links.filter(
      link => new Date(link.created_at) > weekAgo
    ).length;

    this.loading = false;
  }

  async doRefresh(event: any) {
    await this.loadData();
    if (event.detail) {
      event.detail.complete();
    }
  }

  navigateToPatient(patientId: string) {
    this.router.navigate(['/provider/patient', patientId]);
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return this.translate.instant('TIME.NEVER');
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return this.translate.instant('TIME.TODAY');
    if (diffDays === 1) return this.translate.instant('TIME.YESTERDAY');
    if (diffDays < 7) return this.translate.instant('TIME.DAYS_AGO', { count: diffDays });
    return this.dateFormatService.formatDateSync(dateString);
  }

  getMetricIcon(metric: string): string {
    const icons: { [key: string]: string } = {
      'bp': 'pulse',
      'glucose': 'water',
      'spo2': 'speedometer',
      'hr': 'heart',
      'pain': 'thermometer',
      'weight': 'scale'
    };
    return icons[metric] || 'ellipse';
  }

  onSearchChange(event: CustomEvent) {
    this.searchTerm = event.detail.value || '';
    this.filterPatients();
  }

  filterPatients() {
    if (!this.searchTerm.trim()) {
      this.filteredPatients = this.patients;
      return;
    }

    const searchLower = this.searchTerm.toLowerCase().trim();
    this.filteredPatients = this.patients.filter(patient => {
      const firstName = patient.profile.first_name?.toLowerCase() || '';
      const lastName = patient.profile.last_name?.toLowerCase() || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const patientId = patient.profile.id.toLowerCase();
      
      return fullName.includes(searchLower) || 
             firstName.includes(searchLower) || 
             lastName.includes(searchLower) ||
             patientId.includes(searchLower);
    });
  }

  clearSearch() {
    this.searchTerm = '';
    this.filteredPatients = this.patients;
  }
}

