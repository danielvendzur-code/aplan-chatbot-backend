const tls = require('tls');
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
    if (k === 'conversation' || k === 'clientCopy') return;
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

function encodeHeader(value) {
  return /[^\x00-\x7F]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
    : value;
}

function normalizeRecipients(value) {
  return String(value || '').split(',').map(x => x.trim()).filter(Boolean);
}

function smtpClient() {
  const socket = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com' });
  let buffer = '';
  const waiters = [];

  socket.setEncoding('utf8');
  socket.setTimeout(12000);
  socket.on('data', chunk => {
    buffer += chunk;
    flush();
  });
  socket.on('error', err => {
    while (waiters.length) waiters.shift().reject(err);
  });
  socket.on('timeout', () => {
    const err = new Error('smtp_timeout');
    socket.destroy(err);
    while (waiters.length) waiters.shift().reject(err);
  });

  function flush() {
    while (waiters.length) {
      const lines = buffer.split(/\r?\n/);
      let end = -1;
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i])) { end = i; break; }
      }
      if (end < 0) return;
      const response = lines.slice(0, end + 1).join('\n');
      buffer = lines.slice(end + 1).join('\n');
      waiters.shift().resolve(response);
    }
  }

  function read() {
    return new Promise((resolve, reject) => {
      waiters.push({ resolve, reject });
      flush();
    });
  }

  function write(command) {
    socket.write(command + '\r\n');
  }

  function close() {
    socket.end();
  }

  return { read, write, close };
}

async function smtpExpect(client, expected) {
  const response = await client.read();
  const code = Number(response.slice(0, 3));
  const ok = Array.isArray(expected) ? expected.includes(code) : code === expected;
  if (!ok) throw new Error(`smtp_${code || 'bad_response'}`);
  return response;
}

async function sendGmail(lead) {
  const to = normalizeRecipients(process.env.MAIL_TO || process.env.LEAD_TO);
  if (!to.length) throw new Error('missing_mail_to');
  return sendGmailRaw({
    to,
    subject: lead.data.predmet || 'Dopyt z webu - Aplan',
    replyTo: lead.data.email || lead.data.em || '',
    text: leadText(lead),
    html: leadHtml(lead)
  });
}

async function sendGmailRaw({ to, subject, replyTo, text, html }) {
  const user = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;
  if (!user) throw new Error('missing_gmail_user');
  if (!password) throw new Error('missing_gmail_app_password');
  if (!to.length) throw new Error('missing_recipient');

  const boundary = `aplan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  text = String(text).replace(/^\./gm, '..');
  const headers = [
    `From: ${process.env.MAIL_FROM || `Aplan chatbot <${user}>`}`,
    `To: ${to.join(', ')}`,
    `Subject: ${encodeHeader(subject)}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];
  const message = [
    headers.join('\r\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html.replace(/\r?\n/g, '\r\n'),
    '',
    `--${boundary}--`
  ].join('\r\n').replace(/\r\n\./g, '\r\n..');

  const client = smtpClient();
  try {
    await smtpExpect(client, 220);
    client.write('EHLO aplan-chatbot');
    await smtpExpect(client, 250);
    client.write('AUTH LOGIN');
    await smtpExpect(client, 334);
    client.write(Buffer.from(user).toString('base64'));
    await smtpExpect(client, 334);
    client.write(Buffer.from(password).toString('base64'));
    await smtpExpect(client, 235);
    client.write(`MAIL FROM:<${user}>`);
    await smtpExpect(client, 250);
    for (const recipient of to) {
      client.write(`RCPT TO:<${recipient}>`);
      await smtpExpect(client, [250, 251]);
    }
    client.write('DATA');
    await smtpExpect(client, 354);
    client.write(message + '\r\n.');
    await smtpExpect(client, 250);
    client.write('QUIT');
    await smtpExpect(client, 221);
    return { provider: 'gmail_smtp', to };
  } finally {
    client.close();
  }
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
    const mailed = await sendGmail(lead);

    // Kópia klientovi (zhrnutie konverzácie) — zlyhanie nezhodí celý dopyt.
    let clientMail = null;
    const clientEmail = String(body.clientCopy === true ? (data.email || data.em || '') : '').trim();
    if (clientEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      const summary = textValue(body.summary || data.summary || '', 6000);
      try {
        await sendGmailRaw({
          to: [clientEmail],
          subject: 'Zhrnutie konzultácie - Aplan, projektová kancelária',
          replyTo: normalizeRecipients(process.env.MAIL_TO || process.env.LEAD_TO)[0] || '',
          text: `${summary}\n\n—\nAplan, projektová kancelária\n+421 915 775 480 · aplan@aplan.sk · www.aplan.sk\nOdpovede asistenta sú orientačné; presné posúdenie radi pripravíme na konzultácii.`,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#16181c;max-width:640px">
            <h2 style="margin:0 0 14px">Zhrnutie vašej konzultácie</h2>
            <div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(summary)}</div>
            <hr style="border:none;border-top:1px solid #e6e3dc;margin:20px 0">
            <p style="color:#777;font-size:12px;line-height:1.6">Aplan, projektová kancelária<br>+421 915 775 480 · aplan@aplan.sk · www.aplan.sk<br>Odpovede asistenta sú orientačné; presné posúdenie radi pripravíme na konzultácii.</p>
          </div>`
        });
        clientMail = { ok: true };
      } catch (e) {
        clientMail = { ok: false };
      }
    }

    res.status(200).json({ ok: true, saved, mail: mailed, clientMail });
  } catch (e) {
    res.status(502).json({ error: 'lead_failed', detail: e.message.slice(0, 300) });
  }
};
