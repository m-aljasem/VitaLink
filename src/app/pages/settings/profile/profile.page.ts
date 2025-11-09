import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonButton, IonInput, IonItem, IonLabel,
  IonSelect, IonSelectOption, IonChip, ToastController, IonCard, IonCardContent, IonIcon, IonSpinner
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { person, personOutline, locationOutline, medicalOutline, checkmarkCircle, arrowBack, male, female } from 'ionicons/icons';
import { AuthService, Profile } from '../../../core/auth.service';
import { ProfileService } from '../../../core/profile.service';
import { I18nService } from '../../../core/i18n.service';
import { DateFormatService } from '../../../core/date-format.service';
import { CountrySelectComponent, Country } from '@wlucha/ng-country-select';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonButton, IonInput, IonItem, IonLabel,
    IonChip, IonCard, IonCardContent, IonIcon, IonSpinner, TranslateModule,
    CountrySelectComponent
  ],
})
export class ProfilePage implements OnInit {
  profile: Profile | null = null;
  editedProfile: Partial<Profile> = {};
  countryCode = ''; // Store alpha2 code for database

  availableConditions = [
    'HYPERTENSION', 'DIABETES', 'HEART_PROBLEMS', 'STRESS', 'HEADACHE',
    'BACK_PAIN', 'OBESITY', 'DEPRESSION', 'RESPIRATORY_ISSUES'
  ];

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private router: Router,
    private toastController: ToastController,
    private translate: TranslateService,
    public i18nService: I18nService,
    private dateFormatService: DateFormatService
  ) {
    addIcons({ person, personOutline, locationOutline, medicalOutline, checkmarkCircle, arrowBack, male, female });
  }

  async ngOnInit() {
    this.profile = await this.authService.getCurrentProfile();
    if (this.profile) {
      this.editedProfile = { ...this.profile };
      this.countryCode = this.profile.country || '';
    }
  }

  onCountrySelected(country: Country) {
    this.countryCode = country.alpha2;
    this.editedProfile.country = country.alpha2;
  }

  selectGender(gender: 'male' | 'female') {
    this.editedProfile.gender = gender;
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

  saving = false;

  async save() {
    if (!this.profile || this.saving) return;

    // Validate first name
    if (!this.editedProfile.first_name || this.editedProfile.first_name.trim().length === 0) {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.FIRST_NAME_REQUIRED') || 'First name is required',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
      return;
    }

    // Validate last name
    if (!this.editedProfile.last_name || this.editedProfile.last_name.trim().length === 0) {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.LAST_NAME_REQUIRED') || 'Last name is required',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
      return;
    }

    // Validate age if provided
    if (this.editedProfile.age !== null && this.editedProfile.age !== undefined) {
      if (this.editedProfile.age < 0 || this.editedProfile.age > 150 || !Number.isInteger(this.editedProfile.age)) {
        const toast = await this.toastController.create({
          message: this.translate.instant('SETTINGS.AGE_RANGE_ERROR') || 'Age must be between 0 and 150',
          duration: 2000,
          color: 'danger',
        });
        await toast.present();
        return;
      }
    }

    this.saving = true;

    try {
      const { error } = await this.profileService.updateProfile(this.profile.id, this.editedProfile);

      if (error) {
        const toast = await this.toastController.create({
          message: this.translate.instant('SETTINGS.UPDATE_PROFILE_ERROR') || 'Failed to update profile',
          duration: 2000,
          color: 'danger',
        });
        await toast.present();
      } else {
        const toast = await this.toastController.create({
          message: this.translate.instant('SETTINGS.UPDATE_PROFILE_SUCCESS') || 'Profile updated successfully',
          duration: 2000,
          color: 'success',
        });
        await toast.present();
        await this.authService.loadProfile(this.profile.id);
        // Clear date format cache so locale updates if country changed
        this.dateFormatService.clearCache();
        this.router.navigate(['/tabs/settings'], { replaceUrl: true });
      }
    } catch (error) {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.UPDATE_PROFILE_ERROR') || 'Failed to update profile',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.saving = false;
    }
  }
}

