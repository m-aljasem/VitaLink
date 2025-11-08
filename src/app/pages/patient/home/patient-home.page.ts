import { Component, OnInit, OnDestroy } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { Router, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { 
  IonContent, IonRefresher, IonRefresherContent,
  IonList, IonItem, IonLabel, IonIcon, IonText, IonChip, IonCard, IonCardContent,
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, ToastController, AlertController
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService, Profile } from '../../../core/auth.service';
import { ObservationService, MetricType, Observation } from '../../../core/observation.service';
import { MetricCardComponent } from '../../../shared/components/metric-card/metric-card.component';
import { DateFormatService } from '../../../core/date-format.service';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { heart, water, pulse, thermometer, bandage, scale, timeOutline, createOutline, trash, pricetagOutline } from 'ionicons/icons';

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
    IonIcon, IonText, IonChip, IonCard, IonCardContent, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    TranslateModule, MetricCardComponent
  ],
})
export class PatientHomePage implements OnInit, ViewWillEnter, OnDestroy {
  profile: Profile | null = null;
  greeting = '';
  metrics: MetricData[] = [];
  recentActivity: Observation[] = [];
  loading = true;
  private destroy$ = new Subject<void>();

  // Record detail modal
  showRecordModal = false;
  selectedRecord: Observation | null = null;

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
    private observationService: ObservationService,
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController,
    private translate: TranslateService,
    private dateFormatService: DateFormatService
  ) {
    addIcons({ heart, water, pulse, thermometer, bandage, scale, timeOutline, createOutline, trash, pricetagOutline });
    
    // Listen for navigation events to refresh data when returning to this page
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: any) => {
        const url = event.url || event.urlAfterRedirects || '';
        // Check if we're navigating to the home tab
        if (url.includes('/tabs/home') || url.endsWith('/home') || url === '/tabs/home') {
          // Small delay to ensure the view is ready
          setTimeout(() => {
            this.loadData(false);
          }, 100);
        }
      });
  }

  getTagColor(metric: string): 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'danger' {
    const colorMap: { [key: string]: 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'danger' } = {
      bp: 'danger',
      glucose: 'warning',
      spo2: 'primary',
      hr: 'success',
      pain: 'tertiary',
      weight: 'primary',
    };
    return colorMap[metric] || 'primary';
  }

  getMetricIcon(metric: string): string {
    const icons: { [key: string]: string } = {
      bp: 'pulse',
      glucose: 'water',
      spo2: 'heart',
      hr: 'pulse',
      pain: 'bandage',
      weight: 'scale',
    };
    return icons[metric] || 'pulse';
  }

  getMetricColor(metric: string): string {
    return this.metricColors[metric as MetricType] || '#3B82F6';
  }

  getMetricGradient(metric: string): string {
    const gradients: { [key: string]: string } = {
      bp: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
      glucose: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
      spo2: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
      hr: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      pain: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
      weight: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
    };
    return gradients[metric] || 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)';
  }

  async ngOnInit() {
    this.profile = await this.authService.getCurrentProfile();
    this.updateGreeting();
    await this.loadData();
  }

  async ionViewWillEnter() {
    // Refresh data when returning to this page (without showing loading skeleton)
    await this.loadData(false);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
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

  async loadData(showLoading: boolean = true) {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.loading = false;
      return;
    }

    if (showLoading) {
      this.loading = true;
      this.metrics = [];
    }
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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Less than 1 minute
    if (diffMins < 1) {
      return this.translate.instant('TIME.JUST_NOW');
    }

    // Less than 1 hour
    if (diffMins < 60) {
      if (diffMins === 1) {
        return this.translate.instant('TIME.ONE_MINUTE_AGO');
      }
      return this.translate.instant('TIME.MINUTES_AGO', { count: diffMins });
    }

    // Less than 24 hours
    if (diffHours < 24) {
      const hour = date.getHours();
      const isToday = date.toDateString() === now.toDateString();
      
      if (isToday) {
        if (hour < 12) return this.translate.instant('TIME.THIS_MORNING');
        if (hour < 17) return this.translate.instant('TIME.THIS_AFTERNOON');
        return this.translate.instant('TIME.THIS_EVENING');
      }
      
      if (diffHours === 1) {
        return this.translate.instant('TIME.ONE_HOUR_AGO');
      }
      return this.translate.instant('TIME.HOURS_AGO', { count: diffHours });
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      const hour = date.getHours();
      if (hour >= 18 || hour < 6) return this.translate.instant('TIME.LAST_NIGHT');
      return this.translate.instant('TIME.YESTERDAY');
    }

    // Less than 7 days
    if (diffDays < 7) {
      if (diffDays === 1) {
        return this.translate.instant('TIME.ONE_DAY_AGO');
      }
      return this.translate.instant('TIME.DAYS_AGO', { count: diffDays });
    }

    // Less than 14 days
    if (diffDays < 14) {
      return this.translate.instant('TIME.LAST_WEEK');
    }

    // Less than 30 days
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      if (weeks === 1) {
        return this.translate.instant('TIME.ONE_WEEK_AGO');
      }
      return this.translate.instant('TIME.WEEKS_AGO', { count: weeks });
    }

    // Less than 365 days
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      if (months === 1) {
        return this.translate.instant('TIME.ONE_MONTH_AGO');
      }
      return this.translate.instant('TIME.MONTHS_AGO', { count: months });
    }

    // Older than a year
    const years = Math.floor(diffDays / 365);
    if (years === 1) {
      return this.translate.instant('TIME.ONE_YEAR_AGO');
    }
    return this.translate.instant('TIME.YEARS_AGO', { count: years });
  }

  formatDateTime(dateString: string): string {
    return this.dateFormatService.formatDateTimeSync(dateString, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  showRecordDetail(obs: Observation) {
    this.selectedRecord = obs;
    this.showRecordModal = true;
  }

  editRecord() {
    if (!this.selectedRecord) return;
    
    this.showRecordModal = false;
    // Navigate to the metric detail page for editing
    this.router.navigate(['/tabs/metric-detail', this.selectedRecord.metric], {
      queryParams: { editId: this.selectedRecord.id }
    });
  }

  async deleteRecord() {
    if (!this.selectedRecord) return;

    const alert = await this.alertController.create({
      header: this.translate.instant('METRICS.DELETE_RECORD_TITLE'),
      message: this.translate.instant('METRICS.DELETE_RECORD_MESSAGE'),
      buttons: [
        {
          text: this.translate.instant('COMMON.CANCEL'),
          role: 'cancel'
        },
        {
          text: this.translate.instant('COMMON.DELETE'),
          role: 'destructive',
          handler: async () => {
            if (this.selectedRecord?.id) {
              const { error } = await this.observationService.deleteObservation(this.selectedRecord.id);
              
              if (error) {
                const toast = await this.toastController.create({
                  message: this.translate.instant('METRICS.DELETE_RECORD_ERROR'),
                  duration: 2000,
                  color: 'danger',
                });
                await toast.present();
              } else {
                const toast = await this.toastController.create({
                  message: this.translate.instant('METRICS.DELETE_RECORD_SUCCESS'),
                  duration: 2000,
                  color: 'success',
                });
                await toast.present();
                
                this.showRecordModal = false;
                this.selectedRecord = null;
                await this.loadData(false);
              }
            }
          }
        }
      ]
    });

    await alert.present();
  }
}

