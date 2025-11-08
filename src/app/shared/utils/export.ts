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

export function observationsToFHIR(observations: Observation[], profile: any): string {
  // FHIR Bundle containing Observation resources
  const bundle = {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: observations.map((obs, index) => {
      const observation = createFHIRObservation(obs, profile);
      return {
        fullUrl: `urn:uuid:${obs.id || `obs-${index}`}`,
        resource: observation,
      };
    }),
  };

  return JSON.stringify(bundle, null, 2);
}

function createFHIRObservation(obs: Observation, profile: any): any {
  const observation: any = {
    resourceType: 'Observation',
    id: obs.id || undefined,
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          },
        ],
      },
    ],
    code: getFHIRCode(obs.metric),
    subject: {
      reference: `Patient/${obs.user_id}`,
    },
    effectiveDateTime: obs.ts,
    issued: obs.created_at || obs.ts,
  };

  // Add value based on metric type
  if (obs.metric === 'bp') {
    // Blood pressure has two components
    observation.component = [
      {
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8480-6',
              display: 'Systolic blood pressure',
            },
          ],
        },
        valueQuantity: {
          value: obs.systolic,
          unit: 'mmHg',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]',
        },
      },
      {
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8462-4',
              display: 'Diastolic blood pressure',
            },
          ],
        },
        valueQuantity: {
          value: obs.diastolic,
          unit: 'mmHg',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]',
        },
      },
    ];
  } else {
    // Single value observations
    observation.valueQuantity = {
      value: obs.numeric_value,
      unit: obs.unit || getDefaultUnit(obs.metric),
      system: 'http://unitsofmeasure.org',
      code: getUnitCode(obs.metric, obs.unit),
    };
  }

  // Add tags as notes if present
  if (obs.tags && obs.tags.length > 0) {
    observation.note = obs.tags.map((tag) => ({
      text: tag,
    }));
  }

  // Add context if available
  if (obs.context) {
    observation.extension = [
      {
        url: 'http://hl7.org/fhir/StructureDefinition/observation-context',
        valueString: JSON.stringify(obs.context),
      },
    ];
  }

  return observation;
}

function getFHIRCode(metric: string): any {
  const codeMap: { [key: string]: { system: string; code: string; display: string } } = {
    bp: {
      system: 'http://loinc.org',
      code: '85354-9',
      display: 'Blood pressure panel with all children optional',
    },
    glucose: {
      system: 'http://loinc.org',
      code: '2339-0',
      display: 'Glucose [Mass/volume] in Blood',
    },
    spo2: {
      system: 'http://loinc.org',
      code: '2708-6',
      display: 'Oxygen saturation in Arterial blood',
    },
    hr: {
      system: 'http://loinc.org',
      code: '8867-4',
      display: 'Heart rate',
    },
    pain: {
      system: 'http://loinc.org',
      code: '72514-3',
      display: 'Pain severity - 0-10 verbal numeric rating [Score] - Reported',
    },
    weight: {
      system: 'http://loinc.org',
      code: '29463-7',
      display: 'Body weight',
    },
  };

  const code = codeMap[metric] || {
    system: 'http://loinc.org',
    code: 'unknown',
    display: metric,
  };

  return {
    coding: [code],
    text: code.display,
  };
}

function getDefaultUnit(metric: string): string {
  const unitMap: { [key: string]: string } = {
    glucose: 'mg/dL',
    spo2: '%',
    hr: 'bpm',
    pain: 'score',
    weight: 'kg',
  };
  return unitMap[metric] || '';
}

function getUnitCode(metric: string, unit?: string): string {
  if (unit) {
    const unitCodeMap: { [key: string]: string } = {
      'mg/dL': 'mg/dL',
      '%': '%',
      'bpm': '/min',
      'score': '{score}',
      'kg': 'kg',
      'mmHg': 'mm[Hg]',
    };
    return unitCodeMap[unit] || unit;
  }

  const defaultCodeMap: { [key: string]: string } = {
    glucose: 'mg/dL',
    spo2: '%',
    hr: '/min',
    pain: '{score}',
    weight: 'kg',
  };
  return defaultCodeMap[metric] || '';
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

