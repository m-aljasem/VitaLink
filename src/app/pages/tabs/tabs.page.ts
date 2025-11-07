import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { pulse, link, settings } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { AuthService, Profile } from '../../core/auth.service';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, TranslateModule],
})
export class TabsPage implements OnInit, OnDestroy {
  profile: Profile | null = null;
  private profileSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({ pulse, link, settings });
  }

  async ngOnInit() {
    this.profile = await this.authService.getCurrentProfile();
    
    if (!this.profile) {
      this.router.navigate(['/onboarding']);
      return;
    }

    // Subscribe to profile changes
    this.profileSubscription = this.authService.getProfileObservable().subscribe(profile => {
      this.profile = profile;
    });
  }

  ngOnDestroy() {
    if (this.profileSubscription) {
      this.profileSubscription.unsubscribe();
    }
  }
}

