// /api/ontu-stats-save.js
import fetch from "node-fetch";

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const headers = {
  Authorization: `Bearer ${REDIS_TOKEN}`,
  "Content-Type": "application/json"
};

async function upstash(cmd) {
  const r = await fetch(`${REDIS_URL}/${cmd}`, { headers });
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { month, summary, byType } = req.body;

    if (!month) return res.status(400).json({ error: "month required" });

    const key = `ontu:${month}`;

    // 월 데이터 저장
    await upstash(`set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify({ month, summary, byType }))}`);

    // 월 리스트 저장
    await upstash(`sadd/ontu:months/${month}`);

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
