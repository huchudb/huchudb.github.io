// /api/loan-config.js
//
// ✅ 후추 네비게이션 loan-config API (영구 저장: Upstash Redis)
// - GET  /api/loan-config              → 저장된 설정 반환 (없으면 빈 구조)
// - POST /api/loan-config              → 설정 저장
// - OPTIONS                            → CORS preflight
//
// 저장 키: loan-config:v1
// 저장 구조: { byType: {...}, lenders: {...} }

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const STORE_KEY = "loan-config:v1";

const ALLOWED_ORIGINS = [
  "https://www.huchulab.com",
  "https://huchulab.com",
  "https://huchudb.github.io",
  "https://huchudb-github-io.vercel.app",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://127.0.0.1:3000"
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    Vary: "Origin",
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cache-Control, Pragma, Accept, X-Requested-With",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store"
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
    cache: "no-store"
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Upstash ${path} failed: HTTP ${r.status} ${JSON.stringify(j)}`);
  if (j && j.error) throw new Error(`Upstash ${path} error: ${j.error}`);
  return j;
}

async function getValue(key) {
  const j = await upstash(`get/${enc(key)}`);
  return j.result ?? null;
}

async function setValue(key, value) {
  await upstash(`set/${enc(key)}/${enc(value)}`);
}

function safeJsonParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function normalizeStoreShape(obj) {
  // 최종적으로 { byType: {}, lenders: {} } 형태만 허용
  if (!obj || typeof obj !== "object") return { byType: {}, lenders: {} };

  const byType = (obj.byType && typeof obj.byType === "object" && !Array.isArray(obj.byType)) ? obj.byType : {};
  const lenders = (obj.lenders && typeof obj.lenders === "object" && !Array.isArray(obj.lenders)) ? obj.lenders : {};

  return { byType, lenders };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const headers = corsHeaders(origin);

  // Preflight
  if (req.method === "OPTIONS") {
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.status(204).setHeader("Content-Length", "0");
    return res.end();
  }

  try {
    // GET
    if (req.method === "GET") {
      const raw = await getValue(STORE_KEY);
      const parsed = raw ? safeJsonParse(raw) : null;

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json(normalizeStoreShape(parsed));
    }

    // POST
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") body = safeJsonParse(body) || {};

      const normalized = normalizeStoreShape(body);

      await setValue(STORE_KEY, JSON.stringify(normalized));

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json({ ok: true });
    }

    // Others
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    console.error("loan-config API error:", e);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res.status(500).json({ error: "Server Error", detail: String(e?.message || e) });
  }
}
