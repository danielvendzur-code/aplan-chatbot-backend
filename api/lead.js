const tls = require('tls');
const { hasKv, kvCommand, kvSetJson, kvGetJson, isAdmin, rateLimit, applyRateLimitHeaders } = require('./_kv');

const INDEX_KEY = 'aplan:leads:index';
const TTL_SECONDS = 60 * 60 * 24 * 365;
const MAX_REQUEST_BYTES = 3_500_000;
const MAX_ATTACHMENT_COUNT = 3;
const MAX_ATTACHMENT_BYTES = 1_500_000;
const MAX_TOTAL_ATTACHMENT_BYTES = 2_250_000;
const DEFAULT_GMAIL_USER = 'dopyt.chatbot@gmail.com';
const ALLOWED_ATTACHMENTS = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

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
    if (['conversation', 'clientCopy', 'clientSubject', 'clientTitle', 'attachments'].includes(k)) return;
    out[k] = textValue(data[k], 6000);
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

function sanitizeFilename(value, mimeType) {
  const fallbackExt = ALLOWED_ATTACHMENTS.get(mimeType) || '';
  const raw = String(value || 'priloha')
    .replace(/[\\/]+/g, '_')
    .replace(/[\r\n\0]/g, '')
    .trim()
    .slice(0, 120);
  const ascii = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 100) || 'priloha';
  const lower = ascii.toLowerCase();
  const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
  const hasAllowedExt = allowedExts.some(ext => lower.endsWith(ext));
  return hasAllowedExt ? ascii : `${ascii}${fallbackExt}`;
}

function cleanAttachments(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('invalid_attachments');
  if (value.length > MAX_ATTACHMENT_COUNT) throw new Error('too_many_attachments');

  let total = 0;
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error('invalid_attachment');
    const type = String(item.type || '').toLowerCase().trim();
    if (!ALLOWED_ATTACHMENTS.has(type)) throw new Error('unsupported_attachment_type');

    const content = String(item.content || '').replace(/\s+/g, '');
    if (!content || content.length > Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3) + 16) {
      throw new Error('attachment_too_large');
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(content)) throw new Error('invalid_attachment_data');

    const buffer = Buffer.from(content, 'base64');
    if (!buffer.length || buffer.length > MAX_ATTACHMENT_BYTES) throw new Error('attachment_too_large');
    total += buffer.length;
    if (total > MAX_TOTAL_ATTACHMENT_BYTES) throw new Error('attachments_too_large');

    return {
      name: sanitizeFilename(item.name || `priloha-${index + 1}`, type),
      type,
      size: buffer.length,
      content: buffer.toString('base64')
    };
  });
}

function leadText(lead) {
  const labels = Object.keys(lead.data).filter(k => lead.data[k]);
  const files = (lead.attachmentMeta || []).map(a => `${a.name} (${Math.ceil(a.size / 1024)} kB)`);
  return [
    'Nový dopyt z webu - Aplan',
    '',
    ...labels.map(k => `${k}: ${lead.data[k]}`),
    ...(files.length ? ['', 'Prílohy:', ...files.map(x => `- ${x}`)] : []),
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
  const files = (lead.attachmentMeta || []).map(a => `<li>${escapeHtml(a.name)} (${Math.ceil(a.size / 1024)} kB)</li>`).join('');
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#16181c">
    <h2 style="margin:0 0 12px">Nový dopyt z webu - Aplan</h2>
    <table style="border-collapse:collapse;width:100%;max-width:720px">${rows}</table>
    ${files ? `<p style="margin:14px 0 4px"><b>Prílohy:</b></p><ul>${files}</ul>` : ''}
    <p style="color:#777;margin-top:14px">Session: ${escapeHtml(lead.sessionId || '')}<br>Čas: ${escapeHtml(lead.createdAt)}</p>
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>\"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function safeHeader(value, max = 200) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

function encodeHeader(value) {
  const safe = safeHeader(value);
  return /[^\x00-\x7F]/.test(safe)
    ? `=?UTF-8?B?${Buffer.from(safe, 'utf8').toString('base64')}?=`
    : safe;
}

function normalizeRecipients(value) {
  return String(value || '')
    .split(',')
    .map(x => x.trim())
    .filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
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

function wrapBase64(value) {
  return String(value || '').match(/.{1,76}/g)?.join('\r\n') || '';
}

function alternativeMime(boundary, text, html) {
  return [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    String(text),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    String(html).replace(/\r?\n/g, '\r\n'),
    '',
    `--${boundary}--`
  ].join('\r\n');
}

async function sendGmail(lead, attachments = []) {
  const to = normalizeRecipients(process.env.MAIL_TO || process.env.LEAD_TO);
  if (!to.length) throw new Error('missing_mail_to');
  return sendGmailRaw({
    to,
    subject: lead.data.predmet || 'Dopyt z webu - Aplan',
    replyTo: lead.data.email || lead.data.em || '',
    text: leadText(lead),
    html: leadHtml(lead),
    attachments
  });
}

async function sendGmailRaw({ to, subject, replyTo, text, html, attachments = [] }) {
  const user = safeHeader(process.env.GMAIL_USER || DEFAULT_GMAIL_USER);
  const password = process.env.GMAIL_APP_PASSWORD;
  if (!user) throw new Error('missing_gmail_user');
  if (!password) throw new Error('missing_gmail_app_password');
  if (!to.length) throw new Error('missing_recipient');

  const safeReplyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(replyTo || '').trim()) ? String(replyTo).trim() : '';
  const from = safeHeader(process.env.MAIL_FROM || `APLAN AI asistent <${user}>`, 240);
  const altBoundary = `aplan-alt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const mixedBoundary = `aplan-mix-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const hasAttachments = attachments.length > 0;
  const headers = [
    `From: ${from}`,
    `To: ${to.join(', ')}`,
    `Subject: ${encodeHeader(subject)}`,
    ...(safeReplyTo ? [`Reply-To: ${safeReplyTo}`] : []),
    'MIME-Version: 1.0',
    hasAttachments
      ? `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`
      : `Content-Type: multipart/alternative; boundary="${altBoundary}"`
  ];

  let body;
  if (!hasAttachments) {
    body = alternativeMime(altBoundary, text, html);
  } else {
    const parts = [
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      alternativeMime(altBoundary, text, html)
    ];
    for (const attachment of attachments) {
      parts.push(
        `--${mixedBoundary}`,
        `Content-Type: ${attachment.type}; name="${attachment.name}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${attachment.name}"`,
        '',
        wrapBase64(attachment.content)
      );
    }
    parts.push(`--${mixedBoundary}--`);
    body = parts.join('\r\n');
  }

  const message = `${headers.join('\r\n')}\r\n\r\n${body}`.replace(/\r?\n\./g, '\r\n..');

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
    return { provider: 'gmail_smtp', from: user, to, attachmentCount: attachments.length };
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

  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    res.status(413).json({ error: 'payload_too_large' });
    return;
  }

  const requestLimit = await rateLimit(req, { scope: 'lead', limit: 5, windowSeconds: 3600 });
  applyRateLimitHeaders(res, requestLimit);
  if (!requestLimit.allowed) {
    res.status(429).json({ error: 'rate_limited', retryAfter: requestLimit.retryAfter });
    return;
  }

  const body = parseBody(req);
  const data = cleanLead(body);
  if (!data.meno && !data.telefon && !data.email && !data.em) {
    res.status(400).json({ error: 'missing_contact' });
    return;
  }

  let attachments;
  try {
    attachments = cleanAttachments(body.attachments);
  } catch (e) {
    res.status(400).json({ error: e.message || 'invalid_attachments' });
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
    conversation: cleanConversation(body.conversation),
    attachmentMeta: attachments.map(({ name, type, size }) => ({ name, type, size }))
  };

  try {
    const saved = await saveLead(lead);
    const mailed = await sendGmail(lead, attachments);

    let clientMail = null;
    const clientEmail = String(body.clientCopy === true ? (data.email || data.em || '') : '').trim();
    if (clientEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      const summary = textValue(body.summary || data.summary || '', 12000);
      const clientSubject = textValue(body.clientSubject, 160) || (
        data.predmet === 'Projektový štartovací balík'
          ? 'Projektový štartovací balík - Aplan'
          : 'Zhrnutie konzultácie - Aplan, projektová kancelária'
      );
      const clientTitle = textValue(body.clientTitle, 120) || (
        data.predmet === 'Projektový štartovací balík'
          ? 'Váš projektový štartovací balík'
          : 'Zhrnutie vašej konzultácie'
      );
      try {
        await sendGmailRaw({
          to: [clientEmail],
          subject: clientSubject,
          replyTo: normalizeRecipients(process.env.MAIL_TO || process.env.LEAD_TO)[0] || 'aplan@aplan.sk',
          text: `${summary}\n\n—\nAplan, projektová kancelária\n+421 915 775 480 · aplan@aplan.sk · www.aplan.sk\nInformácie sú orientačné; presné posúdenie zámeru pripraví projektant po konzultácii.`,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#16181c;max-width:680px;margin:0 auto">
            <h2 style="margin:0 0 14px">${escapeHtml(clientTitle)}</h2>
            <div style="white-space:pre-wrap;line-height:1.65">${escapeHtml(summary)}</div>
            <hr style="border:none;border-top:1px solid #e6e3dc;margin:22px 0">
            <p style="color:#777;font-size:12px;line-height:1.6">Aplan, projektová kancelária<br>+421 915 775 480 · aplan@aplan.sk · www.aplan.sk<br>Informácie sú orientačné; presné posúdenie zámeru pripraví projektant po konzultácii.</p>
          </div>`
        });
        clientMail = { ok: true };
      } catch (e) {
        clientMail = { ok: false };
      }
    }

    res.status(200).json({
      ok: true,
      saved,
      mail: mailed,
      clientMail,
      attachments: lead.attachmentMeta
    });
  } catch (e) {
    res.status(502).json({ error: 'lead_failed', detail: String(e.message || e).slice(0, 300) });
  }
};
