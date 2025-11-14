import { applyCors, readJson } from '../../_lib/cors.js';
import { requireAdmin } from '../../_lib/guard.js';
import { supabase } from '../../_lib/supabase.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'PUT' && req.method !== 'POST') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  try {
    const payload = await readJson(req);
    const { id, title, image_url, link_url, active = true, published_at } = payload;

    const row = { title, image_url, link_url, active, published_at };
    let q;
    if (id) {
      q = supabase.from('notices').update(row).eq('id', id).select();
    } else {
      q = supabase.from('notices').insert(row).select();
    }
    const { data, error } = await q;
    if (error) throw error;

    res.status(200).json({ ok: true, item: data?.[0] || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
