import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons, IonItem, IonLabel,
  IonText, IonToggle, IonModal, IonCard, IonCardContent, IonIcon, IonInput, IonSpinner, ToastController, AlertController
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
import { DateFormatService } from '../../../core/date-format.service';
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
    IonText, IonToggle, IonModal, IonCard, IonCardContent, IonIcon, IonInput, IonSpinner, TranslateModule
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
  addingProvider = false;

  constructor(
    private authService: AuthService,
    private sharingService: SharingService,
    private profileService: ProfileService,
    private toastController: ToastController,
    private alertController: AlertController,
    private translate: TranslateService,
    private pdfExportService: PdfExportService,
    private router: Router,
    private dateFormatService: DateFormatService
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

  onCodeInput(event: any) {
    // Only allow numeric input
    const value = event.target.value.replace(/\D/g, '').slice(0, 6);
    this.code = value;
    
    // Update the input value to ensure it's synced
    if (event.target.value !== value) {
      event.target.value = value;
    }
  }

  async redeemCode() {
    if (this.code.length !== 6) {
      const alert = await this.alertController.create({
        header: this.translate.instant('CONNECT.ERROR_TITLE') || 'Error',
        message: this.translate.instant('CONNECT.INVALID_CODE_LENGTH') || 'Please enter a valid 6-digit code.',
        buttons: [this.translate.instant('COMMON.OK') || 'OK'],
      });
      await alert.present();
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) return;

    this.addingProvider = true;

    try {
      const { data: link, error } = await this.sharingService.redeemToken(this.code, user.id);
      
      if (error) {
        // Determine error type
        let errorMessage = '';
        const errorCode = error.code || '';
        const errorMsg = error.message || '';

        // Check for specific error types
        if (errorCode === 'PGRST116' || errorMsg.includes('No rows') || errorMsg.includes('not found')) {
          // Code not found
          errorMessage = this.translate.instant('CONNECT.CODE_INCORRECT') || 'The 6-digit code you entered is incorrect. Please check and try again.';
        } else if (errorMsg.includes('expired') || errorMsg.includes('Invalid or expired')) {
          // OTP timeout
          errorMessage = this.translate.instant('CONNECT.CODE_EXPIRED') || 'The code has expired. Please ask your provider for a new code.';
        } else if (errorCode === 'PGRST301' || errorMsg.includes('network') || errorMsg.includes('fetch')) {
          // Network/server error
          errorMessage = this.translate.instant('CONNECT.SERVER_ERROR') || 'Unable to connect to the server. Please check your internet connection and try again.';
        } else {
          // Generic error
          errorMessage = errorMsg || this.translate.instant('CONNECT.CODE_INVALID_EXPIRED') || 'An error occurred while adding the provider. Please try again.';
        }

        const alert = await this.alertController.create({
          header: this.translate.instant('CONNECT.ERROR_TITLE') || 'Error',
          message: errorMessage,
          buttons: [this.translate.instant('COMMON.OK') || 'OK'],
        });
        await alert.present();
      } else {
        // Success - get provider profile to show name
        let providerName = 'Provider';
        if (link) {
          await this.sharingService.updateSharing(link.id, this.newProviderSharing);
          
          // Load provider profile to get name
          const { data: profile } = await this.profileService.getProfile(link.provider_id);
          if (profile) {
            if (profile.first_name || profile.last_name) {
              providerName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
            } else {
              providerName = profile.provider_kind || 'Provider';
            }
          }
        }

        // Reset form
        this.showCodeModal = false;
        this.code = '';
        this.newProviderSharing = {
          share_bp: false,
          share_glucose: false,
          share_spo2: false,
          share_hr: false,
          share_pain: false,
          share_weight: false,
        };
        
        // Reload providers list
        await this.loadProviders();

        // Show success alert with provider name
        const alert = await this.alertController.create({
          header: this.translate.instant('CONNECT.SUCCESS_TITLE') || 'Success',
          message: `${providerName} ${this.translate.instant('CONNECT.ADDED_SUCCESSFULLY') || 'added successfully!'}`,
          buttons: [this.translate.instant('COMMON.OK') || 'OK'],
        });
        await alert.present();
      }
    } catch (err: any) {
      // Catch any unexpected errors
      const alert = await this.alertController.create({
        header: this.translate.instant('CONNECT.ERROR_TITLE') || 'Error',
        message: this.translate.instant('CONNECT.SERVER_ERROR') || 'An unexpected error occurred. Please try again later.',
        buttons: [this.translate.instant('COMMON.OK') || 'OK'],
      });
      await alert.present();
    } finally {
      this.addingProvider = false;
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
    return this.dateFormatService.formatDateSync(dateString);
  }

  showPdfExport() {
    this.router.navigate(['/tabs/settings/pdf-export']);
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

  getAddingProviderText(): string {
    const translated = this.translate.instant('CONNECT.ADDING_PROVIDER');
    return translated !== 'CONNECT.ADDING_PROVIDER' ? translated : 'Adding Provider...';
  }
}

