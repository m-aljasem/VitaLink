import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonInput, IonItem, IonLabel,
  IonChip, IonButtons, ToastController, IonText, IonCard, IonCardContent, IonIcon, ModalController, AlertController, IonModal
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  pulse, water, heart, thermometer, bandage, scale, timeOutline, arrowBack, arrowForward,
  addCircle, time, calendarOutline, checkmarkCircle, pricetagOutline, barChart,
  createOutline, trash
} from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth.service';
import { ObservationService, MetricType, Observation } from '../../../core/observation.service';
import { LineChartComponent } from '../../../shared/components/line-chart/line-chart.component';
import { DatePickerModalComponent } from '../../../shared/components/date-picker-modal/date-picker-modal.component';
import { I18nService } from '../../../core/i18n.service';

@Component({
  selector: 'app-metric-detail',
  templateUrl: './metric-detail.page.html',
  styleUrls: ['./metric-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonInput, IonItem, IonLabel,
    IonChip, IonButtons, IonText, IonCard, IonCardContent, IonIcon, IonModal, TranslateModule, LineChartComponent
  ],
})
export class MetricDetailPage implements OnInit {
  metric!: MetricType;
  observations: Observation[] = [];
  chartData: number[] = [];
  chartLabels: string[] = [];
  chartColor = '#3B82F6';

  metricColors: { [key in MetricType]: string } = {
    bp: '#EF4444',
    glucose: '#F59E0B',
    spo2: '#3B82F6',
    hr: '#10B981',
    pain: '#8B5CF6',
    weight: '#6366F1',
  };

  // Form values
  systolic: number | null = null;
  diastolic: number | null = null;
  pulse: number | null = null; // Optional pulse for BP
  numericValue: number | null = null;
  selectedTags: string[] = [];
  selectedDateTime = new Date().toISOString();
  dateSelectionMode: 'right-now' | 'custom' = 'right-now';
  showForm = true;

  availableTags: string[] = [];

  // Record detail modal
  showRecordModal = false;
  selectedRecord: Observation | null = null;
  editingRecord: Observation | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private observationService: ObservationService,
    private toastController: ToastController,
    private modalController: ModalController,
    private alertController: AlertController,
    private i18nService: I18nService,
    private translate: TranslateService
  ) {
    addIcons({ 
      pulse, water, heart, thermometer, bandage, scale, timeOutline, arrowBack, arrowForward,
      addCircle, time, calendarOutline, checkmarkCircle, pricetagOutline, barChart,
      createOutline, trash
    });
  }

  goBack() {
    this.router.navigate(['/tabs/home']);
  }

  getBackIcon(): string {
    const currentLang = this.i18nService.getCurrentLanguage();
    const rtlLanguages = ['ar', 'fa', 'ur'];
    return rtlLanguages.includes(currentLang) ? 'arrow-forward' : 'arrow-back';
  }

  getGradient(): string {
    const gradients: { [key in MetricType]: string } = {
      bp: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
      glucose: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
      spo2: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
      hr: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      pain: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
      weight: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
    };
    return gradients[this.metric] || 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)';
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
    const metricParam = this.route.snapshot.paramMap.get('type');
    if (!metricParam || !['bp', 'glucose', 'spo2', 'hr', 'pain', 'weight'].includes(metricParam)) {
      this.router.navigate(['/tabs/home']);
      return;
    }

    this.metric = metricParam as MetricType;
    this.chartColor = this.metricColors[this.metric];
    this.setupTags();
    await this.loadData();
  }

  setupTags() {
    if (this.metric === 'bp') {
      this.availableTags = ['TAGS.BP_AFTER_WAKE', 'TAGS.BP_BEFORE_BED', 'TAGS.BP_STRESS'];
    } else if (this.metric === 'glucose') {
      this.availableTags = ['TAGS.GLUCOSE_FASTING', 'TAGS.GLUCOSE_AFTER_MEAL', 'TAGS.GLUCOSE_WORKOUT'];
    }
  }

  async loadData() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const { data: obs } = await this.observationService.getObservationsByMetric(user.id, this.metric, 50);
    this.observations = obs || [];

    // Prepare chart data
    const chartObs = this.observations.slice().reverse();
    this.chartData = chartObs.map(o => {
      if (this.metric === 'bp') {
        return o.systolic || 0;
      }
      return o.numeric_value || 0;
    });
    this.chartLabels = chartObs.map(o => {
      const date = new Date(o.ts);
      return date.toLocaleDateString();
    });
  }

  toggleTag(tag: string) {
    const index = this.selectedTags.indexOf(tag);
    if (index > -1) {
      this.selectedTags.splice(index, 1);
    } else {
      this.selectedTags.push(tag);
    }
  }

  async save() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    // Validate date is not in the future
    const selectedDate = new Date(this.selectedDateTime);
    const now = new Date();
    if (selectedDate > now) {
      const toast = await this.toastController.create({
        message: this.translate.instant('METRICS.DATE_FUTURE_ERROR') || 'Cannot select a future date',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
      return;
    }

    let observationData: Partial<Observation> = {
      user_id: user.id,
      metric: this.metric,
      ts: this.selectedDateTime,
      tags: this.selectedTags,
    };

    if (this.metric === 'bp') {
      if (!this.systolic || !this.diastolic) {
        const toast = await this.toastController.create({
          message: this.translate.instant('METRICS.ENTER_BP_VALUES'),
          duration: 2000,
          color: 'danger',
        });
        await toast.present();
        return;
      }
      
      // Validate BP ranges
      if (this.systolic < 50 || this.systolic > 250) {
        const toast = await this.toastController.create({
          message: this.translate.instant('METRICS.BP_SYSTOLIC_RANGE_ERROR') || 'Systolic must be between 50 and 250',
          duration: 2000,
          color: 'danger',
        });
        await toast.present();
        return;
      }
      
      if (this.diastolic < 30 || this.diastolic > 150) {
        const toast = await this.toastController.create({
          message: this.translate.instant('METRICS.BP_DIASTOLIC_RANGE_ERROR') || 'Diastolic must be between 30 and 150',
          duration: 2000,
          color: 'danger',
        });
        await toast.present();
        return;
      }
      
      if (this.systolic <= this.diastolic) {
        const toast = await this.toastController.create({
          message: this.translate.instant('METRICS.BP_RATIO_ERROR') || 'Systolic must be greater than diastolic',
          duration: 2000,
          color: 'danger',
        });
        await toast.present();
        return;
      }
      
      observationData.systolic = this.systolic;
      observationData.diastolic = this.diastolic;
      if (this.pulse) {
        observationData.context = { pulse: this.pulse };
      }
    } else {
      if (!this.numericValue && this.numericValue !== 0) {
        const toast = await this.toastController.create({
          message: this.translate.instant('METRICS.ENTER_VALUE_REQUIRED'),
          duration: 2000,
          color: 'danger',
        });
        await toast.present();
        return;
      }
      
      // Validate ranges based on metric type
      let min = 0;
      let max = 0;
      let errorMessage = '';
      
      if (this.metric === 'glucose') {
        min = 20;
        max = 600;
        errorMessage = this.translate.instant('METRICS.GLUCOSE_RANGE_ERROR') || 'Glucose must be between 20 and 600 mg/dL';
      } else if (this.metric === 'spo2') {
        min = 0;
        max = 100;
        errorMessage = this.translate.instant('METRICS.SPO2_RANGE_ERROR') || 'SpO2 must be between 0 and 100%';
      } else if (this.metric === 'hr') {
        min = 30;
        max = 220;
        errorMessage = this.translate.instant('METRICS.HR_RANGE_ERROR') || 'Heart rate must be between 30 and 220 bpm';
      } else if (this.metric === 'pain') {
        min = 0;
        max = 10;
        errorMessage = this.translate.instant('METRICS.PAIN_RANGE_ERROR') || 'Pain level must be between 0 and 10';
      } else if (this.metric === 'weight') {
        min = 1;
        max = 500;
        errorMessage = this.translate.instant('METRICS.WEIGHT_RANGE_ERROR') || 'Weight must be between 1 and 500 kg';
      }
      
      if (this.numericValue < min || this.numericValue > max) {
        const toast = await this.toastController.create({
          message: errorMessage,
          duration: 2000,
          color: 'danger',
        });
        await toast.present();
        return;
      }
      
      observationData.numeric_value = this.numericValue;
      
      // Set units
      if (this.metric === 'glucose') observationData.unit = 'mg/dL';
      else if (this.metric === 'spo2') observationData.unit = '%';
      else if (this.metric === 'hr') observationData.unit = 'bpm';
      else if (this.metric === 'weight') observationData.unit = 'kg';
    }

    const { error } = await this.observationService.createObservation(observationData);
    
    if (error) {
      const toast = await this.toastController.create({
        message: this.translate.instant('METRICS.SAVE_ERROR'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } else {
      const toast = await this.toastController.create({
        message: this.translate.instant('METRICS.SAVE_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      
      // Reset form and hide it
      this.systolic = null;
      this.diastolic = null;
      this.numericValue = null;
      this.selectedTags = [];
      this.selectedDateTime = new Date().toISOString();
      this.dateSelectionMode = 'right-now';
      this.showForm = false;
      
      await this.loadData();
    }
  }

  showAddForm() {
    this.showForm = true;
  }

  formatValue(obs: Observation): string {
    if (obs.metric === 'bp') {
      return `${obs.systolic}/${obs.diastolic} ${obs.unit || 'mmHg'}`;
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
      return 'just now';
    }

    // Less than 1 hour
    if (diffMins < 60) {
      return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
    }

    // Less than 24 hours
    if (diffHours < 24) {
      const hour = date.getHours();
      const isToday = date.toDateString() === now.toDateString();
      
      if (isToday) {
        if (hour < 12) return 'this morning';
        if (hour < 17) return 'this afternoon';
        return 'this evening';
      }
      
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      const hour = date.getHours();
      if (hour >= 18 || hour < 6) return 'last night';
      return 'yesterday';
    }

    // Less than 7 days
    if (diffDays < 7) {
      return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    }

    // Less than 14 days
    if (diffDays < 14) {
      return 'last week';
    }

    // Less than 30 days
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }

    // Less than 365 days
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }

    // Older than a year
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }

  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  setRightNow() {
    this.selectedDateTime = new Date().toISOString();
    this.dateSelectionMode = 'right-now';
  }

  async openDatePicker() {
    const maxDate = new Date().toISOString();
    
    const modal = await this.modalController.create({
      component: DatePickerModalComponent,
      componentProps: {
        selectedDate: this.selectedDateTime,
        maxDate: maxDate
      }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data && data.selectedDate) {
      // Ensure selected date is not in the future
      const selectedDate = new Date(data.selectedDate);
      const now = new Date();
      if (selectedDate > now) {
        const toast = await this.toastController.create({
          message: this.translate.instant('METRICS.DATE_FUTURE_ERROR') || 'Cannot select a future date',
          duration: 2000,
          color: 'danger',
        });
        await toast.present();
        this.selectedDateTime = now.toISOString();
      } else {
        this.selectedDateTime = data.selectedDate;
      }
      this.dateSelectionMode = 'custom';
    }
  }

  showRecordDetail(obs: Observation) {
    this.selectedRecord = obs;
    this.showRecordModal = true;
  }

  async editRecord() {
    if (!this.selectedRecord) return;
    
    this.editingRecord = this.selectedRecord;
    this.showRecordModal = false;
    
    // Populate form with record data
    if (this.selectedRecord.metric === 'bp') {
      this.systolic = this.selectedRecord.systolic || null;
      this.diastolic = this.selectedRecord.diastolic || null;
    } else {
      this.numericValue = this.selectedRecord.numeric_value || null;
    }
    
    this.selectedTags = this.selectedRecord.tags || [];
    this.selectedDateTime = this.selectedRecord.ts;
    this.dateSelectionMode = 'custom';
    this.showForm = true;
    
    // Scroll to form
    setTimeout(() => {
      const formElement = document.querySelector('.entry-form-card');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
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
                await this.loadData();
              }
            }
          }
        }
      ]
    });

    await alert.present();
  }
}

