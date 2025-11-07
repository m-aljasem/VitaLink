import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent, IonButton, ToastController, IonCard, IonCardContent, IonIcon
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { swapHorizontal, person, people, checkmarkCircle, arrowBack } from 'ionicons/icons';
import { AuthService, Profile } from '../../../core/auth.service';
import { ProfileService } from '../../../core/profile.service';

@Component({
  selector: 'app-mode-switch',
  templateUrl: './mode-switch.page.html',
  styleUrls: ['./mode-switch.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonButton, IonCard, IonCardContent, IonIcon, TranslateModule
  ],
})
export class ModeSwitchPage implements OnInit {
  profile: Profile | null = null;
  currentRole: 'patient' | 'provider' = 'patient';

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private router: Router,
    private toastController: ToastController,
    private translate: TranslateService
  ) {
    addIcons({ swapHorizontal, person, people, checkmarkCircle, arrowBack });
  }

  goBack() {
    this.router.navigate(['/tabs/settings']);
  }

  async ngOnInit() {
    this.profile = await this.authService.getCurrentProfile();
    if (this.profile) {
      this.currentRole = this.profile.role;
    }
  }

  async switchRole() {
    if (!this.profile) return;

    // Don't do anything if role hasn't changed
    if (this.profile.role === this.currentRole) {
      return;
    }

    const { error } = await this.profileService.updateProfile(this.profile.id, {
      role: this.currentRole,
    });

    if (error) {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.SWITCH_ROLE_ERROR'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } else {
      // Reload the profile to get the updated role
      await this.authService.loadProfile(this.profile.id);
      
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.SWITCH_ROLE_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      
      // Navigate to the correct home page based on the new role
      const homeRoute = this.currentRole === 'provider' ? '/tabs/provider-home' : '/tabs/home';
      this.router.navigate([homeRoute], { replaceUrl: true });
    }
  }
}

