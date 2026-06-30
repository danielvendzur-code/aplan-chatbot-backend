const { hasKv, kvCommand, kvSetJson, kvGetJson, isAdmin } = require('./_kv');

const INDEX_KEY = 'aplan:leads:index';
const TTL_SECONDS = 60 * 60 * 24 * 365;

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

function textValue(v, max = 2000) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\s+\n/g, '\n').trim().slice(0, max);
}

function cleanLead(data) {
  const out = {};
  Object.keys(data || {}).forEach(k => {
    if (k === 'conversation') return;
    out[k] = textValue(data[k], 4000);
  });
  return out;
}

function cleanConversation(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(m => m && (m.r === 'bot' || m.r === 'user') && typeof m.h === 'string')
    .slice(-30)
    .map(m => ({ r: m.r, h: m.h.slice(0, 3000), t: textValue(m.t, 20) }));
}

function leadText(lead) {
  const labels = Object.keys(lead.data).filter(k => lead.data[k]);
  return [
    `Novy dopyt z webu - Aplan`,
    '',
    ...labels.map(k => `${k}: ${lead.data[k]}`),
    '',
    `sessionId: ${lead.sessionId || ''}`,
    `createdAt: ${lead.createdAt}`
  ].join('\n');
}

function leadHtml(lead) {
  const rows = Object.keys(lead.data)
    .filter(k => lead.data[k])
    .map(k => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#555">${escapeHtml(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee"><b>${escapeHtml(lead.data[k])}</b></td></tr>`)
    .join('');
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#16181c">
    <h2 style="margin:0 0 12px">Novy dopyt z webu - Aplan</h2>
    <table style="border-collapse:collapse;width:100%;max-width:720px">${rows}</table>
    <p style="color:#777;margin-top:14px">Session: ${escapeHtml(lead.sessionId || '')}<br>Cas: ${escapeHtml(lead.createdAt)}</p>
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

async function sendResend(lead) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('missing_resend_api_key');
  const to = process.env.MAIL_TO || process.env.LEAD_TO;
  if (!to) throw new Error('missing_mail_to');
  const from = process.env.MAIL_FROM || process.env.RESEND_FROM || 'Aplan chatbot <onboarding@resend.dev>';
  const replyTo = lead.data.email || lead.data.em || '';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: to.split(',').map(x => x.trim()).filter(Boolean),
      subject: lead.data.predmet || 'Dopyt z webu - Aplan',
      text: leadText(lead),
      html: leadHtml(lead),
      reply_to: replyTo || undefined
    })
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
  if (!r.ok) throw new Error((data && data.message) || text || `Resend HTTP ${r.status}`);
  return { provider: 'resend', id: data && data.id };
}

async function saveLead(lead) {
  if (!hasKv()) return { skipped: 'missing_kv_config' };
  const key = `aplan:lead:${lead.id}`;
  await kvSetJson(key, lead, TTL_SECONDS);
  await kvCommand(['ZADD', INDEX_KEY, String(Date.now()), lead.id]);
  return { key };
}

async function listLeads(limit) {
  const ids = await kvCommand(['ZREVRANGE', INDEX_KEY, '0', String(limit - 1)]);
  const out = [];
  for (const id of ids || []) {
    const item = await kvGetJson(`aplan:lead:${id}`);
    if (item) out.push(item);
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Admin-Key');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method === 'GET') {
    if (!isAdmin(req)) { res.status(401).json({ error: 'unauthorized' }); return; }
    if (!hasKv()) { res.status(503).json({ error: 'missing_kv_config' }); return; }
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 100));
    try {
      res.status(200).json({ items: await listLeads(limit) });
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
  const data = cleanLead(body);
  if (!data.meno && !data.telefon && !data.email && !data.em) {
    res.status(400).json({ error: 'missing_contact' });
    return;
  }

  const now = new Date().toISOString();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const lead = {
    id,
    createdAt: now,
    sessionId: textValue(body.sessionId, 120),
    page: textValue(body.page, 500),
    data,
    conversation: cleanConversation(body.conversation)
  };

  try {
    const saved = await saveLead(lead);
    const mailed = await sendResend(lead);
    res.status(200).json({ ok: true, saved, mail: mailed });
  } catch (e) {
    res.status(502).json({ error: 'lead_failed', detail: e.message.slice(0, 300) });
  }
};
