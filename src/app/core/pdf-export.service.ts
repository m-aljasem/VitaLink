import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { ObservationService, MetricType, Observation } from './observation.service';
import { AuthService, Profile } from './auth.service';
import { TranslateService } from '@ngx-translate/core';

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
    private translate: TranslateService
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

    // Helper function to draw a line
    const drawLine = (x1: number, y1: number, x2: number, y2: number, color: string = '#E5E7EB', width: number = 0.5) => {
      doc.setDrawColor(color);
      doc.setLineWidth(width);
      doc.line(x1, y1, x2, y2);
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
      addText(`Gender: ${profile.gender}`, margin + 5, yPosition, 11);
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
      checkPageBreak(30);
      drawRect(margin, yPosition, contentWidth, 25, '#F9FAFB', '#E5E7EB');
      addText('Summary Statistics', margin + 5, yPosition + 7, 14, true);
      yPosition += 12;

      // Calculate summary for each metric
      for (const metric of options.metrics) {
        const { data: observations } = await this.observationService.getObservationsByMetric(
          user.id,
          metric,
          1000
        );

        if (observations && observations.length > 0) {
          const filtered = observations.filter(obs => {
            const obsDate = new Date(obs.ts);
            return obsDate >= options.startDate && obsDate <= options.endDate;
          });

          if (filtered.length > 0) {
            checkPageBreak(10);
            const metricName = this.getMetricName(metric);
            const values = this.extractValues(filtered, metric);
            
            if (values.length > 0) {
              const avg = values.reduce((a, b) => a + b, 0) / values.length;
              const min = Math.min(...values);
              const max = Math.max(...values);
              
              const summaryText = `${metricName}: Avg ${avg.toFixed(1)}, Min ${min.toFixed(1)}, Max ${max.toFixed(1)}`;
              addText(summaryText, margin + 5, yPosition, 10);
              yPosition += lineHeight;
            }
          }
        }
      }
      yPosition += sectionSpacing;
    }

    // Detailed Data Tables for each metric
    for (const metric of options.metrics) {
      checkPageBreak(40);
      
      const { data: observations } = await this.observationService.getObservationsByMetric(
        user.id,
        metric,
        1000
      );

      if (!observations || observations.length === 0) continue;

      const filtered = observations
        .filter(obs => {
          const obsDate = new Date(obs.ts);
          return obsDate >= options.startDate && obsDate <= options.endDate;
        })
        .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
        .slice(0, 50); // Limit to 50 most recent

      if (filtered.length === 0) continue;

      // Metric Header
      const metricName = this.getMetricName(metric);
      const metricColor = this.getMetricColor(metric);
      
      drawRect(margin, yPosition, contentWidth, 15, metricColor, '#1E40AF');
      addText(metricName, margin + 5, yPosition + 10, 14, true, '#FFFFFF');
      yPosition += 18;

      // Table Header
      checkPageBreak(20);
      drawRect(margin, yPosition, contentWidth, 8, '#F3F4F6', '#D1D5DB');
      addText('Date & Time', margin + 5, yPosition + 6, 10, true);
      addText('Value', margin + 100, yPosition + 6, 10, true);
      addText('Tags', margin + 150, yPosition + 6, 10, true);
      yPosition += 10;

      // Table Rows
      for (const obs of filtered) {
        checkPageBreak(8);
        
        const date = new Date(obs.ts);
        const dateStr = date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
        const timeStr = date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        const value = this.formatValue(obs, metric);
        const tags = obs.tags && obs.tags.length > 0 ? obs.tags.join(', ') : '-';
        
        // Alternate row colors
        const rowColor = filtered.indexOf(obs) % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
        drawRect(margin, yPosition, contentWidth, 7, rowColor, '#E5E7EB');
        
        addText(`${dateStr} ${timeStr}`, margin + 5, yPosition + 5, 9);
        addText(value, margin + 100, yPosition + 5, 9);
        
        // Truncate tags if too long
        const tagsText = tags.length > 20 ? tags.substring(0, 17) + '...' : tags;
        addText(tagsText, margin + 150, yPosition + 5, 9);
        
        yPosition += 8;
      }

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

  private extractValues(observations: Observation[], metric: MetricType): number[] {
    if (metric === 'bp') {
      return observations
        .map(obs => obs.systolic || 0)
        .filter(val => val > 0);
    }
    return observations
      .map(obs => obs.numeric_value || 0)
      .filter(val => val > 0);
  }

  private formatValue(obs: Observation, metric: MetricType): string {
    if (metric === 'bp') {
      const unit = this.translate.instant('METRICS.MMHG');
      return `${obs.systolic || 'N/A'}/${obs.diastolic || 'N/A'} ${unit}`;
    }
    // Get unit translation key based on metric type
    const unitKey = this.getUnitTranslationKey(metric);
    const unit = unitKey ? this.translate.instant(unitKey) : (obs.unit || '');
    return `${obs.numeric_value || 'N/A'} ${unit}`;
  }

  private getUnitTranslationKey(metric: string): string | null {
    const unitMap: { [key: string]: string } = {
      glucose: 'METRICS.MGDL',
      spo2: 'METRICS.PERCENT',
      hr: 'METRICS.BPM',
      pain: 'METRICS.SCALE_1_10',
      weight: 'METRICS.KG',
    };
    return unitMap[metric] || null;
  }
}

