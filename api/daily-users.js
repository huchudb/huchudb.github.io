// /api/daily-users.js  — Node.js (Vercel Serverless Function)
// 환경변수: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (쓰기 권한 토큰)

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const ALLOWED_ORIGINS = [
  'https://huchudb.github.io',
  'https://www.huchulab.com',
  'https://huchulab.com',
  'https://huchudb-github-io.vercel.app',
  'http://www.huchulab.com',
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Vary': 'Origin',
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma, Accept',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
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

// ── Upstash REST helpers ───────────────────────────
async function upstash(path) {
  const r = await fetch(`${REDIS_URL}/${path}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: 'no-store',
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Upstash ${path} failed: HTTP ${r.status} ${JSON.stringify(j)}`);
  if (j && j.error) throw new Error(`Upstash ${path} error: ${j.error}`);
  return j;
}
const enc = encodeURIComponent;

async function hIncrBy(key, field, inc = 1) {
  const j = await upstash(`hincrby/${enc(key)}/${enc(field)}/${inc}`);
  return Number(j.result || 0);
}
async function hGetAll(key) {
  const j = await upstash(`hgetall/${enc(key)}`);
  const res = j.result || [];
  const out = {};
  if (Array.isArray(res[0])) {
    for (const [k, v] of res) out[k] = Number(v || 0);
  } else {
    for (let i = 0; i < res.length; i += 2) out[res[i]] = Number(res[i + 1] || 0);
  }
  return out;
}
async function getString(key) {
  const j = await upstash(`get/${enc(key)}`);
  return Number(j.result || 0);
}
async function del(key) { await upstash(`del/${enc(key)}`); }
async function hSet(key, field, val) { await upstash(`hset/${enc(key)}/${enc(field)}/${val}`); }
async function expire(key, ttl) { await upstash(`expire/${enc(key)}/${ttl}`); }

// ── WRONGTYPE → 마이그레이션 (문자열 키 → 해시) ─────
async function migrateStringKeyToHash(key) {
  const curr = await getString(key); // 예전 INCR 값 보존
  await del(key);
  if (curr > 0) await hSet(key, 'total', curr);
}

// 라벨 ↔ 필드 슬러그
const TYPE_SLUGS = { '아파트': 'apt', '다세대/연립': 'multi', '단독/다가구': 'house', '토지/임야': 'land' };
function toByTypeKorean(hash) {
  return {
    '아파트':      Number(hash.apt   || 0),
    '다세대/연립': Number(hash.multi || 0),
    '단독/다가구': Number(hash.house || 0),
    '토지/임야':   Number(hash.land  || 0),
  };
}

// ── Handler ────────────────────────────────────────
export default async function handler(req, res) {
  const origin  = req.headers.origin || '';
  const headers = corsHeaders(origin);

  // Preflight
  if (req.method === 'OPTIONS') {
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.status(204).setHeader('Content-Length', '0');
    return res.end();
  }

  try {
    const key = kstKey();

    if (req.method === 'GET') {
      let hash;
      try {
        hash = await hGetAll(key);
      } catch (e) {
        if (String(e.message || e).includes('WRONGTYPE')) {
          await migrateStringKeyToHash(key);
          hash = await hGetAll(key);
        } else throw e;
      }
      const total = Number(hash.total || 0);
      const byType = toByTypeKorean(hash);

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json({ count: total, byType });
    }

    if (req.method === 'POST') {
      // JSON body(type) 파싱 (Vercel은 application/json이면 자동 파싱됨)
      let typeParam = undefined;
      try {
        if (typeof req.body === 'string') {
          typeParam = JSON.parse(req.body).type;
        } else if (req.body && typeof req.body === 'object') {
          typeParam = req.body.type;
        }
      } catch (_) {/* ignore */}

      const ttl = secondsUntilKstMidnight();

      // total +1 (WRONGTYPE 시 마이그레이션 후 재시도)
      try {
        await hIncrBy(key, 'total', 1);
      } catch (e) {
        if (String(e.message || e).includes('WRONGTYPE')) {
          await migrateStringKeyToHash(key);
          await hIncrBy(key, 'total', 1);
        } else throw e;
      }

      // 타입 필드 +1
      const slug = TYPE_SLUGS[typeParam] || null;
      if (slug) {
        try {
          await hIncrBy(key, slug, 1);
        } catch (e) {
          if (String(e.message || e).includes('WRONGTYPE')) {
            await migrateStringKeyToHash(key);
            await hIncrBy(key, slug, 1);
          } else throw e;
        }
      }

      await expire(key, ttl);
      const hash = await hGetAll(key);
      const total = Number(hash.total || 0);
      const byType = toByTypeKorean(hash);

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json({ count: total, byType });
    }

    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res.status(500).json({ error: 'Server Error', detail: String(e && e.message || e) });
  }
}
