import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  IonContent, IonButton, IonCard, IonCardContent,
  IonText, ToastController, AlertController, IonIcon, IonSpinner
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { qrCode, share, people, peopleOutline, person, timeOutline, closeCircle, copy, checkmark } from 'ionicons/icons';
import { AuthService } from '../../../core/auth.service';
import { SharingService, ProviderLink, LinkToken } from '../../../core/sharing.service';
import { ProfileService } from '../../../core/profile.service';
import { getSupabaseClient } from '../../../core/supabase.client';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  codeCopied = false;
  tokenSubscription: RealtimeChannel | null = null;
  tokenCardFading = false;
  tokenPollingInterval: any = null;

  constructor(
    private authService: AuthService,
    private sharingService: SharingService,
    private profileService: ProfileService,
    private toastController: ToastController,
    private alertController: AlertController,
    private translate: TranslateService
  ) {
    addIcons({ qrCode, share, people, peopleOutline, person, timeOutline, closeCircle, copy, checkmark });
  }

  async ngOnInit() {
    await this.loadPatients();
  }

  ngOnDestroy() {
    if (this.tokenExpiryTimer) {
      clearInterval(this.tokenExpiryTimer);
    }
    if (this.tokenSubscription) {
      this.tokenSubscription.unsubscribe();
    }
    if (this.tokenPollingInterval) {
      clearInterval(this.tokenPollingInterval);
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
        console.log('Token generated, starting polling. Current patients:', this.patients.length);
        this.startExpiryTimer();
        this.subscribeToTokenChanges();
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
    if (this.tokenSubscription) {
      this.tokenSubscription.unsubscribe();
      this.tokenSubscription = null;
    }
    if (this.tokenPollingInterval) {
      clearInterval(this.tokenPollingInterval);
      this.tokenPollingInterval = null;
    }
    this.currentToken = null;
    this.timeRemaining = 0;
    this.tokenCardFading = false;
  }

  async copyCode(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    
    if (!this.currentToken) return;
    
    const code = this.currentToken.code;
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error('Fallback copy failed:', err);
        }
        
        document.body.removeChild(textArea);
      }
      
      this.codeCopied = true;
      const toast = await this.toastController.create({
        message: this.translate.instant('CONNECT.CODE_COPIED_TOAST'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      
      setTimeout(() => {
        this.codeCopied = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
      // Show error toast
      const toast = await this.toastController.create({
        message: 'Failed to copy code. Please try again.',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }

  subscribeToTokenChanges() {
    if (!this.currentToken) return;

    const supabase = getSupabaseClient();
    const user = this.authService.getCurrentUser();
    if (!user) return;
    
    // Subscribe to changes on the link_tokens table
    this.tokenSubscription = supabase
      .channel(`token-${this.currentToken.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'link_tokens',
          filter: `id=eq.${this.currentToken.id}`,
        },
        async (payload) => {
          const updatedToken = payload.new as LinkToken;
          if (updatedToken.used && !this.tokenCardFading) {
            await this.handleTokenRedeemed();
          }
        }
      )
      .subscribe();

    // Also subscribe to provider_links to detect when a new link is created
    supabase
      .channel(`provider-links-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'provider_links',
          filter: `provider_id=eq.${user.id}`,
        },
        async (payload) => {
          const newLink = payload.new as ProviderLink;
          // Check if this link was created using our current token
          if (this.currentToken && !this.tokenCardFading) {
            // Verify by checking if token was recently used
            const { data: token } = await supabase
              .from('link_tokens')
              .select('*')
              .eq('id', this.currentToken.id)
              .single();
            
            if (token?.used) {
              await this.handleTokenRedeemed(newLink.patient_id);
            }
          }
        }
      )
      .subscribe();

    // Add polling as a fallback (check every 2 seconds)
    this.startTokenPolling();
  }

  startTokenPolling() {
    if (this.tokenPollingInterval) {
      clearInterval(this.tokenPollingInterval);
    }

    if (!this.currentToken) {
      console.error('Cannot start polling: no current token');
      return;
    }

    // Store initial patient IDs to detect new additions
    const initialPatientIds = new Set(this.patients.map(p => p.patient_id));
    const tokenCreatedTime = this.currentToken ? new Date(this.currentToken.created_at).getTime() : Date.now();
    
    console.log('Starting token polling. Initial patient IDs:', Array.from(initialPatientIds));
    console.log('Token created at:', new Date(tokenCreatedTime).toISOString());

    this.tokenPollingInterval = setInterval(async () => {
      if (!this.currentToken || this.tokenCardFading) {
        return;
      }

      const supabase = getSupabaseClient();
      const user = this.authService.getCurrentUser();
      if (!user) return;

      try {
        // Check if token was used
        const { data: token, error: tokenError } = await supabase
          .from('link_tokens')
          .select('*')
          .eq('id', this.currentToken.id)
          .maybeSingle();

        if (tokenError) {
          console.error('Error checking token:', tokenError);
          return;
        }

        // Check for new patient links directly
        const { data: links, error: linksError } = await this.sharingService.getProviderLinks(user.id);
        
        if (linksError) {
          console.error('Error fetching links:', linksError);
          return;
        }

        if (links && links.length > 0) {
          // Find links created after the token was generated
          const newLinks = links.filter(link => {
            const linkTime = new Date(link.created_at).getTime();
            // Link was created after token was generated and within last 5 minutes
            return linkTime >= tokenCreatedTime && 
                   (Date.now() - linkTime) < 300000 && // Within last 5 minutes
                   !initialPatientIds.has(link.patient_id);
          });

          if (newLinks.length > 0) {
            // New link detected! Use the most recent one
            const recentLink = newLinks.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            console.log('New link detected!', recentLink);
            console.log('Token used status:', token?.used);

            // Verify token was used (double check)
            if (token?.used || recentLink) {
              console.log('Calling handleTokenRedeemed with patient ID:', recentLink.patient_id);
              await this.handleTokenRedeemed(recentLink.patient_id);
              if (this.tokenPollingInterval) {
                clearInterval(this.tokenPollingInterval);
                this.tokenPollingInterval = null;
              }
              return;
            }
          }
        }

        // Also check if token was used (even if we haven't detected the link yet)
        if (token?.used && !this.tokenCardFading) {
          // Token was used, but we haven't found the link yet
          // Wait a bit and check again, or try to find the most recent link
          const { data: allLinks } = await this.sharingService.getProviderLinks(user.id);
          if (allLinks && allLinks.length > 0) {
            const mostRecentLink = allLinks
              .sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )[0];
            
            const linkTime = new Date(mostRecentLink.created_at).getTime();
            if ((Date.now() - linkTime) < 300000) { // Within last 5 minutes
              await this.handleTokenRedeemed(mostRecentLink.patient_id);
              if (this.tokenPollingInterval) {
                clearInterval(this.tokenPollingInterval);
                this.tokenPollingInterval = null;
              }
            }
          }
        }
      } catch (err) {
        console.error('Error in token polling:', err);
      }
    }, 1500); // Poll every 1.5 seconds for faster detection
  }

  async handleTokenRedeemed(patientId?: string) {
    if (this.tokenCardFading) {
      console.log('Token already fading, ignoring duplicate call');
      return;
    }
    
    console.log('Token redeemed detected! Patient ID:', patientId);
    this.tokenCardFading = true;
    
    // Get patient name
    let patientName = 'Patient';
    if (patientId) {
      try {
        const { data: profile } = await this.profileService.getProfile(patientId);
        if (profile) {
          if (profile.first_name || profile.last_name) {
            patientName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
          } else {
            patientName = 'Patient';
          }
        }
      } catch (err) {
        console.error('Error loading patient profile:', err);
      }
    } else if (this.currentToken) {
      // If we don't have patientId, try to find it from the new link
      const user = this.authService.getCurrentUser();
      if (user) {
        try {
          const { data: links } = await this.sharingService.getProviderLinks(user.id);
          if (links && links.length > 0) {
            // Get the most recent link
            const recentLink = links.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];
            
            const { data: profile } = await this.profileService.getProfile(recentLink.patient_id);
            if (profile) {
              if (profile.first_name || profile.last_name) {
                patientName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
              }
            }
            // Update patientId for later use
            patientId = recentLink.patient_id;
          }
        } catch (err) {
          console.error('Error finding patient from links:', err);
        }
      }
    }

    console.log('Patient name resolved:', patientName);

    // Wait for fade animation
    await new Promise(resolve => setTimeout(resolve, 500));

    // Cancel token and reload patients
    this.cancelToken();
    await this.loadPatients();

    // Show success notification
    try {
      const toast = await this.toastController.create({
        message: `${patientName} ${this.translate.instant('CONNECT.PATIENT_ACCEPTED')}`,
        duration: 4000,
        color: 'success',
        position: 'top',
        icon: 'checkmark-circle',
      });
      await toast.present();
      console.log('Notification shown for:', patientName);
    } catch (err) {
      console.error('Error showing notification:', err);
    }
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
          title: this.translate.instant('CONNECT.CONNECTION_CODE'),
          text: `${this.translate.instant('CONNECT.ENTER_CODE')}: ${this.currentToken.code}`,
          url: window.location.origin,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      // Fallback: copy to clipboard
      await this.copyCode();
    }
  }

  getGeneratingText(): string {
    return this.translate.instant('CONNECT.GENERATING');
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

