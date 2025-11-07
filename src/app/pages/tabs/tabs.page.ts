import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { home, people, settings } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { AuthService, Profile } from '../../core/auth.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, TranslateModule],
})
export class TabsPage implements OnInit {
  profile: Profile | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({ home, people, settings });
  }

  async ngOnInit() {
    this.profile = await this.authService.getCurrentProfile();
    
    if (!this.profile) {
      this.router.navigate(['/onboarding']);
      return;
    }
  }
}

