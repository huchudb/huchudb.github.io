import { applyCors, readJson } from '../_lib/cors.js';
import { requireAdmin } from '../_lib/guard.js';
import { supabase } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  try {
    const { fileName, contentType } = await readJson(req);
    if (!fileName || !contentType) {
      return res.status(400).json({ ok: false, error: 'fileName/contentType required' });
    }
    const bucket = process.env.SUPABASE_BUCKET;
    if (!bucket) return res.status(500).json({ ok: false, error: 'missing SUPABASE_BUCKET' });

    // 저장될 경로: notices/{timestamp}-{fileName}
    const objectName = `notices/${Date.now()}-${fileName}`;

    // 60초짜리 업로드 URL 발급
    const { data, error } = await supabase
      .storage.from(bucket)
      .createSignedUploadUrl(objectName);

    if (error) throw error;

    res.status(200).json({
      ok: true,
      uploadUrl: data.signedUrl,
      path: objectName,
      publicUrl: `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectName}`,
      contentType
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
