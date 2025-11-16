
// /api/loan-config.js  — Node.js (Vercel Serverless Function with Upstash Redis)
// 환경변수: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Redis key
const LOAN_CONFIG_KEY = 'config:loan';

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

const enc = encodeURIComponent;

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

async function getJson(key) {
  const j = await upstash(`get/${enc(key)}`);
  const raw = j.result;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('loan-config getJson parse error', e, 'raw=', raw);
    return null;
  }
}

async function setJson(key, obj) {
  const str = JSON.stringify(obj);
  await upstash(`set/${enc(key)}/${enc(str)}`);
}

// 기본값 (서버/Redis에 아무것도 없을 때 사용)
function defaultLoanConfig() {
  return {
    updatedAt: new Date().toISOString(),
    byType: {
      '아파트':     { maxLtv: 0.73, rateMin: 0.068, rateMax: 0.148 },
      '다세대/연립': { maxLtv: 0.70, rateMin: 0.078, rateMax: 0.158 },
      '단독/다가구': { maxLtv: 0.70, rateMin: 0.080, rateMax: 0.160 },
      '토지/임야':   { maxLtv: 0.50, rateMin: 0.100, rateMax: 0.180 },
    },
  };
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body);
  } catch (_) {
    return {};
  }
}

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
    if (req.method === 'GET') {
      let config = null;
      try {
        config = await getJson(LOAN_CONFIG_KEY);
      } catch (e) {
        console.error('loan-config GET upstash error', e);
      }

      if (!config) {
        // Redis 비어있으면 기본값 리턴 + 백그라운드로 저장 시도
        config = defaultLoanConfig();
        try {
          await setJson(LOAN_CONFIG_KEY, config);
        } catch (e) {
          console.error('loan-config default set error', e);
        }
      }

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json(config);
    }

    if (req.method === 'POST') {
      const body = parseBody(req);

      if (!body || typeof body !== 'object') {
        for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
        return res.status(400).json({ error: 'invalid body' });
      }

      const byType = body.byType;
      if (!byType || typeof byType !== 'object') {
        for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
        return res.status(400).json({ error: 'byType object is required' });
      }

      // 숫자 정리 (maxLtv, rateMin, rateMax)
      const cleanedByType = {};
      for (const key of Object.keys(byType)) {
        const item = byType[key] || {};
        const maxLtv  = typeof item.maxLtv  === 'number' ? item.maxLtv  : null;
        const rateMin = typeof item.rateMin === 'number' ? item.rateMin : null;
        const rateMax = typeof item.rateMax === 'number' ? item.rateMax : null;
        cleanedByType[key] = { maxLtv, rateMin, rateMax };
      }

      const config = {
        updatedAt: body.updatedAt || new Date().toISOString(),
        byType: cleanedByType,
      };

      try {
        await setJson(LOAN_CONFIG_KEY, config);
      } catch (e) {
        console.error('loan-config POST upstash error', e);
        for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
        return res.status(500).json({ error: 'internal error' });
      }

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json(config);
    }

    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('loan-config handler error', e);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res.status(500).json({ error: 'Server Error', detail: String(e && e.message || e) });
  }
}
