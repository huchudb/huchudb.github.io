import { applyCors } from '../../_lib/cors.js';
import { supabase } from '../../_lib/supabase.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  const limit = Math.max(0, Math.min(parseInt(req.query.limit || '0', 10) || 0, 50));
  const baseQuery = supabase
    .from('notices')
    .select('id,title,image_url,link_url,active,published_at')
    .eq('active', true)
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });

  const { data, error } = await (limit ? baseQuery.limit(limit) : baseQuery);
  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.status(200).json({ ok: true, items: data || [] });
}
