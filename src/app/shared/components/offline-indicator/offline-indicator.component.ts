import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonText } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline } from 'ionicons/icons';
import { NetworkService } from '../../../core/network.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-offline-indicator',
  standalone: true,
  imports: [CommonModule, IonIcon, IonText],
  template: `
    <div *ngIf="!isOnline" class="offline-banner">
      <ion-icon name="cloud-offline-outline"></ion-icon>
      <ion-text>You're offline. Changes will sync when you're back online.</ion-text>
    </div>
  `,
  styles: [`
    .offline-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #f59e0b;
      color: white;
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .offline-banner ion-icon {
      font-size: 1.25rem;
    }

    .offline-banner ion-text {
      font-size: 0.875rem;
      font-weight: 500;
    }
  `]
})
export class OfflineIndicatorComponent implements OnInit, OnDestroy {
  isOnline = true;
  private subscription?: Subscription;

  constructor(private networkService: NetworkService) {
    addIcons({ 'cloud-offline-outline': cloudOfflineOutline });
  }

  ngOnInit() {
    this.isOnline = this.networkService.isOnline();
    this.subscription = this.networkService.getOnlineStatus().subscribe(
      status => this.isOnline = status
    );
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}

