// /api/ontu-stats-save.js

let store = {};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { month, summary, byType } = req.body || {};

    if (!month || !summary || !byType) {
      return res.status(400).json({ error: "필수 데이터 누락" });
    }

    store[month] = { summary, byType };

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Server Error" });
  }
}
