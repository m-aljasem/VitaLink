import { Observation } from '../../core/observation.service';

export function observationsToCSV(observations: Observation[]): string {
  const headers = ['Date', 'Time', 'Metric', 'Value', 'Systolic', 'Diastolic', 'Unit', 'Tags'];
  
  const rows = observations.map(obs => {
    const date = new Date(obs.ts);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString();
    
    let value = '';
    if (obs.metric === 'bp') {
      value = `${obs.systolic}/${obs.diastolic}`;
    } else {
      value = obs.numeric_value?.toString() || '';
    }

    return [
      dateStr,
      timeStr,
      obs.metric,
      value,
      obs.systolic?.toString() || '',
      obs.diastolic?.toString() || '',
      obs.unit || '',
      obs.tags?.join('; ') || '',
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return csvContent;
}

export function observationsToJSON(observations: Observation[]): string {
  return JSON.stringify(observations, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

