import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonButton, IonPopover, IonList, IonItem, IonLabel, IonContent, IonText } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { shareOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/auth.service';
import { SharingService, ProviderLink } from '../../../core/sharing.service';
import { ProfileService } from '../../../core/profile.service';

@Component({
  selector: 'app-sharing-dot',
  templateUrl: './sharing-dot.component.html',
  styleUrls: ['./sharing-dot.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, IonButton, IonPopover, IonList, IonItem, IonLabel, IonContent, IonText, TranslateModule],
})
export class SharingDotComponent implements OnInit {
  providers: (ProviderLink & { providerProfile?: any })[] = [];
  showPopover = false;

  constructor(
    private authService: AuthService,
    private sharingService: SharingService,
    private profileService: ProfileService
  ) {
    addIcons({ shareOutline });
  }

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const profile = await this.authService.getCurrentProfile();
    if (profile?.role === 'patient') {
      await this.loadProviders();
    }
  }

  async loadProviders() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const { data: links } = await this.sharingService.getPatientLinks(user.id);
    if (links) {
      this.providers = await Promise.all(
        links.map(async (link) => {
          const { data: profile } = await this.profileService.getProfile(link.provider_id);
          return { ...link, providerProfile: profile };
        })
      );
    }
  }

  getSharedMetricsCount(link: ProviderLink): number {
    let count = 0;
    if (link.share_bp) count++;
    if (link.share_glucose) count++;
    if (link.share_spo2) count++;
    if (link.share_hr) count++;
    if (link.share_pain) count++;
    if (link.share_weight) count++;
    return count;
  }
}

