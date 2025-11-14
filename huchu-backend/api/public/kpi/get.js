import { applyCors } from '../../_lib/cors.js';
import { supabase } from '../../_lib/supabase.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  const ym = (req.query.ym || '').toString();
  if (ym) {
    const { data, error } = await supabase.from('kpi_stats').select('*').eq('ym', ym).maybeSingle();
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, item: data || null });
  } else {
    // 최신(가장 큰 ym) 1건
    const { data, error } = await supabase
      .from('kpi_stats')
      .select('*')
      .order('ym', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, item: data || null });
  }
}
