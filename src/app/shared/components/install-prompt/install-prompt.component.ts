import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonIcon, IonCard, IonCardContent, IonText } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { downloadOutline, closeOutline } from 'ionicons/icons';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Component({
  selector: 'app-install-prompt',
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon, IonCard, IonCardContent, IonText],
  template: `
    <div *ngIf="showPrompt" class="install-prompt-overlay">
      <ion-card class="install-prompt-card">
        <ion-card-content>
          <div class="install-prompt-content">
            <h3>Install VitaLink</h3>
            <ion-text>
              <p>Install VitaLink as an app for a better experience!</p>
            </ion-text>
            <div class="install-prompt-actions">
              <ion-button (click)="installApp()" expand="block">
                <ion-icon name="download-outline" slot="start"></ion-icon>
                Install
              </ion-button>
              <ion-button (click)="dismissPrompt()" fill="clear" expand="block">
                <ion-icon name="close-outline" slot="start"></ion-icon>
                Not now
              </ion-button>
            </div>
          </div>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [`
    .install-prompt-overlay {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10001;
      display: flex;
      align-items: flex-end;
      padding: 1rem;
      animation: slideUp 0.3s ease-out;
    }

    .install-prompt-card {
      width: 100%;
      max-width: 500px;
      margin: 0 auto;
      border-radius: 16px 16px 0 0;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
    }

    .install-prompt-content {
      text-align: center;
      padding: 1rem 0;
    }

    .install-prompt-content h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--ion-color-dark);
    }

    .install-prompt-content p {
      margin: 0 0 1.5rem 0;
      color: var(--ion-color-medium);
      font-size: 0.9rem;
    }

    .install-prompt-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    @keyframes slideUp {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `]
})
export class InstallPromptComponent implements OnInit, OnDestroy {
  showPrompt = false;
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private dismissedKey = 'pwa-install-dismissed';

  constructor() {
    addIcons({ 'download-outline': downloadOutline, 'close-outline': closeOutline });
  }

  ngOnInit() {
    // Check if user has already dismissed the prompt
    const dismissed = localStorage.getItem(this.dismissedKey);
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt.bind(this));
    
    // Check if app is already installed
    if (this.isInstalled()) {
      return;
    }
  }

  ngOnDestroy() {
    window.removeEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt.bind(this));
  }

  private handleBeforeInstallPrompt(e: Event) {
    // Prevent the default browser install prompt
    e.preventDefault();
    // Store the event for later use
    this.deferredPrompt = e as BeforeInstallPromptEvent;
    // Show our custom prompt
    this.showPrompt = true;
  }

  async installApp() {
    if (!this.deferredPrompt) {
      return;
    }

    // Show the install prompt
    await this.deferredPrompt.prompt();
    
    // Wait for the user to respond
    const { outcome } = await this.deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferred prompt
    this.deferredPrompt = null;
    this.showPrompt = false;
  }

  dismissPrompt() {
    this.showPrompt = false;
    // Remember that user dismissed (for 7 days)
    localStorage.setItem(this.dismissedKey, Date.now().toString());
  }

  private isInstalled(): boolean {
    // Check if running in standalone mode (installed)
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }
}

