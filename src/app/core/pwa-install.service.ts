import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({
  providedIn: 'root'
})
export class PwaInstallService {
  private deferredPromptSubject = new BehaviorSubject<BeforeInstallPromptEvent | null>(null);
  public deferredPrompt$: Observable<BeforeInstallPromptEvent | null> = this.deferredPromptSubject.asObservable();

  constructor() {
    // First check if event was already captured by the script in index.html
    // This ensures we don't miss events that fire before Angular bootstraps
    if (typeof window !== 'undefined' && (window as any).__deferredPrompt) {
      const existingPrompt = (window as any).__deferredPrompt;
      this.deferredPromptSubject.next(existingPrompt);
    }
    
    // Also listen for future events (in case event fires after service initialization)
    this.initializeListener();
  }

  private initializeListener(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Listen for the beforeinstallprompt event
    // Note: The script in index.html may have already captured it, but we listen here too
    // in case the event fires after Angular bootstraps
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Prevent the default browser install prompt
      e.preventDefault();
      
      // Store the event
      const promptEvent = e as BeforeInstallPromptEvent;
      this.deferredPromptSubject.next(promptEvent);
      
      // Also store globally as backup (in case service is recreated)
      (window as any).__deferredPrompt = promptEvent;
    });
  }

  getDeferredPrompt(): BeforeInstallPromptEvent | null {
    return this.deferredPromptSubject.value;
  }

  clearDeferredPrompt(): void {
    this.deferredPromptSubject.next(null);
    if (typeof window !== 'undefined') {
      (window as any).__deferredPrompt = null;
    }
  }
}

