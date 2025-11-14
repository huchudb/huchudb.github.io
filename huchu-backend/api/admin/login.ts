// huchu-backend/api/admin/login.ts
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

export const config = { runtime: 'edge' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default async function handler(req: Request) {
  try {
    if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

    const { password } = await req.json().catch(() => ({}));
    if (!password || typeof password !== 'string') {
      return json({ error: 'PASSWORD_REQUIRED' }, 400);
    }

    const adminHash = (process.env.ADMIN_HASH || '').trim();
    const jwtSecret = (process.env.JWT_SECRET || '').trim();

    if (!adminHash || !jwtSecret) {
      // 환경변수 미설정
      return json({ error: 'SERVER_MISCONFIGURED' }, 500);
    }

    // bcrypt 해시로 비교
    // adminHash 예: $2b$10$9q6... (bcrypt)
    const ok = await bcrypt.compare(password, adminHash);
    if (!ok) {
      return json({ error: 'INVALID_PASSWORD' }, 401);
    }

    // Edge 런타임 호환 JWT (jose)
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('12h')
      .sign(secret);

    return json({ token }, 200);
  } catch (e) {
    return json({ error: 'UNEXPECTED' }, 500);
  }
}
