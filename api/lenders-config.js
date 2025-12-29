// /api/lenders-config.js
//
// ✅ lenders-config (legacy view endpoint)
// - 원래는 별도 저장소를 쓸 계획이었지만 현재는 loan-config(Upstash)을 단일 소스로 사용.
// - GET: loan-config의 lenders를 그대로 반환(배열/객체 모두 허용)
// - POST: (호환용) lenders만 업데이트. meta/byType는 건드리지 않음.

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

function asPlainObject(x) {
  return (x && typeof x === "object" && !Array.isArray(x)) ? x : null;
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
    if (req.method === "GET") {
      const raw = await getValue(STORE_KEY);
      const parsed = raw ? safeJsonParse(raw) : null;

      const lenders = (parsed && parsed.lenders != null) ? parsed.lenders : {};
      const version = (parsed && typeof parsed.version === "number") ? parsed.version : 1;

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json({ version, lenders });
    }

    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") body = safeJsonParse(body) || {};
      const incomingLenders = body?.lenders;

      // 기존 값 로드
      const rawPrev = await getValue(STORE_KEY);
      const prev = rawPrev ? safeJsonParse(rawPrev) : null;

      const prevObj = asPlainObject(prev) || {};
      const next = { ...prevObj };

      // lenders만 갱신
      if (Array.isArray(incomingLenders)) {
        // 배열로 들어오면 id 기준으로 객체로 변환
        const map = {};
        incomingLenders.forEach((l) => {
          const id = String(l?.id || "").trim();
          if (!id) return;
          map[id] = l;
        });
        next.lenders = map;
      } else if (asPlainObject(incomingLenders)) {
        next.lenders = incomingLenders;
      } else {
        // 형식이 이상하면 기존 유지
        next.lenders = asPlainObject(next.lenders) || {};
      }

      next.version = (typeof next.version === "number") ? next.version : 1;
      next.updatedAt = Date.now();

      await setValue(STORE_KEY, JSON.stringify(next));

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json({ ok: true, lenderCount: Object.keys(next.lenders || {}).length });
    }

    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    console.error("lenders-config API error:", e);
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res.status(500).json({ error: "Server Error", detail: String(e?.message || e) });
  }
}
