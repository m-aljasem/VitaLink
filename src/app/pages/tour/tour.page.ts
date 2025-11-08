import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { register } from 'swiper/element/bundle';
import { addIcons } from 'ionicons';
import { sparkles, pulse, link, settings } from 'ionicons/icons';
import { I18nService } from '../../core/i18n.service';

register();

@Component({
  selector: 'app-tour',
  templateUrl: './tour.page.html',
  styleUrls: ['./tour.page.scss'],
  standalone: true,
  imports: [IonContent, IonButton, IonIcon, TranslateModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class TourPage implements OnInit {
  isRTL = false;
  slideOpts = {
    initialSlide: 0,
    speed: 400,
  };

  constructor(
    private router: Router,
    private i18nService: I18nService
  ) {
    addIcons({ sparkles, pulse, link, settings });
  }

  ngOnInit() {
    this.isRTL = this.i18nService.isRTL();
    // For RTL, start from the last slide (index 3 for 4 slides)
    if (this.isRTL) {
      this.slideOpts.initialSlide = 3;
    }
  }

  completeTour() {
    this.router.navigate(['/tabs/home']);
  }
}

