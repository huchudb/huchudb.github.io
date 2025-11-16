// /assets/admin-beta.js
// 베타 전용 관리자 스크립트
// 1) 물건별 LTV·금리 기준 관리
// 2) 온투업 중앙기록 통계 입력/수정

const API_BASE = 'https://huchudb-github-io.vercel.app';
const LOAN_CONFIG_API = `${API_BASE}/api/loan-config`;
const ONTU_STATS_API  = `${API_BASE}/api/ontu-stats`;

const PROPERTY_TYPES = ['아파트', '다세대/연립', '단독/다가구', '토지/임야'];
const PRODUCT_TYPES = [
  '부동산담보',
  '부동산PF',
  '어음·매출채권담보',
  '기타담보(주식 등)',
  '개인신용',
  '법인신용',
];

/* -----------------------------
 * 공통 헬퍼
 * ----------------------------- */

function safeNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function setStatus(message, type = 'info') {
  const el = document.getElementById('adminStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = '';
  el.classList.add('notice', type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info'));
}

/* -----------------------------
 * 1. 물건별 LTV·금리 기준
 * ----------------------------- */

async function loadLoanConfig() {
  try {
    const res = await fetch(LOAN_CONFIG_API, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('loan-config load: non-OK', res.status);
      return null;
    }
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('loan-config load error', e);
    return null;
  }
}

function renderLoanConfigForm(config) {
  const wrap = document.getElementById('loanConfigForm');
  if (!wrap) return;

  const byType = config?.byType || {};

  const rows = PROPERTY_TYPES.map(type => {
    const cfg = byType[type] || {};
    const maxLtv  = cfg.maxLtv  ?? '';
    const rateMin = cfg.rateMin ?? '';
    const rateMax = cfg.rateMax ?? '';

    return `
      <div class="amount-row" style="margin:6px 0; align-items:center; gap:8px; flex-wrap:wrap;">
        <div style="flex:0 0 82px; font-weight:700; color:#1a365d;">${type}</div>
        <input
          type="number"
          step="0.0001"
          min="0"
          max="1"
          data-group="loan-config"
          data-type="${type}"
          data-field="maxLtv"
          placeholder="최대 LTV (0~1)"
          value="${maxLtv !== '' ? maxLtv : ''}"
          style="flex:1 1 120px;"
        />
        <input
          type="number"
          step="0.0001"
          min="0"
          max="1"
          data-group="loan-config"
          data-type="${type}"
          data-field="rateMin"
          placeholder="최소 금리 (예: 0.068)"
          value="${rateMin !== '' ? rateMin : ''}"
          style="flex:1 1 140px;"
        />
        <input
          type="number"
          step="0.0001"
          min="0"
          max="1"
          data-group="loan-config"
          data-type="${type}"
          data-field="rateMax"
          placeholder="최대 금리 (예: 0.148)"
          value="${rateMax !== '' ? rateMax : ''}"
          style="flex:1 1 140px;"
        />
      </div>
    `;
  }).join('');

  wrap.innerHTML = `
    <div class="notice info" style="margin-bottom:10px;">
      <p><strong>각 물건 유형별 최대 LTV, 최소·최대 금리</strong>를 설정합니다.</p>
      <p style="margin:4px 0 0;">LTV와 금리는 <strong>0~1</strong> 사이의 값으로 입력해주세요. (예: 73% → 0.73, 6.8% → 0.068)</p>
    </div>
    ${rows}
  `;
}

async function saveLoanConfig() {
  const inputs = document.querySelectorAll('input[data-group="loan-config"][data-type][data-field]');
  if (!inputs.length) return;

  const byType = {};

  inputs.forEach(input => {
    const type  = input.dataset.type;
    const field = input.dataset.field;
    const val   = safeNumber(input.value);

    if (!byType[type]) byType[type] = {};
    byType[type][field] = val;
  });

  const payload = {
    updatedAt: new Date().toISOString(),
    byType,
  };

  try {
    const res = await fetch(LOAN_CONFIG_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('loan-config save non-OK', res.status);
      setStatus('물건별 기준 저장에 실패했습니다. (서버 응답 오류)', 'error');
      return;
    }

    setStatus('물건별 LTV·금리 기준이 저장되었습니다.', 'success');
  } catch (e) {
    console.error('loan-config save error', e);
    setStatus('물건별 기준 저장 중 오류가 발생했습니다.', 'error');
  }
}

/* -----------------------------
 * 2. 온투업 중앙기록 통계
 * ----------------------------- */

async function loadOntuStats() {
  try {
    const res = await fetch(ONTU_STATS_API, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('ontu-stats load: non-OK', res.status);
      return null;
    }
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('ontu-stats load error', e);
    return null;
  }
}

function renderOntuStatsForm(data) {
  const wrap = document.getElementById('ontuStatsForm');
  if (!wrap) return;

  const stats   = data || {};
  const baseMonth = stats.baseMonth || '';
  const summary = stats.summary || {};
  const breakdownArr = Array.isArray(stats.productBreakdown)
    ? stats.productBreakdown
    : [];

  const firmCount          = summary.firmCount          ?? '';
  const cumulativeLoan     = summary.cumulativeLoan     ?? '';
  const cumulativeRepayment= summary.cumulativeRepayment?? '';
  const outstandingBalance = summary.outstandingBalance ?? '';

  const breakdownMap = {};
  breakdownArr.forEach(item => {
    if (!item || !item.type) return;
    breakdownMap[item.type] = item;
  });

  const rows = PRODUCT_TYPES.map(type => {
    const item = breakdownMap[type] || {};
    const share = item.share ?? '';
    return `
      <div class="amount-row" style="margin:6px 0; align-items:center; gap:8px; flex-wrap:wrap;">
        <div style="flex:0 0 120px; font-weight:700; color:#1a365d;">${type}</div>
        <input
          type="number"
          step="0.0001"
          min="0"
          max="1"
          data-group="ontu-product"
          data-type="${type}"
          placeholder="잔액 비중 (0~1, 예: 0.43)"
          value="${share !== '' ? share : ''}"
          style="flex:1 1 160px;"
        />
      </div>
    `;
  }).join('');

  wrap.innerHTML = `
    <div class="notice info" style="margin-bottom:10px;">
      <p><strong>온투업 중앙기록관리기관 공시자료를 정리해서 입력하는 영역</strong>입니다.</p>
      <p style="margin:4px 0 0; font-size:12px; color:#64748b;">
        금액은 '원' 단위, 비율은 <strong>0~1</strong> 사이의 값으로 입력해주세요. (예: 43% → 0.43)
      </p>
    </div>

    <div style="margin-bottom:12px;">
      <label class="steplabel no-badge-before" for="baseMonth">조회년월 (기준월)</label>
      <input
        id="baseMonth"
        type="month"
        value="${baseMonth || ''}"
        style="max-width:220px;"
      />
    </div>

    <div class="step" style="margin:12px 0;">
      <label class="steplabel no-badge-before">대출현황 요약</label>
      <div class="amount-row" style="margin:6px 0; flex-wrap:wrap;">
        <div style="flex:0 0 120px; font-weight:700; color:#1a365d;">온투업체 수</div>
        <input
          type="number"
          step="1"
          min="0"
          id="firmCount"
          placeholder="예: 49"
          value="${firmCount !== '' ? firmCount : ''}"
          style="flex:1 1 120px;"
        />
      </div>
      <div class="amount-row" style="margin:6px 0; flex-wrap:wrap;">
        <div style="flex:0 0 120px; font-weight:700; color:#1a365d;">누적대출금액</div>
        <input
          type="number"
          step="1"
          min="0"
          id="cumulativeLoan"
          placeholder="원 단위 (예: 18358007760000)"
          value="${cumulativeLoan !== '' ? cumulativeLoan : ''}"
          style="flex:1 1 220px;"
        />
      </div>
      <div class="amount-row" style="margin:6px 0; flex-wrap:wrap;">
        <div style="flex:0 0 120px; font-weight:700; color:#1a365d;">누적상환금액</div>
        <input
          type="number"
          step="1"
          min="0"
          id="cumulativeRepayment"
          placeholder="원 단위"
          value="${cumulativeRepayment !== '' ? cumulativeRepayment : ''}"
          style="flex:1 1 220px;"
        />
      </div>
      <div class="amount-row" style="margin:6px 0; flex-wrap:wrap;">
        <div style="flex:0 0 120px; font-weight:700; color:#1a365d;">대출잔액</div>
        <input
          type="number"
          step="1"
          min="0"
          id="outstandingBalance"
          placeholder="원 단위"
          value="${outstandingBalance !== '' ? outstandingBalance : ''}"
          style="flex:1 1 220px;"
        />
      </div>
    </div>

    <div class="step" style="margin-top:12px;">
      <label class="steplabel no-badge-before">상품유형별 대출잔액 비중</label>
      <p style="margin:4px 0 8px; font-size:12px; color:#64748b;">
        각 상품유형별 <strong>대출잔액 비중(%)</strong>을 0~1 값으로 입력합니다. (예: 43% → 0.43)<br/>
        합이 1.0에 가까울수록 전체 잔액 분포와 일치합니다.
      </p>
      ${rows}
    </div>
  `;
}

async function saveOntuStats() {
  const baseMonth = document.getElementById('baseMonth')?.value || null;

  const firmCount          = safeInt(document.getElementById('firmCount')?.value);
  const cumulativeLoan     = safeNumber(document.getElementById('cumulativeLoan')?.value);
  const cumulativeRepayment= safeNumber(document.getElementById('cumulativeRepayment')?.value);
  const outstandingBalance = safeNumber(document.getElementById('outstandingBalance')?.value);

  const summary = {
    firmCount,
    cumulativeLoan,
    cumulativeRepayment,
    outstandingBalance,
  };

  const productInputs = document.querySelectorAll('input[data-group="ontu-product"][data-type]');
  const productBreakdown = [];

  productInputs.forEach(input => {
    const type  = input.dataset.type;
    const share = safeNumber(input.value);
    productBreakdown.push({ type, share });
  });

  const payload = {
    baseMonth,
    lastUpdated: new Date().toISOString(),
    summary,
    productBreakdown,
  };

  try {
    const res = await fetch(ONTU_STATS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('ontu-stats save non-OK', res.status);
      setStatus('온투업 통계 저장에 실패했습니다. (서버 응답 오류)', 'error');
      return;
    }

    setStatus('온투업 중앙기록 통계가 저장되었습니다.', 'success');
  } catch (e) {
    console.error('ontu-stats save error', e);
    setStatus('온투업 통계 저장 중 오류가 발생했습니다.', 'error');
  }
}

/* -----------------------------
 * 초기화
 * ----------------------------- */

document.addEventListener('DOMContentLoaded', async () => {
  setStatus('설정값을 불러오는 중입니다...', 'info');

  // 1) 물건별 LTV·금리 기준
  const loanConfig = await loadLoanConfig();
  renderLoanConfigForm(loanConfig);

  const saveLoanBtn = document.getElementById('saveLoanConfigBtn');
  if (saveLoanBtn) {
    saveLoanBtn.addEventListener('click', () => {
      saveLoanConfig();
    });
  }

  // 2) 온투업 중앙기록 통계
  const ontuStats = await loadOntuStats();
  renderOntuStatsForm(ontuStats);

  const saveStatsBtn = document.getElementById('saveOntuStatsBtn');
  if (saveStatsBtn) {
    saveStatsBtn.addEventListener('click', () => {
      saveOntuStats();
    });
  }

  setStatus('설정값을 불러왔습니다. 수정 후 저장 버튼을 눌러주세요.', 'success');
});
