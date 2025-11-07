import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonButton, IonInput, IonItem, IonLabel,
  IonSelect, IonSelectOption, IonChip, ToastController, IonCard, IonCardContent, IonIcon
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { person, personOutline, locationOutline, medicalOutline, checkmarkCircle, arrowBack } from 'ionicons/icons';
import { AuthService, Profile } from '../../../core/auth.service';
import { ProfileService } from '../../../core/profile.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonButton, IonInput, IonItem, IonLabel,
    IonSelect, IonSelectOption, IonChip, IonCard, IonCardContent, IonIcon, TranslateModule
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
    private toastController: ToastController,
    private translate: TranslateService
  ) {
    addIcons({ person, personOutline, locationOutline, medicalOutline, checkmarkCircle, arrowBack });
  }

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

  goBack() {
    this.router.navigate(['/tabs/settings']);
  }

  async save() {
    if (!this.profile) return;

    const { error } = await this.profileService.updateProfile(this.profile.id, this.editedProfile);

    if (error) {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.UPDATE_PROFILE_ERROR'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } else {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.UPDATE_PROFILE_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      await this.authService.loadProfile(this.profile.id);
      this.router.navigate(['/tabs/settings'], { replaceUrl: true });
    }
  }
}

