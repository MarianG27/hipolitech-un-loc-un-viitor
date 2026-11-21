(() => {
  const config = window.HIPOLITECH_ANALYTICS;
  const isConfigured = config && config.enabled === true && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl || '') && !String(config.supabaseUrl).includes('YOUR_') && config.publishableKey && !String(config.publishableKey).includes('YOUR_');
  if (!isConfigured || !['http:', 'https:'].includes(location.protocol)) return;

  const path = location.pathname.length <= 160 && /^\/[a-zA-Z0-9._/-]*$/.test(location.pathname) ? location.pathname : '/';
  const storageKey = `hipolitech-pageview:${path}`;
  const now = Date.now();
  try {
    const lastSent = Number(sessionStorage.getItem(storageKey) || 0);
    if (now - lastSent < 30_000) return;
    sessionStorage.setItem(storageKey, String(now));
  } catch (_) {
    /* Trimiterea rămâne posibilă dacă sessionStorage este blocat. */
  }

  fetch(`${config.supabaseUrl}/functions/v1/${config.collectorFunction || 'collect-pageview'}`, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-store',
    keepalive: true,
    referrerPolicy: 'no-referrer',
    headers: { 'content-type': 'application/json', apikey: config.publishableKey },
    body: JSON.stringify({ path, event: 'pageview', honeypot: '' })
  }).catch(() => {
    /* Statistica nu trebuie să afecteze utilizarea site-ului. */
  });
})();
