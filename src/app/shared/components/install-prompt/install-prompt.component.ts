import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonIcon, IonCard, IonCardContent, IonText } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { downloadOutline, closeOutline, phonePortraitOutline, flashOutline, notificationsOutline, homeOutline } from 'ionicons/icons';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Component({
  selector: 'app-install-prompt',
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon, IonCard, IonCardContent, IonText, TranslateModule],
  templateUrl: './install-prompt.component.html',
  styleUrls: ['./install-prompt.component.scss']
})
export class InstallPromptComponent implements OnInit, OnDestroy {
  showPrompt = false;
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private dismissedKey = 'pwa-install-dismissed';

  constructor(private translate: TranslateService) {
    addIcons({ 
      'download-outline': downloadOutline, 
      'close-outline': closeOutline,
      'phone-portrait-outline': phonePortraitOutline,
      'flash-outline': flashOutline,
      'notifications-outline': notificationsOutline,
      'home-outline': homeOutline
    });
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
    // Show our custom prompt with a slight delay for better UX
    setTimeout(() => {
      this.showPrompt = true;
    }, 2000);
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
