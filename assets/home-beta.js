// /assets/home-beta.js
// 베타 홈: 온투업 통계(대출현황 + 상품유형별 도넛) + 금일 이용자수 + MENU 토글

import { formatKoreanCurrency } from './shared.js';

const API_BASE = 'https://huchudb-github-io.vercel.app';
const ONTU_STATS_API = `${API_BASE}/api/ontu-stats`;
const DAILY_API      = `${API_BASE}/api/daily-users`;

/* -----------------------------
 * FALLBACK 통계 (관리자 입력 전 임시)
 * ----------------------------- */
const FALLBACK_STATS = {
  baseMonth: '2025-10',
  lastUpdated: '2025-11-16T00:00:00.000Z',
  summary: {
    firmCount: 49,
    cumulativeLoan: 18358007760000,      // 18조 3,580억 776만원
    cumulativeRepayment: 16924144010000, // 16조 9,241억 4,401만원
    outstandingBalance: 1433863750000,   // 1조 4,338억 6,375만원
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

function formatMonthLabel(baseMonth) {
  if (!baseMonth || typeof baseMonth !== 'string') return '-';
  const parts = baseMonth.split('-');
  if (parts.length < 2) return baseMonth;
  const y = parts[0];
  const m = parts[1];
  return `${y}년 ${Number(m)}월`;
}

/* -----------------------------
 * 온투업 통계 API
 * ----------------------------- */
async function fetchOntuStats() {
  const url = `${ONTU_STATS_API}?t=${Date.now()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* -----------------------------
 * Chart.js 도넛 퍼센트 라벨 플러그인
 * ----------------------------- */
let productChart = null;

const percentageLabelPlugin = {
  id: 'percentageLabelPlugin',
  afterDraw(chart) {
    const { ctx } = chart;
    const dataset = chart.data.datasets[0];
    if (!dataset) return;

    const meta = chart.getDatasetMeta(0);
    const total = dataset.data.reduce((sum, v) => sum + (Number(v) || 0), 0);
    if (!total) return;

    ctx.save();
    ctx.font = '11px Arial';
    ctx.fillStyle = '#e5e7eb';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    meta.data.forEach((arc, idx) => {
      const val = Number(dataset.data[idx]);
      if (!val || val <= 0) return;
      const percentage = (val / total) * 100;
      const label = percentage.toFixed(1) + '%';
      const p = arc.getCenterPoint();
      ctx.fillText(label, p.x, p.y);
    });

    ctx.restore();
  },
};

function renderProductDonutAndBoxes(outstandingBalance, breakdown) {
  const sectionEl = document.getElementById('ontuProductSection');
  if (!sectionEl) return;

  const valid = (breakdown || []).filter(
    item => item && typeof item.share === 'number' && item.share > 0
  );
  if (!valid.length) {
    sectionEl.innerHTML = `
      <div class="notice info">
        <p>상품유형별 대출잔액 데이터가 없습니다.</p>
      </div>
    `;
    return;
  }

  // 레이아웃(도넛 + 박스) 렌더
  sectionEl.innerHTML = `
    <div class="beta-product-grid">
      <div class="beta-product-donut-wrap">
        <canvas id="productDonut"></canvas>
      </div>
      <div class="beta-product-boxes" id="productOutstandingBoxes">
        <!-- 6개 박스 -->
      </div>
    </div>
  `;

  const labels = valid.map(v => v.type || '-');
  const shares = valid.map(v => v.share);

  // Chart.js 도넛
  const canvas = document.getElementById('productDonut');
  if (canvas && typeof Chart !== 'undefined') {
    const ctx = canvas.getContext('2d');
    if (productChart) {
      productChart.destroy();
      productChart = null;
    }
    productChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: shares,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const v = context.raw;
                const pct = (Number(v || 0) * 100).toFixed(1);
                return `${label}: ${pct}%`;
              },
            },
          },
        },
        cutout: '60%',
      },
      plugins: [percentageLabelPlugin],
    });
  }

  // 오른쪽 3×2 박스 (부동산담보, PF, 어음·매출채권, 기타담보, 개인신용, 법인신용)
  const order = [
    '부동산담보',
    '부동산PF',
    '어음·매출채권담보',
    '기타담보(주식 등)',
    '개인신용',
    '법인신용',
  ];
  const boxesEl = document.getElementById('productOutstandingBoxes');
  if (!boxesEl) return;

  const map = {};
  valid.forEach(v => { map[v.type] = v.share; });

  const html = order.map(type => {
    const share = map[type] || 0;
    const amount = (typeof outstandingBalance === 'number' && !Number.isNaN(outstandingBalance))
      ? Math.round(outstandingBalance * share)
      : 0;
    return `
      <div class="beta-product-box">
        <div class="beta-product-box__title">${type}</div>
        <div class="beta-product-box__amount">
          ${amount ? formatKoreanCurrency(amount) : '-'}
        </div>
      </div>
    `;
  }).join('');

  boxesEl.innerHTML = html;
}

/* -----------------------------
 * 대출현황 렌더링
 * ----------------------------- */
function renderLoanStatus(stats) {
  const wrap = document.getElementById('ontuLoanStatus');
  const monthMeta = document.getElementById('loanStatusMonth');
  if (!wrap) return;

  if (!stats || !stats.summary) {
    wrap.innerHTML = `
      <div class="notice info">
        <p>등록된 대출현황 통계가 없습니다. 관리자 페이지에서 온투업 통계를 입력해주세요.</p>
      </div>
    `;
    if (monthMeta) monthMeta.textContent = '';
    return;
  }

  const baseMonth = stats.baseMonth || null;
  const summary = stats.summary || {};
  const firmCount = summary.firmCount ?? null;
  const dataFirmCount = summary.dataFirmCount ?? firmCount ?? null;
  const cumulativeLoan = summary.cumulativeLoan ?? null;
  const cumulativeRepayment = summary.cumulativeRepayment ?? null;
  const outstandingBalance = summary.outstandingBalance ?? null;

  if (monthMeta) {
    monthMeta.textContent = baseMonth ? `최근 기준월: ${formatMonthLabel(baseMonth)}` : '';
  }

  wrap.innerHTML = `
    <div class="beta-loanstatus-grid">
      <div class="beta-loanstatus-item">
        <div class="beta-loanstatus-item__label">금융위원회 등록 온투업체수</div>
        <div class="beta-loanstatus-item__value">51개</div>
      </div>
      <div class="beta-loanstatus-item">
        <div class="beta-loanstatus-item__label">데이터 수집 온투업체수</div>
        <div class="beta-loanstatus-item__value">
          ${dataFirmCount != null ? dataFirmCount.toLocaleString('ko-KR') + '개' : '-'}
        </div>
      </div>
      <div class="beta-loanstatus-item">
        <div class="beta-loanstatus-item__label">누적대출금액</div>
        <div class="beta-loanstatus-item__value">
          ${cumulativeLoan != null ? formatKoreanCurrency(cumulativeLoan) : '-'}
        </div>
      </div>
      <div class="beta-loanstatus-item">
        <div class="beta-loanstatus-item__label">누적상환금액</div>
        <div class="beta-loanstatus-item__value">
          ${cumulativeRepayment != null ? formatKoreanCurrency(cumulativeRepayment) : '-'}
        </div>
      </div>
      <div class="beta-loanstatus-item">
        <div class="beta-loanstatus-item__label">대출잔액</div>
        <div class="beta-loanstatus-item__value">
          ${outstandingBalance != null ? formatKoreanCurrency(outstandingBalance) : '-'}
        </div>
      </div>
    </div>
  `;

  // 상품유형별 도넛/박스도 같이 렌더
  renderProductDonutAndBoxes(outstandingBalance, stats.productBreakdown || []);
}

/* -----------------------------
 * 온투 통계 로드
 * ----------------------------- */
async function loadOntuStats() {
  try {
    let stats = await fetchOntuStats();
    // 비거나 필수값 없으면 FALLBACK 사용
    if (!stats || !stats.summary || stats.summary.outstandingBalance == null) {
      console.warn('ontu-stats empty or invalid, use fallback');
      stats = FALLBACK_STATS;
    }
    renderLoanStatus(stats);
  } catch (e) {
    console.error('ontu-stats fetch error, use fallback', e);
    renderLoanStatus(FALLBACK_STATS);
  }
}

/* -----------------------------
 * 금일 계산기 이용자수 (daily-users)
 * ----------------------------- */
function animateCount(el, to, duration = 500) {
  if (!el) return;
  const from = Number((el.textContent || '').replace(/[^0-9]/g, '')) || 0;
  const start = performance.now();
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  function frame(now) {
    const p = Math.min(1, (now - start) / duration);
    const val = Math.round(from + (to - from) * easeOutCubic(p));
    el.textContent = val.toLocaleString('ko-KR');
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
async function fetchDailyUsers() {
  const res = await fetch(`${DAILY_API}?t=${Date.now()}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return Number(j.count || 0);
}
async function initDailyUsersUI() {
  const el = document.getElementById('todayUsersCount');
  if (!el) return;
  try {
    const count = await fetchDailyUsers();
    animateCount(el, count);
  } catch (e) {
    console.error('daily-users fetch error', e);
  }
}

/* -----------------------------
 * MENU 토글
 * ----------------------------- */
function initMenuToggle() {
  const overlay = document.getElementById('betaMenuOverlay');
  const openBtn = document.querySelector('.beta-menu-toggle');
  const closeBtn = document.getElementById('betaMenuClose');

  if (!overlay || !openBtn || !closeBtn) return;

  const open = () => {
    overlay.classList.remove('hide');
    overlay.setAttribute('aria-hidden', 'false');
  };
  const close = () => {
    overlay.classList.add('hide');
    overlay.setAttribute('aria-hidden', 'true');
  };

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

/* -----------------------------
 * DOMContentLoaded
 * ----------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  initMenuToggle();
  initDailyUsersUI();
  loadOntuStats();

  const y = document.getElementById('copyrightYear');
  if (y) y.textContent = String(new Date().getFullYear());
});
