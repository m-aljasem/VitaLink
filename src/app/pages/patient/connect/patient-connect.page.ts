import { Component, OnInit } from '@angular/core';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons, IonItem, IonLabel,
  IonText, IonToggle, IonModal, IonCard, IonCardContent, IonIcon, ToastController, AlertController,
  IonDatetime, IonCheckbox, IonSpinner
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { 
  people, peopleOutline, shareSocial, addCircle, person, medical, timeOutline, 
  chevronForward, keypad, shareSocialOutline, pulse, water, pulseOutline, heart, scale,
  checkmarkCircle, medicalOutline, calendarOutline, trash, documentText, download, settingsOutline
} from 'ionicons/icons';
import { AuthService } from '../../../core/auth.service';
import { SharingService, ProviderLink } from '../../../core/sharing.service';
import { ProfileService } from '../../../core/profile.service';
import { SixDigitInputComponent } from '../../../shared/components/six-digit-input/six-digit-input.component';
import { PdfExportService } from '../../../core/pdf-export.service';
import { MetricType } from '../../../core/observation.service';

@Component({
  selector: 'app-patient-connect',
  templateUrl: './patient-connect.page.html',
  styleUrls: ['./patient-connect.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons, IonItem, IonLabel,
    IonText, IonToggle, IonModal, IonCard, IonCardContent, IonIcon, TranslateModule, SixDigitInputComponent,
    IonDatetime, IonCheckbox, IonSpinner
  ],
})
export class PatientConnectPage implements OnInit {
  providers: (ProviderLink & { providerProfile?: any })[] = [];
  loading = true;
  code = '';
  showCodeModal = false;
  selectedLink: ProviderLink | null = null;
  showProviderDetail = false;
  selectedProvider: (ProviderLink & { providerProfile?: any }) | null = null;
  
  // For new provider being added
  newProviderSharing: {
    share_bp: boolean;
    share_glucose: boolean;
    share_spo2: boolean;
    share_hr: boolean;
    share_pain: boolean;
    share_weight: boolean;
  } = {
    share_bp: false,
    share_glucose: false,
    share_spo2: false,
    share_hr: false,
    share_pain: false,
    share_weight: false,
  };

  // PDF Export
  showPdfExportModal = false;
  pdfExportMetrics: { [key in MetricType]: boolean } = {
    bp: true,
    glucose: true,
    spo2: true,
    hr: true,
    pain: true,
    weight: true,
  };
  pdfStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago
  pdfEndDate = new Date().toISOString().split('T')[0]; // Today
  pdfMaxDate = new Date().toISOString().split('T')[0]; // Today (for max date validation)
  pdfIncludeCharts = true;
  pdfIncludeSummary = true;
  pdfExporting = false;

  constructor(
    private authService: AuthService,
    private sharingService: SharingService,
    private profileService: ProfileService,
    private toastController: ToastController,
    private alertController: AlertController,
    private translate: TranslateService,
    private pdfExportService: PdfExportService
  ) {
    addIcons({ 
      people, peopleOutline, shareSocial, addCircle, person, medical, timeOutline, 
      chevronForward, keypad, shareSocialOutline, pulse, water, pulseOutline, heart, scale,
      checkmarkCircle, medicalOutline, calendarOutline, trash, documentText, download, settingsOutline
    });
  }

  async ngOnInit() {
    await this.loadProviders();
  }

  async loadProviders() {
    this.loading = true;
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        this.loading = false;
        return;
      }

      const { data: links } = await this.sharingService.getPatientLinks(user.id);
      if (links) {
        // Load provider profiles
        this.providers = await Promise.all(
          links.map(async (link) => {
            const { data: profile, error } = await this.profileService.getProfile(link.provider_id);
            if (error) {
              console.error('Error loading provider profile:', error);
            }
            return { ...link, providerProfile: profile || null };
          })
        );
      } else {
        this.providers = [];
      }
    } finally {
      this.loading = false;
    }
  }

  async shareViaOS() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'VitaLink Invitation',
          text: 'Join me on VitaLink to track my health data',
          url: window.location.origin,
        });
      } catch (err) {
        // User cancelled
      }
    }
  }

  showAddProviderModal() {
    this.code = '';
    this.showCodeModal = true;
  }

  async redeemCode() {
    if (this.code.length !== 6) {
      const toast = await this.toastController.create({
        message: this.translate.instant('CONNECT.INVALID_CODE'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) return;

    const { data: link, error } = await this.sharingService.redeemToken(this.code, user.id);
    
    if (error) {
      const toast = await this.toastController.create({
        message: error.message || this.translate.instant('CONNECT.CODE_INVALID_EXPIRED'),
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } else {
      // Update sharing settings if link was created
      if (link) {
        await this.sharingService.updateSharing(link.id, this.newProviderSharing);
      }
      this.showCodeModal = false;
      this.newProviderSharing = {
        share_bp: false,
        share_glucose: false,
        share_spo2: false,
        share_hr: false,
        share_pain: false,
        share_weight: false,
      };
      await this.loadProviders();
      const toast = await this.toastController.create({
        message: this.translate.instant('CONNECT.PROVIDER_ADDED_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    }
  }

  showProviderDetails(provider: ProviderLink & { providerProfile?: any }) {
    this.selectedProvider = provider;
    this.showProviderDetail = true;
  }

  async updateSharing(linkId: string, field: keyof ProviderLink, value: boolean) {
    const updates: any = { [field]: value };
    await this.sharingService.updateSharing(linkId, updates);
    await this.loadProviders();
  }

  async revokeAccess(link: ProviderLink) {
    const alert = await this.alertController.create({
      header: this.translate.instant('CONNECT.REVOKE_TITLE'),
      message: this.translate.instant('CONNECT.REVOKE_MESSAGE'),
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('CONNECT.REVOKE'),
          role: 'destructive',
          handler: async () => {
            await this.sharingService.revokeLink(link.id);
            await this.loadProviders();
          },
        },
      ],
    });

    await alert.present();
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  }

  showPdfExport() {
    this.showPdfExportModal = true;
  }

  togglePdfMetric(metric: MetricType) {
    this.pdfExportMetrics[metric] = !this.pdfExportMetrics[metric];
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

    const startDate = new Date(this.pdfStartDate);
    const endDate = new Date(this.pdfEndDate);
    endDate.setHours(23, 59, 59, 999); // End of day

    if (startDate > endDate) {
      const toast = await this.toastController.create({
        message: this.translate.instant('CONNECT.INVALID_DATE_RANGE') || 'Start date must be before end date',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
      return;
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
      this.showPdfExportModal = false;
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
}

