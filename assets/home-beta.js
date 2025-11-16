// /assets/home-beta.js
// 베타 홈: 온투업 중앙기록 통계 표시용

import { formatKoreanCurrency } from './shared.js';

const API_BASE = 'https://huchudb-github-io.vercel.app';
const ONTU_STATS_API = `${API_BASE}/api/ontu-stats`;

// 퍼센트 포맷 (0~1 → "11.5%")
function formatPercent(v) {
  if (typeof v !== 'number' || isNaN(v)) return '-';
  return (v * 100).toFixed(1) + '%';
}

function formatMonthLabel(baseMonth) {
  if (!baseMonth || typeof baseMonth !== 'string') return '-';
  const [y, m] = baseMonth.split('-');
  if (!y || !m) return baseMonth;
  return `${y}년 ${Number(m)}월 기준`;
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

async function fetchOntuStats() {
  const res = await fetch(`${ONTU_STATS_API}?t=${Date.now()}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function renderOntuSummary(stats) {
  const wrap = document.getElementById('ontuSummary');
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

  const baseMonth   = stats.baseMonth || null;
  const lastUpdated = stats.lastUpdated || null;
  const summary     = stats.summary || {};
  const byTypeArr   = Array.isArray(stats.byType) ? stats.byType : [];

  const totalAmount = typeof summary.totalAmount === 'number' ? summary.totalAmount : 0;
  const loanCount   = typeof summary.loanCount   === 'number' ? summary.loanCount   : 0;
  const avgRate     = typeof summary.avgRate     === 'number' ? summary.avgRate     : null;

  const avgRatePct = avgRate != null ? formatPercent(avgRate) : '-';

  const monthLabel = formatMonthLabel(baseMonth);
  const updatedLabel = lastUpdated ? formatKstDateTime(lastUpdated) : '-';

  const typeChips = byTypeArr.map(item => {
    const type    = item.type || '-';
    const share   = formatPercent(item.share);
    const ratePct = formatPercent(item.avgRate);
    return `
      <span class="chip">
        <span class="label">${type}</span>
        <span class="val">${share} · ${ratePct}</span>
      </span>
    `;
  }).join('');

  wrap.innerHTML = `
    <div class="notice info" style="margin-bottom:14px;">
      <p><strong>온라인투자연계금융업 중앙기록관리기관 공시자료</strong>를 바탕으로 월별 통계를 요약했습니다.</p>
      <p style="margin-top:4px; font-size:12px; color:#64748b;">
        기준월과 수치는 관리자 페이지에서 수동으로 입력·관리됩니다.
      </p>
    </div>

    <div class="kpis">
      <div class="kpi">
        <div class="kpi-label">기준월</div>
        <div class="kpi-value">${monthLabel}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">월 취급액</div>
        <div class="kpi-value">${formatKoreanCurrency(totalAmount)}</div>
      </div>
    </div>

    <div class="kpis" style="margin-top:8px;">
      <div class="kpi">
        <div class="kpi-label">월 취급 건수</div>
        <div class="kpi-value">${loanCount ? loanCount.toLocaleString('ko-KR') + '건' : '-'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">평균 금리</div>
        <div class="kpi-value">${avgRatePct}</div>
      </div>
    </div>

    <div class="breakdown-card" style="margin-top:16px;" aria-labelledby="byTypeTitle">
      <div id="byTypeTitle" class="card-title">상품 유형별 비중 / 평균 금리</div>
      <div class="card-section">
        <div class="section-title">
          <span class="icon-dot dot-blue"></span>
          <span>유형별 구성</span>
        </div>
        <div class="chip-row">
          ${typeChips || '<span style="font-size:13px; color:#6b7280;">등록된 유형별 데이터가 없습니다.</span>'}
        </div>
      </div>
      <div class="card-section" style="font-size:12px; color:#6b7280;">
        <div class="rowlist">
          <div class="row">
            <span class="icon-dot dot-slate"></span>
            <span class="label">마지막 업데이트</span>
            <span class="value">${updatedLabel}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  const wrap = document.getElementById('ontuSummary');
  if (wrap) {
    wrap.innerHTML = `
      <div class="notice info">
        <p>온투업 통계를 불러오는 중입니다...</p>
      </div>
    `;
  }

  try {
    const stats = await fetchOntuStats();
    renderOntuSummary(stats);
  } catch (e) {
    console.error('ontu-stats fetch error', e);
    if (wrap) {
      wrap.innerHTML = `
        <div class="notice error">
          <p>온투업 통계를 불러오지 못했습니다.</p>
          <p style="margin-top:4px; font-size:12px; color:#6b7280;">
            잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해주세요.
          </p>
        </div>
      `;
    }
  }

  // Footer 연도
  const y = document.getElementById('copyrightYear');
  if (y) y.textContent = String(new Date().getFullYear());
});
