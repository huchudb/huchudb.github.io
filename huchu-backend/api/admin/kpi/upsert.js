import { applyCors, readJson } from '../../_lib/cors.js';
import { requireAdmin } from '../../_lib/guard.js';
import { supabase } from '../../_lib/supabase.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'PUT' && req.method !== 'POST') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  try {
    const payload = await readJson(req);
    const { ym, kpi2, kpi2_prev, kpi1_rows, kpi1_prev } = payload;

    if (!ym) return res.status(400).json({ ok: false, error: 'ym required' });

    const upsertRow = { ym, kpi2, kpi2_prev, kpi1_rows, kpi1_prev };
    const { data, error } = await supabase
      .from('kpi_stats')
      .upsert(upsertRow, { onConflict: 'ym' })
      .select();

    if (error) throw error;
    res.status(200).json({ ok: true, item: data?.[0] || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
