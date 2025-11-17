// /assets/admin-beta.js

import { onlyDigits, REGION_OPTIONS } from './shared.js';

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

const LOCAL_KEY_STATS = 'huchu_ontu_stats_beta';
const LOCAL_KEY_LOAN  = 'huchu_loan_config_beta';

const PRODUCT_TYPES = [
  '부동산담보',
  '부동산PF',
  '어음·매출채권담보',
  '기타담보(주식 등)',
  '개인신용',
  '법인신용',
];

const DEFAULT_LOAN_ITEMS = [
  { region: '서울', type: '아파트',     maxLtv: 0.73, rateMin: 0.068, rateMax: 0.148 },
  { region: '서울', type: '다세대/연립', maxLtv: 0.70, rateMin: 0.078, rateMax: 0.158 },
  { region: '서울', type: '단독/다가구', maxLtv: 0.70, rateMin: 0.080, rateMax: 0.160 },
  { region: '서울', type: '토지/임야',   maxLtv: 0.50, rateMin: 0.100, rateMax: 0.180 },
];

// ─────────────────────────────────────────
// 공통: 콤마 포맷 유틸
// ─────────────────────────────────────────

function formatWithCommas(value) {
  const digits = onlyDigits(value);
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function parseMoney(value) {
  const digits = onlyDigits(value);
  return digits ? Number(digits) : 0;
}

function setupMoneyInputs() {
  const moneyInputs = document.querySelectorAll('input[data-type="money"]');
  moneyInputs.forEach((input) => {
    input.addEventListener('input', (e) => {
      const target = e.target;
      const caretPos = target.selectionStart;
      const beforeLen = target.value.length;

      const formatted = formatWithCommas(target.value);
      target.value = formatted;

      // 대충 caret 보정 (완벽하진 않아도 입력감은 유지)
      if (caretPos != null) {
        const afterLen = formatted.length;
        const diff = afterLen - beforeLen;
        target.setSelectionRange(caretPos + diff, caretPos + diff);
      }
    });

    // 초기값도 포맷
    if (input.value) {
      input.value = formatWithCommas(input.value);
    }
  });
}

// ─────────────────────────────────────────
// 상단 MENU 드롭다운 (베타 헤더용)
// ─────────────────────────────────────────

function setupBetaMenu() {
  const btn   = document.getElementById('betaMenuToggle');
  const panel = document.getElementById('betaMenuPanel');
  if (!btn || !panel) return;

  const close = () => {
    panel.classList.add('hide');
    btn.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    panel.classList.remove('hide');
    btn.setAttribute('aria-expanded', 'true');
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    if (expanded) close();
    else open();
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      close();
    }
  });
}

// ─────────────────────────────────────────
// 1. 담보대출 LTV / 금리 설정
// ─────────────────────────────────────────

function loadLoanConfigFromLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_LOAN);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch (e) {
    console.warn('[admin-beta] loan-config load error:', e);
    return null;
  }
}

function buildLoanConfigRows() {
  const tbody = document.getElementById('loanConfigBody');
  if (!tbody) return;

  const stored = loadLoanConfigFromLocal();
  const rowsData = stored?.items && stored.items.length ? stored.items : DEFAULT_LOAN_ITEMS;

  const regionOptionsHTML = (selected) =>
    REGION_OPTIONS.map((r) =>
      `<option value="${r}" ${r === selected ? 'selected' : ''}>${r}</option>`
    ).join('');

  tbody.innerHTML = rowsData.map((row, idx) => {
    const maxLtvPercent  = row.maxLtv != null ? (row.maxLtv * 100) : '';
    const rateMinPercent = row.rateMin != null ? (row.rateMin * 100) : '';
    const rateMaxPercent = row.rateMax != null ? (row.rateMax * 100) : '';

    return `
      <tr data-type="${row.type}">
        <td>
          <select class="admin-select js-region">
            ${regionOptionsHTML(row.region || REGION_OPTIONS[0])}
          </select>
        </td>
        <td>${row.type}</td>
        <td style="text-align:right;">
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            class="admin-input js-maxLtv"
            value="${maxLtvPercent !== '' ? maxLtvPercent : ''}"
            placeholder="예) 73"
          />
        </td>
        <td style="text-align:right;">
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            class="admin-input js-rateMin"
            value="${rateMinPercent !== '' ? rateMinPercent : ''}"
            placeholder="예) 6.8"
          />
        </td>
        <td style="text-align:right;">
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            class="admin-input js-rateMax"
            value="${rateMaxPercent !== '' ? rateMaxPercent : ''}"
            placeholder="예) 14.8"
          />
        </td>
      </tr>
    `;
  }).join('');
}

function saveLoanConfigToLocal(payload) {
  try {
    localStorage.setItem(LOCAL_KEY_LOAN, JSON.stringify(payload));
  } catch (e) {
    console.warn('[admin-beta] loan-config save error:', e);
  }
}

function handleLoanConfigSave() {
  const tbody = document.getElementById('loanConfigBody');
  const statusEl = document.getElementById('loanConfigStatus');
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll('tr'));
  const items = [];

  rows.forEach((row) => {
    const regionSel = row.querySelector('.js-region');
    const maxLtvEl  = row.querySelector('.js-maxLtv');
    const rateMinEl = row.querySelector('.js-rateMin');
    const rateMaxEl = row.querySelector('.js-rateMax');

    const region   = regionSel ? regionSel.value.trim() : '';
    const type     = row.getAttribute('data-type') || '';
    const maxLtvP  = maxLtvEl ? parseFloat(maxLtvEl.value) : NaN;
    const rateMinP = rateMinEl ? parseFloat(rateMinEl.value) : NaN;
    const rateMaxP = rateMaxEl ? parseFloat(rateMaxEl.value) : NaN;

    if (!type) return;

    const item = {
      region: region || REGION_OPTIONS[0],
      type,
      maxLtv: isNaN(maxLtvP)  ? 0 : maxLtvP  / 100,
      rateMin:isNaN(rateMinP) ? 0 : rateMinP / 100,
      rateMax:isNaN(rateMaxP) ? 0 : rateMaxP / 100,
    };
    items.push(item);
  });

  const payload = {
    updatedAt: new Date().toISOString(),
    items,
  };

  saveLoanConfigToLocal(payload);
  console.log('[beta admin] loan-config (local only):', payload);

  if (statusEl) {
    statusEl.textContent = '브라우저(localStorage)에 저장되었습니다.';
    setTimeout(() => { statusEl.textContent = ''; }, 4000);
  }
}

function initLoanConfigSection() {
  buildLoanConfigRows();
  const btn = document.getElementById('loanConfigSaveBtn');
  if (btn) {
    btn.addEventListener('click', handleLoanConfigSave);
  }
}

// ─────────────────────────────────────────
// 2. 온투업 대출 통계
// ─────────────────────────────────────────

function loadStatsStore() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_STATS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.warn('[admin-beta] stats load error:', e);
    return {};
  }
}

function saveStatsStore(store) {
  try {
    localStorage.setItem(LOCAL_KEY_STATS, JSON.stringify(store));
  } catch (e) {
    console.warn('[admin-beta] stats save error:', e);
  }
}

function getBalanceValue() {
  const el = document.getElementById('sum-balance');
  if (!el) return 0;
  return parseMoney(el.value);
}

function recalcProductAmounts() {
  const balance = getBalanceValue();
  const rows = document.querySelectorAll('#productRows tr');

  rows.forEach((row) => {
    const ratioInput  = row.querySelector('.js-ratio');
    const amountInput = row.querySelector('.js-amount');
    if (!ratioInput || !amountInput) return;

    const ratio = parseFloat(ratioInput.value);
    if (!balance || isNaN(ratio)) {
      amountInput.value = '';
      return;
    }
    const amount = Math.round(balance * (ratio / 100));
    amountInput.value = formatWithCommas(String(amount));
  });
}

function collectOntuFormData() {
  const monthInput = document.getElementById('statsMonth');

  const regInput   = document.getElementById('sum-registeredFirms');
  const dataInput  = document.getElementById('sum-dataFirms');
  const totalLoanInput   = document.getElementById('sum-totalLoan');
  const totalRepaidInput = document.getElementById('sum-totalRepaid');
  const balanceInput     = document.getElementById('sum-balance');

  const month = monthInput ? (monthInput.value || '').trim() : '';

  const summary = {
    registeredFirms: regInput ? Number(regInput.value || 0) : 0,
    dataFirms:       dataInput ? Number(dataInput.value || 0) : 0,
    totalLoan:       totalLoanInput ? parseMoney(totalLoanInput.value) : 0,
    totalRepaid:     totalRepaidInput ? parseMoney(totalRepaidInput.value) : 0,
    balance:         balanceInput ? parseMoney(balanceInput.value) : 0,
  };

  const byType = {};
  const rows = document.querySelectorAll('#productRows tr[data-key]');
  rows.forEach((row) => {
    const key = row.getAttribute('data-key');
    if (!key) return;
    const ratioInput  = row.querySelector('.js-ratio');
    const amountInput = row.querySelector('.js-amount');

    const ratioPercent = ratioInput ? parseFloat(ratioInput.value) : NaN;
    const ratio = isNaN(ratioPercent) ? 0 : (ratioPercent / 100);
    const amount = amountInput ? parseMoney(amountInput.value) : 0;

    byType[key] = { ratio, amount };
  });

  return { month, summary, byType };
}

function fillOntuForm(data) {
  if (!data) return;

  const { month, summary, byType } = data;

  const monthInput = document.getElementById('statsMonth');
  if (monthInput && month) monthInput.value = month;

  const regInput   = document.getElementById('sum-registeredFirms');
  const dataInput  = document.getElementById('sum-dataFirms');
  const totalLoanInput   = document.getElementById('sum-totalLoan');
  const totalRepaidInput = document.getElementById('sum-totalRepaid');
  const balanceInput     = document.getElementById('sum-balance');

  if (regInput)   regInput.value   = summary?.registeredFirms ?? '';
  if (dataInput)  dataInput.value  = summary?.dataFirms ?? '';

  if (totalLoanInput) {
    totalLoanInput.value = summary?.totalLoan ? formatWithCommas(String(summary.totalLoan)) : '';
  }
  if (totalRepaidInput) {
    totalRepaidInput.value = summary?.totalRepaid ? formatWithCommas(String(summary.totalRepaid)) : '';
  }
  if (balanceInput) {
    balanceInput.value = summary?.balance ? formatWithCommas(String(summary.balance)) : '';
  }

  // 상품유형별
  const rows = document.querySelectorAll('#productRows tr[data-key]');
  rows.forEach((row) => {
    const key = row.getAttribute('data-key');
    const ratioInput  = row.querySelector('.js-ratio');
    const amountInput = row.querySelector('.js-amount');
    const item = byType && byType[key];

    if (!item) {
      if (ratioInput) ratioInput.value = '';
      if (amountInput) amountInput.value = '';
      return;
    }

    if (ratioInput) {
      ratioInput.value = item.ratio != null ? (item.ratio * 100).toFixed(1).replace(/\.0$/, '') : '';
    }
    if (amountInput) {
      amountInput.value = item.amount ? formatWithCommas(String(item.amount)) : '';
    }
  });

  // balance 기준으로 다시 한 번 재계산(혹시 값이 어긋난 경우)
  recalcProductAmounts();
}

function handleOntuStatsSave() {
  const statusEl = document.getElementById('statsStatus');
  const payload = collectOntuFormData();

  if (!payload.month) {
    alert('조회년월(YYYY-MM)을 먼저 선택해주세요.');
    return;
  }

  const store = loadStatsStore();
  store[payload.month] = payload;
  saveStatsStore(store);

  console.log('[beta admin] ontu-stats (local only):', payload);

  if (statusEl) {
    statusEl.textContent = '통계 데이터가 localStorage에 저장되었습니다.';
    setTimeout(() => { statusEl.textContent = ''; }, 4000);
  }
}

function handleOntuStatsLoad() {
  const monthInput = document.getElementById('statsMonth');
  const statusEl   = document.getElementById('statsStatus');
  if (!monthInput) return;

  const month = (monthInput.value || '').trim();
  if (!month) {
    alert('불러올 조회년월(YYYY-MM)을 먼저 선택해주세요.');
    return;
  }

  const store = loadStatsStore();
  const data = store[month];
  if (!data) {
    if (statusEl) {
      statusEl.textContent = '해당 월에 저장된 데이터가 없습니다.';
      setTimeout(() => { statusEl.textContent = ''; }, 4000);
    } else {
      alert('해당 월에 저장된 데이터가 없습니다.');
    }
    return;
  }

  fillOntuForm(data);

  if (statusEl) {
    statusEl.textContent = '저장된 데이터를 불러왔습니다.';
    setTimeout(() => { statusEl.textContent = ''; }, 4000);
  }
}

function initOntuStatsSection() {
  // 비율/대출잔액 → 금액 자동 계산
  const balanceInput = document.getElementById('sum-balance');
  if (balanceInput) {
    balanceInput.addEventListener('input', recalcProductAmounts);
  }

  const ratioInputs = document.querySelectorAll('#productRows .js-ratio');
  ratioInputs.forEach((input) => {
    input.addEventListener('input', recalcProductAmounts);
  });

  const saveBtn = document.getElementById('saveOntuStatsBtn');
  if (saveBtn) {
    saveBtn.addEventListener('
