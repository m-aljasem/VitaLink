import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon, IonCard, IonCardContent, IonText, IonChip, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { arrowBack, pulse, water, pulseOutline, heart, sad, scale, calendarOutline, timeOutline, barChartOutline, documentOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/auth.service';
import { ProfileService, Profile } from '../../../core/profile.service';
import { SharingService, ProviderLink } from '../../../core/sharing.service';
import { ObservationService, MetricType, Observation } from '../../../core/observation.service';
import { LineChartComponent } from '../../../shared/components/line-chart/line-chart.component';
import { DateFormatService } from '../../../core/date-format.service';

@Component({
  selector: 'app-provider-metric-detail',
  templateUrl: './provider-metric-detail.page.html',
  styleUrls: ['./provider-metric-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon,
    IonCard, IonCardContent, IonText, IonChip, IonRefresher, IonRefresherContent,
    TranslateModule, LineChartComponent
  ],
})
export class ProviderMetricDetailPage implements OnInit {
  patientId: string = '';
  metric!: MetricType;
  patientProfile: Profile | null = null;
  observations: Observation[] = [];
  chartData: number[] = [];
  chartLabels: string[] = [];
  chartColor = '#3B82F6';
  loading = true;

  metricColors: { [key in MetricType]: string } = {
    bp: '#EF4444',
    glucose: '#F59E0B',
    spo2: '#3B82F6',
    hr: '#10B981',
    pain: '#8B5CF6',
    weight: '#6366F1',
  };

  metricIcons: { [key in MetricType]: string } = {
    bp: 'pulse',
    glucose: 'water',
    spo2: 'pulse-outline',
    hr: 'heart',
    pain: 'sad',
    weight: 'scale',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private profileService: ProfileService,
    private sharingService: SharingService,
    private observationService: ObservationService,
    private dateFormatService: DateFormatService,
    private translate: TranslateService
  ) {
    addIcons({ arrowBack, pulse, water, pulseOutline, heart, sad, scale, calendarOutline, timeOutline, barChartOutline, documentOutline });
  }

  async ngOnInit() {
    this.patientId = this.route.snapshot.paramMap.get('id') || '';
    const metricParam = this.route.snapshot.paramMap.get('type');
    
    if (!metricParam || !['bp', 'glucose', 'spo2', 'hr', 'pain', 'weight'].includes(metricParam)) {
      this.router.navigate(['/tabs/provider-home']);
      return;
    }

    if (!this.patientId) {
      this.router.navigate(['/tabs/provider-home']);
      return;
    }

    this.metric = metricParam as MetricType;
    this.chartColor = this.metricColors[this.metric];
    
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

    // Verify provider has access to this patient
    const { data: links } = await this.sharingService.getProviderLinks(user.id);
    const link = links?.find(l => l.patient_id === this.patientId);
    
    if (!link || !this.getSharingStatus(link)) {
      this.router.navigate(['/tabs/provider-home']);
      if (showLoading) {
        this.loading = false;
      }
      return;
    }

    // Load patient profile
    const { data: profile } = await this.profileService.getProfile(this.patientId);
    this.patientProfile = profile || null;

    // Load observations
    const { data: obs } = await this.observationService.getObservationsByMetric(
      this.patientId,
      this.metric,
      100
    );
    this.observations = (obs || []).sort((a, b) => 
      new Date(b.ts).getTime() - new Date(a.ts).getTime()
    );

    // Prepare chart data (last 30 days, sorted chronologically)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const chartObs = this.observations
      .filter(o => new Date(o.ts) >= thirtyDaysAgo)
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    this.chartData = chartObs.map(o => {
      if (this.metric === 'bp') {
        return o.systolic || 0;
      }
      return o.numeric_value || 0;
    });

    this.chartLabels = chartObs.map(o => {
      const date = new Date(o.ts);
      return this.dateFormatService.formatDateSync(o.ts);
    });

    if (showLoading) {
      this.loading = false;
    }
  }

  async doRefresh(event: any) {
    await this.loadData(false);
    if (event.detail) {
      event.detail.complete();
    }
  }

  getSharingStatus(link: ProviderLink): boolean {
    switch (this.metric) {
      case 'bp': return link.share_bp;
      case 'glucose': return link.share_glucose;
      case 'spo2': return link.share_spo2;
      case 'hr': return link.share_hr;
      case 'pain': return link.share_pain;
      case 'weight': return link.share_weight;
      default: return false;
    }
  }

  formatValue(obs: Observation): string {
    if (obs.metric === 'bp') {
      const unit = this.translate.instant('METRICS.MMHG');
      return `${obs.systolic}/${obs.diastolic} ${unit}`;
    }
    // Get unit translation key based on metric type
    const unitKey = this.getUnitTranslationKey(obs.metric);
    const unit = unitKey ? this.translate.instant(unitKey) : (obs.unit || '');
    return `${obs.numeric_value} ${unit}`;
  }

  private getUnitTranslationKey(metric: string): string | null {
    const unitMap: { [key: string]: string } = {
      glucose: 'METRICS.MGDL',
      spo2: 'METRICS.PERCENT',
      hr: 'METRICS.BPM',
      pain: 'METRICS.SCALE_1_10',
      weight: 'METRICS.KG',
    };
    return unitMap[metric] || null;
  }

  formatDate(dateString: string): string {
    return this.dateFormatService.formatDateSync(dateString);
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  goBack() {
    this.router.navigate(['/provider/patient', this.patientId]);
  }

  getMetricIcon(): string {
    return this.metricIcons[this.metric];
  }
}

