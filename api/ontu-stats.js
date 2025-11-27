import fetch from "node-fetch";

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const headers = { Authorization: `Bearer ${REDIS_TOKEN}` };
async function upstash(cmd) {
  const r = await fetch(`${REDIS_URL}/${cmd}`, { headers });
  return r.json();
}

export default async function handler(req, res) {
  const { month } = req.query;

  try {
    let targetMonth = month;

    // 최신 월 찾기
    if (!targetMonth) {
      const list = await upstash("smembers/ontu:months");
      const months = list.result || [];
      targetMonth = months.sort().pop();
    }

    const data = await upstash(`get/${encodeURIComponent(`ontu:${targetMonth}`)}`);
    return res.status(200).json(JSON.parse(data.result));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
