import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonChip } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { MetricType } from '../../../core/observation.service';

@Component({
  selector: 'app-metric-chip',
  templateUrl: './metric-chip.component.html',
  styleUrls: ['./metric-chip.component.scss'],
  standalone: true,
  imports: [CommonModule, IonChip, TranslateModule],
})
export class MetricChipComponent {
  @Input() metric!: MetricType;
  @Input() color: 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'danger' | 'medium' = 'primary';

  getMetricLabel(): string {
    const labels: { [key in MetricType]: string } = {
      bp: 'METRICS.BP',
      glucose: 'METRICS.GLUCOSE',
      spo2: 'METRICS.SPO2',
      hr: 'METRICS.HR',
      pain: 'METRICS.PAIN',
      weight: 'METRICS.WEIGHT',
    };
    return labels[this.metric];
  }
}

