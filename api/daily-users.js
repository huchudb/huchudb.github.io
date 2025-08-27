// /api/daily-users.js  (Vercel Functions - Node.js 런타임)

// ⬇️ Vercel Project Settings > Environment Variables 에 등록한 값
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// ⬇️ CORS 허용 도메인 (GitHub Pages, 커스텀 도메인, Vercel 도메인)
const ALLOWED_ORIGINS = [
  'https://huchudb.github.io',
  'https://huchulab.com',
  'https://www.huchulab.com',
  'https://huchudb-github-io.vercel.app',
];

function corsHeaders(origin) {
  const isAllowed = ALLOWED_ORIGINS.includes(origin);
  return {
    Vary: 'Origin',
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://huchudb.github.io',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    // 브라우저가 preflight에서 cache-control, pragma를 보낼 수 있어 허용 목록에 포함
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, Pragma',
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
  const url = `${REDIS_URL}/get/${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: 'no-store',
  });
  const txt = await r.text();
  // 디버그 로그
  console.log('[UPSTASH GET]', r.status, txt);
  if (!r.ok) throw new Error(`Upstash GET failed: ${r.status} ${txt}`);
  const data = JSON.parse(txt); // { result: "123" | null }
  return Number(data.result || 0);
}

async function upstashIncrAndExpire(key, ttlSec) {
  const incrUrl = `${REDIS_URL}/incr/${encodeURIComponent(key)}`;
  const expireUrl = `${REDIS_URL}/expire/${encodeURIComponent(key)}/${ttlSec}`;

  const r1 = await fetch(incrUrl, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: 'no-store',
    method: 'POST', // 일부 환경에서 POST로만 허용되는 케이스 대비
  });
  const txt1 = await r1.text();
  console.log('[UPSTASH INCR]', r1.status, txt1);
  if (!r1.ok) throw new Error(`Upstash INCR failed: ${r1.status} ${txt1}`);
  const j1 = JSON.parse(txt1); // { result: <number> }

  const r2 = await fetch(expireUrl, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: 'no-store',
    method: 'POST',
  });
  const txt2 = await r2.text();
  console.log('[UPSTASH EXPIRE]', r2.status, txt2);
  if (!r2.ok) throw new Error(`Upstash EXPIRE failed: ${r2.status} ${txt2}`);

  return Number(j1.result || 0);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = corsHeaders(origin);

  // 디버그: 환경변수 유무/오리진 로깅 (비밀 값 자체는 로깅 안함)
  console.log('[CORS]', { method: req.method, origin, hasURL: !!REDIS_URL, hasToken: !!REDIS_TOKEN });

  // CORS 프리플라이트
  if (req.method === 'OPTIONS') {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    res.status(204).setHeader('Content-Length', '0');
    return res.end();
  }

  try {
    if (!REDIS_URL || !REDIS_TOKEN) {
      Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
      return res
        .status(500)
        .json({ error: 'Missing Upstash env. Check UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.' });
    }

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
    console.error('[SERVER ERROR]', e?.message || e);
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    // 디버그 편의상 에러 메시지를 그대로 내려줌 (원인 파악용)
    return res.status(500).json({ error: 'Server Error', detail: String(e?.message || e) });
  }
}
