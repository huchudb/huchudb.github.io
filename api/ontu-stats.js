// /api/ontu-stats.js

const stats = require("../data/ontu-stats.json");

function getLatestMonthKey() {
  const keys = Object.keys(stats);
  if (!keys.length) return null;
  // YYYY-MM 문자열이라 그냥 정렬하면 순서 맞음
  keys.sort(); 
  return keys[keys.length - 1];
}

module.exports = (req, res) => {
  // CORS·캐시 등 필요시 여기에서 설정
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const { month } = req.query || {};

  // 1) 특정 월 요청: /api/ontu-stats?month=2025-10
  if (month) {
    const data = stats[month];
    if (!data) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND", month });
    }
    return res.status(200).json({
      ok: true,
      month,
      summary: data.summary,
      byType: data.byType
    });
  }

  // 2) 월 미지정: 최신 월 + 전체 월 목록 반환
  const latest = getLatestMonthKey();
  if (!latest) {
    return res.status(200).json({ ok: false, error: "NO_DATA" });
  }

  const latestData = stats[latest];

  return res.status(200).json({
    ok: true,
    month: latest,
    months: Object.keys(stats).sort(), // 선택 옵션용
    summary: latestData.summary,
    byType: latestData.byType
  });
};
