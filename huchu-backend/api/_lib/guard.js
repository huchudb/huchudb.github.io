// api/_lib/guard.js
import crypto from 'crypto';

export function getBearerOrHeader(req) {
  const bearer = (req.headers['authorization'] || '').trim();
  const header = (req.headers['x-admin-token'] || '').toString().trim();
  if (header) return header;
  if (bearer.toLowerCase().startsWith('bearer ')) return bearer.slice(7).trim();
  return '';
}

export function verifyAdminToken(req) {
  const plain = getBearerOrHeader(req);
  if (!plain) return false;
  const hashHex = crypto.createHash('sha256').update(plain).digest('hex');
  const expected = (process.env.ADMIN_TOKEN_HASH || '').toLowerCase();
  return expected && hashHex === expected;
}

export function requireAdmin(req, res) {
  if (!verifyAdminToken(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}
