import { applyCors } from '../../_lib/cors.js';
import { requireAdmin } from '../../_lib/guard.js';
import { supabase } from '../../_lib/supabase.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (!requireAdmin(req, res)) return;

  const ym = (req.query.ym || '').toString();
  if (ym) {
    const { data, error } = await supabase.from('kpi_stats').select('*').eq('ym', ym).maybeSingle();
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, item: data || null });
  } else {
    const { data, error } = await supabase
      .from('kpi_stats')
      .select('*')
      .order('ym', { ascending: true });
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, items: data || [] });
  }
}
