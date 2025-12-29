// /api/loan-config.js
//
// ✅ loan-config (20251229-incheon) (영구 저장: Upstash Redis / pipeline)
// - GET  /api/loan-config
// - POST /api/loan-config
// - OPTIONS (CORS)
//
// NOTE (v1.1 patch):
// - 기존 저장 형태({ byType, lenders })와의 하위호환 유지
// - meta(열거형/매트릭스 등)를 함께 저장/조회할 수 있도록 확장
// - POST에서 meta가 없으면, 기존 저장된 meta를 보존(덮어쓰기 방지)

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


function ensureMetaDefaults(meta) {
  const m = asPlainObject(meta) || {};
  const cur = asPlainObject(m.SUBREGION_LTV_UP) || {};
  const merged = { ...cur };

  // ✅ LTV Up 세부지역은 서울/경기/인천 3개 지역이 기본 대상 (admin SoT 기준)
  if (!("seoul" in merged)) merged.seoul = [];
  if (!("gyeonggi" in merged)) merged.gyeonggi = [];
  if (!("incheon" in merged)) merged.incheon = [];

  m.SUBREGION_LTV_UP = merged;
  return m;
}

function normalizeStoreShape(obj) {
  const o = asPlainObject(obj) || {};

  // legacy: { byType, lenders }
  const byType  = asPlainObject(o.byType)  || {};
  const lenders = asPlainObject(o.lenders) || {};

  // extension
  const meta = ensureMetaDefaults(asPlainObject(o.meta) || {});
  const version = (typeof o.version === "number" && Number.isFinite(o.version)) ? o.version : 1;
  const updatedAt = (typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt)) ? o.updatedAt : null;

  return { version, updatedAt, meta, byType, lenders };
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
    // GET
    if (req.method === "GET") {
      const raw = await getValue(STORE_KEY);
      const parsed = raw ? safeJsonParse(raw) : null;

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json(normalizeStoreShape(parsed));
    }

    // POST
    if (req.method === "POST") {
      // body parse
      let body = req.body;
      if (typeof body === "string") body = safeJsonParse(body) || {};
      const incoming = normalizeStoreShape(body);

      // existing read (meta 보존 목적)
      const rawPrev = await getValue(STORE_KEY);
      const prevParsed = rawPrev ? safeJsonParse(rawPrev) : null;
      const prev = normalizeStoreShape(prevParsed);

      const now = Date.now();

      // meta: incoming이 비어있으면 prev를 유지
      const mergedMeta =
        (ensureMetaDefaults(incoming.meta) && Object.keys(ensureMetaDefaults(incoming.meta)).length > 0) ? ensureMetaDefaults(incoming.meta) : ensureMetaDefaults(prev.meta || {});

      // byType: incoming이 비어있으면 prev 유지(혹시 향후 쓰일 수 있음)
      const mergedByType =
        (incoming.byType && Object.keys(incoming.byType).length > 0) ? incoming.byType : (prev.byType || {});

      // lenders: admin이 소스오프트루스이므로 incoming을 우선(없으면 prev)
      const mergedLenders =
        (incoming.lenders && Object.keys(incoming.lenders).length > 0) ? incoming.lenders : (prev.lenders || {});

      const out = {
        version: prev.version || incoming.version || 1,
        updatedAt: now,
        meta: mergedMeta,
        byType: mergedByType,
        lenders: mergedLenders
      };

      const jsonStr = JSON.stringify(out);
      await setValue(STORE_KEY, jsonStr);

      const lenderCount = Object.keys(out.lenders || {}).length;

      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      return res.status(200).json({
        ok: true,
        lenderCount,
        bytes: jsonStr.length,
        updatedAt: now
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
