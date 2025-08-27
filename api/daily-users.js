// /api/daily-users.js  (Vercel Functions - Node.js 런타임)

// ⬇️ Vercel Project Settings > Environment Variables 에 이미 넣은 값 사용
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// ⬇️ CORS 허용 도메인 (GitHub Pages, 커스텀 도메인, Vercel 도메인까지)
const ALLOWED_ORIGINS = [
  'https://huchudb.github.io',
  'https://huchulab.com',
  'https://www.huchulab.com',
  'https://huchudb-github-io.vercel.app',
];

function responseHeaders(origin) {
  const isAllowed = ALLOWED_ORIGINS.includes(origin);
  return {
    // CORS
    'Vary': 'Origin',
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://huchudb.github.io',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    // ✅ 캐시 완전 비활성화 (304 방지)
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    // 응답 타입
    'Content-Type': 'application/json; charset=utf-8',
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
  if (!r.ok) throw new Error(`Upstash GET failed: ${r.status}`);
  const data = await r.json(); // { result: "123" } or { result: null }
  return Number(data.result || 0);
}

async function upstashIncrAndExpire(key, ttlSec) {
  const r1 = await fetch(`${REDIS_URL}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: 'no-store',
  });
  if (!r1.ok) throw new Error(`Upstash INCR failed: ${r1.status}`);
  const j1 = await r1.json(); // { result: <number> }

  // 만료(자정) 설정
  const r2 = await fetch(`${REDIS_URL}/expire/${encodeURIComponent(key)}/${ttlSec}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: 'no-store',
  });
  if (!r2.ok) throw new Error(`Upstash EXPIRE failed: ${r2.status}`);

  return Number(j1.result || 0);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = responseHeaders(origin);

  const send = (status, payload) => {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(status).end(JSON.stringify(payload));
  };

  // Preflight
  if (req.method === 'OPTIONS') {
    return send(204, {});
  }

  try {
    if (!REDIS_URL || !REDIS_TOKEN) {
      return send(500, { error: 'Missing Upstash credentials' });
    }

    const key = kstKey();

    if (req.method === 'GET') {
      const count = await upstashGet(key);
      return send(200, { count });
    }

    if (req.method === 'POST') {
      const ttl = secondsUntilKstMidnight();
      const count = await upstashIncrAndExpire(key, ttl);
      return send(200, { count });
    }

    return send(405, { error: 'Method Not Allowed' });
  } catch (e) {
    console.error(e);
    return send(500, { error: 'Server Error' });
  }
}
