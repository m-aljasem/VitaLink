import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonIcon, IonCard, IonCardContent, IonSpinner } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { arrowBack, arrowForward, eyeOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/auth.service';
import { ProfileService } from '../../../core/profile.service';
import { SharingService, AuditView } from '../../../core/sharing.service';
import { DateFormatService } from '../../../core/date-format.service';
import { I18nService } from '../../../core/i18n.service';

interface AccessEntry extends AuditView {
  providerName: string;
}

/** Shows the patient which providers viewed which of their data, and when. */
@Component({
  selector: 'app-access-log',
  templateUrl: './access-log.page.html',
  styleUrls: ['./access-log.page.scss'],
  standalone: true,
  imports: [CommonModule, TranslateModule, IonContent, IonButton, IonIcon, IonCard, IonCardContent, IonSpinner],
})
export class AccessLogPage implements OnInit {
  entries: AccessEntry[] = [];
  loading = true;
  error = false;

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private sharingService: SharingService,
    private dateFormatService: DateFormatService,
    private i18nService: I18nService,
    private translate: TranslateService,
    private router: Router
  ) {
    addIcons({ arrowBack, arrowForward, eyeOutline });
  }

  get backIcon(): string {
    return this.i18nService.isRTL() ? 'arrow-forward' : 'arrow-back';
  }

  goBack() {
    this.router.navigate(['/tabs/settings']);
  }

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const { data, error } = await this.sharingService.getAccessLog(user.id);
    this.error = !!error;
    const views = data || [];

    // Names are visible only for providers still linked to the patient.
    const providerIds = [...new Set(views.map(v => v.provider_id))];
    const names = new Map<string, string>();
    await Promise.all(providerIds.map(async id => {
      const { data: profile } = await this.profileService.getProfile(id);
      const name = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
      names.set(id, name || this.translate.instant('ACCESS_LOG.FORMER_PROVIDER'));
    }));

    this.entries = views.map(v => ({ ...v, providerName: names.get(v.provider_id)! }));
    this.loading = false;
  }

  formatDateTime(value: string): string {
    return this.dateFormatService.formatDateTimeSync(value, {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }
}
