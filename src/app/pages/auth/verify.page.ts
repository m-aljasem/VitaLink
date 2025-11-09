import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonButton, IonSpinner, IonIcon, IonInput,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { lockClosed } from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { ProfileService } from '../../core/profile.service';

@Component({
  selector: 'app-verify',
  templateUrl: './verify.page.html',
  styleUrls: ['./verify.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonButton, IonSpinner, IonIcon, IonInput,
    TranslateModule
  ],
})
export class VerifyPage implements OnInit {
  email = '';
  code = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private router: Router,
    private route: ActivatedRoute,
    private toastController: ToastController,
    private translate: TranslateService
  ) {
    addIcons({ lockClosed });
  }

  ngOnInit() {
    const state = history.state;
    this.email = state['email'] || '';
    
    if (!this.email) {
      this.router.navigate(['/auth']);
    }
  }

  onCodeInput(event: any) {
    // Only allow numeric input
    const value = event.target.value.replace(/\D/g, '').slice(0, 6);
    this.code = value;
    
    // Update the input value to ensure it's synced
    if (event.target.value !== value) {
      event.target.value = value;
    }
    
    // Auto-verify when 6 digits are entered
    if (this.code.length === 6 && !this.loading) {
      setTimeout(() => this.verify(), 100);
    }
  }

  async verify() {
    if (this.code.length !== 6) {
      return;
    }

    this.loading = true;
    const { error, session } = await this.authService.verifyOTP(this.email, this.code);
    this.loading = false;

    if (error) {
      const toast = await this.toastController.create({
        message: error.message || this.translate.instant('AUTH.INVALID_CODE'),
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
      return;
    }

    if (session) {
      // Check if profile exists and is complete
      const profile = await this.authService.getCurrentProfile();
      if (!profile || !profile.role || !profile.first_name) {
        this.router.navigate(['/onboarding']);
      } else {
        // Check if user has taken tour (optional - can be skipped)
        this.router.navigate(['/tabs/home']);
      }
    }
  }

  async resendCode() {
    this.loading = true;
    const { error } = await this.authService.requestOTP(this.email);
    this.loading = false;

    if (error) {
      const toast = await this.toastController.create({
        message: error.message || this.translate.instant('AUTH.RESEND_CODE_ERROR'),
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } else {
      const toast = await this.toastController.create({
        message: this.translate.instant('AUTH.CODE_SENT_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    }
  }
}

