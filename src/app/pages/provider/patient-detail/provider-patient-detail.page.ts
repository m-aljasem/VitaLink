import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonCard, IonCardContent, IonText, IonIcon, IonChip, IonButton, IonButtons, AlertController, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { lockClosed, pulse, water, pulseOutline, heart, sad, scale, locationOutline, personOutline, calendarOutline, male, female, medicalOutline, arrowBack, trashOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/auth.service';
import { ProfileService, Profile } from '../../../core/profile.service';
import { SharingService, ProviderLink } from '../../../core/sharing.service';
import { ObservationService, MetricType, Observation } from '../../../core/observation.service';

interface MetricWidget {
  metric: MetricType;
  label: string;
  icon: string;
  color: string;
  isShared: boolean;
  recordCount: number;
}

@Component({
  selector: 'app-provider-patient-detail',
  templateUrl: './provider-patient-detail.page.html',
  styleUrls: ['./provider-patient-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonCard, IonCardContent,
    IonIcon, IonChip, IonButton, IonButtons, IonRefresher, IonRefresherContent,
    TranslateModule
  ],
})
export class ProviderPatientDetailPage implements OnInit {
  patientId: string = '';
  patientProfile: Profile | null = null;
  link: ProviderLink | null = null;
  metricWidgets: MetricWidget[] = [];
  loading = true;

  metricConfig: { [key in MetricType]: { label: string; icon: string; color: string } } = {
    bp: { label: 'METRICS.BP', icon: 'pulse', color: '#EF4444' },
    glucose: { label: 'METRICS.GLUCOSE', icon: 'water', color: '#F59E0B' },
    spo2: { label: 'METRICS.SPO2', icon: 'pulse-outline', color: '#3B82F6' },
    hr: { label: 'METRICS.HR', icon: 'heart', color: '#10B981' },
    pain: { label: 'METRICS.PAIN', icon: 'sad', color: '#8B5CF6' },
    weight: { label: 'METRICS.WEIGHT', icon: 'scale', color: '#6366F1' },
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private profileService: ProfileService,
    private sharingService: SharingService,
    private observationService: ObservationService,
    private alertController: AlertController,
    private translate: TranslateService
  ) {
    addIcons({ lockClosed, pulse, water, pulseOutline, heart, sad, scale, locationOutline, personOutline, calendarOutline, male, female, medicalOutline, arrowBack, trashOutline });
  }

  async ngOnInit() {
    this.patientId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.patientId) {
      this.router.navigate(['/tabs/home']);
      return;
    }

    await this.loadData();
  }

  async loadData(showLoading: boolean = true) {
    if (showLoading) {
      this.loading = true;
    }
    const user = this.authService.getCurrentUser();
    if (!user) {
      if (showLoading) {
        this.loading = false;
      }
      return;
    }

    // Load patient profile
    const { data: profile } = await this.profileService.getProfile(this.patientId);
    this.patientProfile = profile || null;

    // Load provider link to see what's shared
    const { data: links } = await this.sharingService.getProviderLinks(user.id);
    this.link = links?.find(l => l.patient_id === this.patientId) || null;

    if (!this.link) {
      this.router.navigate(['/tabs/home']);
      if (showLoading) {
        this.loading = false;
      }
      return;
    }

    // Load all 6 metrics with sharing status and record counts
    const allMetrics: MetricType[] = ['bp', 'glucose', 'spo2', 'hr', 'pain', 'weight'];
    
    this.metricWidgets = await Promise.all(
      allMetrics.map(async (metric) => {
        const config = this.metricConfig[metric];
        const isShared = this.getSharingStatus(metric);
        
        let recordCount = 0;
        if (isShared) {
          // Get count of observations for this metric
          const { data: observations } = await this.observationService.getObservationsByMetric(
            this.patientId,
            metric,
            1000 // Large limit to get count
          );
          recordCount = observations?.length || 0;
        }

        return {
          metric,
          label: config.label,
          icon: config.icon,
          color: config.color,
          isShared,
          recordCount,
        };
      })
    );

    if (showLoading) {
      this.loading = false;
    }
  }

  async doRefresh(event: any) {
    await this.loadData(false);
    event.target.complete();
  }

  getSharingStatus(metric: MetricType): boolean {
    if (!this.link) return false;
    
    switch (metric) {
      case 'bp': return this.link.share_bp;
      case 'glucose': return this.link.share_glucose;
      case 'spo2': return this.link.share_spo2;
      case 'hr': return this.link.share_hr;
      case 'pain': return this.link.share_pain;
      case 'weight': return this.link.share_weight;
      default: return false;
    }
  }

  onMetricClick(widget: MetricWidget) {
    if (widget.isShared && widget.recordCount > 0) {
      // Navigate to provider metric detail page
      this.router.navigate(['/provider/patient', this.patientId, 'metric', widget.metric]);
    }
  }

  getGenderIcon(): string {
    return this.patientProfile?.gender === 'male' ? 'male' : 'female';
  }

  goBack() {
    this.router.navigate(['/tabs/provider-home']);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  }

  async deletePatient() {
    if (!this.link) return;

    const alert = await this.alertController.create({
      header: this.translate.instant('PROVIDER.DELETE_PATIENT_TITLE'),
      message: this.translate.instant('PROVIDER.DELETE_PATIENT_MESSAGE'),
      buttons: [
        {
          text: this.translate.instant('COMMON.CANCEL'),
          role: 'cancel',
        },
        {
          text: this.translate.instant('PROVIDER.DELETE'),
          role: 'destructive',
          handler: async () => {
            await this.performDelete();
          },
        },
      ],
    });

    await alert.present();
  }

  async performDelete() {
    if (!this.link) return;

    const { error } = await this.sharingService.revokeLink(this.link.id);
    
    if (error) {
      // Show error toast if needed
      console.error('Error deleting patient:', error);
      return;
    }

    // Navigate back to provider home
    this.router.navigate(['/tabs/provider-home']);
  }
}

