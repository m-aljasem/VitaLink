import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonItem, IonLabel, IonToggle } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-consent-toggle',
  templateUrl: './consent-toggle.component.html',
  styleUrls: ['./consent-toggle.component.scss'],
  standalone: true,
  imports: [CommonModule, IonItem, IonLabel, IonToggle, TranslateModule],
})
export class ConsentToggleComponent {
  @Input() label!: string;
  @Input() checked = false;
  @Input() disabled = false;
  @Output() checkedChange = new EventEmitter<boolean>();

  onToggle(event: any) {
    this.checkedChange.emit(event.detail.checked);
  }
}

