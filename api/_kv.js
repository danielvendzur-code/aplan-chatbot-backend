const crypto = require('crypto');

const KV_URL = process.env.KV_REST_API_URL || process.env.KV_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN_READ_ONLY || '';
const MEMORY_RATE_LIMITS = new Map();

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

function safeEqual(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isAdmin(req) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) return false;
  const auth = req.headers.authorization || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const headerKey = typeof req.headers['x-admin-key'] === 'string' ? req.headers['x-admin-key'].trim() : '';
  return safeEqual(headerKey, expected) || safeEqual(bearer, expected);
}

function requestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().slice(0, 120);
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.trim()) return real.trim().slice(0, 120);
  if (req.socket && req.socket.remoteAddress) return String(req.socket.remoteAddress).slice(0, 120);
  return 'unknown';
}

function rateKey(req, scope) {
  const salt = process.env.RATE_LIMIT_SALT || process.env.ADMIN_KEY || 'aplan-rate-limit';
  const digest = crypto
    .createHash('sha256')
    .update(`${salt}:${requestIp(req)}`)
    .digest('hex')
    .slice(0, 32);
  return `aplan:rate:${scope}:${digest}`;
}

function memoryRateLimit(key, limit, windowSeconds) {
  const now = Date.now();
  const current = MEMORY_RATE_LIMITS.get(key);
  const windowMs = windowSeconds * 1000;
  let item = current;

  if (!item || item.resetAt <= now) {
    item = { count: 0, resetAt: now + windowMs };
  }

  item.count += 1;
  MEMORY_RATE_LIMITS.set(key, item);

  if (MEMORY_RATE_LIMITS.size > 2000) {
    for (const [k, value] of MEMORY_RATE_LIMITS) {
      if (value.resetAt <= now) MEMORY_RATE_LIMITS.delete(k);
    }
  }

  return {
    allowed: item.count <= limit,
    limit,
    remaining: Math.max(0, limit - item.count),
    retryAfter: Math.max(1, Math.ceil((item.resetAt - now) / 1000)),
    backend: 'memory'
  };
}

async function rateLimit(req, { scope, limit, windowSeconds }) {
  const key = rateKey(req, scope);

  if (hasKv()) {
    try {
      const count = Number(await kvCommand(['INCR', key]));
      if (count === 1) await kvCommand(['EXPIRE', key, String(windowSeconds)]);

      let retryAfter = windowSeconds;
      if (count > limit) {
        const ttl = Number(await kvCommand(['TTL', key]));
        if (Number.isFinite(ttl) && ttl > 0) retryAfter = ttl;
      }

      return {
        allowed: count <= limit,
        limit,
        remaining: Math.max(0, limit - count),
        retryAfter,
        backend: 'kv'
      };
    } catch (e) {
      return memoryRateLimit(key, limit, windowSeconds);
    }
  }

  return memoryRateLimit(key, limit, windowSeconds);
}

function applyRateLimitHeaders(res, result) {
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  if (!result.allowed) res.setHeader('Retry-After', String(result.retryAfter));
}

module.exports = {
  hasKv,
  kvCommand,
  kvSetJson,
  kvGetJson,
  isAdmin,
  rateLimit,
  applyRateLimitHeaders
};
