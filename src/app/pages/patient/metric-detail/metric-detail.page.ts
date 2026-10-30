import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonInput, IonItem, IonLabel,
  IonChip, IonButtons, ToastController, IonText, IonCard, IonCardContent, IonIcon, ModalController, AlertController, IonModal,
  IonTextarea
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  pulse, water, heart, thermometer, bandage, scale, timeOutline, arrowBack, arrowForward,
  addCircle, time, calendarOutline, checkmarkCircle, pricetagOutline, barChart,
  createOutline, trash, documentTextOutline
} from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth.service';
import { ObservationService, MetricType, Observation } from '../../../core/observation.service';
import { LineChartComponent } from '../../../shared/components/line-chart/line-chart.component';
import { DatePickerModalComponent } from '../../../shared/components/date-picker-modal/date-picker-modal.component';
import { I18nService } from '../../../core/i18n.service';
import { DateFormatService } from '../../../core/date-format.service';
import { MetricFormatService } from '../../../core/metric-format.service';
import { ObservationChanges } from '../../../core/observation.service';
import { isOutOfRange } from '../../../core/clinical';
import { BP_RANGES, canonicalUnit } from '../../../core/units';
import { SeverityBadgeComponent } from '../../../shared/components/severity-badge/severity-badge.component';

@Component({
  selector: 'app-metric-detail',
  templateUrl: './metric-detail.page.html',
  styleUrls: ['./metric-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonInput, IonItem, IonLabel,
    IonChip, IonButtons, IonText, IonCard, IonCardContent, IonIcon, IonModal, IonTextarea, TranslateModule, LineChartComponent,
    SeverityBadgeComponent
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
  numericValue: number | null = null; // in the user's display unit
  note = '';
  saving = false;
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
    private translate: TranslateService,
    private dateFormatService: DateFormatService,
    public format: MetricFormatService
  ) {
    addIcons({ 
      pulse, water, heart, thermometer, bandage, scale, timeOutline, arrowBack, arrowForward,
      addCircle, time, calendarOutline, checkmarkCircle, pricetagOutline, barChart,
      createOutline, trash, documentTextOutline
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

    // Opened from "Edit" on the home screen
    const editId = this.route.snapshot.queryParamMap.get('editId');
    const toEdit = editId ? this.observations.find(o => o.id === editId) : undefined;
    if (toEdit) {
      this.selectedRecord = toEdit;
      await this.editRecord();
    }
  }

  get inputRange(): { min: number; max: number; step: number } {
    return this.metric === 'bp' ? { min: 0, max: 0, step: 1 } : this.format.inputRange(this.metric);
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
      return this.format.toDisplay(this.metric, Number(o.numeric_value) || 0);
    });
    this.chartLabels = chartObs.map(o => {
      return this.dateFormatService.formatDateSync(o.ts);
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
    if (!user || this.saving) return;

    if (new Date(this.selectedDateTime) > new Date()) {
      return this.showToast('METRICS.DATE_FUTURE_ERROR', 'danger');
    }

    const changes: ObservationChanges = {
      ts: this.selectedDateTime,
      tags: this.selectedTags,
      note: this.note.trim() || null,
      unit: canonicalUnit(this.metric),
    };

    if (this.metric === 'bp') {
      if (!this.systolic || !this.diastolic) {
        return this.showToast('METRICS.ENTER_BP_VALUES', 'danger');
      }
      if (this.systolic < BP_RANGES.systolic.min || this.systolic > BP_RANGES.systolic.max) {
        return this.showToast('METRICS.BP_SYSTOLIC_RANGE_ERROR', 'danger', BP_RANGES.systolic);
      }
      if (this.diastolic < BP_RANGES.diastolic.min || this.diastolic > BP_RANGES.diastolic.max) {
        return this.showToast('METRICS.BP_DIASTOLIC_RANGE_ERROR', 'danger', BP_RANGES.diastolic);
      }
      if (this.systolic <= this.diastolic) {
        return this.showToast('METRICS.BP_RATIO_ERROR', 'danger');
      }
      changes.systolic = this.systolic;
      changes.diastolic = this.diastolic;
      if (this.pulse) {
        changes.context = { pulse: this.pulse };
      }
    } else {
      if (this.numericValue === null || this.numericValue === undefined || isNaN(Number(this.numericValue))) {
        return this.showToast('METRICS.ENTER_VALUE_REQUIRED', 'danger');
      }
      const range = this.inputRange;
      const value = Number(this.numericValue);
      if (value < range.min || value > range.max) {
        return this.showToast('METRICS.VALUE_RANGE_ERROR', 'danger', {
          min: range.min, max: range.max, unit: this.format.unitLabel(this.metric),
        });
      }
      changes.numeric_value = this.format.fromDisplay(this.metric, value);
    }

    this.saving = true;
    let result: { error?: any; queued?: boolean };
    try {
      result = this.editingRecord?.id
        ? await this.observationService.updateObservation(this.editingRecord.id, changes)
        : await this.observationService.createObservation({ ...changes, user_id: user.id, metric: this.metric });
    } finally {
      this.saving = false;
    }

    if (result.error) {
      return this.showToast('METRICS.SAVE_ERROR', 'danger');
    }

    await this.showToast(result.queued ? 'METRICS.SAVED_OFFLINE' : 'METRICS.SAVE_SUCCESS', 'success');

    const saved = { metric: this.metric, ...changes };
    if (isOutOfRange(saved)) {
      await this.showReadingWarning(saved);
    }

    this.resetForm();
    this.showForm = false;
    await this.loadData();
  }

  /** Explains an out-of-range reading right after it is saved. */
  private async showReadingWarning(reading: ObservationChanges & { metric: MetricType }) {
    const classification = this.format.classify(reading);
    const alert = await this.alertController.create({
      header: this.format.severityLabel(classification),
      subHeader: this.format.formatValue(reading),
      message: this.format.severityAdvice(classification),
      cssClass: classification?.severity === 'critical' ? 'reading-alert-critical' : 'reading-alert',
      buttons: [this.translate.instant('COMMON.OK')],
    });
    await alert.present();
  }

  private async showToast(key: string, color: 'success' | 'danger', params?: object) {
    const toast = await this.toastController.create({
      message: this.translate.instant(key, params),
      duration: 2000,
      color,
    });
    await toast.present();
  }

  private resetForm() {
    this.systolic = null;
    this.diastolic = null;
    this.numericValue = null;
    this.note = '';
    this.selectedTags = [];
    this.selectedDateTime = new Date().toISOString();
    this.dateSelectionMode = 'right-now';
    this.editingRecord = null;
  }

  cancelEdit() {
    this.resetForm();
  }

  showAddForm() {
    this.showForm = true;
  }

  formatValue(obs: Observation): string {
    return this.format.formatValue(obs);
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
    return this.dateFormatService.formatDateTimeSync(dateString, {
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
    } else if (this.selectedRecord.numeric_value != null) {
      this.numericValue = this.format.toDisplay(this.metric, Number(this.selectedRecord.numeric_value));
    }

    this.note = this.selectedRecord.note || '';
    this.selectedTags = [...(this.selectedRecord.tags || [])];
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

