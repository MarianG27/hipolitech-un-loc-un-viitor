import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = (origin: string | null) => ({
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': origin ?? 'null',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'GET, OPTIONS',
  'vary': 'Origin'
});

const namedKey = (name: string, fallback: string) => {
  const named = Deno.env.get(name);
  if (named) {
    try { return JSON.parse(named).default as string; } catch (_) { /* fallback */ }
  }
  return Deno.env.get(fallback) || '';
};

const permittedOrigin = (request: Request) => {
  const origin = request.headers.get('origin')?.replace(/\/$/, '') || null;
  const permitted = (Deno.env.get('ANALYTICS_SITE_ORIGINS') || '').split(',').map(value => value.trim().replace(/\/$/, '')).filter(Boolean);
  return origin && permitted.includes(origin) ? origin : null;
};

Deno.serve(async request => {
  const origin = permittedOrigin(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: origin ? 204 : 403, headers: cors(origin) });
  if (request.method !== 'GET' || !origin) return new Response(JSON.stringify({ error: 'not allowed' }), { status: 403, headers: cors(origin) });

  try {
    const url = Deno.env.get('SUPABASE_URL') || '';
    const publicKey = namedKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
    const serviceKey = namedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('authorization') || '';
    if (!url || !publicKey || !serviceKey || !authorization.startsWith('Bearer ')) throw new Error('unauthorized');

    const userClient = createClient(url, publicKey, { global: { headers: { authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error('unauthorized');

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const membership = await admin.from('analytics_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (membership.error || !membership.data) return new Response(JSON.stringify({ error: 'Nu ai drept de administrator pentru statistici.' }), { status: 403, headers: cors(origin) });

    const dashboard = await admin.rpc('analytics_dashboard');
    if (dashboard.error) throw dashboard.error;
    return new Response(JSON.stringify(dashboard.data), { status: 200, headers: cors(origin) });
  } catch (error) {
    const status = error instanceof Error && error.message === 'unauthorized' ? 401 : 503;
    return new Response(JSON.stringify({ error: status === 401 ? 'Autentificare necesară.' : 'Statisticile nu sunt disponibile momentan.' }), { status, headers: cors(origin) });
  }
});
