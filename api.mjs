const json = (status, data, origin = '') => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    ...(origin ? {'Access-Control-Allow-Origin': origin} : {})
  }
});

export default async function handler(request) {
  const allowed = (Netlify.env.get('ALLOWED_ORIGIN') || '').replace(/\/$/, '');
  const origin = request.headers.get('origin') || '';
  // Only the configured GitHub Pages origin may call this browser endpoint.
  if (!allowed || origin !== allowed) return json(403, {ok:false,error:'Origin not allowed'});
  if (request.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '3600',
      'Vary': 'Origin'
    }
  });
  if (request.method !== 'POST') return json(405, {ok:false,error:'Use POST'}, allowed);
  try {
    const url = Netlify.env.get('APPS_SCRIPT_URL');
    const secret = Netlify.env.get('BRIDGE_SHARED_SECRET');
    if (!url || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url))
      return json(500, {ok:false,error:'Invalid APPS_SCRIPT_URL in Netlify'}, allowed);
    if (!secret || secret.length < 32) return json(500, {ok:false,error:'BRIDGE_SHARED_SECRET missing or too short'}, allowed);
    const raw = await request.text();
    if (raw.length > 100000) return json(413, {ok:false,error:'Request too large'}, allowed);
    const body = JSON.parse(raw);
    if (!body || typeof body.action !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,59}$/.test(body.action))
      return json(400, {ok:false,error:'Invalid action'}, allowed);
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({bridgeSecret:secret, action:body.action, payload:body.payload || {}, token:body.token || ''}),
      redirect: 'follow',
      signal: AbortSignal.timeout(25000)
    });
    const text = await upstream.text();
    let result;
    try {result = JSON.parse(text);} catch {
      return json(502, {ok:false,error:'Apps Script did not return JSON. Check deployment access and doPost code.'}, allowed);
    }
    return json(upstream.ok ? 200 : 502, result, allowed);
  } catch (e) {
    return json(502, {ok:false,error:'Proxy request failed. Check Netlify function logs.'}, allowed);
  }
}
