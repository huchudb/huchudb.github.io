// /api/daily-users.js  — Node.js (Vercel)
// Upstash Redis (REST) 읽기/쓰기 토큰 필요
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// CORS: GitHub Pages, 커스텀 도메인, Vercel 도메인 허용
const ALLOWED_ORIGINS = [
  'https://huchudb.github.io',
  'https://www.huchulab.com',
  'https://huchulab.com',
  'https://huchudb-github-io.vercel.app',
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Vary': 'Origin',
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma, Accept',
    'Access-Control-Max-Age': '600',
  };
}

// 오늘자(KST) 키
function kstKey() {
  const nowKst = Date.now() + 9 * 60 * 60 * 1000;
  const d = new Date(nowKst);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `daily:${yyyy}-${mm}-${dd}`;         // 해시 키 (total + 유형별 필드 저장)
}
function secondsUntilKstMidnight() {
  const nowKstSec = Math.floor((Date.now() + 9 * 60 * 60 * 1000) / 1000);
  return 86400 - (nowKstSec % 86400);
}

// Upstash REST helpers
async function upstash(path) {
  const r = await fetch(`${REDIS_URL}/${path}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Upstash ${path} failed: ${r.status}`);
  return r.json();
}
async function hIncrBy(key, field, inc = 1) {
  const j = await upstash(`hincrby/${encodeURIComponent(key)}/${encodeURIComponent(field)}/${inc}`);
  return Number(j.result || 0);
}
async function expire(key, ttlSec) {
  await upstash(`expire/${encodeURIComponent(key)}/${ttlSec}`);
}
function pairsToObj(result) {
  // HGETALL은 ["field1","value1","field2","value2"] 혹은 [["f","v"], ...] 형태일 수 있음
  if (!Array.isArray(result)) return {};
  const obj = {};
  if (Array.isArray(result[0])) {
    for (const [k, v] of result) obj[k] = Number(v || 0);
  } else {
    for (let i = 0; i < result.length; i += 2) {
      obj[result[i]] = Number(result[i + 1] || 0);
    }
  }
  return obj;
}
async function hGetAll(key) {
  const j = await upstash(`hgetall/${encodeURIComponent(key)}`);
  return pairsToObj(j.result || []);
}

// 한글 라벨 ↔ 필드 슬러그 매핑
const TYPE_SLUGS = {
  '아파트': 'apt',
  '다세대/연립': 'multi',
  '단독/다가구': 'house',
  '토지/임야': 'land',
};
function toByTypeKorean(hash) {
  return {
    '아파트':      Number(hash.apt  || 0),
    '다세대/연립': Number(hash.multi|| 0),
    '단독/다가구': Number(hash.house|| 0),
    '토지/임야':   Number(hash.land || 0),
  };
}

export default async function handler(req, res) {
  const origin  = req.headers.origin || '';
  const headers = corsHeaders(origin);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.status(204).setHeader('Content-Length', '0');
    return res.end();
  }

  try {
    const key = kstKey();

    if (req.method === 'GET') {
      const hash = await hGetAll(key);
      const total = Number(hash.total || 0);
      const byType = toByTypeKorean(hash);

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json({ count: total, byType });
    }

    if (req.method === 'POST') {
      // JSON body(type) 파싱
      let typeParam;
      try {
        typeParam = (req.body && typeof req.body === 'object') ? req.body.type : undefined;
      } catch (_) { /* noop */ }
      // total +1
      const ttl = secondsUntilKstMidnight();
      await hIncrBy(key, 'total', 1);

      // 타입이 유효하면 해당 필드도 +1
      const slug = TYPE_SLUGS[typeParam] || null;
      if (slug) await hIncrBy(key, slug, 1);

      // 자정 만료 설정
      await expire(key, ttl);

      // 최신 값 반환
      const hash = await hGetAll(key);
      const total = Number(hash.total || 0);
      const byType = toByTypeKorean(hash);

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json({ count: total, byType });
    }

    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error(e);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res.status(500).json({ error: 'Server Error', detail: String(e && e.message || e) });
  }
}
