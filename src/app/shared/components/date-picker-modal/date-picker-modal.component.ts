import { Component, Input } from '@angular/core';
import { IonDatetime, IonButton, IonButtons, IonHeader, IonToolbar, IonTitle, IonContent, ModalController } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-date-picker-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Choose Date & Time</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-datetime 
        [(ngModel)]="selectedDate"
        presentation="date-time"
        [max]="maxDate"
        [showDefaultButtons]="true"
      ></ion-datetime>
      <ion-button expand="block" (click)="confirm()" class="ion-margin-top">
        Confirm
      </ion-button>
    </ion-content>
  `,
  standalone: true,
  imports: [CommonModule, FormsModule, IonDatetime, IonButton, IonButtons, IonHeader, IonToolbar, IonTitle, IonContent]
})
export class DatePickerModalComponent {
  @Input() selectedDate: string = new Date().toISOString();
  @Input() maxDate: string = new Date().toISOString();

  constructor(private modalController: ModalController) {}

  dismiss() {
    this.modalController.dismiss();
  }

  confirm() {
    this.modalController.dismiss({ selectedDate: this.selectedDate });
  }
}

