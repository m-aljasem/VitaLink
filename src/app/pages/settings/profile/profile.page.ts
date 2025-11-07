import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonInput, IonItem, IonLabel,
  IonSelect, IonSelectOption, IonChip, ToastController
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AuthService, Profile } from '../../../core/auth.service';
import { ProfileService } from '../../../core/profile.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonInput, IonItem, IonLabel,
    IonSelect, IonSelectOption, IonChip, TranslateModule
  ],
})
export class ProfilePage implements OnInit {
  profile: Profile | null = null;
  editedProfile: Partial<Profile> = {};

  availableConditions = [
    'Hypertension', 'Diabetes', 'Heart Problems', 'Stress', 'Headache',
    'Back Pain', 'Obesity', 'Depression', 'Respiratory Issues'
  ];

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private router: Router,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    this.profile = await this.authService.getCurrentProfile();
    if (this.profile) {
      this.editedProfile = { ...this.profile };
    }
  }

  toggleCondition(condition: string) {
    const conditions = this.editedProfile.conditions || [];
    const index = conditions.indexOf(condition);
    if (index > -1) {
      conditions.splice(index, 1);
    } else {
      conditions.push(condition);
    }
    this.editedProfile.conditions = conditions;
  }

  async save() {
    if (!this.profile) return;

    const { error } = await this.profileService.updateProfile(this.profile.id, this.editedProfile);

    if (error) {
      const toast = await this.toastController.create({
        message: 'Failed to update profile',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } else {
      const toast = await this.toastController.create({
        message: 'Profile updated',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      await this.authService.loadProfile(this.profile.id);
      this.router.navigate(['/tabs/settings']);
    }
  }
}

