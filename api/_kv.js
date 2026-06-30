const KV_URL = process.env.KV_REST_API_URL || process.env.KV_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN_READ_ONLY || '';

function hasKv() {
  return Boolean(KV_URL && KV_TOKEN);
}

async function kvCommand(args) {
  if (!hasKv()) return null;
  const r = await fetch(KV_URL.replace(/\/$/, ''), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${KV_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
  if (!r.ok || (data && data.error)) {
    const msg = data && data.error ? data.error : text || `KV HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data && Object.prototype.hasOwnProperty.call(data, 'result') ? data.result : data;
}

async function kvSetJson(key, value, ttlSeconds) {
  await kvCommand(['SET', key, JSON.stringify(value)]);
  if (ttlSeconds) await kvCommand(['EXPIRE', key, String(ttlSeconds)]);
}

async function kvGetJson(key) {
  const raw = await kvCommand(['GET', key]);
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return null; }
}

function isAdmin(req) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) return false;
  const auth = req.headers.authorization || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';
  const queryKey = req.query && req.query.key;
  return req.headers['x-admin-key'] === expected || bearer === expected || queryKey === expected;
}

module.exports = { hasKv, kvCommand, kvSetJson, kvGetJson, isAdmin };
