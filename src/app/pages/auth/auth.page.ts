import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonInput, IonItem, IonLabel,
  IonSpinner, ToastController
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonInput, IonItem, IonLabel,
    IonSpinner, TranslateModule
  ],
})
export class AuthPage {
  email = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController
  ) {}

  async requestCode() {
    if (!this.email || !this.email.includes('@')) {
      const toast = await this.toastController.create({
        message: 'Please enter a valid email',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
      return;
    }

    this.loading = true;
    const { error } = await this.authService.requestOTP(this.email);
    this.loading = false;

    if (error) {
      const toast = await this.toastController.create({
        message: error.message || 'Failed to send code',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } else {
      this.router.navigate(['/auth/verify'], { state: { email: this.email } });
    }
  }
}

