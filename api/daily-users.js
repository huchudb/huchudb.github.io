// /api/daily-users.js  (Vercel Functions - Node.js 런타임)

// 환경변수 (Vercel > Project Settings > Environment Variables)
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// CORS 허용 도메인
const ALLOWED_ORIGINS = [
  'https://huchudb.github.io',
  'https://huchulab.com',
  'https://www.huchulab.com',
  'https://huchudb-github-io.vercel.app',
];

const TYPES = ['아파트','다세대/연립','단독/다가구','토지/임야'];

function corsHeaders(origin) {
  const isAllowed = ALLOWED_ORIGINS.includes(origin);
  return {
    'Vary': 'Origin',
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control',
    'Access-Control-Max-Age': '600',
  };
}

function kstKey() {
  const nowKst = Date.now() + 9 * 60 * 60 * 1000;
  const d = new Date(nowKst);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `daily:${yyyy}-${mm}-${dd}`;
}
function typeKey(type) {
  return `${kstKey()}:type:${type}`;
}
function secondsUntilKstMidnight() {
  const nowKstSec = Math.floor((Date.now() + 9 * 60 * 60 * 1000) / 1000);
  return 86400 - (nowKstSec % 86400);
}

async function upstashGet(key) {
  const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: 'no-store',
  });
  const data = await r.json();
  return Number(data.result || 0);
}
async function upstashIncrAndExpire(key, ttlSec) {
  const r1 = await fetch(`${REDIS_URL}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: 'no-store',
  });
  const j1 = await r1.json(); // { result: <number> }
  await fetch(`${REDIS_URL}/expire/${encodeURIComponent(key)}/${ttlSec}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: 'no-store',
  });
  return Number(j1.result || 0);
}

async function readJsonBody(req) {
  try {
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function getAllCounts() {
  const total = await upstashGet(kstKey());
  const byType = {};
  for (const t of TYPES) {
    byType[t] = await upstashGet(typeKey(t));
  }
  return { count: total, byType };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    res.status(204).setHeader('Content-Length', '0');
    return res.end();
  }

  try {
    if (req.method === 'GET') {
      const counts = await getAllCounts();
      Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
      return res.status(200).json(counts);
    }

    if (req.method === 'POST') {
      const ttl = secondsUntilKstMidnight();
      const url = new URL(req.url, 'http://x');
      const body = await readJsonBody(req);

      const type = body.propertyType || url.searchParams.get('propertyType') || '';
      const bumpTotalParam = body.bumpTotal ?? url.searchParams.get('bumpTotal');
      const bumpTotal = bumpTotalParam === true || bumpTotalParam === 'true';

      if (bumpTotal) {
        await upstashIncrAndExpire(kstKey(), ttl);
      }
      if (TYPES.includes(type)) {
        await upstashIncrAndExpire(typeKey(type), ttl);
      }

      const counts = await getAllCounts();
      Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
      return res.status(200).json(counts);
    }

    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(500).json({
      error: 'Server Error',
      detail: e?.message || String(e),
    });
  }
}
