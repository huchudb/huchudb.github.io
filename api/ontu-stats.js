{
  "baseMonth": "2025-10",
  "lastUpdated": "2025-11-17T...",
  "summary": {
    "firmCount": 49,
    "cumulativeLoan": 18358007760000,
    "cumulativeRepayment": 16924144010000,
    "outstandingBalance": 1433863750000
  },
  "productBreakdown": [
    { "type": "부동산담보",         "share": 0.43 },
    { "type": "부동산PF",          "share": 0.02 },
    { "type": "어음·매출채권담보", "share": 0.09 },
    { "type": "기타담보(주식 등)", "share": 0.38 },
    { "type": "개인신용",          "share": 0.06 },
    { "type": "법인신용",          "share": 0.03 }
  ]
}
// /api/ontu-stats.js  — Node.js (Vercel Serverless Function with Upstash Redis)
// 환경변수: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Redis key
const ONTU_STATS_KEY = 'stats:ontu';

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
    Vary: 'Origin',
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
    console.error('ontu-stats getJson parse error', e, 'raw=', raw);
    return null;
  }
}

async function setJson(key, obj) {
  const str = JSON.stringify(obj);
  await upstash(`set/${enc(key)}/${enc(str)}`);
}

// 기본값 (비어있을 때)
const PRODUCT_TYPES = [
  '부동산담보',
  '부동산PF',
  '어음·매출채권담보',
  '기타담보(주식 등)',
  '개인신용',
  '법인신용',
];

function defaultOntuStats() {
  return {
    baseMonth: null,      // 'YYYY-MM'
    lastUpdated: null,    // ISO string
    summary: {
      firmCount: null,
      cumulativeLoan: null,
      cumulativeRepayment: null,
      outstandingBalance: null,
    },
    productBreakdown: PRODUCT_TYPES.map(type => ({
      type,
      share: null,        // 0~1
    })),
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
      let stats = null;
      try {
        stats = await getJson(ONTU_STATS_KEY);
      } catch (e) {
        console.error('ontu-stats GET upstash error', e);
      }

      if (!stats) {
        stats = defaultOntuStats();
      }

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json(stats);
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (!body || typeof body !== 'object') {
        for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
        return res.status(400).json({ error: 'invalid body' });
      }

      const baseMonth = body.baseMonth || null;
      const summaryBody = body.summary || {};
      const breakdownBody = Array.isArray(body.productBreakdown)
        ? body.productBreakdown
        : [];

      const summary = {
        firmCount: (typeof summaryBody.firmCount === 'number')
          ? summaryBody.firmCount
          : null,
        cumulativeLoan: (typeof summaryBody.cumulativeLoan === 'number')
          ? summaryBody.cumulativeLoan
          : null,
        cumulativeRepayment: (typeof summaryBody.cumulativeRepayment === 'number')
          ? summaryBody.cumulativeRepayment
          : null,
        outstandingBalance: (typeof summaryBody.outstandingBalance === 'number')
          ? summaryBody.outstandingBalance
          : null,
      };

      const productBreakdown = breakdownBody.map(item => ({
        type: String(item.type || ''),
        share: (typeof item.share === 'number') ? item.share : null,
      }));

      const stats = {
        baseMonth,
        lastUpdated: body.lastUpdated || new Date().toISOString(),
        summary,
        productBreakdown,
      };

      try {
        await setJson(ONTU_STATS_KEY, stats);
      } catch (e) {
        console.error('ontu-stats POST upstash error', e);
        for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
        return res.status(500).json({ error: 'internal error' });
      }

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json(stats);
    }

    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('ontu-stats handler error', e);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res.status(500).json({ error: 'Server Error', detail: String(e && e.message || e) });
  }
}
