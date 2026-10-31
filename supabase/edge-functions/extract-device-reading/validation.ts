export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
export const GLUCOSE_CONVERSION = 18.016;

export type Metric = 'bp' | 'glucose';
export type Reading =
  | { metric: 'bp'; systolic: number; diastolic: number; pulse: number | null }
  | { metric: 'glucose'; value: number; unit: 'mg/dL' | 'mmol/L' };

export class InvalidImage extends Error {}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/** A signature check is not a full JPEG decoder; the vision provider must also accept it. */
export function validateInput(body: unknown): { image: string; metric: Metric } {
  if (
    !object(body) || !exactKeys(body, ['image', 'metric']) ||
    (body['metric'] !== 'bp' && body['metric'] !== 'glucose') || typeof body['image'] !== 'string'
  ) {
    throw new InvalidImage();
  }
  const prefix = 'data:image/jpeg;base64,';
  if (!body['image'].startsWith(prefix) || body['image'].length > MAX_REQUEST_BYTES) {
    throw new InvalidImage();
  }
  const encoded = body['image'].slice(prefix.length);
  if (
    !encoded || encoded.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
  ) {
    throw new InvalidImage();
  }
  let bytes: string;
  try {
    bytes = atob(encoded);
  } catch {
    throw new InvalidImage();
  }
  if (
    btoa(bytes) !== encoded || bytes.length < 5 ||
    bytes.charCodeAt(0) !== 0xff || bytes.charCodeAt(1) !== 0xd8 ||
    bytes.charCodeAt(2) !== 0xff || bytes.charCodeAt(bytes.length - 2) !== 0xff ||
    bytes.charCodeAt(bytes.length - 1) !== 0xd9
  ) {
    throw new InvalidImage();
  }
  return { image: body['image'], metric: body['metric'] };
}

export async function readJson(request: Request): Promise<unknown> {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) {
    throw new InvalidImage();
  }
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
      'application/json' ||
    !request.body
  ) throw new InvalidImage();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new InvalidImage();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new InvalidImage();
  } finally {
    reader.releaseLock();
  }
}

/** Treat the model response as untrusted, even with a strict provider schema. */
export function validateReading(result: unknown, metric: Metric): Reading | null {
  if (
    !object(result) || !exactKeys(result, ['status', 'reading']) || result['status'] !== 'ok' ||
    !object(result['reading'])
  ) return null;
  const reading = result['reading'];
  if (reading['metric'] !== metric) return null;
  if (metric === 'bp') {
    if (
      !exactKeys(reading, ['metric', 'systolic', 'diastolic', 'pulse']) ||
      !inRange(reading['systolic'], 50, 250) || !Number.isInteger(reading['systolic']) ||
      !inRange(reading['diastolic'], 30, 150) || !Number.isInteger(reading['diastolic']) ||
      reading['systolic'] <= reading['diastolic'] ||
      (reading['pulse'] !== null &&
        (!inRange(reading['pulse'], 30, 220) || !Number.isInteger(reading['pulse'])))
    ) {
      return null;
    }
    return {
      metric,
      systolic: reading['systolic'],
      diastolic: reading['diastolic'],
      pulse: reading['pulse'] as number | null,
    };
  }
  if (
    !exactKeys(reading, ['metric', 'value', 'unit']) ||
    (reading['unit'] !== 'mg/dL' && reading['unit'] !== 'mmol/L') ||
    typeof reading['value'] !== 'number' || !Number.isFinite(reading['value'])
  ) return null;
  const canonical = reading['unit'] === 'mmol/L'
    ? reading['value'] * GLUCOSE_CONVERSION
    : reading['value'];
  if (!inRange(canonical, 20, 600)) return null;
  return { metric, value: reading['value'], unit: reading['unit'] };
}

export function responseSchema(metric: Metric): Record<string, unknown> {
  const properties = metric === 'bp'
    ? {
      metric: { type: 'string', enum: ['bp'] },
      systolic: { type: 'number' },
      diastolic: { type: 'number' },
      pulse: { type: ['number', 'null'] },
    }
    : {
      metric: { type: 'string', enum: ['glucose'] },
      value: { type: 'number' },
      unit: { type: 'string', enum: ['mg/dL', 'mmol/L'] },
    };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['status', 'reading'],
    properties: {
      status: { type: 'string', enum: ['ok', 'unreadable'] },
      reading: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: Object.keys(properties),
            properties,
          },
          { type: 'null' },
        ],
      },
    },
  };
}
