import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButton } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { register } from 'swiper/element/bundle';

register();

@Component({
  selector: 'app-tour',
  templateUrl: './tour.page.html',
  styleUrls: ['./tour.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonButton, TranslateModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class TourPage {
  slideOpts = {
    initialSlide: 0,
    speed: 400,
  };

  constructor(private router: Router) {}

  completeTour() {
    this.router.navigate(['/tabs/home']);
  }
}

