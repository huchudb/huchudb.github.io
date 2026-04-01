// /api/_admin-auth.js

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "";

const SUPABASE_PUBLIC_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

function parseCsvEnv(value) {
  return String(value || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function getAllowedEmails() {
  return parseCsvEnv(process.env.ADMIN_EMAILS);
}

function getAllowedUserIds() {
  return parseCsvEnv(process.env.ADMIN_USER_IDS);
}

function getAllowedRoles() {
  const roles = parseCsvEnv(process.env.ADMIN_ROLE_NAMES || "admin,superadmin");
  return roles.length ? roles : ["admin", "superadmin"];
}

function readUserRoles(user) {
  const roles = new Set();
  const appMeta = (user && typeof user.app_metadata === "object" && user.app_metadata) ? user.app_metadata : {};
  const userMeta = (user && typeof user.user_metadata === "object" && user.user_metadata) ? user.user_metadata : {};

  const pushValue = (value) => {
    if (typeof value === "string" && value.trim()) roles.add(value.trim().toLowerCase());
  };

  pushValue(appMeta.role);
  pushValue(userMeta.role);

  if (Array.isArray(appMeta.roles)) appMeta.roles.forEach(pushValue);
  if (Array.isArray(userMeta.roles)) userMeta.roles.forEach(pushValue);

  return Array.from(roles);
}

function isAllowedAdminUser(user) {
  if (!user || typeof user !== "object") return false;

  const email = String(user.email || "").trim().toLowerCase();
  const userId = String(user.id || "").trim().toLowerCase();
  const roles = readUserRoles(user);

  const allowedEmails = getAllowedEmails();
  const allowedUserIds = getAllowedUserIds();
  const allowedRoles = getAllowedRoles();

  if (email && allowedEmails.includes(email)) return true;
  if (userId && allowedUserIds.includes(userId)) return true;
  if (roles.some((role) => allowedRoles.includes(role))) return true;

  return false;
}

async function fetchSupabaseUser(accessToken) {
  const url = `${SUPABASE_URL.replace(/\/+$/, "")}/auth/v1/user`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_PUBLIC_KEY
    },
    cache: "no-store"
  });

  const text = await res.text().catch(() => "");
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }

  return { ok: res.ok, status: res.status, body: json, raw: text };
}

export function getAdminAuthConfig() {
  const allowedEmails = getAllowedEmails();
  const allowedUserIds = getAllowedUserIds();
  const allowedRoles = getAllowedRoles();
  const enabled = Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);

  return {
    enabled,
    supabaseUrl: enabled ? SUPABASE_URL : "",
    supabaseAnonKey: enabled ? SUPABASE_PUBLIC_KEY : "",
    hasAdminRules: Boolean(allowedEmails.length || allowedUserIds.length || allowedRoles.length),
    allowedRoleNames: allowedRoles,
    allowlistMode: {
      emails: allowedEmails.length > 0,
      userIds: allowedUserIds.length > 0,
      roles: allowedRoles.length > 0
    }
  };
}

export async function requireAdmin(req) {
  const cfg = getAdminAuthConfig();
  if (!cfg.enabled) {
    return {
      ok: false,
      status: 500,
      code: "AUTH_CONFIG_MISSING",
      message: "Supabase 관리자 인증 설정이 누락되었습니다."
    };
  }

  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(String(authHeader).trim());
  const accessToken = match ? String(match[1] || "").trim() : "";

  if (!accessToken) {
    return {
      ok: false,
      status: 401,
      code: "AUTH_REQUIRED",
      message: "관리자 로그인이 필요합니다."
    };
  }

  let fetched;
  try {
    fetched = await fetchSupabaseUser(accessToken);
  } catch (error) {
    return {
      ok: false,
      status: 502,
      code: "AUTH_UPSTREAM_ERROR",
      message: "Supabase 인증 확인 중 오류가 발생했습니다.",
      detail: String(error && error.message ? error.message : error)
    };
  }

  if (!fetched.ok || !fetched.body) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_TOKEN",
      message: "로그인 세션이 유효하지 않습니다.",
      detail: fetched.raw || null
    };
  }

  if (!isAllowedAdminUser(fetched.body)) {
    return {
      ok: false,
      status: 403,
      code: "ADMIN_FORBIDDEN",
      message: "관리자 권한이 없습니다.",
      user: {
        id: fetched.body.id || null,
        email: fetched.body.email || null
      }
    };
  }

  return { ok: true, user: fetched.body };
}
