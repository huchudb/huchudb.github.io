// /api/ontu-stats.js
// 온투업 담보대출 통계 (월별)

// ── CORS 설정 (daily-users.js와 동일하게) ─────────────────
const ALLOWED_ORIGINS = [
  'https://huchudb.github.io',
  'https://www.huchulab.com',
  'https://huchulab.com',
  'https://huchudb-github-io.vercel.app',
  'http://www.huchulab.com',
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    Vary: 'Origin',
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma, Accept',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

// ── 월별 통계 데이터 (임시: JS 상수로 관리) ─────────────────
// 나중에 admin에서 만든 값으로 월별 데이터 계속 추가하면 됨
const ONTU_STATS = {
  "2025-10": {
    summary: {
      registeredFirms: 51,
      dataFirms: 49,
      // 18조 3,580억 776만원
      totalLoan: 18_358_007_760_000,
      // 16조 9,241억 4,401만원
      totalRepaid: 16_924_144_010_000,
      // 1조 4,338억 6,375만원
      balance: 1_433_867_500_000
    },
    byType: {
      "부동산담보": {
        ratio: 0.43,
        amount: 6_165_061_410_000
      },
      "부동산PF": {
        ratio: 0.02,
        amount: 286_077_270_000
      },
      "어음·매출채권담보": {
        ratio: 0.09,
        amount: 1_290_047_730_000
      },
      "기타담보(주식 등)": {
        ratio: 0.38,
        amount: 5_448_068_220_000
      },
      "개인신용": {
        ratio: 0.06,
        amount: 860_031_820_000
      },
      "법인신용": {
        ratio: 0.03,
        amount: 430_015_910_000
      }
    }
  }

  // 예시) 다음 달 데이터 추가할 땐 이렇게만 붙이면 됨
  // "2025-11": { summary: { ... }, byType: { ... } }
};

// 최신 월 키 구하기 (YYYY-MM 문자열이라 sort로 OK)
function getLatestMonthKey() {
  const keys = Object.keys(ONTU_STATS);
  if (!keys.length) return null;
  keys.sort();
  return keys[keys.length - 1];
}

// ── 메인 핸들러 ───────────────────────────────────────────
export default async function handler(req, res) {
  const origin  = req.headers.origin || '';
  const headers = corsHeaders(origin);
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

  // Preflight
  if (req.method === 'OPTIONS') {
    res.status(204).setHeader('Content-Length', '0');
    return res.end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { month } = req.query || {};
    const allMonths = Object.keys(ONTU_STATS).sort();

    // 특정 월 요청: /api/ontu-stats?month=2025-10
    if (month) {
      const data = ONTU_STATS[month];
      if (!data) {
        return res.status(404).json({ ok: false, error: 'NOT_FOUND', month });
      }
      return res.status(200).json({
        ok: true,
        month,
        months: allMonths,
        summary: data.summary,
        byType: data.byType,
      });
    }

    // 월 미지정: 최신 월 + 전체 월 목록
    const latest = getLatestMonthKey();
    if (!latest) {
      return res.status(200).json({ ok: false, error: 'NO_DATA' });
    }

    const latestData = ONTU_STATS[latest];

    return res.status(200).json({
      ok: true,
      month: latest,
      months: allMonths,
      summary: latestData.summary,
      byType: latestData.byType,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: 'Server Error',
      detail: String(e && e.message || e),
    });
  }
}
