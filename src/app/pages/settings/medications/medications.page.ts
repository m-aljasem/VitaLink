import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonCard, IonCardContent, IonButton, IonIcon, IonInput, IonItem, IonLabel,
  IonChip, IonToggle, IonSpinner, AlertController, ToastController
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  arrowBack, arrowForward, add, medkit, checkmarkCircle, closeCircle, trashOutline, createOutline, timeOutline
} from 'ionicons/icons';
import { AuthService } from '../../../core/auth.service';
import { I18nService } from '../../../core/i18n.service';
import { Dose, DoseStatus, Medication, MedicationLog, MedicationService } from '../../../core/medication.service';

@Component({
  selector: 'app-medications',
  templateUrl: './medications.page.html',
  styleUrls: ['./medications.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule,
    IonContent, IonCard, IonCardContent, IonButton, IonIcon, IonInput, IonItem, IonLabel,
    IonChip, IonToggle, IonSpinner,
  ],
})
export class MedicationsPage implements OnInit {
  medications: Medication[] = [];
  logs: MedicationLog[] = [];
  todaysDoses: Dose[] = [];
  adherence: number | null = null;
  loading = true;
  saving = false;

  /** Medication being added or edited; null when the form is closed. */
  draft: Medication | null = null;
  newTime = '08:00';

  daysOfWeek = [
    { value: 'Mon', label: 'SETTINGS.MON' },
    { value: 'Tue', label: 'SETTINGS.TUE' },
    { value: 'Wed', label: 'SETTINGS.WED' },
    { value: 'Thu', label: 'SETTINGS.THU' },
    { value: 'Fri', label: 'SETTINGS.FRI' },
    { value: 'Sat', label: 'SETTINGS.SAT' },
    { value: 'Sun', label: 'SETTINGS.SUN' },
  ];

  constructor(
    private medicationService: MedicationService,
    private authService: AuthService,
    private i18nService: I18nService,
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController,
    private translate: TranslateService
  ) {
    addIcons({ arrowBack, arrowForward, add, medkit, checkmarkCircle, closeCircle, trashOutline, createOutline, timeOutline });
  }

  async ngOnInit() {
    await this.load();
  }

  get backIcon(): string {
    return this.i18nService.isRTL() ? 'arrow-forward' : 'arrow-back';
  }

  goBack() {
    this.router.navigate(['/tabs/settings']);
  }

  async load() {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.loading = true;
    const since = new Date();
    since.setDate(since.getDate() - 7);
    since.setHours(0, 0, 0, 0);
    const [meds, logs] = await Promise.all([
      this.medicationService.getMedications(user.id),
      this.medicationService.getLogs(user.id, since),
    ]);
    if (meds.error || logs.error) {
      await this.toast('MEDICATIONS.LOAD_ERROR', 'danger');
    }
    this.medications = meds.data || [];
    this.logs = logs.data || [];
    this.refreshDerived();
    this.loading = false;
  }

  private refreshDerived() {
    this.todaysDoses = this.medicationService.dosesForDay(this.medications, this.logs);
    this.adherence = this.medicationService.adherence(this.medications, this.logs);
  }

  async markDose(dose: Dose, status: DoseStatus) {
    const user = this.authService.getCurrentUser();
    if (!user || !dose.medication.id) return;
    const { error } = await this.medicationService.logDose(user.id, dose.medication.id, dose.scheduledFor, status);
    if (error) {
      await this.toast('MEDICATIONS.SAVE_ERROR', 'danger');
      return;
    }
    const scheduledFor = dose.scheduledFor.toISOString();
    this.logs = [
      ...this.logs.filter(l => !(l.medication_id === dose.medication.id && new Date(l.scheduled_for).getTime() === dose.scheduledFor.getTime())),
      { user_id: user.id, medication_id: dose.medication.id, scheduled_for: scheduledFor, status },
    ];
    this.refreshDerived();
  }

  isDue(dose: Dose): boolean {
    return dose.scheduledFor <= new Date();
  }

  startAdd() {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.draft = { user_id: user.id, name: '', dose: '', times: ['08:00'], days: [], active: true };
  }

  startEdit(medication: Medication) {
    this.draft = { ...medication, times: [...medication.times], days: [...(medication.days || [])] };
  }

  cancelEdit() {
    this.draft = null;
  }

  addTime() {
    if (!this.draft || !this.newTime) return;
    if (!this.draft.times.includes(this.newTime)) {
      this.draft.times = [...this.draft.times, this.newTime].sort();
    }
  }

  removeTime(time: string) {
    if (this.draft) this.draft.times = this.draft.times.filter(t => t !== time);
  }

  toggleDay(day: string) {
    if (!this.draft) return;
    const days = this.draft.days || [];
    this.draft.days = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
  }

  async save() {
    if (!this.draft || this.saving) return;
    if (!this.draft.name.trim()) {
      await this.toast('MEDICATIONS.NAME_REQUIRED', 'danger');
      return;
    }
    if (this.draft.times.length === 0) {
      await this.toast('MEDICATIONS.TIME_REQUIRED', 'danger');
      return;
    }
    this.saving = true;
    const { error } = await this.medicationService.saveMedication(this.draft);
    this.saving = false;
    if (error) {
      await this.toast('MEDICATIONS.SAVE_ERROR', 'danger');
      return;
    }
    this.draft = null;
    await this.load();
  }

  async toggleActive(medication: Medication) {
    const { error } = await this.medicationService.saveMedication({ ...medication, active: !medication.active });
    if (error) {
      await this.toast('MEDICATIONS.SAVE_ERROR', 'danger');
    }
    await this.load();
  }

  async remove(medication: Medication) {
    const alert = await this.alertController.create({
      header: this.translate.instant('MEDICATIONS.DELETE_TITLE'),
      message: this.translate.instant('MEDICATIONS.DELETE_MESSAGE', { name: medication.name }),
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('COMMON.DELETE'),
          role: 'destructive',
          handler: async () => {
            const { error } = await this.medicationService.deleteMedication(medication);
            if (error) await this.toast('MEDICATIONS.SAVE_ERROR', 'danger');
            await this.load();
          },
        },
      ],
    });
    await alert.present();
  }

  daysLabel(medication: Medication): string {
    if (!medication.days?.length) return this.translate.instant('MEDICATIONS.EVERY_DAY');
    return this.daysOfWeek
      .filter(d => medication.days!.includes(d.value))
      .map(d => this.translate.instant(d.label))
      .join(', ');
  }

  private async toast(key: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({ message: this.translate.instant(key), duration: 2000, color });
    await toast.present();
  }
}
