import { createClient } from '@supabase/supabase-js';
import { InvalidImage, readJson } from './validation.ts';
import {
  extractReading,
  loadVisionConfig,
  ProviderError,
  publicVisionConfig,
  validatePhotoRequest,
} from './provider.ts';

const allowedOrigins = new Set(
  (Deno.env.get('DEVICE_PHOTO_ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(
    (origin) => {
      if (origin === 'capacitor://localhost' || origin === 'ionic://localhost') return true;
      try {
        const url = new URL(origin);
        return ['https:', 'http:'].includes(url.protocol) && url.origin === origin;
      } catch {
        return false;
      }
    },
  ),
);

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get('origin');
  const headers = new Headers({
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'authorization, apikey, content-type, x-client-info',
    );
    headers.set('Access-Control-Expose-Headers', 'Retry-After');
    headers.set('Access-Control-Max-Age', '600');
  }
  const fail = (code: string, status: number, retryAfter?: number): Response => {
    if (retryAfter !== undefined) headers.set('Retry-After', String(retryAfter));
    return new Response(JSON.stringify({ error: code }), { status, headers });
  };
  if (origin && !allowedOrigins.has(origin)) return fail('unauthorized', 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (!['POST', 'GET'].includes(request.method)) {
    headers.set('Allow', 'GET, POST, OPTIONS');
    return fail('invalid_image', 405);
  }
  const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) return fail('unauthorized', 401);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return fail('unavailable', 503);
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
      },
    });
    // Verify with Auth, not merely a decoded JWT. Never use a client-supplied user ID.
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError) {
      return authError.status && [400, 401, 403].includes(authError.status)
        ? fail('unauthorized', 401)
        : fail('unavailable', 503);
    }
    if (!auth.user) return fail('unauthorized', 401);

    const config = await loadVisionConfig((name) => Deno.env.get(name));
    // Disclosure contains no secrets. Fetching it never consumes quota or calls a vision model.
    if (request.method === 'GET') {
      return new Response(JSON.stringify(publicVisionConfig(config)), { status: 200, headers });
    }
    const input = validatePhotoRequest(await readJson(request), config);

    // The SQL function serializes concurrent requests across all edge instances.
    const { data: quota, error: quotaError } = await supabase.rpc('consume_device_photo_quota', {
      p_user_id: auth.user.id,
    });
    if (
      quotaError || !quota || typeof quota.allowed !== 'boolean' ||
      !Number.isInteger(quota.retry_after) || quota.retry_after < 0 || quota.retry_after > 86400
    ) return fail('unavailable', 503);
    if (!quota.allowed) return fail('rate_limited', 429, Math.max(1, quota.retry_after));

    const reading = await extractReading(config, input);
    return new Response(JSON.stringify({ reading }), { status: 200, headers });
  } catch (error) {
    if (error instanceof InvalidImage) return fail('invalid_image', 400);
    if (error instanceof ProviderError) {
      const status = {
        configuration_changed: 409,
        invalid_image: 400,
        unreadable: 422,
        rate_limited: 429,
        unavailable: 503,
      }[error.code];
      return fail(error.code, status, error.code === 'rate_limited' ? 60 : undefined);
    }
    // Do not log requests, images, readings, tokens, or provider error payloads.
    return fail('unavailable', 503);
  }
});
