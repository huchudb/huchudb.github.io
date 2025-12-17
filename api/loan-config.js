// /api/loan-config.js  (Vercel Serverless Function)
// 역할:
//  - GET  /api/loan-config            → 현재 loan-config 반환 (없으면 기본값)
//  - POST /api/loan-config            → loan-config 저장 (Upstash Redis에 영구 저장)
//  - OPTIONS                           → CORS Preflight

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// 저장 키(단일 최신본)
const LOANCFG_KEY = "loan-config:current";

const ALLOWED_ORIGINS = [
  "https://www.huchulab.com",
  "https://huchulab.com",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:3000",
  "https://huchudb-github-io.vercel.app"
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    Vary: "Origin",
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    // admin-beta.js에서 보낼 수 있는 헤더 범위(넉넉히)
    "Access-Control-Allow-Headers": "Content-Type, Cache-Control, Pragma, Accept, X-Requested-With",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
  };
}

// ---- Upstash REST helpers ----
const enc = encodeURIComponent;

async function upstash(path) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error("Upstash env missing: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN");
  }

  const r = await fetch(`${REDIS_URL}/${path}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: "no-store",
  });

  const j = await r.json().catch(() => ({}));
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
  return j.result ?? null; // 문자열 또는 null
}

function safeJsonParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function normalizeLoanConfigShape(obj) {
  // 최종 저장 형태: { byType: {}, lenders: {} }
  if (!obj || typeof obj !== "object") return { byType: {}, lenders: {} };

  const byType = (obj.byType && typeof obj.byType === "object" && !Array.isArray(obj.byType))
    ? obj.byType
    : {};

  const lenders = (obj.lenders && typeof obj.lenders === "object" && !Array.isArray(obj.lenders))
    ? obj.lenders
    : {};

  return { byType, lenders };
}

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
    // ---------------- GET: 조회 ----------------
    if (req.method === "GET") {
      const raw = await getValue(LOANCFG_KEY);
      const parsed = raw ? safeJsonParse(raw) : null;
      const payload = normalizeLoanConfigShape(parsed);

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json(payload);
    }

    // ---------------- POST: 저장 ----------------
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") body = safeJsonParse(body) || {};

      // admin-beta.js는 { lenders: {...} } 형태로 보낼 가능성이 높음
      // 혹은 { byType, lenders } 형태도 허용
      const normalized = normalizeLoanConfigShape(body);

      // 저장
      await setValue(LOANCFG_KEY, JSON.stringify(normalized));

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json({ ok: true, loanConfig: normalized });
    }

    // 그 외 메서드
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    console.error("loan-config API error:", e);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res.status(500).json({
      error: "Server Error",
      detail: String(e && e.message ? e.message : e),
    });
  }
}
