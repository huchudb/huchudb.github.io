// /api/loan-config.js
//
// ✅ loan-config (영구 저장: Upstash Redis / pipeline)
// - GET  /api/loan-config
// - POST /api/loan-config
// - OPTIONS (CORS)

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

function safeJsonParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function normalizeStoreShape(obj) {
  if (!obj || typeof obj !== "object") return { byType: {}, lenders: {} };

  const byType = (obj.byType && typeof obj.byType === "object" && !Array.isArray(obj.byType)) ? obj.byType : {};
  const lenders = (obj.lenders && typeof obj.lenders === "object" && !Array.isArray(obj.lenders)) ? obj.lenders : {};

  return { byType, lenders };
}

// ---- Upstash pipeline helpers ----
async function upstashPipeline(commands) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error("Upstash env missing: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN");
  }

  const r = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(commands),
    cache: "no-store"
  });

  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Upstash pipeline failed: HTTP ${r.status} ${JSON.stringify(j)}`);
  return j; // array
}

async function getValue(key) {
  const resp = await upstashPipeline([["GET", key]]);
  // resp[0].result 에 값이 들어옴 (없으면 null)
  return resp?.[0]?.result ?? null;
}

async function setValue(key, value) {
  const resp = await upstashPipeline([["SET", key, value]]);
  const ok = resp?.[0]?.result === "OK";
  if (!ok) throw new Error(`Upstash SET not OK: ${JSON.stringify(resp)}`);
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
      const jsonStr = JSON.stringify(normalized);

      await setValue(STORE_KEY, jsonStr);

      const lenderCount = Object.keys(normalized.lenders || {}).length;

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json({
        ok: true,
        lenderCount,
        bytes: jsonStr.length
      });
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
