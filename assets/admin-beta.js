// /assets/admin-beta.js

// ─────────────────────────────
// 숫자 포맷 유틸
// ─────────────────────────────
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
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─────────────────────────────
// 1. 담보대출 LTV / 금리 설정
// ─────────────────────────────
const LOAN_REGIONS = [
  "서울",
  "경기",
  "인천",
  "충청도",
  "전라도",
  "강원도",
  "경상도",
  "제주도"
];

const LOAN_PROPERTY_TYPES = ["아파트", "다세대/연립", "단독/다가구", "토지/임야"];
const LOCAL_KEY_LOAN_CONFIG = "huchu_loan_config_beta";

const DEFAULT_LOAN_BY_TYPE = {
  "아파트":     { maxLtv: 0.79, rateMin: 0.068, rateMax: 0.159 },
  "다세대/연립": { maxLtv: 0.73, rateMin: 0.07,  rateMax: 0.159 },
  "단독/다가구": { maxLtv: 0.73, rateMin: 0.07,  rateMax: 0.159 },
  "토지/임야":   { maxLtv: 0.73, rateMin: 0.07,  rateMax: 0.159 }
};

let loanConfig = null;
let currentLoanRegion = LOAN_REGIONS[0];

function loadLoanConfigFromStorage() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_LOAN_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.byRegion) return parsed;
    }
  } catch (e) {
    console.warn("loan-config load error:", e);
  }
  const byRegion = {};
  LOAN_REGIONS.forEach((r) => {
    byRegion[r] = deepClone(DEFAULT_LOAN_BY_TYPE);
  });
  return { byRegion };
}

function ensureRegionExists(region) {
  if (!loanConfig.byRegion[region]) {
    loanConfig.byRegion[region] = deepClone(DEFAULT_LOAN_BY_TYPE);
  }
}

function renderLoanRows() {
  const tbody = document.getElementById("loanConfigBody");
  if (!tbody) return;

  tbody.innerHTML = LOAN_PROPERTY_TYPES.map((name, idx) => `
    <tr>
      <td style="padding:6px 4px;">${name}</td>
      <td style="padding:6px 4px;">
        <input
          type="number"
          id="loan-maxLtv-${idx}"
          data-property="${name}"
          min="0" max="100" step="0.1"
          style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #d1d5db;font-size:13px;text-align:right;"
        />
      </td>
      <td style="padding:6px 4px;">
        <input
          type="number"
          id="loan-rateMin-${idx}"
          data-property="${name}"
          min="0" max="30" step="0.1"
          style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #d1d5db;font-size:13px;text-align:right;"
        />
      </td>
      <td style="padding:6px 4px;">
        <input
          type="number"
          id="loan-rateMax-${idx}"
          data-property="${name}"
          min="0" max="30" step="0.1"
          style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #d1d5db;font-size:13px;text-align:right;"
        />
      </td>
    </tr>
  `).join("");
}

function readLoanFormIntoRegion(region) {
  if (!loanConfig) return;
  ensureRegionExists(region);
  const regionCfg = loanConfig.byRegion[region];

  LOAN_PROPERTY_TYPES.forEach((name, idx) => {
    const maxEl  = document.getElementById(`loan-maxLtv-${idx}`);
    const minEl  = document.getElementById(`loan-rateMin-${idx}`);
    const maxREl = document.getElementById(`loan-rateMax-${idx}`);
    if (!maxEl || !minEl || !maxREl) return;

    const ltvPct  = parseFloat(maxEl.value);
    const rMinPct = parseFloat(minEl.value);
    const rMaxPct = parseFloat(maxREl.value);

    regionCfg[name] = {
      maxLtv:  isNaN(ltvPct)  ? 0 : ltvPct  / 100,
      rateMin: isNaN(rMinPct) ? 0 : rMinPct / 100,
      rateMax: isNaN(rMaxPct) ? 0 : rMaxPct / 100
    };
  });
}

function fillLoanFormFromRegion(region) {
  if (!loanConfig) return;
  ensureRegionExists(region);
  const regionCfg = loanConfig.byRegion[region];

  LOAN_PROPERTY_TYPES.forEach((name, idx) => {
    const cfg = regionCfg[name] || {};
    const maxEl  = document.getElementById(`loan-maxLtv-${idx}`);
    const minEl  = document.getElementById(`loan-rateMin-${idx}`);
    const maxREl = document.getElementById(`loan-rateMax-${idx}`);
    if (!maxEl || !minEl || !maxREl) return;

    maxEl.value  = cfg.maxLtv  != null ? (cfg.maxLtv  * 100).toFixed(1).replace(/\.0$/, "") : "";
    minEl.value  = cfg.rateMin != null ? (cfg.rateMin * 100).toFixed(1).replace(/\.0$/, "") : "";
    maxREl.value = cfg.rateMax != null ? (cfg.rateMax * 100).toFixed(1).replace(/\.0$/, "") : "";
  });
}

function updateLoanRegionTabActive() {
  const buttons = document.querySelectorAll("#loanRegionTabs .admin-region-btn");
  buttons.forEach((btn) => {
    const r = btn.dataset.region;
    btn.classList.toggle("is-active", r === currentLoanRegion);
  });
}

function setupLoanRegionTabs() {
  const container = document.getElementById("loanRegionTabs");
  if (!container) return;

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".admin-region-btn");
    if (!btn) return;
    const newRegion = btn.dataset.region;
    if (!newRegion || newRegion === currentLoanRegion) return;

    // 현재 지역 값 저장
    readLoanFormIntoRegion(currentLoanRegion);

    currentLoanRegion = newRegion;
    updateLoanRegionTabActive();
    fillLoanFormFromRegion(currentLoanRegion);
  });

  // 초기 정리 (서울만 노란색)
  updateLoanRegionTabActive();
}

function setupLoanConfigSaveButton() {
  const btn = document.getElementById("loanConfigSaveBtn");
  const statusEl = document.getElementById("loanConfigStatus");
  if (!btn) return;

  btn.addEventListener("click", () => {
    if (!loanConfig) return;

    // 현재 지역 값 반영 후 저장
    readLoanFormIntoRegion(currentLoanRegion);

    try {
      localStorage.setItem(LOCAL_KEY_LOAN_CONFIG, JSON.stringify(loanConfig));
      console.log("[beta admin] loan-config 저장:", loanConfig);
      if (statusEl) {
        statusEl.textContent =
          "LTV/금리 설정이 브라우저(localStorage)에 저장되었습니다.";
        statusEl.style.color = "#16a34a";
      }
    } catch (e) {
      console.error("loan-config 저장 오류:", e);
      if (statusEl) {
        statusEl.textContent = "저장 중 오류가 발생했습니다. (콘솔 확인)";
        statusEl.style.color = "#dc2626";
      }
    }
  });
}

// ─────────────────────────────
// 2. 온투업 통계 (월별 localStorage)
// ─────────────────────────────
const STATS_PRODUCT_TYPES = [
  "부동산담보",
  "부동산PF",
  "어음·매출채권담보",
  "기타담보(주식 등)",
  "개인신용",
  "법인신용"
];
const LOCAL_KEY_STATS = "huchu_ontu_stats_beta_v2";

let statsAllMonths = {};

function loadStatsAllFromStorage() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_STATS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (e) {
    console.warn("stats load error:", e);
  }
  return {};
}
function saveStatsAllToStorage() {
  try {
    localStorage.setItem(LOCAL_KEY_STATS, JSON.stringify(statsAllMonths));
  } catch (e) {
    console.warn("stats save error:", e);
  }
}

function clearStatsForm() {
  const ids = [
    "sum-registeredFirms",
    "sum-dataFirms",
    "sum-totalLoan",
    "sum-totalRepaid",
    "sum-balance"
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  STATS_PRODUCT_TYPES.forEach((name) => {
    const ratioInput = document.querySelector(`.js-ratio[data-key="${name}"]`);
    const amountInput = document.querySelector(`.js-amount[data-key="${name}"]`);
    if (ratioInput) ratioInput.value = "";
    if (amountInput) amountInput.value = "";
  });
}

function fillStatsFormFromData(data) {
  if (!data) {
    clearStatsForm();
    return;
  }

  const s = data.summary || {};
  const idsMap = {
    "sum-registeredFirms": s.registeredFirms,
    "sum-dataFirms": s.dataFirms,
    "sum-totalLoan": s.totalLoan,
    "sum-totalRepaid": s.totalRepaid,
    "sum-balance": s.balance
  };
  Object.keys(idsMap).forEach((id) => {
    const el = document.getElementById(id);
    if (el != null && idsMap[id] != null) {
      el.value = String(idsMap[id]);
    }
  });

  const byType = data.byType || {};
  STATS_PRODUCT_TYPES.forEach((name) => {
    const item = byType[name] || {};
    const ratioInput = document.querySelector(`.js-ratio[data-key="${name}"]`);
    const amountInput = document.querySelector(`.js-amount[data-key="${name}"]`);

    if (ratioInput) {
      const ratioPct = item.ratio != null ? item.ratio * 100 : "";
      ratioInput.value = ratioPct === "" ? "" : String(ratioPct);
    }
    if (amountInput) {
      amountInput.value =
        item.amount != null ? formatWithCommas(String(item.amount)) : "";
    }
  });
}

function collectStatsFormForCurrentMonth() {
  const monthInput = document.getElementById("statsMonth");
  const month = monthInput ? (monthInput.value || "").trim() : "";
  if (!month) return null;

  const summary = {
    registeredFirms: Number(
      document.getElementById("sum-registeredFirms")?.value || 0
    ),
    dataFirms: Number(
      document.getElementById("sum-dataFirms")?.value || 0
    ),
    totalLoan: Number(
      document.getElementById("sum-totalLoan")?.value || 0
    ),
    totalRepaid: Number(
      document.getElementById("sum-totalRepaid")?.value || 0
    ),
    balance: Number(
      document.getElementById("sum-balance")?.value || 0
    )
  };

  const byType = {};
  STATS_PRODUCT_TYPES.forEach((name) => {
    const ratioInput = document.querySelector(`.js-ratio[data-key="${name}"]`);
    const amountInput = document.querySelector(`.js-amount[data-key="${name}"]`);

    const ratioPct = ratioInput ? parseFloat(ratioInput.value) : NaN;
    const ratio = isNaN(ratioPct) ? 0 : ratioPct / 100;
    const amount = getMoneyValueFromInput(amountInput);

    byType[name] = { ratio, amount };
  });

  return { month, summary, byType };
}

function setupStatsMonthChange() {
  const monthInput = document.getElementById("statsMonth");
  if (!monthInput) return;

  // 초기: 값이 이미 선택돼 있으면 불러오기
  if (monthInput.value) {
    const existing = statsAllMonths[monthInput.value];
    if (existing) fillStatsFormFromData(existing);
  }

  monthInput.addEventListener("change", () => {
    const m = monthInput.value;
    if (!m) {
      clearStatsForm();
      return;
    }
    const data = statsAllMonths[m];
    if (data) {
      fillStatsFormFromData(data);
    } else {
      clearStatsForm();
    }
  });
}

function setupRatioAutoCalc() {
  const balanceInput = document.getElementById("sum-balance");
  if (!balanceInput) return;

  const ratioInputs = document.querySelectorAll(".js-ratio");
  ratioInputs.forEach((ratioInput) => {
    ratioInput.addEventListener("input", () => {
      const key = ratioInput.dataset.key;
      const amountInput = document.querySelector(
        `.js-amount[data-key="${key}"]`
      );
      if (!amountInput) return;

      const balance = Number(balanceInput.value || 0);
      const ratioPct = parseFloat(ratioInput.value);
      if (!balance || isNaN(ratioPct)) {
        amountInput.value = "";
        return;
      }

      const amount = Math.round(balance * (ratioPct / 100));
      amountInput.value = formatWithCommas(String(amount));
    });
  });
}

function setupSaveStatsButton() {
  const btn = document.getElementById("saveOntuStatsBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const monthInput = document.getElementById("statsMonth");
    const month = monthInput ? (monthInput.value || "").trim() : "";
    if (!month) {
      alert("조회년월을 먼저 선택해주세요.");
      if (monthInput) monthInput.focus();
      return;
    }

    const data = collectStatsFormForCurrentMonth();
    if (!data) return;

    statsAllMonths[month] = {
      summary: data.summary,
      byType: data.byType
    };
    saveStatsAllToStorage();

    console.log("[beta admin] 통계 데이터 저장:", month, statsAllMonths[month]);
    alert(
      "통계 데이터가 브라우저(localStorage)에 저장되었습니다.\n\n" +
        "실제 서버 연동 시 이 위치에서 API를 호출하면 됩니다."
    );
  });
}

// ─────────────────────────────
// 초기화
// ─────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // 1) LTV/금리 설정
  loanConfig = loadLoanConfigFromStorage();
  renderLoanRows();
  setupLoanRegionTabs();
  fillLoanFormFromRegion(currentLoanRegion);
  setupLoanConfigSaveButton();

  // 2) 통계
  setupMoneyInputs();
  statsAllMonths = loadStatsAllFromStorage();
  setupStatsMonthChange();
  setupRatioAutoCalc();
  setupSaveStatsButton();
});
