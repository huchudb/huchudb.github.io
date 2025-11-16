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
    ctx.fillStyle = '#111827';
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

/* -----------------------------
 * 도넛 차트
 * ----------------------------- */

function renderProductDonut(outstandingBalance, breakdown) {
  const canvas = document.getElementById('productDonut');
  if (!canvas) return;
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded');
    return;
  }

  const validItems = (breakdown || []).filter(
    item => item && typeof item.share === 'number' && item.share > 0
  );

  if (!validItems.length) {
    if (productChart) {
      productChart.destroy();
      productChart = null;
    }
    const legendWrap = document.getElementById('productDonutLegend');
    if (legendWrap) {
      legendWrap.innerHTML = '<span style="font-size:13px; color:#6b7280;">등록된 상품유형 데이터가 없습니다.</span>';
    }
    return;
  }

  const labels = validItems.map(item => item.type || '-');
  const shares = validItems.map(item => item.share);

  const legendItems = validItems.map(item => {
    const amount = (typeof outstandingBalance === 'number' && !isNaN(outstandingBalance))
      ? Math.round(outstandingBalance * (item.share || 0))
      : null;
    return {
      type: item.type || '-',
      amountFormatted: amount != null ? formatKoreanCurrency(amount) : '-',
    };
  });

  const ctx = canvas.getContext('2d');
  if (productChart) {
    productChart.data.labels = labels;
    productChart.data.datasets[0].data = shares;
    productChart.update();
  } else {
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
                return `${label}: ${formatPercent(v)}`;
              },
            },
          },
        },
        cutout: '60%',
      },
      plugins: [percentageLabelPlugin],
    });
  }

  const legendWrap = document.getElementById('productDonutLegend');
  if (legendWrap) {
    legendWrap.innerHTML = legendItems.map(item => `
      <div class="amount-row" style="margin:4px 0; align-items:center; justify-content:space-between; gap:8px;">
        <div style="font-size:13px; color:#1f2933; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${item.type}
        </div>
        <div style="font-size:13px; font-weight:700; color:#0b2a66; white-space:nowrap;">
          ${item.amountFormatted}
        </div>
      </div>
    `).join('');
  }
}

/* -----------------------------
 * 메인 렌더링
 * ----------------------------- */

function renderOntuSummary(stats, requestedMonth) {
  const wrap = document.getElementById('ontuSummary');
  const monthLabelEl = document.getElementById('monthDisplayLabel');
  const monthInput   = document.getElementById('monthPickerInput');

  if (!wrap) return;

  if (!stats) {
    wrap.innerHTML = `
      <div class="notice info">
        <p>등록된 온투업 통계가 없습니다.</p>
        <p style="margin-top:4px;">관리자 페이지에서 중앙기록 통계를 먼저 입력해주세요.</p>
      </div>
    `;
    return;
  }

  const baseMonth     = stats.baseMonth || null;
  const lastUpdated   = stats.lastUpdated || null;
  const summary       = stats.summary || {};
  const breakdown     = Array.isArray(stats.productBreakdown) ? stats.productBreakdown : [];

  const firmCount          = summary.firmCount          ?? null;
  const cumulativeLoan     = summary.cumulativeLoan     ?? null;
  const cumulativeRepayment= summary.cumulativeRepayment?? null;
  const outstandingBalance = summary.outstandingBalance ?? null;

  const baseMonthLabel = baseMonth ? formatMonthLabel(baseMonth) : '-';
  const updatedLabel   = lastUpdated ? formatKstDateTime(lastUpdated) : '-';

  if (monthLabelEl) {
    monthLabelEl.textContent = baseMonthLabel;
  }
  if (monthInput && baseMonth) {
    monthInput.value = baseMonth;
  }

  let monthNotice = '';
  if (requestedMonth && baseMonth && requestedMonth !== baseMonth) {
    monthNotice = `
      <p style="margin-top:4px; font-size:12px; color:#dc2626;">
        선택한 월(${requestedMonth})의 데이터가 없어, 등록된 기준월(${baseMonth}) 자료를 표시합니다.
      </p>
    `;
  }

  wrap.innerHTML = `
    <div class="notice info" style="margin-bottom:14px;">
      <p><strong>온라인투자연계금융업 중앙기록관리기관 공시자료</strong>를 바탕으로 월별 통계를 요약했습니다.</p>
      <p style="margin-top:4px; font-size:12px; color:#64748b;">
        수치는 관리자 페이지에서 수동으로 입력·관리됩니다.
      </p>
      ${monthNotice}
    </div>

    <section aria-label="대출현황">
      <h2 class="section-title" style="margin-top:0;">
        <span class="icon-dot dot-navy"></span>
        <span>대출현황</span>
      </h2>
      <div class="kpis">
        <div class="kpi">
          <div class="kpi-label">온투업체 수</div>
          <div class="kpi-value">
            ${firmCount != null ? firmCount.toLocaleString('ko-KR') + '개' : '-'}
          </div>
        </div>
        <div class="kpi">
          <div class="kpi-label">누적대출금액</div>
          <div class="kpi-value">
            ${cumulativeLoan != null ? formatKoreanCurrency(cumulativeLoan) : '-'}
          </div>
        </div>
      </div>
      <div class="kpis" style="margin-top:8px;">
        <div class="kpi">
          <div class="kpi-label">누적상환금액</div>
          <div class="kpi-value">
            ${cumulativeRepayment != null ? formatKoreanCurrency(cumulativeRepayment) : '-'}
          </div>
        </div>
        <div class="kpi">
          <div class="kpi-label">대출잔액</div>
          <div class="kpi-value">
            ${outstandingBalance != null ? formatKoreanCurrency(outstandingBalance) : '-'}
          </div>
        </div>
      </div>
    </section>

    <section style="margin-top:20px;" aria-label="상품유형별 대출잔액">
      <h2 class="section-title">
        <span class="icon-dot dot-blue"></span>
        <span>상품유형별 대출잔액</span>
      </h2>
      <div class="breakdown-card">
        <div class="card-section" style="display:flex; flex-wrap:wrap; gap:16px;">
          <div style="flex:0 0 220px; min-height:200px;">
            <canvas id="productDonut"></canvas>
          </div>
          <div id="productDonutLegend" style="flex:1 1 200px; min-width:0;">
            <!-- legend items -->
          </div>
        </div>
        <div class="card-section" style="font-size:12px; color:#6b7280;">
          <div class="rowlist">
            <div class="row">
              <span class="icon-dot dot-slate"></span>
              <span class="label">기준월</span>
              <span class="value">${baseMonthLabel || '-'}</span>
            </div>
            <div class="row">
              <span class="icon-dot dot-slate"></span>
              <span class="label">마지막 업데이트</span>
              <span class="value">${updatedLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  renderProductDonut(outstandingBalance, breakdown);
}

/* -----------------------------
 * 초기화 & 조회년월 선택
 * ----------------------------- */

async function loadAndRenderOntuStats(requestedMonth) {
  const wrap = document.getElementById('ontuSummary');
  if (wrap && !requestedMonth) {
    wrap.innerHTML = `
      <div class="notice info">
        <p>온투업 통계를 불러오는 중입니다...</p>
      </div>
    `;
  }

  try {
    let stats = await fetchOntuStats(requestedMonth);

    // API가 살아 있어도 내용이 비어 있으면 fallback 사용
    if (
      !stats ||
      !stats.summary ||
      stats.summary.outstandingBalance == null
    ) {
      console.warn('ontu-stats empty or invalid, use FALLBACK_STATS');
      stats = FALLBACK_STATS;
    }

    renderOntuSummary(stats, requestedMonth);
  } catch (e) {
    console.error('ontu-stats fetch error, use fallback data instead.', e);
    renderOntuSummary(FALLBACK_STATS, FALLBACK_STATS.baseMonth);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const monthBtn   = document.getElementById('monthPickerBtn');
  const monthInput = document.getElementById('monthPickerInput');

  if (monthBtn && monthInput) {
    monthBtn.addEventListener('click', () => {
      try {
        if (monthInput.showPicker) {
          monthInput.showPicker();
        } else {
          monthInput.click();
        }
      } catch (_) {
        monthInput.click();
      }
    });

    monthInput.addEventListener('change', () => {
      const selected = monthInput.value || null;
      loadAndRenderOntuStats(selected);
    });
  }

  loadAndRenderOntuStats(null);

  const y = document.getElementById('copyrightYear');
  if (y) y.textContent = String(new Date().getFullYear());
});
