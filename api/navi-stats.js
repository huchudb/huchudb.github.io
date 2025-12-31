// /api/navi-stats.js
// Huchu Navi usage stats (monthly aggregation)
// - Incremented on navi page events (Step1 product click / Step5 confirm)
// - Exposes monthly stats for main page hero widget

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getKstMonthKey(d = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
    }).format(d); // YYYY-MM
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
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function kvSetJson(key, obj) {
  return await upstash("set", [key, JSON.stringify(obj)]);
}

function initStats(monthKey) {
  return {
    version: 2,
    monthKey,
    updatedAt: Date.now(),
    totals: {
      // all events combined
      requests: 0,
      // Step1 "대출상품군 선택" 클릭 집계
      productClicks: 0,
      // Step5 확인(결과보기) 집계 (legacy/optional)
      confirms: 0,
      error: 0
    },
    // Step1 클릭 기반: 9개 상품군(메인 위젯)
    productGroups: {
      re_collateral: 0,      // 부동산 담보대출
      personal_credit: 0,    // 개인 신용대출
      corporate_credit: 0,   // 법인 신용대출
      stock: 0,              // 스탁론(상장/비상장 통합)
      medical: 0,            // 의료사업자대출
      art: 0,                // 미술품 담보대출
      receivable: 0,         // 매출채권 유동화(선정산 포함)
      eao: 0,                // 전자어음
      auction: 0             // 경매배당금 담보대출
    },
    // legacy: Step5 confirm에서만 집계(사용 중이면 유지)
    regions: {},
    loanTypes: {},
    amountBuckets: {}
  };
}


function inc(map, key, by = 1) {
  const k = String(key || "").trim() || "unknown";
  map[k] = (Number(map[k]) || 0) + by;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") {
      const mk = normalizeMonthKey(req.query?.month) || getKstMonthKey();
      const key = `huchu:navi-stats:v1:${mk}`;
      const stats = (await kvGetJson(key)) || initStats(mk);
      return res.status(200).json(stats);
    }

    if (req.method === "POST") {
      const mk = getKstMonthKey();
      const key = `huchu:navi-stats:v1:${mk}`;
      const body = (typeof req.body === "string") ? JSON.parse(req.body) : (req.body || {});

      const event = String(body.event || body.evt || "confirm");

// Step1 선택: product_click (메인 9개 집계)
const productGroupKey = body.productGroupKey || body.productGroup || body.mainCategoryKey || body.mainCategory || "";

// Step5 확인: confirm (legacy)
const regionKey = body.regionKey || body.region || "unknown";
const loanTypeKey = body.loanTypeKey || body.loanType || "unknown";
const amountMan = body.amountMan ?? body.amount ?? 0;

const b = amountBucket(amountMan);

const stats = (await kvGetJson(key)) || initStats(mk);
stats.monthKey = mk;
stats.updatedAt = Date.now();

if (!stats.totals) stats.totals = { requests: 0, productClicks: 0, confirms: 0, error: 0 };
stats.totals.requests = (Number(stats.totals?.requests) || 0) + 1;

if (event === "product_click") {
  if (!stats.productGroups) stats.productGroups = {};
  // 등록된 9개 키만 안전하게 증가
  const pg = String(productGroupKey || "").trim();
  if (isAllowedProductKey(pg)) inc(stats.productGroups, pg, 1);
  stats.totals.productClicks = (Number(stats.totals?.productClicks) || 0) + 1;
} else {
  // confirm (기존 집계)
  if (!stats.regions) stats.regions = {};
  if (!stats.loanTypes) stats.loanTypes = {};
  if (!stats.amountBuckets) stats.amountBuckets = {};
  inc(stats.regions, regionKey, 1);
  inc(stats.loanTypes, loanTypeKey, 1);
  inc(stats.amountBuckets, b, 1);
  stats.totals.confirms = (Number(stats.totals?.confirms) || 0) + 1;
}

      await kvSetJson(key, stats);
      return res.status(200).json({ ok: true, monthKey: mk });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    console.error("navi-stats error:", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
