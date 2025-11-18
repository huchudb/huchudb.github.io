// /assets/admin-beta.js
// 베타 관리자: LTV/금리 설정 + 온투업 통계 (localStorage 전용)

///////////////////////////////
// 공통 유틸: 금액 포맷
///////////////////////////////

function stripNonDigits(str) {
  return (str || "").replace(/[^\d]/g, "");
}

function formatWithCommas(str) {
  const digits = stripNonDigits(str);
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getMoneyValueFromInput(input) {
  if (!input) return 0;
  const digits = stripNonDigits(input.value);
  return digits ? Number(digits) : 0;
}

function setupMoneyInputs() {
  const moneyInputs = document.querySelectorAll('input[data-type="money"]');
  moneyInputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      const target = e.target;
      const formatted = formatWithCommas(target.value);
      target.value = formatted;
    });
    if (input.value) {
      input.value = formatWithCommas(input.value);
    }
  });
}

function setMoneyValue(input, numeric) {
  if (!input) return;
  if (numeric == null || isNaN(numeric) || numeric <= 0) {
    input.value = "";
    return;
  }
  const s = String(Math.floor(Number(numeric)));
  input.value = formatWithCommas(s);
}

///////////////////////////////
// 1. 담보대출 LTV / 금리 설정
///////////////////////////////

const REGIONS = [
  "서울",
  "경기",
  "인천",
  "충청도",
  "전라도",
  "강원도",
  "경상도",
  "제주도",
];

const PROPERTY_TYPES_LTV = ["아파트", "다세대/연립", "단독/다가구", "토지/임야"];

const LOCAL_KEY_LOAN_CONFIG = "huchu_beta_loan_config_by_region";

let loanConfigState = {};
let currentRegion = REGIONS[0];

function loadLoanConfigState() {
  loanConfigState = {};
  try {
    const raw = localStorage.getItem(LOCAL_KEY_LOAN_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.byRegion && typeof parsed.byRegion === "object") {
        loanConfigState = parsed.byRegion;
      } else if (parsed && parsed.byType) {
        // 구버전: region 없이 byType만 있었던 경우 → 모든 지역에 복사
        REGIONS.forEach((r) => {
          loanConfigState[r] = JSON.parse(JSON.stringify(parsed.byType));
        });
      }
    }
  } catch (e) {
    console.warn("loan-config load error:", e);
  }

  // 최소 구조 보정
  REGIONS.forEach((region) => {
    if (!loanConfigState[region]) loanConfigState[region] = {};
    PROPERTY_TYPES_LTV.forEach((prop) => {
      if (!loanConfigState[region][prop]) {
        loanConfigState[region][prop] = {
          maxLtv: 0, // 비율 (0.79)
          rateMin: 0,
          rateMax: 0,
        };
      }
    });
  });
}

function saveCurrentRegionFormIntoState() {
  if (!currentRegion) return;
  if (!loanConfigState[currentRegion]) {
    loanConfigState[currentRegion] = {};
  }

  PROPERTY_TYPES_LTV.forEach((prop) => {
    const row = document.querySelector(`tr[data-prop="${prop}"]`);
    if (!row) return;

    const maxLtvInput = row.querySelector('input[data-field="maxLtv"]');
    const rateMinInput = row.querySelector('input[data-field="rateMin"]');
    const rateMaxInput = row.querySelector('input[data-field="rateMax"]');

    const maxLtvPct = maxLtvInput ? parseFloat(maxLtvInput.value) : NaN;
    const rateMinPct = rateMinInput ? parseFloat(rateMinInput.value) : NaN;
    const rateMaxPct = rateMaxInput ? parseFloat(rateMaxInput.value) : NaN;

    loanConfigState[currentRegion][prop] = {
      maxLtv: isNaN(maxLtvPct) ? 0 : maxLtvPct / 100,
      rateMin: isNaN(rateMinPct) ? 0 : rateMinPct / 100,
      rateMax: isNaN(rateMaxPct) ? 0 : rateMaxPct / 100,
    };
  });
}

function renderRegionToForm(region) {
  PROPERTY_TYPES_LTV.forEach((prop) => {
    const row = document.querySelector(`tr[data-prop="${prop}"]`);
    if (!row) return;
    const cfg =
      loanConfigState[region] && loanConfigState[region][prop]
        ? loanConfigState[region][prop]
        : { maxLtv: 0, rateMin: 0, rateMax: 0 };

    const maxLtvInput = row.querySelector('input[data-field="maxLtv"]');
    const rateMinInput = row.querySelector('input[data-field="rateMin"]');
    const rateMaxInput = row.querySelector('input[data-field="rateMax"]');

    if (maxLtvInput) {
      const v = cfg.maxLtv > 0 ? (cfg.maxLtv * 100).toFixed(1) : "";
      maxLtvInput.value = v.replace(/\.0$/, "");
    }
    if (rateMinInput) {
      const v = cfg.rateMin > 0 ? (cfg.rateMin * 100).toFixed(2) : "";
      rateMinInput.value = v.replace(/0$/, "").replace(/\.0$/, "");
    }
    if (rateMaxInput) {
      const v = cfg.rateMax > 0 ? (cfg.rateMax * 100).toFixed(2) : "";
      rateMaxInput.value = v.replace(/0$/, "").replace(/\.0$/, "");
    }
  });
}

function initLoanConfigUI() {
  const regionButtons = Array.from(
    document.querySelectorAll(".admin-region-chip")
  );
  const ltvInputs = document.querySelectorAll(".admin-ltv-input");
  if (!regionButtons.length || !ltvInputs.length) return;

  loadLoanConfigState();

  const initBtn =
    regionButtons.find((b) => b.classList.contains("is-active")) ||
    regionButtons[0];
  if (initBtn && initBtn.dataset.region) {
    currentRegion = initBtn.dataset.region;
  }

  // 초기 렌더
  renderRegionToForm(currentRegion);
  regionButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.region === currentRegion);
  });

  // 지역 탭 클릭
  regionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const region = btn.dataset.region;
      if (!region || region === currentRegion) return;

      // 기존 값 state에 저장
      saveCurrentRegionFormIntoState();

      currentRegion = region;
      regionButtons.forEach((b) =>
        b.classList.toggle("is-active", b === btn)
      );
      renderRegionToForm(currentRegion);
    });
  });

  // 저장 버튼
  const saveBtn = document.getElementById("loanConfigSaveBtn");
  const statusSpan = document.getElementById("loanConfigStatus");

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      saveCurrentRegionFormIntoState();
      const payload = {
        updatedAt: new Date().toISOString(),
        regions: REGIONS,
        byRegion: loanConfigState,
      };
      try {
        localStorage.setItem(LOCAL_KEY_LOAN_CONFIG, JSON.stringify(payload));
      } catch (e) {
        console.warn("loan-config localStorage 저장 실패:", e);
      }
      console.log("[beta admin] loan-config(byRegion):", payload);

      if (statusSpan) {
        statusSpan.textContent =
          "LTV/금리 설정이 브라우저(localStorage)에 저장되었습니다.";
        statusSpan.classList.add("is-active");
        setTimeout(() => statusSpan.classList.remove("is-active"), 2500);
      }
    });
  }
}

///////////////////////////////
// 2. 온투업 통계 (월별 저장)
///////////////////////////////

const LOCAL_KEY_STATS = "huchu_ontu_stats_beta";

function loadStatsStore() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_STATS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);

    // 구버전: 단일 {month, summary, byType}
    if (parsed && parsed.month) {
      const store = {};
      const m = parsed.month;
      store[m] = {
        month: m,
        summary: parsed.summary || {},
        byType: parsed.byType || {},
      };
      return store;
    }

    // 신버전: { "YYYY-MM": {month, summary, byType}, ... }
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (e) {
    console.warn("stats load error:", e);
  }
  return {};
}

function saveStatsStore(store) {
  try {
    localStorage.setItem(LOCAL_KEY_STATS, JSON.stringify(store));
  } catch (e) {
    console.warn("stats save error:", e);
  }
}

function getSelectedMonth() {
  const input = document.getElementById("statsMonth");
  return input ? (input.value || "").trim() : "";
}

function setSelectedMonth(ym) {
  const input = document.getElementById("statsMonth");
  if (input) input.value = ym;
}

function clearStatsFormValues() {
  const reg = document.getElementById("statsRegisteredFirms");
  const data = document.getElementById("statsDataFirms");
  const totalLoan = document.getElementById("statsTotalLoan");
  const totalRepaid = document.getElementById("statsTotalRepaid");
  const balance = document.getElementById("statsBalance");

  if (reg) reg.value = "";
  if (data) data.value = "";
  if (totalLoan) totalLoan.value = "";
  if (totalRepaid) totalRepaid.value = "";
  if (balance) balance.value = "";

  const ratios = document.querySelectorAll(".js-ratio");
  const amounts = document.querySelectorAll(".js-amount");
  ratios.forEach((i) => (i.value = ""));
  amounts.forEach((i) => (i.value = ""));
}

function applyStatsToForm(data) {
  clearStatsFormValues();
  if (!data) return;

  const s = data.summary || {};
  const byType = data.byType || {};

  const reg = document.getElementById("statsRegisteredFirms");
  const d = document.getElementById("statsDataFirms");
  const totalLoan = document.getElementById("statsTotalLoan");
  const totalRepaid = document.getElementById("statsTotalRepaid");
  const balance = document.getElementById("statsBalance");

  if (reg) reg.value = s.registeredFirms != null ? s.registeredFirms : "";
  if (d) d.value = s.dataFirms != null ? s.dataFirms : "";

  setMoneyValue(totalLoan, s.totalLoan);
  setMoneyValue(totalRepaid, s.totalRepaid);
  setMoneyValue(balance, s.balance);

  const rows = document.querySelectorAll("#productRows tr[data-key]");
  rows.forEach((tr) => {
    const key = tr.getAttribute("data-key");
    const cfg = byType[key] || {};
    const ratioInput = tr.querySelector(".js-ratio");
    const amountInput = tr.querySelector(".js-amount");

    const ratioPct =
      cfg.ratio != null && cfg.ratio > 0
        ? (Number(cfg.ratio) * 100).toFixed(1)
        : "";
    if (ratioInput) ratioInput.value = ratioPct.replace(/\.0$/, "");

    if (amountInput) setMoneyValue(amountInput, cfg.amount);
  });
}

function collectStatsFormData() {
  const month = getSelectedMonth();

  const reg = document.getElementById("statsRegisteredFirms");
  const d = document.getElementById("statsDataFirms");
  const totalLoan = document.getElementById("statsTotalLoan");
  const totalRepaid = document.getElementById("statsTotalRepaid");
  const balance = document.getElementById("statsBalance");

  const summary = {
    registeredFirms: reg ? Number(reg.value || 0) : 0,
    dataFirms: d ? Number(d.value || 0) : 0,
    totalLoan: getMoneyValueFromInput(totalLoan),
    totalRepaid: getMoneyValueFromInput(totalRepaid),
    balance: getMoneyValueFromInput(balance),
  };

  const byType = {};
  const rows = document.querySelectorAll("#productRows tr[data-key]");
  rows.forEach((tr) => {
    const key = tr.getAttribute("data-key");
    const ratioInput = tr.querySelector(".js-ratio");
    const amountInput = tr.querySelector(".js-amount");

    const ratioPercent = ratioInput ? parseFloat(ratioInput.value) : 0;
    const ratio = isNaN(ratioPercent) ? 0 : ratioPercent / 100;
    const amount = getMoneyValueFromInput(amountInput);

    byType[key] = { ratio, amount };
  });

  return { month, summary, byType };
}

// 대출잔액 × 비율 → 금액 자동계산
function recalcAmountForKey(key) {
  const balanceInput = document.getElementById("statsBalance");
  if (!balanceInput) return;
  const balance = getMoneyValueFromInput(balanceInput);
  if (!balance) {
    const amt = document.querySelector(`.js-amount[data-key="${key}"]`);
    if (amt) amt.value = "";
    return;
  }
  const ratioInput = document.querySelector(`.js-ratio[data-key="${key}"]`);
  const amountInput = document.querySelector(`.js-amount[data-key="${key}"]`);
  if (!ratioInput || !amountInput) return;

  const ratioPercent = parseFloat(ratioInput.value);
  if (isNaN(ratioPercent)) {
    amountInput.value = "";
    return;
  }
  const amount = Math.round(balance * (ratioPercent / 100));
  setMoneyValue(amountInput, amount);
}

function recalcAllAmounts() {
  const rows = document.querySelectorAll("#productRows tr[data-key]");
  rows.forEach((tr) => {
    const key = tr.getAttribute("data-key");
    recalcAmountForKey(key);
  });
}

function initStatsUI() {
  const monthInput = document.getElementById("statsMonth");
  if (!monthInput) return;

  // 기본값: 오늘 기준 YYYY-MM
  if (!monthInput.value) {
    const now = new Date();
    const ym =
      now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    monthInput.value = ym;
  }

  // 월 변경 시 자동 로드
  monthInput.addEventListener("change", () => {
    const ym = getSelectedMonth();
    const store = loadStatsStore();
    const data = store[ym];
    applyStatsToForm(data);
  });

  // 최초 로드 시 선택된 월 데이터 적용
  {
    const ym = getSelectedMonth();
    const store = loadStatsStore();
    const data = store[ym];
    applyStatsToForm(data);
  }

  // 비율 입력 & 대출잔액 입력 → 자동 계산
  const balanceInput = document.getElementById("statsBalance");
  if (balanceInput) {
    balanceInput.addEventListener("input", () => {
      recalcAllAmounts();
    });
  }

  const ratioInputs = document.querySelectorAll(".js-ratio");
  ratioInputs.forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.getAttribute("data-key");
      recalcAmountForKey(key);
    });
  });

  // 저장 버튼
  const saveBtn = document.getElementById("saveOntuStatsBtn");
  const statusEl = document.getElementById("statsSaveStatus");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const data = collectStatsFormData();
      if (!data.month) {
        alert("조회년월을 먼저 선택해주세요.");
        monthInput.focus();
        return;
      }
      const store = loadStatsStore();
      store[data.month] = data;
      saveStatsStore(store);
      console.log("[beta admin] ontu-stats(month:", data.month, "):", data);

      if (statusEl) {
        statusEl.textContent =
          "통계 데이터가 브라우저(localStorage)에 저장되었습니다.";
        statusEl.classList.add("is-active");
        setTimeout(() => statusEl.classList.remove("is-active"), 2500);
      } else {
        alert("통계 데이터가 저장되었습니다.");
      }
    });
  }
}

///////////////////////////////
// 상단 MENU 드롭다운
///////////////////////////////

function setupBetaMenu() {
  const btn = document.getElementById("betaMenuToggle");
  const panel = document.getElementById("betaMenuPanel");
  if (!btn || !panel) return;

  const close = () => {
    panel.classList.add("hide");
    btn.setAttribute("aria-expanded", "false");
  };
  const open = () => {
    panel.classList.remove("hide");
    btn.setAttribute("aria-expanded", "true");
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const expanded = btn.getAttribute("aria-expanded") === "true";
    if (expanded) close();
    else open();
  });

  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      close();
    }
  });
}

///////////////////////////////
// DOM 로드 후 초기화
///////////////////////////////

document.addEventListener("DOMContentLoaded", () => {
  setupMoneyInputs();   // 금액 입력 쉼표 처리
  setupBetaMenu();      // 상단 메뉴
  initLoanConfigUI();   // LTV/금리 by 지역
  initStatsUI();        // 온투업 통계
});
