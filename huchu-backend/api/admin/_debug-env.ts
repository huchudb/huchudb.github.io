// huchu-backend/api/admin/_debug-env.ts
export const config = { runtime: 'edge' };

export default async function handler() {
  const hasHash = !!(process.env.ADMIN_HASH && process.env.ADMIN_HASH.trim());
  const hasJwt  = !!(process.env.JWT_SECRET && process.env.JWT_SECRET.trim());
  return new Response(JSON.stringify({
    ok: true,
    ADMIN_HASH_present: hasHash,
    JWT_SECRET_present: hasJwt
  }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
