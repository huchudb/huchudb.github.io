// /api/ontu-stats.js  (Vercel Serverless Function)
// 역할:
//  - GET  /api/ontu-stats?month=YYYY-MM  → 해당 월 통계 반환
//  - GET  /api/ontu-stats               → latest 월 통계 반환
//  - POST /api/ontu-stats               → 관리자에서 통계 저장

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
  const r = await fetch(`${REDIS_URL}/${path}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Upstash ${path} failed: HTTP ${r.status} ${JSON.stringify(j)}`);
  if (j && j.error) throw new Error(`Upstash ${path} error: ${j.error}`);
  return j;
}

async function setValue(key, value) {
  // 문자열 통째로 저장
  await upstash(`set/${enc(key)}/${enc(value)}`);
}
async function getValue(key) {
  const j = await upstash(`get/${enc(key)}`);
  return j.result ?? null;        // 문자열 또는 null
}

// ── 응답 포맷 변환 유틸 ───────────────────────────
// admin-beta가 보내는 구조:
// { monthKey, summary, products: { "부동산담보": {ratioPercent, amount}, ... } }
//
// 프론트(home-beta.js, ontu-stats.js)가 기대하는 구조:
// { month, summary, byType: { "부동산담보": { ratio, amount }, ... } }

function normalizePayload(body) {
  const monthKey = (body.monthKey || "").trim();
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error("유효하지 않은 monthKey 입니다. (예: 2025-10)");
  }

  const summary = body.summary || {};
  const products = body.products || {};

  const byType = {};
  for (const [name, cfg] of Object.entries(products)) {
    const ratioPercent = Number(cfg.ratioPercent ?? 0);
    const amount       = Number(cfg.amount ?? 0);
    if (!ratioPercent && !amount) continue;

    byType[name] = {
      ratio: ratioPercent / 100,  // 43 → 0.43
      amount,
    };
  }

  return {
    month: monthKey,
    summary: {
      registeredFirms: Number(summary.registeredFirms ?? 0),
      dataFirms:       Number(summary.dataFirms ?? 0),
      totalLoan:       Number(summary.totalLoan ?? 0),
      totalRepaid:     Number(summary.totalRepaid ?? 0),
      balance:         Number(summary.balance ?? 0),
    },
    byType,
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
      const monthParam = req.query?.month || req.query?.Month || "";

      // month 파라미터 있으면 그 월, 없으면 latest 키 사용
      let monthKey = (monthParam || "").trim();

      if (!monthKey) {
        const latest = await getValue("ontu-stats:latest");
        if (!latest) {
          // 아무 데이터도 없을 때 빈 응답
          for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
          return res.status(200).json({ month: null, summary: null, byType: {} });
        }
        monthKey = latest;
      }

      const raw = await getValue(`ontu-stats:${monthKey}`);
      if (!raw) {
        for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
        return res.status(404).json({ error: "해당 월 데이터 없음", month: monthKey });
      }

      const parsed = JSON.parse(raw);

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json(parsed);
    }

    // ---------------- POST: 관리자 저장 ----------------
    if (req.method === "POST") {
      let body = req.body;
      // 문자열로 올 수도 있으니 파싱
      if (typeof body === "string") {
        body = JSON.parse(body);
      }

      const normalized = normalizePayload(body);
      const { month }  = normalized;

      // 1) 월별 데이터 저장
      await setValue(`ontu-stats:${month}`, JSON.stringify(normalized));
      // 2) latest 갱신 (가장 최근 저장 월 기준)
      await setValue("ontu-stats:latest", month);

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json({ ok: true, month });
    }

    // 그 외 메서드
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
