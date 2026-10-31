# Device photo readings

The blood-pressure and glucose entry forms offer camera/photo import. The `extract-device-reading` Supabase Edge Function sends one device photo to a configured **OpenAI-compatible vision endpoint**. There are no provider presets, vendor-specific API keys, automatic model selection, or provider-specific request branches.

The model transcribes a display; it does not diagnose or save readings. The user must review and confirm values before the existing observation-save flow runs. Photos are not saved to Supabase Storage or offline storage, and sensitive payloads are not logged. The function's only database writes are quota counters.

## Server configuration

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Set these additional secrets **on the server**, never in Angular environment files or the app:

| Variable | Required | Meaning |
| --- | --- | --- |
| `IMAGE_AI_API_KEY` | Yes | Bearer key for the configured endpoint |
| `IMAGE_AI_API_URL` | Yes | **Full HTTPS completion URL**, including its route; used as configured, with no appended `/chat/completions` |
| `IMAGE_AI_MODEL` | Yes | Exact vision-capable model ID available to your account |
| `IMAGE_AI_OUTPUT_MODE` | No | `prompt` (default), `json_object`, or `json_schema`; choose only a mode supported by the selected model |
| `IMAGE_AI_MAX_IMAGE_BYTES` | No | Decoded JPEG limit, 1,024–2,850,000 bytes; defaults to 2,850,000. Set a smaller value when required by the endpoint |
| `DEVICE_PHOTO_ALLOWED_ORIGINS` | Browser/WebView calls | Comma-separated exact allowed app origins, with no paths or trailing slashes |

### NVIDIA Llama 3.2 Vision example

The [NVIDIA catalog](https://build.nvidia.com/meta/llama-3.2-90b-vision-instruct) documents this model and completion URL:

```dotenv
IMAGE_AI_API_KEY=YOUR_SERVER_ONLY_API_KEY
IMAGE_AI_API_URL=https://integrate.api.nvidia.com/v1/chat/completions
IMAGE_AI_MODEL=meta/llama-3.2-90b-vision-instruct
IMAGE_AI_OUTPUT_MODE=prompt
DEVICE_PHOTO_ALLOWED_ORIGINS=https://app.example.com,capacitor://localhost,http://localhost
```

The NVIDIA JavaScript sample uses this endpoint/model, bearer authentication, and a user message containing `image_url` and text. We use the same message contract with `stream: false` and `Accept: application/json` so the backend can validate a complete response before returning a reading. Native `fetch` replaces Axios in the edge function; no Axios dependency or streaming/SSE parser is needed. The sample's sampling/penalty parameters are optional and are not required by this adapter. Our completion budget is 1,024 tokens rather than the sample's 512.

The sample demonstrates a **public image URL**, not an inline JPEG data URL. It does not by itself verify support for our private camera-photo payload; confirm that with a non-identifying test image rather than making users' photos publicly accessible.

The catalog lists structured output as unsupported, so the example requests JSON through the prompt and applies strict local validation rather than sending a `response_format` option. Confirm that the model and inline JPEG data URLs are supported by your account/region before deployment. Catalog examples, availability, quotas, and image limits can change. Older NVIDIA routes documented small **base64** payload limits and asset uploads; if your endpoint imposes a 180,000-character base64 limit, a conservative `IMAGE_AI_MAX_IMAGE_BYTES=130000` leaves room for encoding overhead. This application does not implement asset uploads, HTML image tags, asynchronous polling, or other model-specific protocols.

This is a configuration example, **not a claim of live integration testing or superior accuracy**. Benchmark segmented digits, decimal points, units, glare, and different device layouts with representative photos before choosing a model.

**Health-data warning:** the NVIDIA trial catalog says inputs/outputs are recorded for the trial and product improvement and prohibits confidential/personal data unless expressly permitted. Use synthetic/non-identifying demo photos unless your service agreement explicitly permits the intended real-user health data. A key or OpenAI-compatible interface does not establish privacy or regulatory suitability.

For another compatible service, change the URL, key, model, and supported output mode—there is no provider selector and no frontend rebuild. The former provider-specific settings are no longer read; migrate to the `IMAGE_AI_*` variables above. Never commit real credentials. For example, upload secrets from a protected, untracked file outside the repository:

```sh
supabase secrets set --project-ref YOUR_PROJECT_REF --env-file /secure/image-ai.env
```

Restart/redeploy the function as required by your platform after changing secrets.

## Request compatibility and validation

All configured endpoints receive the same non-streaming Chat Completions request: `model`, `messages`, `max_tokens: 1024`, and `stream: false`. A single user message contains extraction instructions, the expected JSON schema, and an `image_url` JPEG data URL. No vendor-specific `store`, image-detail, or token-parameter options are inferred from the endpoint hostname.

- `prompt`: omits `response_format` and asks for a JSON object in the prompt.
- `json_object`: adds `response_format: { type: 'json_object' }`.
- `json_schema`: adds the strict schema through `response_format`.

Compatibility includes more than a similar URL: the endpoint must accept those image messages and parameters and return `choices[0].message.content` with `finish_reason: 'stop'`. Unsupported capabilities fail closed; they are not retried with weaker settings. The backend rejects malformed JSON, refusals, truncated responses, wrong metrics, extra/missing fields, and invalid values in **every** output mode.

BP requires integer systolic 50–250, diastolic 30–150, and systolic greater than diastolic. Optional pulse is an integer 30–220 or null. Glucose requires a visibly identifiable `mg/dL` or `mmol/L` unit and a value within 20–600 mg/dL after conversion using 18.016. The model is instructed to reject uncertain digits, HI/LO/errors, missing glucose units, history lists, and multiple devices. Validation cannot independently prove what is visible in a photo, so human verification remains mandatory.

`provider.ts` handles generic endpoint configuration and transport; `validation.ts` owns the domain rules. There are no new frontend AI SDKs or local model downloads.

## User flow and consent

1. Open Blood Pressure or Blood Glucose and choose **Take photo** or **Choose photo**. Photo import is available for new readings, not editing existing readings.
2. Fetch the endpoint disclosure without sending a photo. Prepare a preview locally and ask for consent naming the **actual endpoint hostname**, not a hardcoded provider name.
3. Only **Read photo** transmits the image. Successful extraction fills editable form fields, including optional BP pulse; it never automatically creates an observation.
4. Compare values, units, and measurement time with the device, correct mistakes, and check the review confirmation before **Save**. Measurement time is set to now, not extracted from the device; change it for older readings.

Changing the endpoint, model, output mode, or byte limit changes the consent fingerprint. Stale submissions are rejected before quota use or inference, and the user must select the photo and consent again. Rotating only the key does not change the fingerprint. There are no automatic retries or cross-endpoint fallbacks that could send health data to another destination.

The frontend accepts JPEG/PNG/WebP up to 20 MiB, re-encodes to JPEG with a maximum 1600-pixel edge, strips EXIF/location metadata, and enforces the configured decoded-byte limit and a 3,800,000-character encoded limit. Quality can step down from 0.9 to 0.8 or 0.7; images that still exceed the limit are rejected rather than aggressively shrinking digits. Crop to the display for small endpoint limits. HEIC is not supported. Photos/consent stay in memory only and are cleared on removal/page leave; originals may still exist in the device photo library. New interface text falls back to English in other languages.

HTML `capture="environment"` is a camera hint, not a guaranteed native-camera integration. Verify camera permissions, capture, orientation, format, and gallery selection on physical Android/iOS devices and browsers before release. Manual entry remains available; AI extraction requires internet access.

## Application API

Use an authenticated Supabase client:

```ts
const { data: disclosure } = await supabase.functions.invoke('extract-device-reading', {
  method: 'GET',
});
// Show disclosure.provider.label and obtain consent before sending the image.
const { data, error } = await supabase.functions.invoke('extract-device-reading', {
  body: {
    image: jpegDataUrl,
    metric: 'bp', // or 'glucose'
    consentToken: disclosure.provider.consentToken,
  },
});
```

GET returns `{ provider: { label, consentToken, maxImageBytes } }` without credentials, model calls, or quota use. POST accepts only the three fields shown. Clients cannot supply an endpoint, API key, model, or user ID. The entire streamed JSON request is limited to 4 MiB; only canonical JPEG data URLs are accepted and JPEG signatures checked.

Successful responses remain:

```json
{"reading":{"metric":"bp","systolic":120,"diastolic":80,"pulse":null}}
```

```json
{"reading":{"metric":"glucose","value":5.5,"unit":"mmol/L"}}
```

The frontend converts glucose to preferred display units and saves canonical mg/dL; the original canonical value is preserved across display rounding unless the user edits the value. Existing offline-save and clinical-warning behavior remains in use.

Function-generated errors are `{ "error": "code" }`: `invalid_image` (400/405), `unauthorized` (401/403), `configuration_changed` (409), `unreadable` (422), `rate_limited` (429), and `unavailable` (503). Gateway/network errors may not use this envelope. `functions.invoke` exposes non-2xx responses through its error context. Deploy backend and frontend together when migrating the disclosure contract.

## Security, limits, and privacy

Every GET/POST verifies the bearer JWT through Supabase `auth.getUser`; merely decoding a JWT is insufficient. Provider URLs are server-only HTTPS settings; credentials/query strings/fragments in the URL are rejected. HTTP redirects are refused to avoid forwarding images and credentials elsewhere. Inference has a 20-second timeout covering fetch and body consumption; Auth and quota calls each have a 10-second timeout. Requests, photos, readings, credentials, and upstream error bodies are not logged or surfaced to clients. Do not enable request-body tracing in surrounding infrastructure.

Apply `supabase/edge-functions/extract-device-reading/rate_limit.sql` through the Supabase SQL Editor or an administrative PostgreSQL connection **before deployment**. The `consume_device_photo_quota` RPC uses row locks for a persistent limit of 5 valid attempts per UTC-aligned minute and 30 per UTC day per user across edge instances. Valid attempts count even if inference fails. The quota table contains only user UUIDs and counters/window timestamps; RLS is enabled, with table/RPC access restricted to the server service role. Account deletion cascades to the counter. SQL failures fail closed. Fixed windows allow bursts around boundaries; this does not replace signup protections, global budgets, or WAF controls.

CORS uses `DEVICE_PHOTO_ALLOWED_ORIGINS`; there is no wildcard fallback. Include only actual production origins. Local examples are `http://localhost:8100` and `http://localhost:4200`; Capacitor may use `capacitor://localhost` or `http://localhost`. Check the actual Origin header. `ionic://localhost` is also supported. Origin-less native/CLI requests still require authentication and quota. CORS is not authentication or an abuse-prevention mechanism.

Obtain explicit consent before uploading, minimize identifying content, and review the chosen service's retention/training rules, medical-use restrictions, processing regions, costs/quotas, and required agreements. Do not assume a free tier permits sensitive health data or claim HIPAA compliance without the necessary review and agreements.

## Deployment

Sources live in `supabase/edge-functions/`, not the CLI's usual `supabase/functions/`. Stage a new disposable CLI project from the repository root (POSIX/WSL example):

```sh
mkdir -p /tmp/vivia-photo-edge
supabase init --workdir /tmp/vivia-photo-edge
mkdir -p /tmp/vivia-photo-edge/supabase/functions
cp -R supabase/edge-functions/extract-device-reading /tmp/vivia-photo-edge/supabase/functions/
supabase functions deploy extract-device-reading \
  --workdir /tmp/vivia-photo-edge --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

Use equivalent temporary-directory/copy commands in PowerShell. Copy the whole folder, including `deno.json`; apply SQL separately because function deployment does not run it. Restage the latest source for every deployment. `--no-verify-jwt` disables only the gateway's legacy JWT check; the function always verifies through `getUser`. Never remove that application check.

## Validation

From the function directory, with Deno 2:

```sh
deno task test
deno task check
deno lint index.ts provider.ts provider_test.ts validation.ts validation_test.ts
deno fmt --check
```

Backend tests cover generic settings, destination disclosure, unchanged full endpoints, consent invalidation, output modes, HTTP failures/timeouts, input limits, reading validation, and quota SQL integration fixtures. HTTP calls in `provider_test.ts` are mocked: they do not establish live model compatibility or accuracy. The optional `rate_limit_test.sql` must run only against a disposable database after its companion migration. Enable the Zed Deno language server for this function directory; Angular's TypeScript environment does not provide Deno globals/module resolution.

Before release, test the deployed endpoint with expired JWTs, allowed/disallowed origins, corrupt/oversized images, changed configuration while awaiting consent, quota boundaries/concurrency, upstream failures, and representative clear/ambiguous device photos. Real-model calls incur costs and transmit images; use demo data and verify results before enabling real-user uploads.
