import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { 
  IonContent, IonButton, IonSpinner, IonIcon,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { lockClosed } from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { ProfileService } from '../../core/profile.service';
import { SixDigitInputComponent } from '../../shared/components/six-digit-input/six-digit-input.component';

@Component({
  selector: 'app-verify',
  templateUrl: './verify.page.html',
  styleUrls: ['./verify.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonButton, IonSpinner, IonIcon,
    TranslateModule, SixDigitInputComponent
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

  async onCodeComplete(code: string) {
    this.code = code;
    await this.verify();
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

