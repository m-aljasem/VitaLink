import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonList, IonItem, IonLabel, IonChip, IonText, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AuthService, Profile } from '../../../core/auth.service';
import { SharingService, ProviderLink } from '../../../core/sharing.service';
import { ProfileService } from '../../../core/profile.service';
import { ObservationService } from '../../../core/observation.service';

interface PatientInfo {
  link: ProviderLink;
  profile: Profile;
  lastSeen: string | null;
  sharedMetrics: string[];
}

interface Stats {
  totalPatients: number;
  activeThisWeek: number;
  newLinks: number;
  exceptions: number;
}

@Component({
  selector: 'app-provider-home',
  templateUrl: './provider-home.page.html',
  styleUrls: ['./provider-home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonList, IonItem, IonLabel, IonChip, IonText, IonRefresher, IonRefresherContent, TranslateModule
  ],
})
export class ProviderHomePage implements OnInit {
  profile: Profile | null = null;
  stats: Stats = {
    totalPatients: 0,
    activeThisWeek: 0,
    newLinks: 0,
    exceptions: 0,
  };
  patients: PatientInfo[] = [];

  constructor(
    private authService: AuthService,
    private sharingService: SharingService,
    private profileService: ProfileService,
    private observationService: ObservationService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.profile = await this.authService.getCurrentProfile();
    await this.loadData();
  }

  async loadData() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    // Load provider links
    const { data: links } = await this.sharingService.getProviderLinks(user.id);
    if (!links) return;

    this.stats.totalPatients = links.length;

    // Calculate active this week (patients with observations in last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Load patient profiles and calculate stats
    this.patients = await Promise.all(
      links.map(async (link) => {
        const { data: patientProfile } = await this.profileService.getProfile(link.patient_id);
        
        // Get latest observation for each shared metric
        const sharedMetrics: string[] = [];
        if (link.share_bp) sharedMetrics.push('bp');
        if (link.share_glucose) sharedMetrics.push('glucose');
        if (link.share_spo2) sharedMetrics.push('spo2');
        if (link.share_hr) sharedMetrics.push('hr');
        if (link.share_pain) sharedMetrics.push('pain');
        if (link.share_weight) sharedMetrics.push('weight');

        let lastSeen: string | null = null;
        if (sharedMetrics.length > 0) {
          // Get most recent observation across all shared metrics
          const observations = await Promise.all(
            sharedMetrics.map(metric =>
              this.observationService.getLatestObservation(link.patient_id, metric as any)
            )
          );
          
          const latest = observations
            .filter(o => o.data)
            .map(o => o.data!.ts)
            .sort()
            .reverse()[0];
          
          lastSeen = latest || null;

          // Check if active this week
          if (lastSeen && new Date(lastSeen) > weekAgo) {
            this.stats.activeThisWeek++;
          }
        }

        return {
          link,
          profile: patientProfile!,
          lastSeen,
          sharedMetrics,
        };
      })
    );

    // Calculate new links (created in last 7 days)
    this.stats.newLinks = links.filter(
      link => new Date(link.created_at) > weekAgo
    ).length;
  }

  async doRefresh(event: any) {
    await this.loadData();
    event.target.complete();
  }

  navigateToPatient(patientId: string) {
    this.router.navigate(['/provider/patient', patientId]);
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }
}

