// /assets/admin-beta.js  (베타 관리자 전용 스크립트)

// ------------------------------------------------------
// 공통 상수 / 유틸
// ------------------------------------------------------

const REGIONS = ["서울", "경기", "인천", "충청도", "전라도", "강원도", "경상도", "제주도"];
const PROPERTY_TYPES = ["아파트", "다세대/연립", "단독/다가구", "토지/임야"];

const LOAN_LOCAL_KEY  = "huchu_loan_config_beta";
const STATS_LOCAL_KEY = "huchu_ontu_stats_beta_v2"; // 월별 저장용 (v2)

// 숫자 유틸
function stripNonDigits(str) {
  return (str || "").replace(/[^\d]/g, "");
}
function formatWithCommas(str) {
  const digits = stripNonDigits(str);
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function getMoneyValue(inputEl) {
  if (!inputEl) return 0;
  const digits = stripNonDigits(inputEl.value);
  return digits ? Number(digits) : 0;
}

// 금액 input(텍스트)에 3자리 쉼표 자동
function setupMoneyInputs() {
  const moneyInputs = document.querySelectorAll('input[data-type="money"]');
  moneyInputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      const v = e.target.value;
      e.target.value = formatWithCommas(v);
    });
    if (input.value) {
      input.value = formatWithCommas(input.value);
    }
  });
}

// ------------------------------------------------------
// 1. 담보대출 LTV / 금리 설정 (지역별)
// ------------------------------------------------------

let loanConfigData = {
  byRegion: {} // { "서울": { "아파트": {maxLtv, rateMin, rateMax}, ... }, ... }
};
let currentRegion = "서울";

function loadLoanConfigFromStorage() {
  try {
    const raw = localStorage.getItem(LOAN_LOCAL_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.byRegion) {
      loanConfigData = parsed;
    }
  } catch (e) {
    console.warn("loan-config load error:", e);
  }
}

function saveLoanConfigToStorage() {
  try {
    localStorage.setItem(LOAN_LOCAL_KEY, JSON.stringify(loanConfigData));
  } catch (e) {
    console.warn("loan-config save error:", e);
  }
}

// 현재 region의 폼값 -> loanConfigData에 반영 (메모리)
function captureLoanConfigFromForm(region) {
  const tbody = document.getElementById("loanConfigBody");
  if (!tbody) return;

  const regionCfg = loanConfigData.byRegion[region] || {};

  PROPERTY_TYPES.forEach((prop) => {
    const row = tbody.querySelector(`tr[data-prop="${prop}"]`);
    if (!row) return;

    const maxLtvEl  = row.querySelector('input[data-field="maxLtv"]');
    const rateMinEl = row.querySelector('input[data-field="rateMin"]');
    const rateMaxEl = row.querySelector('input[data-field="rateMax"]');

    const maxLtvPct   = maxLtvEl && maxLtvEl.value !== "" ? Number(maxLtvEl.value) : NaN;
    const rateMinPct  = rateMinEl && rateMinEl.value !== "" ? Number(rateMinEl.value) : NaN;
    const rateMaxPct  = rateMaxEl && rateMaxEl.value !== "" ? Number(rateMaxEl.value) : NaN;

    if (isNaN(maxLtvPct) && isNaN(rateMinPct) && isNaN(rateMaxPct)) {
      // 해당 물건에 아무 값도 없으면 제거
      delete regionCfg[prop];
      return;
    }

    const cfg = regionCfg[prop] || {};
    if (!isNaN(maxLtvPct))  cfg.maxLtv  = maxLtvPct  / 100; // 79 → 0.79
    if (!isNaN(rateMinPct)) cfg.rateMin = rateMinPct / 100; // 6.8 → 0.068
    if (!isNaN(rateMaxPct)) cfg.rateMax = rateMaxPct / 100; // 15.9 → 0.159

    regionCfg[prop] = cfg;
  });

  loanConfigData.byRegion[region] = regionCfg;
}

// loanConfigData에 저장된 값 → 폼에 채우기
function fillLoanConfigForm(region) {
  const tbody = document.getElementById("loanConfigBody");
  if (!tbody) return;

  const regionCfg = loanConfigData.byRegion[region] || {};

  PROPERTY_TYPES.forEach((prop) => {
    const row = tbody.querySelector(`tr[data-prop="${prop}"]`);
    if (!row) return;

    const cfg = regionCfg[prop] || {};

    const maxLtvEl  = row.querySelector('input[data-field="maxLtv"]');
    const rateMinEl = row.querySelector('input[data-field="rateMin"]');
    const rateMaxEl = row.querySelector('input[data-field="rateMax"]');

    if (maxLtvEl) {
      maxLtvEl.value =
        typeof cfg.maxLtv === "number" ? String(Math.round(cfg.maxLtv * 1000) / 10) : "";
    }
    if (rateMinEl) {
      rateMinEl.value =
        typeof cfg.rateMin === "number" ? String(Math.round(cfg.rateMin * 1000) / 10) : "";
    }
    if (rateMaxEl) {
      rateMaxEl.value =
        typeof cfg.rateMax === "number" ? String(Math.round(cfg.rateMax * 1000) / 10) : "";
    }
  });
}

// 지역 버튼 클릭 핸들러
function setupRegionTabs() {
  const container = document.getElementById("loanRegionTabs");
  if (!container) return;

  const buttons = container.querySelectorAll(".admin-region-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const region = btn.getAttribute("data-region");
      if (!region || region === currentRegion) return;

      // 1) 현재 폼 내용을 메모리에 반영
      captureLoanConfigFromForm(currentRegion);

      // 2) 선택 표시 변경
      buttons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      currentRegion = region;

      // 3) 새 지역 값 채우기
      fillLoanConfigForm(currentRegion);
    });
  });
}

// LTV / 금리 설정 저장 버튼
function setupLoanConfigSaveButton() {
  const btn = document.getElementById("loanConfigSaveBtn");
  const statusEl = document.getElementById("loanConfigStatus");
  if (!btn) return;

  btn.addEventListener("click", () => {
    // 현재 폼 → 데이터 반영 후 전체 저장
    captureLoanConfigFromForm(currentRegion);
    saveLoanConfigToStorage();

    if (statusEl) {
      statusEl.textContent = "LTV/금리 설정이 브라우저(localStorage)에 저장되었습니다.";
      setTimeout(() => {
        if (statusEl.textContent.includes("저장되었습니다")) {
          statusEl.textContent = "";
        }
      }, 3000);
    }

    alert("LTV/금리 설정이 저장되었습니다.\n(브라우저 localStorage 기준 테스트)");
  });
}

// ------------------------------------------------------
// 2. 온투업 통계 (월별 저장, 비율 → 금액 자동계산)
// ------------------------------------------------------

let statsRoot = {
  // byMonth: { "2025-11": { summary:{...}, products:{...} } }
  byMonth: {}
};

function loadStatsFromStorage() {
  try {
    const raw = localStorage.getItem(STATS_LOCAL_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.byMonth) {
      statsRoot = parsed;
    }
  } catch (e) {
    console.warn("ontu-stats load error:", e);
  }
}
function saveStatsToStorage() {
  try {
    localStorage.setItem(STATS_LOCAL_KEY, JSON.stringify(statsRoot));
  } catch (e) {
    console.warn("ontu-stats save error:", e);
  }
}

function getCurrentMonthKey() {
  const m = document.getElementById("statsMonth");
  return m ? (m.value || "").trim() : "";
}

function clearStatsForm() {
  const ids = [
    "statsRegisteredFirms",
    "statsDataFirms",
    "statsTotalLoan",
    "statsTotalRepaid",
    "statsBalance"
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const ratios = document.querySelectorAll("#productRows .js-ratio");
  const amounts = document.querySelectorAll("#productRows .js-amount");
  ratios.forEach((el) => (el.value = ""));
  amounts.forEach((el) => (el.value = ""));
}

// stats 객체 → 폼 세팅
function fillStatsForm(stat) {
  if (!stat) {
    clearStatsForm();
    return;
  }

  const s = stat.summary || {};
  const p = stat.products || {};

  const regEl   = document.getElementById("statsRegisteredFirms");
  const dataEl  = document.getElementById("statsDataFirms");
  const tlEl    = document.getElementById("statsTotalLoan");
  const trEl    = document.getElementById("statsTotalRepaid");
  const balEl   = document.getElementById("statsBalance");

  if (regEl) regEl.value = s.registeredFirms ?? "";
  if (dataEl) dataEl.value = s.dataFirms ?? "";
  if (tlEl)   tlEl.value   = s.totalLoan ? formatWithCommas(String(s.totalLoan)) : "";
  if (trEl)   trEl.value   = s.totalRepaid ? formatWithCommas(String(s.totalRepaid)) : "";
  if (balEl)  balEl.value  = s.balance ? formatWithCommas(String(s.balance)) : "";

  const tbody = document.getElementById("productRows");
  if (!tbody) return;

  const rows = tbody.querySelectorAll("tr[data-key]");
  rows.forEach((row) => {
    const key = row.getAttribute("data-key");
    const cfg = p[key] || {};
    const ratioEl  = row.querySelector(".js-ratio");
    const amountEl = row.querySelector(".js-amount");
    if (ratioEl)  ratioEl.value  = cfg.ratioPercent != null ? cfg.ratioPercent : "";
    if (amountEl) amountEl.value = cfg.amount != null ? formatWithCommas(String(cfg.amount)) : "";
  });
}

// 폼 → stats 객체
function collectStatsFormData() {
  const monthKey = getCurrentMonthKey();
  if (!monthKey) return null;

  const regEl   = document.getElementById("statsRegisteredFirms");
  const dataEl  = document.getElementById("statsDataFirms");
  const tlEl    = document.getElementById("statsTotalLoan");
  const trEl    = document.getElementById("statsTotalRepaid");
  const balEl   = document.getElementById("statsBalance");

  const summary = {
    registeredFirms: regEl ? Number(regEl.value || 0) : 0,
    dataFirms:      dataEl ? Number(dataEl.value || 0) : 0,
    totalLoan:      getMoneyValue(tlEl),
    totalRepaid:    getMoneyValue(trEl),
    balance:        getMoneyValue(balEl)
  };

  const products = {};
  const rows = document.querySelectorAll("#productRows tr[data-key]");
  rows.forEach((row) => {
    const key = row.getAttribute("data-key");
    if (!key) return;
    const ratioEl  = row.querySelector(".js-ratio");
    const amountEl = row.querySelector(".js-amount");

    const ratioPercent = ratioEl && ratioEl.value !== "" ? Number(ratioEl.value) : 0;
    const amount       = getMoneyValue(amountEl);

    if (ratioPercent === 0 && amount === 0) return;

    products[key] = {
      ratioPercent,
      amount
    };
  });

  return { monthKey, summary, products };
}

// 비율 입력 or 잔액 변경 → 금액 자동계산
function recalcProductAmounts() {
  const balEl = document.getElementById("statsBalance");
  if (!balEl) return;
  const balance = getMoneyValue(balEl);
  const rows = document.querySelectorAll("#productRows tr[data-key]");

  rows.forEach((row) => {
    const ratioEl  = row.querySelector(".js-ratio");
    const amountEl = row.querySelector(".js-amount");
    if (!ratioEl || !amountEl) return;

    const ratio = ratioEl.value !== "" ? parseFloat(ratioEl.value) : NaN;
    if (!balance || isNaN(ratio)) {
      amountEl.value = "";
      return;
    }
    const amt = Math.round(balance * (ratio / 100));
    amountEl.value = formatWithCommas(String(amt));
  });
}

function setupStatsInteractions() {
  const monthInput = document.getElementById("statsMonth");
  if (monthInput) {
    monthInput.addEventListener("change", () => {
      const m = getCurrentMonthKey();
      if (!m) {
        clearStatsForm();
        return;
      }
      const stat = statsRoot.byMonth[m] || null;
      fillStatsForm(stat);
      // money 포맷 재적용
      setupMoneyInputs();
      recalcProductAmounts();
    });
  }

  const balEl = document.getElementById("statsBalance");
  if (balEl) {
    balEl.addEventListener("input", () => {
      // 금액 입력 시 포맷 + 재계산
      balEl.value = formatWithCommas(balEl.value);
      recalcProductAmounts();
    });
  }

  const ratioInputs = document.querySelectorAll("#productRows .js-ratio");
  ratioInputs.forEach((el) => {
    el.addEventListener("input", () => {
      recalcProductAmounts();
    });
  });

  const saveBtn = document.getElementById("saveOntuStatsBtn");
  const statusEl = document.getElementById("statsSaveStatus");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const payload = collectStatsFormData();
      if (!payload) {
        alert("먼저 조회년월을 선택해주세요.");
        return;
      }
      const { monthKey, summary, products } = payload;
      statsRoot.byMonth[monthKey] = { summary, products };
      saveStatsToStorage();

      if (statusEl) {
        statusEl.textContent = "통계 데이터가 저장되었습니다. (localStorage)";
        setTimeout(() => {
          if (statusEl.textContent.includes("저장되었습니다")) {
            statusEl.textContent = "";
          }
        }, 3000);
      }

      alert(`통계 데이터가 ${monthKey} 기준으로 저장되었습니다.\n(브라우저 localStorage 테스트)`);
    });
  }
}

// ------------------------------------------------------
// 상단 MENU 드롭다운 (간단)
// ------------------------------------------------------
function setupBetaMenu() {
  const toggle = document.getElementById("betaMenuToggle");
  const panel  = document.getElementById("betaMenuPanel");
  if (!toggle || !panel) return;

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = panel.classList.contains("hide");
    if (isHidden) {
      panel.classList.remove("hide");
      toggle.setAttribute("aria-expanded", "true");
    } else {
      panel.classList.add("hide");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("click", (e) => {
    if (!panel.classList.contains("hide")) {
      if (!panel.contains(e.target) && e.target !== toggle) {
        panel.classList.add("hide");
        toggle.setAttribute("aria-expanded", "false");
      }
    }
  });
}

// ------------------------------------------------------
// 초기화
// ------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // 공통
  setupBetaMenu();
  setupMoneyInputs();

  // LTV/금리 설정
  loadLoanConfigFromStorage();
  setupRegionTabs();
  fillLoanConfigForm(currentRegion);
  setupLoanConfigSaveButton();

  // 통계
  loadStatsFromStorage();
  setupStatsInteractions();
});
