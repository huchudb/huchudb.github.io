import { applyCors } from '../_lib/cors.js';
import { requireAdmin } from '../_lib/guard.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  // 어떤 메서드든 토큰만 맞으면 200
  if (!requireAdmin(req, res)) return;
  res.status(200).json({ ok: true });
}
