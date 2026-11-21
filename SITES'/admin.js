(() => {
  const config = window.HIPOLITECH_ANALYTICS;
  const valid = config && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl || '') && !String(config.supabaseUrl).includes('YOUR_') && config.publishableKey && !String(config.publishableKey).includes('YOUR_');
  const $ = id => document.getElementById(id);
  if (!valid || !window.supabase) return;

  $('config-warning').hidden = true;
  const client = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  let refreshTimer;

  const number = value => new Intl.NumberFormat('ro-RO').format(Number(value || 0));
  const setStatus = text => { $('dashboard-status').textContent = text; };

  function showLogin(message = '') {
    clearInterval(refreshTimer);
    $('analytics-dashboard').hidden = true;
    $('admin-login').hidden = false;
    $('login-status').textContent = message;
  }

  function showDashboard() {
    $('admin-login').hidden = true;
    $('analytics-dashboard').hidden = false;
  }

  async function loadDashboard() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return showLogin('Sesiunea a expirat. Autentifică-te din nou.');
    setStatus('Se actualizează…');
    try {
      const response = await fetch(`${config.supabaseUrl}/functions/v1/${config.adminFunction || 'admin-analytics'}`, {
        method: 'GET',
        cache: 'no-store',
        headers: { authorization: `Bearer ${session.access_token}`, apikey: config.publishableKey }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Nu ai acces la aceste statistici.');
      $('active-visitors').textContent = number(payload.activeVisitors);
      $('views-today').textContent = number(payload.viewsToday);
      $('views-total').textContent = number(payload.totalViews);
      const rows = Array.isArray(payload.topPages) ? payload.topPages : [];
      $('top-pages').replaceChildren(...(rows.length ? rows.map(row => {
        const tr = document.createElement('tr');
        const path = document.createElement('td');
        const count = document.createElement('td');
        path.textContent = row.path;
        count.textContent = number(row.views);
        tr.append(path, count);
        return tr;
      }) : [Object.assign(document.createElement('tr'), { innerHTML: '<td colspan="2">Nu există încă date.</td>' })]));
      setStatus(`Actualizat la ${new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())}.`);
    } catch (error) {
      setStatus(error.message || 'Nu s-au putut încărca statisticile.');
    }
  }

  async function start() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return showLogin();
    showDashboard();
    await loadDashboard();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(loadDashboard, 15_000);
  }

  $('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    $('login-status').textContent = 'Se verifică…';
    const { error } = await client.auth.signInWithPassword({ email: $('admin-email').value, password: $('admin-password').value });
    if (error) return showLogin('Emailul sau parola nu au putut fi verificate.');
    await start();
  });
  $('refresh-stats').addEventListener('click', loadDashboard);
  $('sign-out').addEventListener('click', async () => { await client.auth.signOut(); showLogin('Ai ieșit din panou.'); });
  client.auth.onAuthStateChange((_event, session) => { if (!session) showLogin(); });
  start();
})();
