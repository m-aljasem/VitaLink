import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonInput, IonItem, IonLabel,
  IonSelect, IonSelectOption, IonChip, IonSpinner
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AuthService, Profile } from '../../core/auth.service';
import { ProfileService } from '../../core/profile.service';
import { ObservationService } from '../../core/observation.service';
import { I18nService } from '../../core/i18n.service';

type OnboardingStep = 'role' | 'language' | 'profile' | 'conditions' | 'initial-metrics';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonInput, IonItem, IonLabel,
    IonSelect, IonSelectOption, IonChip, IonSpinner, TranslateModule
  ],
})
export class OnboardingPage implements OnInit {
  currentStep: OnboardingStep = 'role';
  loading = false;

  // Role step
  role: 'patient' | 'provider' | null = null;

  // Language step
  language = 'en';

  // Profile step
  firstName = '';
  lastName = '';
  age: number | null = null;
  gender: 'male' | 'female' | null = null;
  country = '';
  city = '';

  // Provider step
  providerKind: 'doctor' | 'nurse' | 'family' | 'friend' | 'caregiver' | null = null;
  hospital = '';

  // Conditions step
  conditions: string[] = [];
  availableConditions = [
    'Hypertension', 'Diabetes', 'Heart Problems', 'Stress', 'Headache',
    'Back Pain', 'Obesity', 'Depression', 'Respiratory Issues'
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
    private i18nService: I18nService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.user = this.authService.getCurrentUser();
    if (!this.user) {
      this.router.navigate(['/auth']);
    }
  }

  nextStep() {
    if (this.currentStep === 'role') {
      this.currentStep = 'language';
    } else if (this.currentStep === 'language') {
      this.i18nService.setLanguage(this.language as any);
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

    this.loading = true;

    // Create profile
    const profileData: Partial<Profile> = {
      id: this.user.id,
      email: this.user.email || '',
      role: this.role!,
      language: this.language,
      first_name: this.firstName,
      last_name: this.lastName,
      age: this.age || undefined,
      gender: this.gender || undefined,
      country: this.country || undefined,
      city: this.city || undefined,
      provider_kind: this.providerKind || undefined,
      hospital: this.hospital || undefined,
      conditions: this.role === 'patient' ? this.conditions : undefined,
      height_cm: this.height || undefined,
    };

    await this.profileService.createProfile(profileData);

    // Save initial observations
    if (this.systolic && this.diastolic) {
      await this.observationService.createObservation({
        user_id: this.user.id,
        metric: 'bp',
        ts: new Date().toISOString(),
        systolic: this.systolic,
        diastolic: this.diastolic,
      });
    }

    if (this.weight) {
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

  skip() {
    if (this.currentStep === 'initial-metrics') {
      this.completeOnboarding();
    } else {
      this.nextStep();
    }
  }
}

