import { applyCors, readJson } from '../../_lib/cors.js';
import { requireAdmin } from '../../_lib/guard.js';
import { supabase } from '../../_lib/supabase.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'DELETE') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  try {
    const { id } = await readJson(req);
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });

    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) throw error;

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
