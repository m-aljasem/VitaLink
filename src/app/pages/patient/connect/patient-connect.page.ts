import { Component, OnInit } from '@angular/core';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons, IonItem, IonLabel,
  IonList, IonText, IonToggle, IonModal, IonCard, IonCardContent, IonIcon, ToastController, AlertController
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { 
  people, peopleOutline, shareSocial, addCircle, person, medical, timeOutline, 
  chevronForward, keypad, shareSocialOutline, pulse, water, pulseOutline, heart, scale,
  checkmarkCircle, medicalOutline, calendarOutline, trash
} from 'ionicons/icons';
import { AuthService } from '../../../core/auth.service';
import { SharingService, ProviderLink } from '../../../core/sharing.service';
import { ProfileService } from '../../../core/profile.service';
import { SixDigitInputComponent } from '../../../shared/components/six-digit-input/six-digit-input.component';

@Component({
  selector: 'app-patient-connect',
  templateUrl: './patient-connect.page.html',
  styleUrls: ['./patient-connect.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons, IonItem, IonLabel,
    IonList, IonText, IonToggle, IonModal, IonCard, IonCardContent, IonIcon, TranslateModule, SixDigitInputComponent
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

  constructor(
    private authService: AuthService,
    private sharingService: SharingService,
    private profileService: ProfileService,
    private toastController: ToastController,
    private alertController: AlertController
  ) {
    addIcons({ 
      people, peopleOutline, shareSocial, addCircle, person, medical, timeOutline, 
      chevronForward, keypad, shareSocialOutline, pulse, water, pulseOutline, heart, scale,
      checkmarkCircle, medicalOutline, calendarOutline, trash
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
        message: 'Please enter a 6-digit code',
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
        message: error.message || 'Invalid or expired code',
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
        message: 'Provider added successfully',
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
      header: 'Revoke Access',
      message: 'Are you sure you want to revoke access for this provider?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Revoke',
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
}

