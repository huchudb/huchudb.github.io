import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

/* =========================================================
   ✅ Navi Stats API (Vercel)
   - GET  /api/navi-stats?month=YYYY-MM            : 월별 통계 조회
   - GET  /api/navi-stats?track=1&event=product_click&k=... : Step1 상품군 클릭 카운트(월별)
   - POST /api/navi-stats                           : (기존) Step5 제출 기반 집계 유지
========================================================= */

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getKstMonthKey(now = new Date()) {
  // KST(+09:00) 기준 YYYY-MM
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function normalizeMonthKey(input) {
  const s = String(input ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  return "";
}

async function kvGetJson(key) {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return (typeof raw === "string") ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

async function kvSetJson(key, obj) {
  // Upstash Redis는 객체 저장도 되지만, 환경 차이 대비해 JSON 문자열로 통일
  await redis.set(key, JSON.stringify(obj));
}

function inc(obj, key, delta = 1) {
  if (!obj || !key) return;
  obj[key] = (Number(obj[key]) || 0) + delta;
}

const PRODUCT_KEYS = new Set([
  "re_collateral",
  "personal_credit",
  "corporate_credit",
  "stock",
  "medical",
  "art",
  "receivable",
  "enote",
  "auction_dividend",
]);

function normalizeProductKey(input) {
  const k = String(input ?? "").trim();
  if (!k) return "";
  return PRODUCT_KEYS.has(k) ? k : "";
}

function initStats(monthKey) {
  const now = Date.now();
  return {
    monthKey,
    totals: { requests: 0, productClicks: 0 },
    // ✅ 메인 페이지 9개 카드용 (Step1 클릭 집계)
    productGroups: {},
    // (기존) Step5 제출 기반 집계
    regions: {},
    loanTypes: {},
    amountBuckets: {},
    createdAt: now,
    updatedAt: now,
  };
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    // =========================================================
    // ✅ GET: 통계 조회 OR 트래킹
    // =========================================================
    if (req.method === "GET") {
      const isTrack = String(req.query?.track ?? "") === "1";

      // --- 트래킹 모드 (명시적 flag가 있을 때만 side-effect 발생)
      if (isTrack) {
        const event = String(req.query?.event ?? "").trim();
        if (event !== "product_click") {
          return res.status(400).json({ ok: false, error: "Unsupported event" });
        }

        const key = normalizeProductKey(req.query?.k ?? req.query?.key);
        if (!key) {
          return res.status(400).json({ ok: false, error: "Invalid product key" });
        }

        const monthKey = getKstMonthKey();
        const redisKey = `huchu:navi-stats:v1:${monthKey}`;

        const stats = (await kvGetJson(redisKey)) || initStats(monthKey);
        stats.totals = stats.totals || { requests: 0, productClicks: 0 };
        stats.productGroups = stats.productGroups || {};

        inc(stats.productGroups, key, 1);
        stats.totals.productClicks = (Number(stats.totals.productClicks) || 0) + 1;
        stats.updatedAt = Date.now();

        await kvSetJson(redisKey, stats);
        return res.status(200).json({ ok: true, monthKey, key, value: stats.productGroups[key] });
      }

      // --- 조회 모드
      const qMonth = normalizeMonthKey(req.query?.month);
      const monthKey = qMonth || getKstMonthKey();
      const redisKey = `huchu:navi-stats:v1:${monthKey}`;

      const stats = (await kvGetJson(redisKey)) || initStats(monthKey);

      // 하위호환: 예전 데이터에 totals/productGroups가 없을 수 있음
      if (!stats.totals) stats.totals = { requests: 0, productClicks: 0 };
      if (!stats.productGroups) stats.productGroups = {};

      return res.status(200).json(stats);
    }

    // =========================================================
    // ✅ POST: (기존) Step5 제출 기반 집계 유지
    // =========================================================
    if (req.method === "POST") {
      const monthKey = getKstMonthKey();
      const redisKey = `huchu:navi-stats:v1:${monthKey}`;

      const body = (typeof req.body === "string") ? JSON.parse(req.body) : (req.body || {});
      const region = String(body.region ?? "").trim();
      const loanType = String(body.loanType ?? "").trim();
      const amountBucket = String(body.amountBucket ?? "").trim();

      const stats = (await kvGetJson(redisKey)) || initStats(monthKey);

      stats.totals = stats.totals || { requests: 0, productClicks: 0 };
      stats.regions = stats.regions || {};
      stats.loanTypes = stats.loanTypes || {};
      stats.amountBuckets = stats.amountBuckets || {};

      stats.totals.requests = (Number(stats.totals.requests) || 0) + 1;
      if (region) inc(stats.regions, region, 1);
      if (loanType) inc(stats.loanTypes, loanType, 1);
      if (amountBucket) inc(stats.amountBuckets, amountBucket, 1);

      stats.updatedAt = Date.now();

      await kvSetJson(redisKey, stats);
      return res.status(200).json({ ok: true, monthKey });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
