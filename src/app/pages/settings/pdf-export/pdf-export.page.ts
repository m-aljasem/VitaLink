import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import {
  IonContent, IonButton, ToastController, IonCard, IonCardContent, IonIcon,
  IonItem, IonLabel, IonCheckbox, IonToggle, IonDatetime, IonSpinner,
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { 
  arrowBack, documentText, pulse, water, pulseOutline, heart, medical, scale,
  calendarOutline, settingsOutline, download, chevronDown, chevronUp
} from 'ionicons/icons';
import { PdfExportService } from '../../../core/pdf-export.service';
import { MetricType } from '../../../core/observation.service';

@Component({
  selector: 'app-pdf-export',
  templateUrl: './pdf-export.page.html',
  styleUrls: ['./pdf-export.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonButton, IonCard, IonCardContent, IonIcon, TranslateModule,
    IonItem, IonLabel, IonCheckbox, IonToggle, IonDatetime, IonSpinner,
    IonModal, IonHeader, IonToolbar, IonTitle, IonButtons
  ],
})
export class PdfExportPage implements OnInit {
  // Metric selection
  metricsExpanded = true;
  pdfExportMetrics: { [key in MetricType]: boolean } = {
    bp: true,
    glucose: true,
    spo2: true,
    hr: true,
    pain: true,
    weight: true,
  };

  // Date range selection
  dateRangeMode: 'all' | 'specific' | null = null;
  pdfStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago
  pdfEndDate = new Date().toISOString().split('T')[0]; // Today
  pdfMaxDate = new Date().toISOString().split('T')[0]; // Today
  
  // Date picker modals
  showStartDatePicker = false;
  showEndDatePicker = false;
  tempStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  tempEndDate = new Date().toISOString().split('T')[0];

  // Export options
  pdfIncludeCharts = true;
  pdfIncludeSummary = true;
  pdfExporting = false;

  constructor(
    private router: Router,
    private location: Location,
    private pdfExportService: PdfExportService,
    private toastController: ToastController,
    private translate: TranslateService
  ) {
    addIcons({ 
      arrowBack, documentText, pulse, water, pulseOutline, heart, medical, scale,
      calendarOutline, settingsOutline, download, chevronDown, chevronUp
    });
  }

  goBack() {
    this.location.back();
  }

  async ngOnInit() {
    // Component initialization
  }

  toggleMetricsExpanded() {
    this.metricsExpanded = !this.metricsExpanded;
  }

  togglePdfMetric(metric: MetricType) {
    this.pdfExportMetrics[metric] = !this.pdfExportMetrics[metric];
  }

  selectAllData() {
    this.dateRangeMode = 'all';
  }

  selectSpecificDateRange() {
    this.dateRangeMode = 'specific';
  }

  openStartDatePicker() {
    this.tempStartDate = this.pdfStartDate;
    this.showStartDatePicker = true;
  }

  openEndDatePicker() {
    this.tempEndDate = this.pdfEndDate;
    this.showEndDatePicker = true;
  }

  confirmStartDate() {
    this.pdfStartDate = this.tempStartDate;
    this.showStartDatePicker = false;
  }

  confirmEndDate() {
    this.pdfEndDate = this.tempEndDate;
    this.showEndDatePicker = false;
  }

  cancelStartDatePicker() {
    this.showStartDatePicker = false;
  }

  cancelEndDatePicker() {
    this.showEndDatePicker = false;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  getMetricName(metric: MetricType): string {
    const names: { [key in MetricType]: string } = {
      bp: 'Blood Pressure',
      glucose: 'Glucose',
      spo2: 'SpO₂',
      hr: 'Heart Rate',
      pain: 'Pain',
      weight: 'Weight',
    };
    return names[metric] || metric;
  }

  getMetricIcon(metric: MetricType): string {
    const icons: { [key in MetricType]: string } = {
      bp: 'pulse',
      glucose: 'water',
      spo2: 'pulse-outline',
      hr: 'heart',
      pain: 'medical',
      weight: 'scale',
    };
    return icons[metric] || 'pulse';
  }

  getMetricColor(metric: MetricType): string {
    const colors: { [key in MetricType]: string } = {
      bp: '#EF4444',
      glucose: '#F59E0B',
      spo2: '#3B82F6',
      hr: '#10B981',
      pain: '#8B5CF6',
      weight: '#6366F1',
    };
    return colors[metric] || '#667eea';
  }

  async generatePdf() {
    const selectedMetrics = Object.entries(this.pdfExportMetrics)
      .filter(([_, selected]) => selected)
      .map(([metric, _]) => metric as MetricType);

    if (selectedMetrics.length === 0) {
      const toast = await this.toastController.create({
        message: this.translate.instant('CONNECT.SELECT_AT_LEAST_ONE_METRIC') || 'Please select at least one metric',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
      return;
    }

    if (!this.dateRangeMode) {
      const toast = await this.toastController.create({
        message: this.translate.instant('PDF_EXPORT.SELECT_DATE_RANGE') || 'Please select a date range option',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
      return;
    }

    let startDate: Date;
    let endDate: Date;

    if (this.dateRangeMode === 'all') {
      // Get all data - use a very early date as start
      startDate = new Date(0); // January 1, 1970
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Specific date range
      startDate = new Date(this.pdfStartDate);
      endDate = new Date(this.pdfEndDate);
      endDate.setHours(23, 59, 59, 999);

      if (startDate > endDate) {
        const toast = await this.toastController.create({
          message: this.translate.instant('CONNECT.INVALID_DATE_RANGE') || 'Start date must be before end date',
          duration: 2000,
          color: 'danger',
        });
        await toast.present();
        return;
      }
    }

    this.pdfExporting = true;
    try {
      await this.pdfExportService.generatePDF({
        metrics: selectedMetrics,
        startDate,
        endDate,
        includeCharts: this.pdfIncludeCharts,
        includeSummary: this.pdfIncludeSummary,
      });

      const toast = await this.toastController.create({
        message: this.translate.instant('CONNECT.PDF_EXPORT_SUCCESS') || 'PDF exported successfully!',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      this.goBack();
    } catch (error: any) {
      const toast = await this.toastController.create({
        message: error.message || this.translate.instant('CONNECT.PDF_EXPORT_ERROR') || 'Error generating PDF',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.pdfExporting = false;
    }
  }
}

