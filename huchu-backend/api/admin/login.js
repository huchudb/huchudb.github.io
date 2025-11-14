// api/admin/login.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { withCORS } from '../_lib/cors.js';

const JWT_SECRET = process.env.HUCHU_JWT_SECRET || 'dev-secret';
const ADMIN_HASH = (process.env.HUCHU_ADMIN_HASH || '').trim();

export default withCORS(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.end(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }));
    }

    if (!ADMIN_HASH) {
      console.error('ENV MISSING: HUCHU_ADMIN_HASH is empty');
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: 'SERVER_MISCONFIGURED' }));
    }

    let body = '';
    await new Promise((resolve) => {
      req.on('data', (c) => (body += c));
      req.on('end', resolve);
    });

    let password = '';
    try {
      const json = JSON.parse(body || '{}');
      password = (json.password || '').trim();
    } catch (_) {
      // 폼 전송 등 대비
      const params = new URLSearchParams(body);
      password = (params.get('password') || '').trim();
    }

    if (!password) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: 'PASSWORD_REQUIRED' }));
    }

    // bcrypt 비교
    const ok = await bcrypt.compare(password, ADMIN_HASH);
    if (!ok) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ ok: false, error: 'INVALID_PASSWORD' }));
    }

    // JWT 발급 (1일)
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, token }));
  } catch (e) {
    console.error('LOGIN_ERROR', e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: 'INTERNAL' }));
  }
});
