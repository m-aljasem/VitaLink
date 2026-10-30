import { Injectable } from '@angular/core';
import { ObservationService, MetricType, Observation } from './observation.service';
import { AuthService } from './auth.service';
import { MetricFormatService } from './metric-format.service';
import { classifyReading } from './clinical';
import { UnitPreferences, toDisplay, unitSymbol } from './units';
import { computeMetricStats } from './report-stats';

interface PDFExportOptions {
  metrics: MetricType[];
  startDate: Date;
  endDate: Date;
  includeCharts: boolean;
  includeSummary: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PdfExportService {
  constructor(
    private observationService: ObservationService,
    private authService: AuthService,
    private format: MetricFormatService
  ) {}

  async generatePDF(options: PDFExportOptions): Promise<void> {
    const user = this.authService.getCurrentUser();
    const profile = await this.authService.getCurrentProfile();
    
    if (!user || !profile) {
      throw new Error('User not authenticated');
    }

    // A4 dimensions in mm
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    // jsPDF (with html2canvas/canvg) is large, so it is only loaded when a report is generated.
    const { jsPDF } = await import('jspdf');
    const prefs = this.format.units;

    // Readings in the report period, per metric, newest first.
    const readingsByMetric = new Map<MetricType, Observation[]>();
    for (const metric of options.metrics) {
      const { data } = await this.observationService.getObservationsByMetric(user.id, metric, 1000);
      readingsByMetric.set(metric, (data || [])
        .filter(obs => {
          const ts = new Date(obs.ts);
          return ts >= options.startDate && ts <= options.endDate;
        })
        .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()));
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let yPosition = margin;
    const lineHeight = 7;
    const sectionSpacing = 10;

    // Helper function to add new page if needed
    const checkPageBreak = (requiredSpace: number) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
    };

    // Helper function to add text with styling
    const addText = (text: string, x: number, y: number, fontSize: number, isBold: boolean = false, color: string = '#000000') => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(color);
      doc.text(text, x, y);
    };

    // Helper function to draw a filled rectangle
    const drawRect = (x: number, y: number, width: number, height: number, fillColor: string, strokeColor: string = '#E5E7EB') => {
      doc.setFillColor(fillColor);
      doc.setDrawColor(strokeColor);
      doc.rect(x, y, width, height, 'FD');
    };

    // Header Section
    checkPageBreak(30);
    drawRect(margin, yPosition, contentWidth, 25, '#3B82F6', '#2563EB');
    
    addText('VitaLink', margin + 5, yPosition + 10, 20, true, '#FFFFFF');
    addText('Health Data Report', margin + 5, yPosition + 18, 12, false, '#FFFFFF');
    
    const reportDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    addText(`Generated: ${reportDate}`, pageWidth - margin - 5, yPosition + 18, 10, false, '#FFFFFF');
    
    yPosition += 30;

    // Patient Information Section
    checkPageBreak(25);
    drawRect(margin, yPosition, contentWidth, 20, '#F9FAFB', '#E5E7EB');
    addText('Patient Information', margin + 5, yPosition + 7, 14, true);
    
    yPosition += 12;
    const patientName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'N/A';
    addText(`Name: ${patientName}`, margin + 5, yPosition, 11);
    yPosition += lineHeight;
    
    if (profile.age) {
      addText(`Age: ${profile.age} years`, margin + 5, yPosition, 11);
      yPosition += lineHeight;
    }
    
    if (profile.gender) {
      const genders: Record<string, string> = { male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Not stated' };
      addText(`Gender: ${genders[profile.gender] || profile.gender}`, margin + 5, yPosition, 11);
      yPosition += lineHeight;
    }
    
    if (profile.city || profile.country) {
      const location = [profile.city, profile.country].filter(Boolean).join(', ');
      addText(`Location: ${location}`, margin + 5, yPosition, 11);
      yPosition += lineHeight;
    }
    
    yPosition += sectionSpacing;

    // Date Range Section
    checkPageBreak(15);
    drawRect(margin, yPosition, contentWidth, 12, '#F3F4F6', '#E5E7EB');
    const dateRangeText = `${options.startDate.toLocaleDateString()} - ${options.endDate.toLocaleDateString()}`;
    addText(`Report Period: ${dateRangeText}`, margin + 5, yPosition + 8, 11, true);
    yPosition += 15;

    // Summary Statistics (if enabled)
    if (options.includeSummary) {
      checkPageBreak(20);
      addText('Summary Statistics', margin, yPosition + 6, 14, true);
      yPosition += 10;

      for (const metric of options.metrics) {
        const stats = computeMetricStats(metric, readingsByMetric.get(metric) || [], prefs);
        if (!stats) continue;

        const unit = unitSymbol(metric, prefs);
        const lines: string[] = [];
        if (metric === 'bp' && stats.diastolic) {
          lines.push(`Average ${stats.average}/${stats.diastolic.average} ${unit}  (range ${stats.min}-${stats.max} / ${stats.diastolic.min}-${stats.diastolic.max})`);
          const parts = [
            stats.morning ? `Morning (before 12:00): ${stats.morning.systolic}/${stats.morning.diastolic} (n=${stats.morning.count})` : '',
            stats.evening ? `Evening (after 18:00): ${stats.evening.systolic}/${stats.evening.diastolic} (n=${stats.evening.count})` : '',
          ].filter(Boolean);
          if (parts.length) lines.push(parts.join('   '));
        } else {
          lines.push(`Average ${stats.average} ${unit}  (range ${stats.min}-${stats.max})`);
        }
        const rangeText = stats.inRangeShare !== null
          ? `In normal range: ${Math.round(stats.inRangeShare * 100)}%   Out of range: ${stats.outOfRangeCount}`
          : '';
        lines.push([`Readings: ${stats.count}`, rangeText].filter(Boolean).join('   '));

        const boxHeight = 9 + lines.length * 6;
        checkPageBreak(boxHeight + 4);
        drawRect(margin, yPosition, contentWidth, boxHeight, '#F9FAFB', '#E5E7EB');
        doc.setFillColor(this.getMetricColor(metric));
        doc.rect(margin, yPosition, 2, boxHeight, 'F');
        addText(this.getMetricName(metric), margin + 6, yPosition + 6, 11, true);
        lines.forEach((line, i) => addText(line, margin + 6, yPosition + 12 + i * 6, 9.5, false, '#374151'));
        yPosition += boxHeight + 4;
      }

      checkPageBreak(10);
      addText(
        'Ranges are general adult guidelines (e.g. ACC/AHA blood pressure, ADA glucose) and are not a diagnosis.',
        margin, yPosition + 4, 8, false, '#6B7280'
      );
      yPosition += sectionSpacing;
    }

    // Detailed Data Tables for each metric
    for (const metric of options.metrics) {
      const filtered = (readingsByMetric.get(metric) || []).slice(0, 50); // 50 most recent
      if (filtered.length === 0) continue;

      checkPageBreak(40);
      const metricName = this.getMetricName(metric);
      drawRect(margin, yPosition, contentWidth, 15, this.getMetricColor(metric), this.getMetricColor(metric));
      addText(metricName, margin + 5, yPosition + 10, 14, true, '#FFFFFF');
      yPosition += 18;

      // Table Header
      checkPageBreak(20);
      drawRect(margin, yPosition, contentWidth, 8, '#F3F4F6', '#D1D5DB');
      addText('Date & Time', margin + 3, yPosition + 6, 9, true);
      addText('Value', margin + 45, yPosition + 6, 9, true);
      addText('Status', margin + 82, yPosition + 6, 9, true);
      addText('Tags / Note', margin + 112, yPosition + 6, 9, true);
      yPosition += 10;

      filtered.forEach((obs, index) => {
        checkPageBreak(8);
        const date = new Date(obs.ts);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const status = this.statusText(obs);
        const details = [
          ...(obs.tags || []).map(tag => this.tagText(tag)),
          obs.note ? `"${obs.note}"` : '',
        ].filter(Boolean).join(', ') || '-';

        drawRect(margin, yPosition, contentWidth, 7, index % 2 === 0 ? '#FFFFFF' : '#F9FAFB', '#E5E7EB');
        addText(`${dateStr} ${timeStr}`, margin + 3, yPosition + 5, 8.5);
        addText(this.formatValue(obs, metric, prefs), margin + 45, yPosition + 5, 8.5);
        addText(status, margin + 82, yPosition + 5, 8.5, status !== 'Normal' && status !== '-',
          status.startsWith('Critical') ? '#B91C1C' : '#000000');
        addText(details.length > 38 ? details.substring(0, 35) + '...' : details, margin + 112, yPosition + 5, 8.5);
        yPosition += 8;
      });

      yPosition += sectionSpacing;
    }

    // Footer on last page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addText(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        9,
        false,
        '#6B7280'
      );
      addText(
        'VitaLink Health Tracker - Confidential Medical Data',
        pageWidth / 2,
        pageHeight - 5,
        8,
        false,
        '#9CA3AF'
      );
    }

    // Save the PDF
    const fileName = `VitaLink_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }

  private getMetricName(metric: MetricType): string {
    const names: { [key in MetricType]: string } = {
      bp: 'Blood Pressure',
      glucose: 'Blood Glucose',
      spo2: 'SpO₂ (Oxygen Saturation)',
      hr: 'Heart Rate',
      pain: 'Pain Level',
      weight: 'Weight',
    };
    return names[metric] || metric;
  }

  private getMetricColor(metric: MetricType): string {
    const colors: { [key in MetricType]: string } = {
      bp: '#EF4444',
      glucose: '#F59E0B',
      spo2: '#3B82F6',
      hr: '#10B981',
      pain: '#8B5CF6',
      weight: '#6366F1',
    };
    return colors[metric] || '#3B82F6';
  }

  private formatValue(obs: Observation, metric: MetricType, prefs: UnitPreferences): string {
    const unit = unitSymbol(metric, prefs);
    if (metric === 'bp') {
      return `${obs.systolic ?? '-'}/${obs.diastolic ?? '-'} ${unit}`;
    }
    if (obs.numeric_value == null) return '-';
    return `${toDisplay(metric, Number(obs.numeric_value), prefs)} ${unit}`;
  }

  /** English status label (the PDF font only covers Latin script). */
  private statusText(obs: Observation): string {
    const c = classifyReading(obs);
    if (!c) return '-';
    if (c.severity === 'normal') return 'Normal';
    const level = { borderline: 'Borderline', abnormal: '', critical: 'Critically' }[c.severity];
    const direction = c.direction === 'low' ? 'low' : 'high';
    return level ? `${level} ${direction}` : direction === 'low' ? 'Low' : 'High';
  }

  private tagText(tag: string): string {
    const tags: Record<string, string> = {
      'TAGS.BP_AFTER_WAKE': 'After waking',
      'TAGS.BP_BEFORE_BED': 'Before bed',
      'TAGS.BP_STRESS': 'Stress',
      'TAGS.GLUCOSE_FASTING': 'Fasting',
      'TAGS.GLUCOSE_AFTER_MEAL': 'After meal',
      'TAGS.GLUCOSE_WORKOUT': 'Workout',
    };
    return tags[tag] || tag.replace(/^TAGS\./, '');
  }
}
