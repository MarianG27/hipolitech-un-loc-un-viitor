import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const jsonHeaders = (origin: string | null) => ({
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': origin ?? 'null',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'vary': 'Origin'
});

const readNamedKey = (name: string, fallback: string) => {
  const named = Deno.env.get(name);
  if (named) {
    try { return JSON.parse(named).default as string; } catch (_) { /* Folosește cheia legacy dacă există. */ }
  }
  return Deno.env.get(fallback) || '';
};

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

const allowedOrigins = () => (Deno.env.get('ANALYTICS_SITE_ORIGINS') || '')
  .split(',').map(origin => origin.trim().replace(/\/$/, '')).filter(Boolean);

const originFor = (request: Request) => {
  const origin = request.headers.get('origin')?.replace(/\/$/, '') || null;
  return origin && allowedOrigins().includes(origin) ? origin : null;
};

const clientIp = (request: Request) => {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return request.headers.get('cf-connecting-ip') || forwarded || request.headers.get('x-real-ip') || 'unavailable';
};

Deno.serve(async request => {
  const allowedOrigin = originFor(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: allowedOrigin ? 204 : 403, headers: jsonHeaders(allowedOrigin) });
  if (request.method !== 'POST' || !allowedOrigin) return new Response(JSON.stringify({ error: 'not allowed' }), { status: 403, headers: jsonHeaders(allowedOrigin) });
  if (Number(request.headers.get('content-length') || 0) > 1024) return new Response(JSON.stringify({ error: 'payload too large' }), { status: 413, headers: jsonHeaders(allowedOrigin) });

  try {
    const body = await request.json();
    const path = typeof body.path === 'string' ? body.path : '';
    if (body.event !== 'pageview' || body.honeypot !== '' || !/^\/[A-Za-z0-9._/-]{0,159}$/.test(path)) {
      return new Response(JSON.stringify({ error: 'invalid event' }), { status: 400, headers: jsonHeaders(allowedOrigin) });
    }

    const secret = Deno.env.get('ANALYTICS_HASH_SECRET') || '';
    const serviceKey = readNamedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
    const projectUrl = Deno.env.get('SUPABASE_URL') || '';
    if (secret.length < 32 || !serviceKey || !projectUrl) throw new Error('analytics is not configured');

    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const minuteBucket = now.toISOString().slice(0, 16) + ':00.000Z';
    const dayBucket = `${day}T00:00:00.000Z`;
    const ip = clientIp(request);
    const visitorHash = await sha256(`${secret}|visitor|${day}|${ip}|${request.headers.get('user-agent') || ''}`);
    const minuteKey = await sha256(`${secret}|minute|${minuteBucket}|${ip}`);
    const dayKey = await sha256(`${secret}|day|${day}|${ip}`);
    const admin = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const minute = await admin.rpc('consume_analytics_rate_limit', { p_key_hash: minuteKey, p_window_started_at: minuteBucket, p_limit: 12 });
    const daily = minute.data ? await admin.rpc('consume_analytics_rate_limit', { p_key_hash: dayKey, p_window_started_at: dayBucket, p_limit: 200 }) : { data: false, error: minute.error };
    if (minute.error || daily.error) throw minute.error || daily.error;
    if (!minute.data || !daily.data) return new Response(JSON.stringify({ accepted: false }), { status: 202, headers: jsonHeaders(allowedOrigin) });

    const inserted = await admin.from('analytics_page_events').insert({ page_path: path, visitor_hash: visitorHash });
    if (inserted.error) throw inserted.error;
    return new Response(JSON.stringify({ accepted: true }), { status: 202, headers: jsonHeaders(allowedOrigin) });
  } catch (error) {
    console.error('analytics event rejected', error instanceof Error ? error.message : 'unknown error');
    return new Response(JSON.stringify({ error: 'event not stored' }), { status: 503, headers: jsonHeaders(allowedOrigin) });
  }
});
