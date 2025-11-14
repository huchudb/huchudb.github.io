import { applyCors } from '../../_lib/cors.js';
import { requireAdmin } from '../../_lib/guard.js';
import { supabase } from '../../_lib/supabase.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (!requireAdmin(req, res)) return;

  // 관리자: 비활성 포함 전체
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.status(200).json({ ok: true, items: data || [] });
}
