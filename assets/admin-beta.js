// /assets/admin-beta.js (베타 관리자 전용 JS)

// ─────────────────────────────────────────
// 상수 정의
// ─────────────────────────────────────────

// LTV/금리 설정용 지역 리스트 (계산기 1번과 동일)
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

// LTV/금리 설정용 부동산 종류 (계산기와 맞춤)
const PROPERTY_TYPES_LTV = [
  "아파트",
  "다세대/연립",
  "단독/다가구",
  "토지/임야",
];

// 온투업 통계용 상품유형
const PRODUCT_TYPES_STATS = [
  "부동산담보",
  "부동산PF",
  "어음·매출채권담보",
  "기타담보(주식 등)",
  "개인신용",
  "법인신용",
];

// localStorage 키
const LOCAL_KEY_LOAN_CONFIG = "huchu_loan_config_beta";
const LOCAL_KEY_ONTU_STATS  = "huchu_ontu_stats_beta";

// ─────────────────────────────────────────
// 숫자 / 통화 유틸
// ─────────────────────────────────────────

function stripNonDigits(str) {
  return (str || "").replace(/[^\d]/g, "");
}

function formatWithCommas(str) {
  const digits = stripNonDigits(str);
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getMoneyValueFromInput(inputEl) {
  if (!inputEl) return 0;
  const digits = stripNonDigits(inputEl.value);
  return digits ? Number(digits) : 0;
}

// data-type="money" 인풋에 쉼표 포맷 적용
function setupMoneyInputs() {
  const moneyInputs = document.querySelectorAll('input[data-type="money"]');
  moneyInputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      const target = e.target;
      const formatted = formatWithCommas(target.value);
      target.value = formatted;
    });

    // 초기값도 포맷
    if (input.value) {
      input.value = formatWithCommas(input.value);
    }
  });
}

// ─────────────────────────────────────────
// 상단 MENU 드롭다운 (베타 공통)
// ─────────────────────────────────────────

function setupBetaMenu() {
  const btn   = document.getElementById("betaMenuToggle");
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

// ─────────────────────────────────────────
// 1. 담보대출 LTV / 금리 설정 영역
// ─────────────────────────────────────────

// LTV/금리 설정 테이블 렌더링
function buildLoanConfigTable() {
  const tbody = document.getElementById("loanConfigBody");
  if (!tbody) return;

  const rowsHtml = PROPERTY_TYPES_LTV.map((type) => {
    const regionSelect = `
      <select class="admin-input js-region" data-type-key="${type}">
        ${REGIONS.map((r) => `<option value="${r}">${r}</option>`).join("")}
      </select>
    `;

    return `
      <tr data-type="${type}">
        <td style="padding:4px 4px;">${type}</td>
        <td style="padding:4px 4px;">${regionSelect}</td>
        <td style="padding:4px 4px;text-align:right;">
          <input
            type="number"
            class="admin-input js-maxLtv"
            data-type-key="${type}"
            min="0" max="100" step="0.1"
            placeholder="예) 73"
            style="width:100%;text-align:right;"
          />
        </td>
        <td style="padding:4px 4px;text-align:right;">
          <input
            type="number"
            class="admin-input js-rateMin"
            data-type-key="${type}"
            min="0" max="100" step="0.01"
            placeholder="예) 6.8"
            style="width:100%;text-align:right;"
          />
        </td>
        <td style="padding:4px 4px;text-align:right;">
          <input
            type="number"
            class="admin-input js-rateMax"
            data-type-key="${type}"
            min="0" max="100" step="0.01"
            placeholder="예) 14.8"
            style="width:100%;text-align:right;"
          />
        </td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = rowsHtml;
}

// localStorage에서 LTV/금리 설정 로드
function loadLoanConfigFromLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_LOAN_CONFIG);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (e) {
    console.warn("[admin-beta] loan-config parse 실패:", e);
    return null;
  }
}

// LTV/금리 설정 UI에 값 반영
function hydrateLoanConfigUI(config) {
  if (!config || !config.byType) return;

  PROPERTY_TYPES_LTV.forEach((type) => {
    const rowData = config.byType[type];
    if (!rowData) return;

    const regionEl   = document.querySelector(`select.js-region[data-type-key="${type}"]`);
    const maxLtvEl   = document.querySelector(`input.js-maxLtv[data-type-key="${type}"]`);
    const rateMinEl  = document.querySelector(`input.js-rateMin[data-type-key="${type}"]`);
    const rateMaxEl  = document.querySelector(`input.js-rateMax[data-type-key="${type}"]`);

    if (regionEl && rowData.region && REGIONS.includes(rowData.region)) {
      regionEl.value = rowData.region;
    }
    if (maxLtvEl && typeof rowData.maxLtv === "number") {
      const pct = (rowData.maxLtv * 100).toFixed(1).replace(/\.0$/, "");
      maxLtvEl.value = pct;
    }
    if (rateMinEl && typeof rowData.rateMin === "number") {
      const pct = (rowData.rateMin * 100).toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
      rateMinEl.value = pct;
    }
    if (rateMaxEl && typeof rowData.rateMax === "number") {
      const pct = (rowData.rateMax * 100).toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
      rateMaxEl.value = pct;
    }
  });
}

// LTV/금리 설정 저장
function setupLoanConfigSave() {
  const btn    = document.getElementById("loanConfigSaveBtn");
  const status = document.getElementById("loanConfigStatus");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const byType = {};

    PROPERTY_TYPES_LTV.forEach((type) => {
      const regionEl  = document.querySelector(`select.js-region[data-type-key="${type}"]`);
      const maxLtvEl  = document.querySelector(`input.js-maxLtv[data-type-key="${type}"]`);
      const rateMinEl = document.querySelector(`input.js-rateMin[data-type-key="${type}"]`);
      const rateMaxEl = document.querySelector(`input.js-rateMax[data-type-key="${type}"]`);

      const region      = regionEl ? (regionEl.value || "").trim() : "";
      const maxLtvPct   = maxLtvEl ? parseFloat(maxLtvEl.value) : NaN;
      const rateMinPct  = rateMinEl ? parseFloat(rateMinEl.value) : NaN;
      const rateMaxPct  = rateMaxEl ? parseFloat(rateMaxEl.value) : NaN;

      const maxLtv  = isNaN(maxLtvPct)  ? null : maxLtvPct / 100;
      const rateMin = isNaN(rateMinPct) ? null : rateMinPct / 100;
      const rateMax = isNaN(rateMaxPct) ? null : rateMaxPct / 100;

      byType[type] = {
        region: region || null,
        maxLtv,
        rateMin,
        rateMax,
      };
    });

    const payload = {
      updatedAt: new Date().toISOString(),
      byType,
    };

    try {
      localStorage.setItem(LOCAL_KEY_LOAN_CONFIG, JSON.stringify(payload));
      console.log("[admin-beta] loan-config 저장:", payload);
      if (status) {
        status.textContent = "LTV/금리 설정이 브라우저(localStorage)에 저장되었습니다.";
        status.style.color = "#16a34a";
      }
    } catch (e) {
      console.error("[admin-beta] loan-config 저장 실패:", e);
      if (status) {
        status.textContent = "저장 중 오류가 발생했습니다. (콘솔 확인)";
        status.style.color = "#b91c1c";
      }
    }
  });
}

// ─────────────────────────────────────────
// 2. 온투업 통계 영역 (요약 + 상품유형별)
// ─────────────────────────────────────────

// localStorage에서 온투 통계 전체 스토어 로드
function loadOntuStore() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_ONTU_STATS);
    if (!raw) {
      return { byMonth: {}, lastMonth: null };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { byMonth: {}, lastMonth: null };
    }
    if (!parsed.byMonth || typeof parsed.byMonth !== "object") {
      parsed.byMonth = {};
    }
    return parsed;
  } catch (e) {
    console.warn("[admin-beta] ontu-stats parse 실패:", e);
    return { byMonth: {}, lastMonth: null };
  }
}

// 온투 통계 스토어 저장
function saveOntuStore(store) {
  try {
    localStorage.setItem(LOCAL_KEY_ONTU_STATS, JSON.stringify(store));
  } catch (e) {
    console.error("[admin-beta] ontu-stats 저장 실패:", e);
  }
}

// 현재 UI에서 통계 데이터 수집
function collectOntuStatsFromUI() {
  const monthInput = document.getElementById("statsMonth");
  const month = monthInput ? (monthInput.value || "").trim() : "";

  const regFirmsEl   = document.getElementById("summary-registeredFirms");
  const dataFirmsEl  = document.getElementById("summary-dataFirms");
  const totalLoanEl  = document.getElementById("summary-totalLoan");
  const totalRepEl   = document.getElementById("summary-totalRepaid");
  const balanceEl    = document.getElementById("summary-balance");

  const summary = {
    registeredFirms: regFirmsEl ? Number(regFirmsEl.value || 0) : 0,
    dataFirms:       dataFirmsEl ? Number(dataFirmsEl.value || 0) : 0,
    totalLoan:       getMoneyValueFromInput(totalLoanEl),
    totalRepaid:     getMoneyValueFromInput(totalRepEl),
    balance:         getMoneyValueFromInput(balanceEl),
  };

  const byType = {};
  PRODUCT_TYPES_STATS.forEach((name) => {
    const ratioEl  = document.querySelector(`.js-ratio[data-key="${name}"]`);
    const amountEl = document.querySelector(`.js-amount[data-key="${name}"]`);

    const ratioPercent = ratioEl ? parseFloat(ratioEl.value) : NaN;
    const ratio = isNaN(ratioPercent) ? 0 : (ratioPercent / 100);

    const amount = getMoneyValueFromInput(amountEl);

    byType[name] = {
      ratio,
      amount,
    };
  });

  return { month, summary, byType };
}

// UI에 통계 데이터 바인딩
function hydrateOntuStatsUI(statsObj) {
  const monthInput = document.getElementById("statsMonth");
  if (monthInput && statsObj.month) {
    monthInput.value = statsObj.month;
  }

  const regFirmsEl   = document.getElementById("summary-registeredFirms");
  const dataFirmsEl  = document.getElementById("summary-dataFirms");
  const totalLoanEl  = document.getElementById("summary-totalLoan");
  const totalRepEl   = document.getElementById("summary-totalRepaid");
  const balanceEl    = document.getElementById("summary-balance");

  if (regFirmsEl) regFirmsEl.value = statsObj.summary?.registeredFirms ?? "";
  if (dataFirmsEl) dataFirmsEl.value = statsObj.summary?.dataFirms ?? "";

  if (totalLoanEl) {
    const v = statsObj.summary?.totalLoan ?? 0;
    totalLoanEl.value = v ? formatWithCommas(String(v)) : "";
  }
  if (totalRepEl) {
    const v = statsObj.summary?.totalRepaid ?? 0;
    totalRepEl.value = v ? formatWithCommas(String(v)) : "";
  }
  if (balanceEl) {
    const v = statsObj.summary?.balance ?? 0;
    balanceEl.value = v ? formatWithCommas(String(v)) : "";
  }

  // 상품유형별 비율/금액
  PRODUCT_TYPES_STATS.forEach((name) => {
    const typeData = statsObj.byType?.[name] || {};
    const ratioEl  = document.querySelector(`.js-ratio[data-key="${name}"]`);
    const amountEl = document.querySelector(`.js-amount[data-key="${name}"]`);

    if (ratioEl && typeof typeData.ratio === "number") {
      const pct = (typeData.ratio * 100).toFixed(1).replace(/\.0$/, "");
      ratioEl.value = pct;
    } else if (ratioEl) {
      ratioEl.value = "";
    }

    if (amountEl && typeof typeData.amount === "number") {
      amountEl.value = typeData.amount
        ? formatWithCommas(String(typeData.amount))
        : "";
    } else if (amountEl) {
      amountEl.value = "";
    }
  });
}

// [상품유형별 대출잔액] 금액 재계산
function recalcProductAmounts() {
  const balanceEl = document.getElementById("summary-balance");
  if (!balanceEl) return;
  const balance = getMoneyValueFromInput(balanceEl);
  const ratioInputs = document.querySelectorAll(".js-ratio");

  ratioInputs.forEach((ratioEl) => {
    const key = ratioEl.getAttribute("data-key");
    const amountEl = document.querySelector(`.js-amount[data-key="${key}"]`);
    if (!amountEl) return;

    const ratioPercent = parseFloat(ratioEl.value);
    if (!balance || isNaN(ratioPercent)) {
      amountEl.value = "";
      return;
    }
    const amount = Math.round(balance * (ratioPercent / 100));
    amountEl.value = formatWithCommas(String(amount));
  });
}

// 온투 통계 섹션 초기화
function setupOntuStatsSection() {
  const balanceEl = document.getElementById("summary-balance");
  const ratioInputs = document.querySelectorAll(".js-ratio");
  const saveBtn  = document.getElementById("saveOntuStatsBtn");
  const statusEl = document.getElementById("ontuStatsStatus");
  const loadBtn  = document.getElementById("statsLoadBtn");
  const monthEl  = document.getElementById("statsMonth");

  // 대출잔액 변화 시 전체 재계산
  if (balanceEl) {
    balanceEl.addEventListener("input", () => {
      recalcProductAmounts();
    });
  }

  // 각 상품유형 비율 입력 시 금액 재계산
  ratioInputs.forEach((el) => {
    el.addEventListener("input", () => recalcProductAmounts());
  });

  // 저장 버튼
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const stats = collectOntuStatsFromUI();
      if (!stats.month) {
        alert("조회년월을 먼저 선택해주세요.");
        if (monthEl) monthEl.focus();
        return;
      }

      const store = loadOntuStore();
      store.byMonth[stats.month] = stats;
      store.lastMonth = stats.month;
      saveOntuStore(store);

      console.log("[admin-beta] ontu-stats 저장:", stats);

      if (statusEl) {
        statusEl.textContent = `${stats.month} 통계가 브라우저(localStorage)에 저장되었습니다.`;
        statusEl.style.color = "#16a34a";
      }
    });
  }

  // 해당 월 데이터 불러오기
  if (loadBtn) {
    loadBtn.addEventListener("click", () => {
      const monthKey = monthEl ? (monthEl.value || "").trim() : "";
      if (!monthKey) {
        alert("조회년월을 먼저 선택해주세요.");
        if (monthEl) monthEl.focus();
        return;
      }
      const store = loadOntuStore();
      const stats = store.byMonth[monthKey];
      if (!stats) {
        // 해당 월 데이터가 없으면 UI 초기화
        const emptyStats = {
          month: monthKey,
          summary: {
            registeredFirms: 0,
            dataFirms: 0,
            totalLoan: 0,
            totalRepaid: 0,
            balance: 0,
          },
          byType: {},
        };
        hydrateOntuStatsUI(emptyStats);
        recalcProductAmounts();
        if (statusEl) {
          statusEl.textContent = `${monthKey} 데이터가 없어 초기값으로 설정되었습니다.`;
          statusEl.style.color = "#6b7280";
        }
        return;
      }
      hydrateOntuStatsUI(stats);
      recalcProductAmounts();
      if (statusEl) {
        statusEl.textContent = `${monthKey} 저장된 통계를 불러왔습니다.`;
        statusEl.style.color = "#0f766e";
      }
    });
  }

  // 초기 로딩 시, lastMonth가 있으면 자동 로딩
  const store = loadOntuStore();
  if (store.lastMonth && store.byMonth[store.lastMonth]) {
    const last = store.byMonth[store.lastMonth];
    if (monthEl) monthEl.value = last.month;
    hydrateOntuStatsUI(last);
    recalcProductAmounts();
    if (statusEl) {
      statusEl.textContent = `${last.month} 기준 마지막 저장 통계를 불러왔습니다.`;
      statusEl.style.color = "#6b7280";
    }
  }
}

// ─────────────────────────────────────────
// DOMContentLoaded
// ─────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // 상단 MENU
  setupBetaMenu();

  // LTV/금리 설정 테이블 생성 + 데이터 복원 + 저장 버튼
  buildLoanConfigTable();
  const loadedLoanConfig = loadLoanConfigFromLocal();
  if (loadedLoanConfig) {
    hydrateLoanConfigUI(loadedLoanConfig);
  }
  setupLoanConfigSave();

  // 금액 인풋 쉼표 포맷
  setupMoneyInputs();

  // 온투 통계 섹션 초기화
  setupOntuStatsSection();
});
