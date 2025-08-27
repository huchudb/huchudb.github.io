// /api/daily-users.js  (Vercel Functions - Node.js 런타임)

// ⬇️ Vercel Project Settings > Environment Variables 에 이미 넣은 값 사용
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// ⬇️ CORS 허용 도메인 (GitHub Pages, 커스텀 도메인, Vercel 도메인까지)
const ALLOWED_ORIGINS = [
  'https://huchudb.github.io',
  'https://huchulab.com',
  'https://www.huchulab.com',
  'https://huchudb-github-io.vercel.app'
];

function corsHeaders(origin) {
  const isAllowed = ALLOWED_ORIGINS.includes(origin);
  return {
    'Vary': 'Origin',
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://huchudb.github.io',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    res.status(204).setHeader('Content-Length', '0');
    return res.end();
  }

  // 원하면 아래 두 줄 주석 해제하여 '허용 안 된 오리진'은 차단
  // if (!ALLOWED_ORIGINS.includes(origin)) {
  //   Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  //   return res.status(403).json({ error: 'Origin not allowed' });
  // }

  try {
    const key = kstKey();

    if (req.method === 'GET') {
      const count = await upstashGet(key);
      Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
      return res.status(200).json({ count });
    }

    if (req.method === 'POST') {
      const ttl = secondsUntilKstMidnight();
      const count = await upstashIncrAndExpire(key, ttl);
      Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
      return res.status(200).json({ count });
    }

    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error(e);
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(500).json({ error: 'Server Error' });
  }
}
