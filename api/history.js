const { hasKv, kvCommand, kvSetJson, kvGetJson, isAdmin } = require('./_kv');

const INDEX_KEY = 'aplan:history:index';
const TTL_SECONDS = 60 * 60 * 24 * 120;

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(m => m && (m.r === 'bot' || m.r === 'user') && typeof m.h === 'string')
    .slice(-80)
    .map(m => ({
      r: m.r,
      h: m.h.slice(0, 5000),
      t: typeof m.t === 'string' ? m.t.slice(0, 20) : ''
    }));
}

async function listHistory(limit) {
  const ids = await kvCommand(['ZREVRANGE', INDEX_KEY, '0', String(limit - 1)]);
  const out = [];
  for (const id of ids || []) {
    const item = await kvGetJson(`aplan:history:${id}`);
    if (item) out.push(item);
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Admin-Key');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (!hasKv()) {
    res.status(503).json({ error: 'missing_kv_config' });
    return;
  }

  if (req.method === 'GET') {
    if (!isAdmin(req)) { res.status(401).json({ error: 'unauthorized' }); return; }
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 100));
    try {
      res.status(200).json({ items: await listHistory(limit) });
    } catch (e) {
      res.status(502).json({ error: 'kv_failed' });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const body = parseBody(req);
  const sessionId = String(body.sessionId || '').replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 120);
  const messages = cleanMessages(body.messages);
  if (!sessionId || !messages.length) {
    res.status(400).json({ error: 'invalid_history' });
    return;
  }

  const key = `aplan:history:${sessionId}`;
  const now = new Date().toISOString();
  try {
    const prev = await kvGetJson(key);
    const item = {
      sessionId,
      createdAt: prev && prev.createdAt ? prev.createdAt : now,
      updatedAt: now,
      page: typeof body.page === 'string' ? body.page.slice(0, 500) : '',
      messageCount: messages.length,
      messages
    };
    await kvSetJson(key, item, TTL_SECONDS);
    await kvCommand(['ZADD', INDEX_KEY, String(Date.now()), sessionId]);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: 'kv_failed' });
  }
};
