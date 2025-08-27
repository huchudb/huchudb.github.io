// api/daily-users.js (Vercel Functions - Node.js 런타임)
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// 필요한 도메인으로 바꾸세요.
const ALLOWED_ORIGINS = [
  'https://huchudb.github.io', // GitHub Pages
  'https://www.huchulab.com'               // (있다면) 커스텀 도메인
  // 'https://<your-vercel-project>.vercel.app' // 프리뷰/프로덕션에서 직접 테스트도 허용하고 싶으면 추가
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
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
  // Upstash GET 응답: { result: "123" } 또는 { result: null }
  return Number(data.result || 0);
}

async function upstashIncrAndExpire(key, ttlSec) {
  const r1 = await fetch(`${REDIS_URL}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: 'no-store',
  });
  const j1 = await r1.json(); // { result: 123 }
  // 만료(자정) 설정
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
    res.status(204).setHeader('Content-Length', '0');
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.end();
  }

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

