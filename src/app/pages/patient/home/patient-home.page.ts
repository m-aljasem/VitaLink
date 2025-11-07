import { Component, OnInit } from '@angular/core';
import { 
  IonContent, IonRefresher, IonRefresherContent,
  IonList, IonItem, IonLabel, IonIcon, IonText, IonChip
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService, Profile } from '../../../core/auth.service';
import { ObservationService, MetricType, Observation } from '../../../core/observation.service';
import { MetricCardComponent } from '../../../shared/components/metric-card/metric-card.component';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { heart, water, pulse, thermometer, bandage, scale } from 'ionicons/icons';

interface MetricData {
  metric: MetricType;
  value: string | null;
  lastTime: string | null;
  trend: 'up' | 'down' | 'neutral';
  color: string;
  sparklineData: number[];
}

@Component({
  selector: 'app-patient-home',
  templateUrl: './patient-home.page.html',
  styleUrls: ['./patient-home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonRefresher, IonRefresherContent,
    IonList, IonItem, IonLabel, IonIcon, IonText, IonChip, TranslateModule, MetricCardComponent
  ],
})
export class PatientHomePage implements OnInit {
  profile: Profile | null = null;
  greeting = '';
  metrics: MetricData[] = [];
  recentActivity: Observation[] = [];
  loading = true;

  metricColors: { [key in MetricType]: string } = {
    bp: '#EF4444',
    glucose: '#F59E0B',
    spo2: '#3B82F6',
    hr: '#10B981',
    pain: '#8B5CF6',
    weight: '#6366F1',
  };

  constructor(
    private authService: AuthService,
    private observationService: ObservationService
  ) {
    addIcons({ heart, water, pulse, thermometer, bandage, scale });
  }

  getMetricIcon(metric: MetricType): string {
    const icons: { [key in MetricType]: string } = {
      bp: 'pulse',
      glucose: 'water',
      spo2: 'heart',
      hr: 'pulse',
      pain: 'bandage',
      weight: 'scale',
    };
    return icons[metric];
  }

  async ngOnInit() {
    this.profile = await this.authService.getCurrentProfile();
    this.updateGreeting();
    await this.loadData();
  }

  updateGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) {
      this.greeting = 'HOME.GREETING_MORNING';
    } else if (hour < 17) {
      this.greeting = 'HOME.GREETING_AFTERNOON';
    } else if (hour < 21) {
      this.greeting = 'HOME.GREETING_EVENING';
    } else {
      this.greeting = 'HOME.GREETING_NIGHT';
    }
  }

  async loadData() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.loading = false;
      return;
    }

    this.loading = true;
    this.metrics = [];
    const metricTypes: MetricType[] = ['bp', 'glucose', 'spo2', 'hr', 'pain', 'weight'];
    
    // Load all metrics in parallel instead of sequentially
    const metricPromises = metricTypes.map(async (metric) => {
      const [latestResult, chartResult] = await Promise.all([
        this.observationService.getLatestObservation(user.id, metric),
        this.observationService.getObservationsForChart(user.id, metric, 7)
      ]);
      
      const latest = latestResult.data;
      const chartData = chartResult.data;
      
      let value: string | null = null;
      let trend: 'up' | 'down' | 'neutral' = 'neutral';
      let sparklineData: number[] = [];

      if (latest) {
        if (metric === 'bp') {
          value = `${latest.systolic}/${latest.diastolic}`;
        } else {
          value = latest.numeric_value?.toString() || null;
        }
      }

      // Calculate trend and sparkline
      if (chartData && chartData.length >= 2) {
        sparklineData = chartData.map(o => {
          if (metric === 'bp') return o.systolic || 0;
          return o.numeric_value || 0;
        });

        // Compare last two values for trend
        const last = sparklineData[sparklineData.length - 1];
        const prev = sparklineData[sparklineData.length - 2];
        
        if (last > prev) trend = 'up';
        else if (last < prev) trend = 'down';
        else trend = 'neutral';
      }

      return {
        metric,
        value,
        lastTime: latest?.ts || null,
        trend,
        color: this.metricColors[metric],
        sparklineData,
      };
    });

    // Wait for all metrics to load, then load recent activity in parallel
    const [metricsData, recentActivityResult] = await Promise.all([
      Promise.all(metricPromises),
      this.observationService.getAllObservations(user.id, 20)
    ]);

    this.metrics = metricsData;
    this.recentActivity = recentActivityResult.data || [];
    this.loading = false;
  }

  async doRefresh(event: any) {
    await this.loadData();
    event.target.complete();
  }

  formatMetricValue(obs: Observation): string {
    if (obs.metric === 'bp') {
      return `${obs.systolic}/${obs.diastolic} mmHg`;
    }
    return `${obs.numeric_value} ${obs.unit || ''}`;
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString();
  }
}

