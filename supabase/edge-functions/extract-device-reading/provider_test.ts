import {
  extractReading,
  loadVisionConfig,
  ProviderError,
  publicVisionConfig,
  validatePhotoRequest,
  visionRequest,
} from './provider.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}
function equal(actual: unknown, expected: unknown) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), 'Values differ');
}
async function fails(action: () => unknown | Promise<unknown>, code: ProviderError['code']) {
  try {
    await action();
  } catch (error) {
    assert(error instanceof ProviderError && error.code === code, `Expected ${code}`);
    return;
  }
  throw new Error(`Expected ${code}`);
}
const env = (values: Record<string, string | undefined>) => (name: string) => values[name];
const settings = {
  IMAGE_AI_API_KEY: 'test-secret',
  IMAGE_AI_API_URL: 'https://vision.example.com/v1/chat/completions',
  IMAGE_AI_MODEL: 'vision-model',
};
const configured = (overrides: Record<string, string | undefined> = {}) =>
  loadVisionConfig(env({ ...settings, ...overrides }));
const image = 'data:image/jpeg;base64,' + btoa('\xff\xd8\xff\xe0\x00\xff\xd9');
const input = { image, metric: 'bp' as const };
const bp = { metric: 'bp', systolic: 120, diastolic: 80, pulse: null };
const envelope = (content: string, finish_reason = 'stop', refusal: string | null = null) =>
  Response.json({ choices: [{ finish_reason, message: { content, refusal } }] });
const ok = () => envelope(JSON.stringify({ status: 'ok', reading: bp }));

Deno.test('generic configuration discloses the actual hostname, never credentials', async () => {
  const config = await configured();
  equal(config.endpoint, settings.IMAGE_AI_API_URL);
  equal(config.model, settings.IMAGE_AI_MODEL);
  equal(config.outputMode, 'prompt');
  equal(config.label, 'vision.example.com');
  const disclosure = publicVisionConfig(config);
  equal(Object.keys(disclosure.provider).sort(), ['consentToken', 'label', 'maxImageBytes']);
  assert(!JSON.stringify(disclosure).includes('test-secret'));
  assert(!JSON.stringify(disclosure).includes('vision-model'));
});

Deno.test('requires an explicit API key, full URL and model without provider defaults', async () => {
  for (const name of ['IMAGE_AI_API_KEY', 'IMAGE_AI_API_URL', 'IMAGE_AI_MODEL']) {
    await fails(() => configured({ [name]: undefined }), 'unavailable');
    await fails(() => configured({ [name]: ' ' }), 'unavailable');
  }
  await fails(() => loadVisionConfig(env({})), 'unavailable');
});

Deno.test('uses configured endpoints verbatim, including model-specific paths', async () => {
  for (
    const endpoint of [
      'https://integrate.api.nvidia.com/v1/chat/completions',
      'https://vision.example.com/models/custom/completions',
    ]
  ) {
    const config = await configured({
      IMAGE_AI_API_URL: endpoint,
      IMAGE_AI_MODEL: 'meta/llama-3.2-90b-vision-instruct',
      IMAGE_AI_MAX_IMAGE_BYTES: '130000',
    });
    equal(config.endpoint, endpoint);
    equal(config.model, 'meta/llama-3.2-90b-vision-instruct');
    equal(config.maxImageBytes, 130000);
  }
});

Deno.test('invalid endpoints and capability settings fail closed', async () => {
  for (
    const extra of [
      { IMAGE_AI_OUTPUT_MODE: 'automatic' },
      { IMAGE_AI_API_URL: 'not-a-url' },
      { IMAGE_AI_API_URL: 'http://vision.example.com/v1/chat/completions' },
      { IMAGE_AI_API_URL: 'https://vision.example.com/v1/chat/completions?key=secret' },
      { IMAGE_AI_API_URL: 'https://vision.example.com/v1/chat/completions#fragment' },
      { IMAGE_AI_API_URL: 'https://user:pass@vision.example.com/v1/chat/completions' },
      { IMAGE_AI_API_KEY: 'invalid\nheader' },
      { IMAGE_AI_MODEL: 'invalid\nmodel' },
      { IMAGE_AI_MAX_IMAGE_BYTES: '0' },
      { IMAGE_AI_MAX_IMAGE_BYTES: '3000000' },
    ]
  ) await fails(() => configured(extra), 'unavailable');
});

Deno.test('consent fingerprint changes with destination/model/options, but not key rotation', async () => {
  const config = await configured();
  const rotated = await configured({ IMAGE_AI_API_KEY: 'new-secret' });
  equal(config.consentToken, rotated.consentToken);
  for (
    const extra of [
      { IMAGE_AI_API_URL: 'https://another.example.com/v1/chat/completions' },
      { IMAGE_AI_API_URL: 'https://vision.example.com/another/completions' },
      { IMAGE_AI_MODEL: 'another-model' },
      { IMAGE_AI_MAX_IMAGE_BYTES: '100000' },
      { IMAGE_AI_OUTPUT_MODE: 'json_object' },
    ]
  ) {
    const changed = await configured(extra);
    assert(config.consentToken !== changed.consentToken);
  }
  equal(validatePhotoRequest({ ...input, consentToken: config.consentToken }, config), input);
  await fails(() => validatePhotoRequest(input, config), 'configuration_changed');
  await fails(
    () => validatePhotoRequest({ ...input, consentToken: 'stale' }, config),
    'configuration_changed',
  );
  await fails(
    () =>
      validatePhotoRequest({
        ...input,
        consentToken: config.consentToken,
        endpoint: 'https://other.example.com',
      }, config),
    'invalid_image',
  );
});

Deno.test('configured decoded-byte limits reject oversized images before inference', async () => {
  const config = await configured({ IMAGE_AI_MAX_IMAGE_BYTES: '1024' });
  const large = 'data:image/jpeg;base64,' + btoa('\xff\xd8\xff' + 'a'.repeat(1100) + '\xff\xd9');
  await fails(
    () =>
      validatePhotoRequest(
        { image: large, metric: 'bp', consentToken: config.consentToken },
        config,
      ),
    'invalid_image',
  );
});

Deno.test('one compatible request format supports explicit output modes without vendor-specific fields', async () => {
  const config = await configured();
  const request = visionRequest(config, input);
  equal(request['max_tokens'], 1024);
  assert(
    !('store' in request) && !('max_completion_tokens' in request) &&
      !('response_format' in request),
  );
  const messages = request['messages'] as { content: { type: string; image_url?: object }[] }[];
  equal(messages[0].content[1].image_url, { url: image });
  assert(JSON.stringify(request).includes('Never guess units'));
  const json = visionRequest({ ...config, outputMode: 'json_object' }, input);
  equal(json['response_format'], { type: 'json_object' });
  const schema = visionRequest({ ...config, outputMode: 'json_schema' }, input);
  const format = schema['response_format'] as { type: string; json_schema: { strict: boolean } };
  equal(format.type, 'json_schema');
  equal(format.json_schema.strict, true);
});

Deno.test('configured endpoint and credentials are used for exactly one request', async () => {
  for (
    const endpoint of [settings.IMAGE_AI_API_URL, 'https://another.example.com/custom/completions']
  ) {
    const config = await configured({ IMAGE_AI_API_URL: endpoint });
    let count = 0;
    const transport: typeof fetch = (url, init) => {
      count++;
      equal(url, endpoint);
      equal(init?.redirect, 'error');
      equal((init?.headers as Record<string, string>)['Authorization'], 'Bearer test-secret');
      return Promise.resolve(ok());
    };
    equal(await extractReading(config, input, transport), bp);
    equal(count, 1);
  }
});

Deno.test('NVIDIA example configuration uses a non-streaming JSON request (mocked)', async () => {
  const config = await configured({
    IMAGE_AI_API_URL: 'https://integrate.api.nvidia.com/v1/chat/completions',
    IMAGE_AI_MODEL: 'meta/llama-3.2-90b-vision-instruct',
  });
  let calls = 0;
  const transport: typeof fetch = (url, init) => {
    calls++;
    equal(url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    const headers = new Headers(init?.headers);
    equal(headers.get('Authorization'), 'Bearer test-secret');
    equal(headers.get('Accept'), 'application/json');
    equal(headers.get('Content-Type'), 'application/json');
    const payload = JSON.parse(String(init?.body));
    equal(payload.model, 'meta/llama-3.2-90b-vision-instruct');
    equal(payload.stream, false);
    equal(payload.max_tokens, 1024);
    equal(payload.messages[0].role, 'user');
    equal(payload.messages[0].content[1], { type: 'image_url', image_url: { url: image } });
    assert(!('response_format' in payload));
    return Promise.resolve(ok());
  };
  equal(await extractReading(config, input, transport), bp);
  equal(calls, 1);
});

Deno.test('malformed, refused, truncated and invalid model readings are rejected in every output mode', async () => {
  const config = await configured();
  for (const outputMode of ['prompt', 'json_object', 'json_schema'] as const) {
    for (
      const make of [
        () => envelope('not JSON'),
        () => envelope('```json\n{}\n```'),
        () => envelope(JSON.stringify({ status: 'unreadable', reading: null })),
        () => envelope(JSON.stringify({ status: 'ok', reading: { ...bp, systolic: 40 } })),
        () =>
          envelope(
            JSON.stringify({
              status: 'ok',
              reading: { metric: 'glucose', value: 100, unit: 'mg/dL' },
            }),
          ),
        () => envelope(JSON.stringify({ status: 'ok', reading: bp }), 'length'),
        () => envelope(JSON.stringify({ status: 'ok', reading: bp }), 'stop', 'refused'),
      ]
    ) {
      await fails(
        () => extractReading({ ...config, outputMode }, input, () => Promise.resolve(make())),
        'unreadable',
      );
    }
  }
});

Deno.test('HTTP failures never leak endpoint messages or retry another destination', async () => {
  const config = await configured();
  for (const status of [400, 401, 403, 429, 500]) {
    let calls = 0;
    const transport: typeof fetch = () => {
      calls++;
      return Promise.resolve(new Response('private-provider-error', { status }));
    };
    await fails(
      () => extractReading(config, input, transport),
      status === 429 ? 'rate_limited' : 'unavailable',
    );
    equal(calls, 1);
  }
  await fails(
    () => extractReading(config, input, () => Promise.reject(new Error('private-secret'))),
    'unavailable',
  );
});

Deno.test('timeout covers fetch and response-body consumption', async () => {
  const config = await configured();
  const waitingFetch: typeof fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  await fails(() => extractReading(config, input, waitingFetch, 5), 'unavailable');
  const waitingBody: typeof fetch = (_url, init) =>
    Promise.resolve(
      new Response(
        new ReadableStream({
          start(controller) {
            init?.signal?.addEventListener('abort', () =>
              controller.error(new Error('aborted body')), { once: true });
          },
        }),
      ),
    );
  await fails(() => extractReading(config, input, waitingBody, 5), 'unavailable');
});
