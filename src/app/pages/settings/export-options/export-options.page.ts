import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent, IonButton, ToastController, IonCard, IonCardContent, IonIcon
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { 
  arrowBack, download, documentText, medical, document, logoGoogle, logoApple, chevronForward
} from 'ionicons/icons';
import { ExportService } from '../../../core/export.service';

@Component({
  selector: 'app-export-options',
  templateUrl: './export-options.page.html',
  styleUrls: ['./export-options.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonButton, IonCard, IonCardContent, IonIcon, TranslateModule
  ],
})
export class ExportOptionsPage implements OnInit {
  exporting = false;

  constructor(
    private router: Router,
    private exportService: ExportService,
    private toastController: ToastController,
    private translate: TranslateService
  ) {
    addIcons({ 
      arrowBack, download, documentText, medical, document, 
      logoGoogle, logoApple, chevronForward
    });
  }

  goBack() {
    this.router.navigate(['/tabs/settings']);
  }

  async ngOnInit() {
    // Component initialization
  }

  async exportCSV() {
    if (this.exporting) return;
    
    this.exporting = true;
    const { error } = await this.exportService.exportToCSV();
    this.exporting = false;
    
    if (error) {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.EXPORT_ERROR'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } else {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.EXPORT_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    }
  }

  async exportFHIR() {
    if (this.exporting) return;
    
    this.exporting = true;
    const { error } = await this.exportService.exportToFHIR();
    this.exporting = false;
    
    if (error) {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.EXPORT_ERROR'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } else {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.EXPORT_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    }
  }

  exportPDF() {
    this.router.navigate(['/tabs/settings/pdf-export']);
  }

  async connectGoogleFit() {
    const toast = await this.toastController.create({
      message: this.translate.instant('SETTINGS.GOOGLE_FIT_COMING_SOON'),
      duration: 3000,
      color: 'primary',
    });
    await toast.present();
    // TODO: Implement Google Fit integration
  }

  async connectAppleHealth() {
    const toast = await this.toastController.create({
      message: this.translate.instant('SETTINGS.APPLE_HEALTH_COMING_SOON'),
      duration: 3000,
      color: 'primary',
    });
    await toast.present();
    // TODO: Implement Apple Health integration
  }
}

