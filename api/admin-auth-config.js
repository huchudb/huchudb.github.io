// /api/admin-auth-config.js

import { getAdminAuthConfig } from "./_admin-auth.js";

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
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store"
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.status(204).setHeader("Content-Length", "0");
    return res.end();
  }

  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const cfg = getAdminAuthConfig();
  return res.status(200).json({
    ok: true,
    enabled: cfg.enabled,
    supabaseUrl: cfg.supabaseUrl,
    supabaseAnonKey: cfg.supabaseAnonKey,
    hasAdminRules: cfg.hasAdminRules,
    allowlistMode: cfg.allowlistMode,
    allowedRoleNames: cfg.allowedRoleNames
  });
}
