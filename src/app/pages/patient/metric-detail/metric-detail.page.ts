import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonInput, IonItem, IonLabel,
  IonDatetime, IonChip, IonList, IonBackButton, IonButtons, ToastController, IonText, ModalController
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth.service';
import { ObservationService, MetricType, Observation } from '../../../core/observation.service';
import { LineChartComponent } from '../../../shared/components/line-chart/line-chart.component';
import { DatePickerModalComponent } from '../../../shared/components/date-picker-modal/date-picker-modal.component';

@Component({
  selector: 'app-metric-detail',
  templateUrl: './metric-detail.page.html',
  styleUrls: ['./metric-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonInput, IonItem, IonLabel,
    IonDatetime, IonChip, IonList, IonBackButton, IonButtons, IonText, TranslateModule, LineChartComponent
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private observationService: ObservationService,
    private toastController: ToastController,
    private modalController: ModalController
  ) {}

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

    let observationData: Partial<Observation> = {
      user_id: user.id,
      metric: this.metric,
      ts: this.selectedDateTime,
      tags: this.selectedTags,
    };

    if (this.metric === 'bp') {
      if (!this.systolic || !this.diastolic) {
        const toast = await this.toastController.create({
          message: 'Please enter both systolic and diastolic values',
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
      if (!this.numericValue) {
        const toast = await this.toastController.create({
          message: 'Please enter a value',
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
        message: 'Failed to save',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } else {
      const toast = await this.toastController.create({
        message: 'Saved successfully',
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
    return new Date(dateString).toLocaleString();
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
      this.selectedDateTime = data.selectedDate;
      this.dateSelectionMode = 'custom';
    }
  }
}

