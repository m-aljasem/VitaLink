import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MetricFormatService } from '../../../core/metric-format.service';
import { Classification, ReadingValues } from '../../../core/clinical';

/** Coloured label such as "High" or "Critically low" for a reading. */
@Component({
  selector: 'app-severity-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      *ngIf="classification && (showNormal || classification.severity !== 'normal')"
      class="severity-badge"
      [class]="'severity-badge severity-' + classification.severity"
      role="status"
    >{{ label }}</span>
  `,
  styles: [`
    .severity-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      line-height: 1.4;
      white-space: nowrap;
    }
    .severity-normal { background: var(--severity-normal-bg); color: var(--severity-normal-fg); }
    .severity-borderline { background: var(--severity-borderline-bg); color: var(--severity-borderline-fg); }
    .severity-abnormal { background: var(--severity-abnormal-bg); color: var(--severity-abnormal-fg); }
    .severity-critical { background: var(--severity-critical-bg); color: var(--severity-critical-fg); }
  `],
})
export class SeverityBadgeComponent {
  @Input() set reading(value: ReadingValues | null | undefined) {
    this.classification = this.format.classify(value);
  }
  @Input() showNormal = false;

  classification: Classification | null = null;

  constructor(private format: MetricFormatService) {}

  get label(): string {
    return this.format.severityLabel(this.classification);
  }
}
