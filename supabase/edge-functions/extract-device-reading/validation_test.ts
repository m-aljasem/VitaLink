import {
  GLUCOSE_CONVERSION,
  InvalidImage,
  MAX_REQUEST_BYTES,
  readJson,
  responseSchema,
  validateInput,
  validateReading,
} from './validation.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function equal(actual: unknown, expected: unknown) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function invalid(body: unknown) {
  try {
    validateInput(body);
  } catch (error) {
    assert(error instanceof InvalidImage);
    return;
  }
  throw new Error('Expected InvalidImage');
}

async function invalidRequest(request: Request) {
  try {
    await readJson(request);
  } catch (error) {
    assert(error instanceof InvalidImage);
    return;
  }
  throw new Error('Expected InvalidImage');
}

// Deliberately only a signature fixture, not a decodable photo.
const image = 'data:image/jpeg;base64,' + btoa('\xff\xd8\xff\xe0\x00\xff\xd9');
const bp = { metric: 'bp', systolic: 120, diastolic: 80, pulse: null };
const glucose = { metric: 'glucose', value: 5.5, unit: 'mmol/L' };
const ok = (reading: unknown) => ({ status: 'ok', reading });

Deno.test('accepts canonical JPEG signatures and only the two supported metrics', () => {
  equal(validateInput({ image, metric: 'bp' }), { image, metric: 'bp' });
  equal(validateInput({ image, metric: 'glucose' }), { image, metric: 'glucose' });
  for (
    const body of [null, [], {}, { image, metric: 'weight' }, {
      image,
      metric: 'bp',
      user_id: 'other',
    }, { image: 123, metric: 'bp' }]
  ) invalid(body);
});

Deno.test('rejects non-JPEG, malformed/noncanonical base64 and wrong signatures', () => {
  for (
    const value of [
      image.replace('image/jpeg', 'image/png'),
      'https://example.com/photo.jpg',
      'data:image/jpeg;base64,',
      image + '\n',
      image + '=',
      image.replace('Q==', 'R=='), // Same decoded bytes, non-zero padding bits.
      'data:image/jpeg;base64,' + btoa('not a jpeg'),
      'data:image/jpeg;base64,' + btoa('\xff\xd8\xff\xe0'),
      'data:image/jpeg;base64,' + btoa('\x00\xd8\xff\xff\xd9'),
      'data:image/jpeg;base64,' + 'A'.repeat(MAX_REQUEST_BYTES),
    ]
  ) invalid({ image: value, metric: 'bp' });
});

Deno.test('large JPEG base64 is validated without a recursive/repeated-group regex', () => {
  const bytes = '\xff\xd8\xff' + '\x00'.repeat(2 * 1024 * 1024) + '\xff\xd9';
  const largeImage = 'data:image/jpeg;base64,' + btoa(bytes);
  assert(validateInput({ image: largeImage, metric: 'bp' }).image === largeImage);
});

Deno.test('bounded JSON parser accepts JSON and enforces content type and syntax', async () => {
  const request = (body: string, type = 'application/json; charset=utf-8') =>
    new Request('https://example.test', {
      method: 'POST',
      headers: { 'Content-Type': type },
      body,
    });
  equal(await readJson(request(JSON.stringify({ image, metric: 'bp' }))), { image, metric: 'bp' });
  await invalidRequest(request('{}', 'text/plain'));
  await invalidRequest(request('{'));
  await invalidRequest(
    new Request('https://example.test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(MAX_REQUEST_BYTES + 1),
      },
      body: '{}',
    }),
  );
  await invalidRequest(
    new Request('https://example.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: new Uint8Array([0xff]),
    }),
  );
});

Deno.test('request limit counts streamed bytes, not a trusted Content-Length or string characters', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_REQUEST_BYTES));
      controller.enqueue(new Uint8Array([0]));
    },
    cancel() {
      cancelled = true;
    },
  });
  await invalidRequest(
    new Request('https://example.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '1' },
      body,
    }),
  );
  assert(cancelled);
  const unicode = JSON.stringify('é'.repeat(MAX_REQUEST_BYTES / 2));
  await invalidRequest(
    new Request('https://example.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: unicode,
    }),
  );
});

Deno.test('BP validates inclusive bounds, ordering, integer values and nullable pulse', () => {
  equal(validateReading(ok(bp), 'bp'), bp);
  for (
    const reading of [
      { ...bp, systolic: 50, diastolic: 30, pulse: 30 },
      { ...bp, systolic: 250, diastolic: 150, pulse: 220 },
    ]
  ) equal(validateReading(ok(reading), 'bp'), reading);
  for (
    const patch of [
      { systolic: 49 },
      { systolic: 251 },
      { diastolic: 29 },
      { diastolic: 151 },
      { systolic: 80 },
      { systolic: 79 },
      { systolic: 120.5 },
      { diastolic: 80.5 },
      { pulse: 29 },
      { pulse: 221 },
      { pulse: 65.5 },
      { pulse: undefined },
      { pulse: '65' },
      { systolic: '120' },
      { systolic: NaN },
      { systolic: Infinity },
      { extra: true },
    ]
  ) equal(validateReading(ok({ ...bp, ...patch }), 'bp'), null);
});

Deno.test('glucose validates canonical 20–600 mg/dL using 18.016 and preserves visible units', () => {
  equal(validateReading(ok(glucose), 'glucose'), glucose);
  for (const value of [20, 600]) {
    const mg = { metric: 'glucose', value, unit: 'mg/dL' };
    equal(validateReading(ok(mg), 'glucose'), mg);
    const mmol = { metric: 'glucose', value: value / GLUCOSE_CONVERSION, unit: 'mmol/L' };
    equal(validateReading(ok(mmol), 'glucose'), mmol);
  }
  for (
    const reading of [
      { ...glucose, value: 1.1 },
      { ...glucose, value: 33.4 },
      { ...glucose, value: 19.99, unit: 'mg/dL' },
      { ...glucose, value: 600.01, unit: 'mg/dL' },
      { ...glucose, unit: null },
      { ...glucose, unit: undefined },
      { ...glucose, unit: 'mg/dl' },
      { ...glucose, value: 'HI' },
      { ...glucose, value: 'LO' },
      { ...glucose, value: '5.5' },
      { ...glucose, value: Infinity },
      { ...glucose, value: -1 },
      { ...glucose, extra: true },
    ]
  ) equal(validateReading(ok(reading), 'glucose'), null);
});

Deno.test('rejects unreadable, mismatched metrics, missing/extra fields and malformed envelopes', () => {
  equal(validateReading(ok(bp), 'glucose'), null);
  equal(validateReading(ok(glucose), 'bp'), null);
  for (
    const result of [
      null,
      [],
      bp,
      { reading: bp },
      { status: 'unreadable', reading: bp },
      { status: 'ok', reading: null },
      { status: 'ok', reading: [bp] },
      { status: 'ok', reading: bp, confidence: 1 },
    ]
  ) equal(validateReading(result, 'bp'), null);
});

Deno.test('both response schemas require every field and forbid extras', () => {
  for (const metric of ['bp', 'glucose'] as const) {
    const schema = responseSchema(metric);
    assert(schema['type'] === 'object' && schema['additionalProperties'] === false);
    equal(schema['required'], ['status', 'reading']);
    const properties = schema['properties'] as Record<string, { anyOf: Record<string, unknown>[] }>;
    const reading = properties['reading'].anyOf[0];
    assert(reading['additionalProperties'] === false);
    equal(reading['required'], Object.keys(reading['properties'] as object));
  }
});
