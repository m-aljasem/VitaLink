import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent, IonText
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth.service';
import { ProfileService, Profile } from '../../../core/profile.service';
import { SharingService, ProviderLink } from '../../../core/sharing.service';
import { ObservationService, MetricType, Observation } from '../../../core/observation.service';
import { LineChartComponent } from '../../../shared/components/line-chart/line-chart.component';

interface SharedMetricData {
  metric: MetricType;
  label: string;
  latestValue: Observation | null;
  chartData: number[];
  chartLabels: string[];
  color: string;
}

@Component({
  selector: 'app-provider-patient-detail',
  templateUrl: './provider-patient-detail.page.html',
  styleUrls: ['./provider-patient-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent, IonText,
    TranslateModule, LineChartComponent
  ],
})
export class ProviderPatientDetailPage implements OnInit {
  patientId: string = '';
  patientProfile: Profile | null = null;
  link: ProviderLink | null = null;
  sharedMetrics: SharedMetricData[] = [];

  metricColors: { [key in MetricType]: string } = {
    bp: '#EF4444',
    glucose: '#F59E0B',
    spo2: '#3B82F6',
    hr: '#10B981',
    pain: '#8B5CF6',
    weight: '#6366F1',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private profileService: ProfileService,
    private sharingService: SharingService,
    private observationService: ObservationService
  ) {}

  async ngOnInit() {
    this.patientId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.patientId) {
      this.router.navigate(['/tabs/home']);
      return;
    }

    await this.loadData();
  }

  async loadData() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    // Load patient profile
    const { data: profile } = await this.profileService.getProfile(this.patientId);
    this.patientProfile = profile || null;

    // Load provider link to see what's shared
    const { data: links } = await this.sharingService.getProviderLinks(user.id);
    this.link = links?.find(l => l.patient_id === this.patientId) || null;

    if (!this.link) {
      this.router.navigate(['/tabs/home']);
      return;
    }

    // Load shared metrics
    const metrics: MetricType[] = [];
    if (this.link.share_bp) metrics.push('bp');
    if (this.link.share_glucose) metrics.push('glucose');
    if (this.link.share_spo2) metrics.push('spo2');
    if (this.link.share_hr) metrics.push('hr');
    if (this.link.share_pain) metrics.push('pain');
    if (this.link.share_weight) metrics.push('weight');

    this.sharedMetrics = await Promise.all(
      metrics.map(async (metric) => {
        const { data: latest } = await this.observationService.getLatestObservation(
          this.patientId,
          metric
        );

        // Get chart data (last 7 days)
        const { data: chartObs } = await this.observationService.getObservationsForChart(
          this.patientId,
          metric,
          7
        );

        const chartData = (chartObs || []).map(o => {
          if (metric === 'bp') return o.systolic || 0;
          return o.numeric_value || 0;
        });

        const chartLabels = (chartObs || []).map(o => {
          const date = new Date(o.ts);
          return date.toLocaleDateString();
        });

        return {
          metric,
          label: `METRICS.${metric.toUpperCase()}`,
          latestValue: latest || null,
          chartData,
          chartLabels,
          color: this.metricColors[metric],
        };
      })
    );
  }

  formatValue(obs: Observation): string {
    if (obs.metric === 'bp') {
      return `${obs.systolic}/${obs.diastolic} ${obs.unit || 'mmHg'}`;
    }
    return `${obs.numeric_value} ${obs.unit || ''}`;
  }

  formatTime(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  getTrendLinePoints(data: number[]): string {
    if (!data || data.length === 0) return '';
    
    const width = 100;
    const height = 30;
    const padding = 2;
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - ((value - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    });
    
    return points.join(' ');
  }
}

