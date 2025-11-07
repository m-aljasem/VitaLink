import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { register } from 'swiper/element/bundle';
import { addIcons } from 'ionicons';
import { sparkles, pulse, link, settings } from 'ionicons/icons';

register();

@Component({
  selector: 'app-tour',
  templateUrl: './tour.page.html',
  styleUrls: ['./tour.page.scss'],
  standalone: true,
  imports: [IonContent, IonButton, IonIcon, TranslateModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class TourPage {
  slideOpts = {
    initialSlide: 0,
    speed: 400,
  };

  constructor(private router: Router) {
    addIcons({ sparkles, pulse, link, settings });
  }

  completeTour() {
    this.router.navigate(['/tabs/home']);
  }
}

