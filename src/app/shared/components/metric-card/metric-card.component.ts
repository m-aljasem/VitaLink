import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonCard, IonCardContent, IonText, IonIcon } from '@ionic/angular/standalone';
import { arrowUp, arrowDown, remove } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { TranslateModule } from '@ngx-translate/core';
import { MetricType } from '../../../core/observation.service';

@Component({
  selector: 'app-metric-card',
  templateUrl: './metric-card.component.html',
  styleUrls: ['./metric-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonCard, IonCardContent, IonText, IonIcon, TranslateModule],
})
export class MetricCardComponent {
  @Input() metric!: MetricType;
  @Input() value: string | number | null = null;
  @Input() lastTime: string | null = null;
  @Input() trend: 'up' | 'down' | 'neutral' = 'neutral';
  @Input() color = '#3B82F6';
  @Input() sparklineData: number[] = [];

  constructor(private router: Router) {
    addIcons({ arrowUp, arrowDown, remove });
  }

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

  formatTime(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  navigateToDetail() {
    this.router.navigate(['/metric', this.metric]);
  }

  getSparklinePoints(): string {
    if (!this.sparklineData || this.sparklineData.length === 0) return '';
    
    const width = 120; // Increased from 60 to 120 for wider space
    const height = 30; // Increased from 20 to 30 for better visibility
    const padding = 3;
    const data = this.sparklineData;
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - ((value - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    });
    
    return points.join(' ');
  }

  getSparklinePath(): string {
    if (!this.sparklineData || this.sparklineData.length === 0) return '';
    
    const width = 120;
    const height = 30;
    const padding = 3;
    const data = this.sparklineData;
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    // Create points array
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - ((value - min) / range) * (height - 2 * padding);
      return { x, y };
    });
    
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    
    // Build smooth path using cubic bezier curves for smoother transitions
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      
      // Calculate control points for smooth cubic bezier curve
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    
    return path;
  }

  getLightBackgroundColor(): string {
    // Convert hex color to RGB and apply light opacity
    const hex = this.color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.1)`;
  }
}

