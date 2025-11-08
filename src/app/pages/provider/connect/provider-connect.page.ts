import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  IonContent, IonButton, IonCard, IonCardContent,
  IonText, ToastController, AlertController, IonIcon, IonSpinner
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { qrCode, share, people, peopleOutline, person, timeOutline, closeCircle } from 'ionicons/icons';
import { AuthService } from '../../../core/auth.service';
import { SharingService, ProviderLink, LinkToken } from '../../../core/sharing.service';
import { ProfileService } from '../../../core/profile.service';

@Component({
  selector: 'app-provider-connect',
  templateUrl: './provider-connect.page.html',
  styleUrls: ['./provider-connect.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonButton, IonCard, IonCardContent,
    IonText, IonIcon, IonSpinner, TranslateModule
  ],
})
export class ProviderConnectPage implements OnInit, OnDestroy {
  patients: (ProviderLink & { patientProfile?: any })[] = [];
  currentToken: LinkToken | null = null;
  tokenExpiryTimer: any;
  timeRemaining = 0;
  loading = true;
  generatingCode = false;

  constructor(
    private authService: AuthService,
    private sharingService: SharingService,
    private profileService: ProfileService,
    private toastController: ToastController,
    private alertController: AlertController,
    private translate: TranslateService
  ) {
    addIcons({ qrCode, share, people, peopleOutline, person, timeOutline, closeCircle });
  }

  async ngOnInit() {
    await this.loadPatients();
  }

  ngOnDestroy() {
    if (this.tokenExpiryTimer) {
      clearInterval(this.tokenExpiryTimer);
    }
  }

  async loadPatients() {
    this.loading = true;
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.loading = false;
      return;
    }

    const { data: links } = await this.sharingService.getProviderLinks(user.id);
    if (links) {
      this.patients = await Promise.all(
        links.map(async (link) => {
          const { data: profile, error } = await this.profileService.getProfile(link.patient_id);
          if (error) {
            console.error('Error loading patient profile:', error);
          }
          return { ...link, patientProfile: profile || null };
        })
      );
    }
    this.loading = false;
  }

  async generateCode() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    this.generatingCode = true;
    
    try {
      const { data: token, error } = await this.sharingService.createToken(user.id);
      
      if (error) {
        const toast = await this.toastController.create({
          message: this.translate.instant('CONNECT.GENERATE_CODE_ERROR'),
          duration: 2000,
          color: 'danger',
        });
        await toast.present();
        return;
      }

      this.currentToken = token || null;
      if (this.currentToken) {
        this.startExpiryTimer();
      }
    } finally {
      this.generatingCode = false;
    }
  }

  cancelToken() {
    if (this.tokenExpiryTimer) {
      clearInterval(this.tokenExpiryTimer);
      this.tokenExpiryTimer = null;
    }
    this.currentToken = null;
    this.timeRemaining = 0;
  }

  startExpiryTimer() {
    if (this.tokenExpiryTimer) {
      clearInterval(this.tokenExpiryTimer);
    }

    this.tokenExpiryTimer = setInterval(() => {
      if (!this.currentToken) {
        clearInterval(this.tokenExpiryTimer);
        return;
      }

      const now = new Date().getTime();
      const expiry = new Date(this.currentToken.expires_at).getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));

      this.timeRemaining = remaining;

      if (remaining === 0) {
        this.currentToken = null;
        clearInterval(this.tokenExpiryTimer);
      }
    }, 1000);
  }

  formatTimeRemaining(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async shareViaOS() {
    if (!this.currentToken) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'VitaLink Connection Code',
          text: `Use this code to connect: ${this.currentToken.code}`,
          url: window.location.origin,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(this.currentToken.code);
      const toast = await this.toastController.create({
        message: this.translate.instant('CONNECT.CODE_COPIED'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    }
  }

  async removePatient(link: ProviderLink) {
    const alert = await this.alertController.create({
      header: this.translate.instant('CONNECT.PROVIDER_REMOVE_TITLE'),
      message: this.translate.instant('CONNECT.PROVIDER_REMOVE_MESSAGE'),
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('CONNECT.PROVIDER_REMOVE'),
          role: 'destructive',
          handler: async () => {
            await this.sharingService.revokeLink(link.id);
            await this.loadPatients();
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

