// /api/navi-stats.js
// Huchu Navi usage stats (monthly aggregation)
//
// ✅ 메인페이지(Hero) 위젯:
// - Step1 '대출상품군 선택' 클릭 시 9개 상품군 카운팅 (event='product_click')
// - 메인페이지에서는 monthKey 기준으로 productGroups를 조회(GET)
//
// ⚠️ CORS: GitHub Pages(https://www.huchulab.com) → Vercel Functions 호출을 위해 CORS 헤더 필수

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Access-Control-Max-Age", "86400");
}

const ALLOWED_PRODUCT_KEYS = new Set([
  "re_collateral",
  "personal_credit",
  "corporate_credit",
  "stock",
  "medical",
  "art",
  "receivable",
  "eao",
  "auction",
]);

function isAllowedProductKey(key) {
  return ALLOWED_PRODUCT_KEYS.has(String(key || "").trim());
}

function getKstMonthKey(d = new Date()) {
  // YYYY-MM (KST)
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
    }).format(d);
  } catch {
    const tzOffsetMs = 9 * 60 * 60 * 1000;
    return new Date(Date.now() + tzOffsetMs).toISOString().slice(0, 7);
  }
}

function normalizeMonthKey(m) {
  const s = String(m || "").trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  return null;
}

function amountBucket(amountMan) {
  const a = Number(amountMan);
  if (!Number.isFinite(a) || a <= 0) return "unknown";
  if (a < 3000) return "0_3000";
  if (a < 5000) return "3000_5000";
  if (a < 10000) return "5000_10000";
  if (a < 20000) return "10000_20000";
  if (a < 30000) return "20000_30000";
  if (a < 50000) return "30000_50000";
  return "50000_plus";
}

async function upstash(command, args = []) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) throw new Error("Missing Upstash env");
  const url = `${UPSTASH_URL}/${command}/${args.map(encodeURIComponent).join("/")}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } });
  if (!res.ok) throw new Error(`Upstash ${command} failed: ${res.status}`);
  const data = await res.json();
  return data?.result;
}

async function kvGetJson(key) {
  const raw = await upstash("get", [key]);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function kvSetJson(key, obj) {
  return await upstash("set", [key, JSON.stringify(obj)]);
}

function initStats(monthKey) {
  return {
    version: 2,
    monthKey,
    updatedAt: Date.now(),
    totals: { requests: 0, productClicks: 0, confirms: 0, error: 0 },
    productGroups: {
      re_collateral: 0,
      personal_credit: 0,
      corporate_credit: 0,
      stock: 0,
      medical: 0,
      art: 0,
      receivable: 0,
      eao: 0,
      auction: 0,
    },
    // legacy(선택): Step5 confirm을 쓰는 경우만 증가
    regions: {},
    loanTypes: {},
    amountBuckets: {},
  };
}

function inc(map, key, by = 1) {
  const k = String(key || "").trim() || "unknown";
  map[k] = (Number(map[k]) || 0) + by;
}

function safeParseBody(req) {
  const b = req?.body;

  if (!b) return {};

  // 문자열(JSON)
  if (typeof b === "string") {
    try { return JSON.parse(b); } catch { return {}; }
  }

  // Buffer
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(b)) {
    try { return JSON.parse(b.toString("utf8")); } catch { return {}; }
  }

  // 이미 객체로 파싱된 경우
  if (typeof b === "object") return b;

  return {};
}

async function parseBody(req) {
  // 1) Try already-parsed body (Next/Vercel default)
  const parsed = safeParseBody(req);
  if (parsed && typeof parsed === "object" && Object.keys(parsed).length) return parsed;

  // 2) Fallback: read raw stream (sendBeacon(text/plain) or fetch without JSON parser)
  try {
    const raw = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => {
        data += chunk;
        // safety: 256KB max
        if (data.length > 256 * 1024) {
          reject(new Error("Body too large"));
        }
      });
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    const s = String(raw || "").trim();
    if (!s) return {};
    try { return JSON.parse(s); } catch { return {}; }
  } catch (e) {
    return {};
  }
}


export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    if (req.method === "GET") {
      const mk = normalizeMonthKey(req.query?.month) || getKstMonthKey();
      const key = `huchu:navi-stats:v1:${mk}`;
      const stats = (await kvGetJson(key)) || initStats(mk);

      // 누락 필드 방어(구버전/수동 수정 대비)
      stats.version = 2;
      stats.monthKey = mk;
      stats.updatedAt = Date.now();
      if (!stats.totals) stats.totals = { requests: 0, productClicks: 0, confirms: 0, error: 0 };
      if (!stats.productGroups) stats.productGroups = initStats(mk).productGroups;

      return res.status(200).json(stats);
    }

    if (req.method === "POST") {
      const mk = getKstMonthKey();
      const key = `huchu:navi-stats:v1:${mk}`;
      const body = await parseBody(req);
      const event = String(body.event || body.evt || "confirm").trim();
      const stats = (await kvGetJson(key)) || initStats(mk);

      // 누락 필드 방어
      if (!stats.totals) stats.totals = { requests: 0, productClicks: 0, confirms: 0, error: 0 };
      if (!stats.productGroups) stats.productGroups = initStats(mk).productGroups;

      stats.monthKey = mk;
      stats.updatedAt = Date.now();
      stats.totals.requests = (Number(stats.totals.requests) || 0) + 1;

      if (event === "product_click") {
        const pg = String(body.productGroupKey || body.productGroup || body.mainCategoryKey || body.mainCategory || "").trim();
        if (isAllowedProductKey(pg)) {
          inc(stats.productGroups, pg, 1);
        } else {
          // 잘못된 키는 버림(통계 오염 방지)
          stats.totals.error = (Number(stats.totals.error) || 0) + 1;
        }
        stats.totals.productClicks = (Number(stats.totals.productClicks) || 0) + 1;
      } else {
        // legacy: Step5 confirm
        const regionKey = body.regionKey || body.region || "unknown";
        const loanTypeKey = body.loanTypeKey || body.loanType || "unknown";
        const amountMan = body.amountMan ?? body.amount ?? 0;
        const b = amountBucket(amountMan);

        if (!stats.regions) stats.regions = {};
        if (!stats.loanTypes) stats.loanTypes = {};
        if (!stats.amountBuckets) stats.amountBuckets = {};

        inc(stats.regions, regionKey, 1);
        inc(stats.loanTypes, loanTypeKey, 1);
        inc(stats.amountBuckets, b, 1);
        stats.totals.confirms = (Number(stats.totals.confirms) || 0) + 1;
      }

      await kvSetJson(key, stats);
      // 응답에 현재값을 포함해 네트워크에서 즉시 확인 가능
      const pgKey = String(body.productGroupKey || body.productGroup || "").trim();
      const pgVal = pgKey ? (Number(stats?.productGroups?.[pgKey]) || 0) : undefined;
      return res.status(200).json({ ok: true, monthKey: mk, event, productGroupKey: pgKey || undefined, productGroupValue: pgVal, totals: stats.totals });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    console.error("navi-stats error:", e);
    // CORS 헤더는 이미 setCors()로 설정됨
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
