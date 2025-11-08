import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonButton, IonInput, IonItem, IonLabel,
  IonSelect, IonSelectOption, IonChip, IonSpinner, IonCard, IonCardContent, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { people, person, medical, pulse, male, female } from 'ionicons/icons';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AuthService, Profile } from '../../core/auth.service';
import { ProfileService } from '../../core/profile.service';
import { ObservationService } from '../../core/observation.service';
import { I18nService } from '../../core/i18n.service';
import { CountrySelectComponent, Country } from '@wlucha/ng-country-select';

type OnboardingStep = 'role' | 'profile' | 'conditions' | 'initial-metrics';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonButton, IonInput, IonItem, IonLabel,
    IonSelect, IonSelectOption, IonChip, IonSpinner, IonCard, IonCardContent, IonIcon, TranslateModule,
    CountrySelectComponent
  ],
})
export class OnboardingPage implements OnInit {
  currentStep: OnboardingStep = 'role';
  loading = false;

  // Role step
  role: 'patient' | 'provider' | null = null;

  // Profile step
  firstName = '';
  lastName = '';
  age: number | null = null;
  gender: 'male' | 'female' | null = null;
  country: Country | null = null;
  countryCode = ''; // Store alpha2 code for database
  city = '';

  // Provider step
  providerKind: 'doctor' | 'nurse' | 'family' | 'friend' | 'caregiver' | null = null;
  hospital = '';

  // Conditions step
  conditions: string[] = [];
  availableConditions = [
    'HYPERTENSION', 'DIABETES', 'HEART_PROBLEMS', 'STRESS', 'HEADACHE',
    'BACK_PAIN', 'OBESITY', 'DEPRESSION', 'RESPIRATORY_ISSUES'
  ];

  // Initial metrics
  height: number | null = null;
  weight: number | null = null;
  systolic: number | null = null;
  diastolic: number | null = null;

  private user: any;

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private observationService: ObservationService,
    public i18nService: I18nService,
    private router: Router
  ) {
    addIcons({ people, person, medical, pulse, male, female });
  }

  async ngOnInit() {
    this.user = this.authService.getCurrentUser();
    if (!this.user) {
      this.router.navigate(['/auth']);
      return;
    }

    // Check if onboarding is already complete - show only once
    const profile = await this.authService.getCurrentProfile();
    if (profile && profile.role && profile.first_name) {
      // Onboarding already complete, redirect to home
      this.router.navigate(['/tabs/home']);
      return;
    }

    // Load existing profile data to prefill form
    if (profile) {
      this.role = profile.role || null;
      this.firstName = profile.first_name || '';
      this.lastName = profile.last_name || '';
      this.age = profile.age || null;
      this.gender = profile.gender || null;
      this.countryCode = profile.country || '';
      // Set country by alpha2 code if exists
      if (this.countryCode) {
        // Will be set via selectedCountryByAlpha2 in template
      }
      this.city = profile.city || '';
      this.providerKind = profile.provider_kind || null;
      this.hospital = profile.hospital || '';
      this.conditions = profile.conditions || [];
      this.height = profile.height_cm || null;
      
      // Load latest observations to prefill initial metrics
      const latestWeight = await this.observationService.getLatestObservation(this.user.id, 'weight');
      if (latestWeight.data?.numeric_value) {
        this.weight = latestWeight.data.numeric_value;
      }
      
      const latestBP = await this.observationService.getLatestObservation(this.user.id, 'bp');
      if (latestBP.data) {
        this.systolic = latestBP.data.systolic || null;
        this.diastolic = latestBP.data.diastolic || null;
      }
      
      // If role is already set, skip role step
      if (this.role) {
        this.currentStep = 'profile';
      }
    }
  }

  nextStep() {
    if (this.currentStep === 'role') {
      this.currentStep = 'profile';
    } else if (this.currentStep === 'profile') {
      if (this.role === 'provider') {
        this.currentStep = 'conditions'; // Skip to provider details
      } else {
        this.currentStep = 'conditions';
      }
    } else if (this.currentStep === 'conditions') {
      this.currentStep = 'initial-metrics';
    } else if (this.currentStep === 'initial-metrics') {
      this.completeOnboarding();
    }
  }

  toggleCondition(condition: string) {
    const index = this.conditions.indexOf(condition);
    if (index > -1) {
      this.conditions.splice(index, 1);
    } else {
      this.conditions.push(condition);
    }
  }

  async completeOnboarding() {
    if (!this.user) return;

    // Validate height if provided
    if (this.height !== null && this.height !== undefined) {
      if (this.height < 50 || this.height > 250) {
        // Height validation error - but allow to continue (optional field)
        console.warn('Height out of range:', this.height);
      }
    }

    // Validate weight if provided
    if (this.weight !== null && this.weight !== undefined) {
      if (this.weight < 1 || this.weight > 500) {
        // Weight validation error - but allow to continue (optional field)
        console.warn('Weight out of range:', this.weight);
      }
    }

    // Validate BP if provided
    if (this.systolic !== null && this.systolic !== undefined) {
      if (this.systolic < 50 || this.systolic > 250) {
        // BP validation error - but allow to continue (optional field)
        console.warn('Systolic out of range:', this.systolic);
      }
    }

    if (this.diastolic !== null && this.diastolic !== undefined) {
      if (this.diastolic < 30 || this.diastolic > 150) {
        // BP validation error - but allow to continue (optional field)
        console.warn('Diastolic out of range:', this.diastolic);
      }
    }

    // Validate BP ratio if both provided
    if (this.systolic !== null && this.systolic !== undefined && 
        this.diastolic !== null && this.diastolic !== undefined) {
      if (this.systolic <= this.diastolic) {
        // BP ratio error - but allow to continue (optional field)
        console.warn('Systolic must be greater than diastolic');
      }
    }

    this.loading = true;

    // Check if profile already exists
    const existingProfile = await this.profileService.getProfile(this.user.id);
    
    // Prepare profile data
    const profileData: Partial<Profile> = {
      id: this.user.id,
      email: this.user.email || '',
      role: this.role!,
      language: this.i18nService.getCurrentLanguage(), // Use current language from i18n service
      first_name: this.firstName,
      last_name: this.lastName,
      age: this.age || undefined,
      gender: this.gender || undefined,
      country: this.countryCode || undefined,
      city: this.city || undefined,
      provider_kind: this.providerKind || undefined,
      hospital: this.hospital || undefined,
      conditions: this.role === 'patient' ? this.conditions : undefined,
      height_cm: this.height || undefined,
    };

    // Update existing profile or create new one
    if (existingProfile.data) {
      await this.profileService.updateProfile(this.user.id, profileData);
    } else {
      await this.profileService.createProfile(profileData);
    }

    // Save initial observations (only if values are valid)
    if (this.systolic !== null && this.systolic !== undefined && 
        this.diastolic !== null && this.diastolic !== undefined &&
        this.systolic >= 50 && this.systolic <= 250 &&
        this.diastolic >= 30 && this.diastolic <= 150 &&
        this.systolic > this.diastolic) {
      await this.observationService.createObservation({
        user_id: this.user.id,
        metric: 'bp',
        ts: new Date().toISOString(),
        systolic: this.systolic,
        diastolic: this.diastolic,
      });
    }

    if (this.weight !== null && this.weight !== undefined &&
        this.weight >= 1 && this.weight <= 500) {
      await this.observationService.createObservation({
        user_id: this.user.id,
        metric: 'weight',
        ts: new Date().toISOString(),
        numeric_value: this.weight,
        unit: 'kg',
      });
    }

    this.loading = false;
    this.router.navigate(['/tour']);
  }

  onCountrySelected(country: Country) {
    this.country = country;
    this.countryCode = country.alpha2;
  }

  selectGender(gender: 'male' | 'female') {
    this.gender = gender;
  }

  skip() {
    if (this.currentStep === 'initial-metrics') {
      this.completeOnboarding();
    } else {
      this.nextStep();
    }
  }
}

