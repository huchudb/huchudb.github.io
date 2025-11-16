// /assets/home-beta.js
// 베타 홈: 온투업 중앙기록 통계 + 도넛 차트 (API 실패/빈 데이터 시 샘플 fallback)

import { formatKoreanCurrency } from './shared.js';

const API_BASE = 'https://huchudb-github-io.vercel.app';
const ONTU_STATS_API = `${API_BASE}/api/ontu-stats`;

let productChart = null;

/* -----------------------------
 * 개발용 샘플 통계 (fallback)
 * ----------------------------- */
const FALLBACK_STATS = {
  baseMonth: '2025-10',
  lastUpdated: '2025-11-16T00:00:00.000Z',
  summary: {
    firmCount: 49,
    // 18조 3,580억 776만원
    cumulativeLoan: 18358007760000,
    // 16조 9,241억 4,401만원
    cumulativeRepayment: 16924144010000,
    // 1조 4,338억 6,375만원
    outstandingBalance: 1433863750000,
  },
  productBreakdown: [
    { type: '부동산담보',         share: 0.43 },
    { type: '부동산PF',          share: 0.02 },
    { type: '어음·매출채권담보', share: 0.09 },
    { type: '기타담보(주식 등)', share: 0.38 },
    { type: '개인신용',          share: 0.06 },
    { type: '법인신용',          share: 0.03 },
  ],
};

function formatPercent(v) {
  if (typeof v !== 'number' || isNaN(v)) return '-';
  return (v * 100).toFixed(1) + '%';
}

function formatMonthLabel(baseMonth) {
  if (!baseMonth || typeof baseMonth !== 'string') return '-';
  const parts = baseMonth.split('-');
  if (parts.length < 2) return baseMonth;
  const y = parts[0];
  const m = parts[1];
  if (!y || !m) return baseMonth;
  return `${y}년 ${Number(m)}월`;
}

function formatKstDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function fetchOntuStats(requestedMonth) {
  const url = `${ONTU_STATS_API}?t=${Date.now()}${requestedMonth ? `&month=${requestedMonth}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* -----------------------------
 * 도넛 퍼센트 라벨 플러그인
 * ----------------------------- */

const percentageLabelPlugin = {
  id: 'percentag
