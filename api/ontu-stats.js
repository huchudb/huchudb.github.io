// /api/ontu-stats.js  (Vercel Serverless Function)
// 역할:
//  - GET  /api/ontu-stats?month=YYYY-MM  → 해당 월 통계 반환
//  - GET  /api/ontu-stats               → latest 월 통계 반환
//  - POST /api/ontu-stats               → 관리자에서 통계 저장
//
// ✅ v2 업그레이드:
//  - admin이 byLender(업체별 상품유형 잔액 원천데이터)를 보내면
//    서버가 byType(상품유형별 합계/ratio)를 자동 계산해서 함께 저장
//  - 기존 products:{ratioPercent,amount} 방식도 그대로 지원(하위호환)

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const ALLOWED_ORIGINS = [
  "https://huchudb.github.io",
  "https://www.huchulab.com",
  "https://huchulab.com",
  "https://huchudb-github-io.vercel.app",
  "http://www.huchulab.com",
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    Vary: "Origin",
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cache-Control, Pragma, Accept",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
  };
}

// ── Upstash REST helpers ───────────────────────────
const enc = encodeURIComponent;

async function upstash(path) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error("Upstash env missing: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN");
  }
  const r = await fetch(`${REDIS_URL}/${path}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: "no-store",
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Upstash ${path} failed: HTTP ${r.status} ${JSON.stringify(j)}`);
  if (j && j.error) throw new Error(`Upstash ${path} error: ${j.error}`);
  return j;
}

async function setValue(key, value) {
  await upstash(`set/${enc(key)}/${enc(value)}`);
}
async function getValue(key) {
  const j = await upstash(`get/${enc(key)}`);
  return j.result ?? null;
}

// ── 숫자 유틸 ───────────────────────────
function toNumberSafe(v) {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d.-]/g, "");
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeMonthKey(raw) {
  const monthKey = String(raw || "").trim();
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error("유효하지 않은 monthKey 입니다. (예: 2025-10)");
  }
  return monthKey;
}

function normalizeSummary(summary) {
  const s = summary || {};
  return {
    registeredFirms: toNumberSafe(s.registeredFirms ?? s.dataRegisteredFirms ?? 0),
    dataFirms:       toNumberSafe(s.dataFirms ?? s.dataFirmsCount ?? 0),
    totalLoan:       toNumberSafe(s.totalLoan ?? 0),
    totalRepaid:     toNumberSafe(s.totalRepaid ?? 0),
    balance:         toNumberSafe(s.balance ?? 0),
  };
}

// ── v2: byLender → byType 합산 ─────────────────────
function normalizeByLender(raw) {
  // 허용 입력 키들(유연 지원)
  // body.byLender / body.lenders / body.lenderBalances 중 하나를 받을 수 있게
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = {};

  for (const [lenderKey, typeMap] of Object.entries(src)) {
    if (!lenderKey) continue;
    if (!typeMap || typeof typeMap !== "object" || Array.isArray(typeMap)) continue;

    const cleaned = {};
    for (const [typeName, amountRaw] of Object.entries(typeMap)) {
      const amt = toNumberSafe(amountRaw);
      if (!amt) continue;
      cleaned[typeName] = amt;
    }
    if (Object.keys(cleaned).length) out[lenderKey] = cleaned;
  }
  return out;
}

function calcByTypeFromByLender(byLender) {
  const byType = {};
  let total = 0;

  for (const typeMap of Object.values(byLender || {})) {
    for (const [typeName, amtRaw] of Object.entries(typeMap || {})) {
      const amt = toNumberSafe(amtRaw);
      if (!amt) continue;
      byType[typeName] = byType[typeName] || { amount: 0, ratio: 0 };
      byType[typeName].amount += amt;
      total += amt;
    }
  }
  return { byType, totalFromLenders: total };
}

// ── v1: products(ratioPercent/amount) → byType 변환 ──
function calcByTypeFromProducts(products) {
  const src = products && typeof products === "object" && !Array.isArray(products) ? products : {};
  const byType = {};

  for (const [name, cfg] of Object.entries(src)) {
    const ratioPercent = toNumberSafe(cfg?.ratioPercent ?? 0);
    const amount       = toNumberSafe(cfg?.amount ?? 0);
    if (!ratioPercent && !amount) continue;

    byType[name] = {
      ratio: ratioPercent / 100, // 43 → 0.43
      amount,
    };
  }
  return byType;
}

// ── 최종 payload 정규화 ───────────────────────────
function normalizePayload(body) {
  const monthKey = normalizeMonthKey(body?.monthKey || body?.month);

  const summary = normalizeSummary(body?.summary || {});

  // byLender 우선(원천데이터)
  const rawByLender = body?.byLender || body?.lenders || body?.lenderBalances || null;
  const byLender = normalizeByLender(rawByLender);

  let byType = {};
  let totalFromLenders = 0;

  if (Object.keys(byLender).length) {
    const calc = calcByTypeFromByLender(byLender);
    byType = calc.byType;
    totalFromLenders = calc.totalFromLenders;
  } else {
    // 하위호환: products 기반
    byType = calcByTypeFromProducts(body?.products || {});
  }

  // balance가 비어있으면(byLender 합계로) 자동 채움
  const inferredBalance = totalFromLenders > 0 ? totalFromLenders : summary.balance;
  const balance = summary.balance > 0 ? summary.balance : inferredBalance;

  // ratio 재계산(항상 0~1)
  const safeBalance = balance > 0 ? balance : 0;
  for (const [typeName, obj] of Object.entries(byType)) {
    const amt = toNumberSafe(obj?.amount ?? 0);
    const ratio = safeBalance > 0 ? (amt / safeBalance) : 0;
    byType[typeName] = { amount: amt, ratio };
  }

  return {
    month: monthKey,
    summary: { ...summary, balance },
    byType,
    // ✅ v2 확장 필드 (프론트는 무시해도 됨)
    byLender,
    meta: {
      version: "ontu-stats:v2",
      updatedAt: new Date().toISOString(),
    },
  };
}

// ── Handler ────────────────────────────────────────
export default async function handler(req, res) {
  const origin  = req.headers.origin || "";
  const headers = corsHeaders(origin);

  // Preflight
  if (req.method === "OPTIONS") {
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.status(204).setHeader("Content-Length", "0");
    return res.end();
  }

  try {
    // ---------------- GET: 통계 조회 ----------------
    if (req.method === "GET") {
      const monthParam =
        req.query?.monthKey ||
        req.query?.month ||
        req.query?.Month ||
        "";

      let monthKey = String(monthParam || "").trim();

      // month 파라미터 없으면 latest 키 사용
      if (!monthKey) {
        const latest = await getValue("ontu-stats:latest");
        if (!latest) {
          for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
          return res.status(200).json({ month: null, summary: null, byType: {}, byLender: {} });
        }
        monthKey = latest;
      }

      const raw = await getValue(`ontu-stats:${monthKey}`);
      if (!raw) {
        for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
        return res.status(404).json({ error: "해당 월 데이터 없음", month: monthKey });
      }

      const parsed = JSON.parse(raw);

      // ✅ 과거 데이터(v1)에 byLender가 없을 수 있으니 기본값 보강
      if (!parsed.byLender) parsed.byLender = {};

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json(parsed);
    }

    // ---------------- POST: 관리자 저장 ----------------
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") body = JSON.parse(body);

      const normalized = normalizePayload(body);
      const { month }  = normalized;

      await setValue(`ontu-stats:${month}`, JSON.stringify(normalized));
      await setValue("ontu-stats:latest", month);

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json({
        ok: true,
        month,
        hasByLender: Object.keys(normalized.byLender || {}).length > 0,
        byTypeCount: Object.keys(normalized.byType || {}).length,
      });
    }

    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    console.error("ontu-stats API error:", e);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res
      .status(500)
      .json({ error: "Server Error", detail: String(e && e.message ? e.message : e) });
  }
}
