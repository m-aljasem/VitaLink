import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonItem, IonLabel,
  IonSelect, IonSelectOption, ToastController
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, Profile } from '../../../core/auth.service';
import { ProfileService } from '../../../core/profile.service';

@Component({
  selector: 'app-mode-switch',
  templateUrl: './mode-switch.page.html',
  styleUrls: ['./mode-switch.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonItem, IonLabel,
    IonSelect, IonSelectOption, TranslateModule
  ],
})
export class ModeSwitchPage implements OnInit {
  profile: Profile | null = null;
  currentRole: 'patient' | 'provider' = 'patient';

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private router: Router,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    this.profile = await this.authService.getCurrentProfile();
    if (this.profile) {
      this.currentRole = this.profile.role;
    }
  }

  async switchRole() {
    if (!this.profile) return;

    const { error } = await this.profileService.updateProfile(this.profile.id, {
      role: this.currentRole,
    });

    if (error) {
      const toast = await this.toastController.create({
        message: 'Failed to switch role',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } else {
      await this.authService.loadProfile(this.profile.id);
      const toast = await this.toastController.create({
        message: 'Role switched successfully',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      this.router.navigate(['/tabs/home']);
    }
  }
}

