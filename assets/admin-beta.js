// /assets/admin-beta.js  (베타 관리자 전용 스크립트)

// ------------------------------------------------------
// 공통 상수 / 유틸
// ------------------------------------------------------

// API 베이스
const API_BASE = "https://huchudb-github-io.vercel.app";
const NAVI_LOAN_CONFIG_ENDPOINT = `${API_BASE}/api/loan-config`;

// 지역 / 부동산 유형
const REGIONS = ["서울", "경기", "인천", "충청도", "전라도", "강원도", "경상도", "제주도"];
const PROPERTY_TYPES = ["아파트", "다세대/연립", "단독/다가구", "토지/임야"];

// localStorage 키
const LOAN_LOCAL_KEY = "huchu_loan_config_beta";
const STATS_LOCAL_KEY = "huchu_ontu_stats_beta_v2";
const NAVI_LOAN_CONFIG_LOCAL_KEY = "huchu_navi_loan_config_v1";

// 숫자 유틸
function stripNonDigits(str) {
  return (str || "").replace(/[^\d]/g, "");
}
function formatWithCommas(str) {
  const digits = stripNonDigits(str);
  if (!digits) return "";
  // 정규식 오류 방지를 위해 \B 뒤에 ? 제거
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
  byRegion: {}, // { "서울": { "아파트": {maxLtv, rateMin, rateMax}, ... }, ... }
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

    const maxLtvEl = row.querySelector('input[data-field="maxLtv"]');
    const rateMinEl = row.querySelector('input[data-field="rateMin"]');
    const rateMaxEl = row.querySelector('input[data-field="rateMax"]');

    const maxLtvPct = maxLtvEl && maxLtvEl.value !== "" ? Number(maxLtvEl.value) : NaN;
    const rateMinPct = rateMinEl && rateMinEl.value !== "" ? Number(rateMinEl.value) : NaN;
    const rateMaxPct = rateMaxEl && rateMaxEl.value !== "" ? Number(rateMaxEl.value) : NaN;

    if (isNaN(maxLtvPct) && isNaN(rateMinPct) && isNaN(rateMaxPct)) {
      delete regionCfg[prop];
      return;
    }

    const cfg = regionCfg[prop] || {};
    if (!isNaN(maxLtvPct)) cfg.maxLtv = maxLtvPct / 100;
    if (!isNaN(rateMinPct)) cfg.rateMin = rateMinPct / 100;
    if (!isNaN(rateMaxPct)) cfg.rateMax = rateMaxPct / 100;

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

    const maxLtvEl = row.querySelector('input[data-field="maxLtv"]');
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

      captureLoanConfigFromForm(currentRegion);

      buttons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      currentRegion = region;

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
  byMonth: {},
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
  const ids = ["statsRegisteredFirms", "statsDataFirms", "statsTotalLoan", "statsTotalRepaid", "statsBalance"];
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

  const regEl = document.getElementById("statsRegisteredFirms");
  const dataEl = document.getElementById("statsDataFirms");
  const tlEl = document.getElementById("statsTotalLoan");
  const trEl = document.getElementById("statsTotalRepaid");
  const balEl = document.getElementById("statsBalance");

  if (regEl) regEl.value = s.registeredFirms ?? "";
  if (dataEl) dataEl.value = s.dataFirms ?? "";
  if (tlEl) tlEl.value = s.totalLoan ? formatWithCommas(String(s.totalLoan)) : "";
  if (trEl) trEl.value = s.totalRepaid ? formatWithCommas(String(s.totalRepaid)) : "";
  if (balEl) balEl.value = s.balance ? formatWithCommas(String(s.balance)) : "";

  const tbody = document.getElementById("productRows");
  if (!tbody) return;

  const rows = tbody.querySelectorAll("tr[data-key]");
  rows.forEach((row) => {
    const key = row.getAttribute("data-key");
    const cfg = p[key] || {};
    const ratioEl = row.querySelector(".js-ratio");
    const amountEl = row.querySelector(".js-amount");
    if (ratioEl) ratioEl.value = cfg.ratioPercent != null ? cfg.ratioPercent : "";
    if (amountEl)
      amountEl.value = cfg.amount != null ? formatWithCommas(String(cfg.amount)) : "";
  });
}

// 폼 → stats 객체
function collectStatsFormData() {
  const monthKey = getCurrentMonthKey();
  if (!monthKey) return null;

  const regEl = document.getElementById("statsRegisteredFirms");
  const dataEl = document.getElementById("statsDataFirms");
  const tlEl = document.getElementById("statsTotalLoan");
  const trEl = document.getElementById("statsTotalRepaid");
  const balEl = document.getElementById("statsBalance");

  const summary = {
    registeredFirms: regEl ? Number(regEl.value || 0) : 0,
    dataFirms: dataEl ? Number(dataEl.value || 0) : 0,
    totalLoan: getMoneyValue(tlEl),
    totalRepaid: getMoneyValue(trEl),
    balance: getMoneyValue(balEl),
  };

  const products = {};
  const rows = document.querySelectorAll("#productRows tr[data-key]");
  rows.forEach((row) => {
    const key = row.getAttribute("data-key");
    if (!key) return;
    const ratioEl = row.querySelector(".js-ratio");
    const amountEl = row.querySelector(".js-amount");

    const ratioPercent = ratioEl && ratioEl.value !== "" ? Number(ratioEl.value) : 0;
    const amount = getMoneyValue(amountEl);

    if (ratioPercent === 0 && amount === 0) return;

    products[key] = {
      ratioPercent,
      amount,
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
    const ratioEl = row.querySelector(".js-ratio");
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
      setupMoneyInputs();
      recalcProductAmounts();
    });
  }

  const balEl = document.getElementById("statsBalance");
  if (balEl) {
    balEl.addEventListener("input", () => {
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
    saveBtn.addEventListener("click", async () => {
      const payload = collectStatsFormData();
      if (!payload) {
        alert("먼저 조회년월을 선택해주세요.");
        return;
      }

      const { monthKey, summary, products } = payload;

      try {
        const res = await fetch(`${API_BASE}/api/ontu-stats`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            monthKey,
            summary,
            products,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`API 실패: HTTP ${res.status} ${errText}`);
        }

        const json = await res.json();
        console.log("ontu-stats saved:", json);

        statsRoot.byMonth[monthKey] = { summary, products };
        saveStatsToStorage();

        if (statusEl) {
          statusEl.textContent = "통계 데이터가 서버에 저장되었습니다.";
          setTimeout(() => {
            if (statusEl.textContent.includes("저장되었습니다")) {
              statusEl.textContent = "";
            }
          }, 3000);
        }

        alert(`통계 데이터가 ${monthKey} 기준으로 서버에 저장되었습니다.`);
      } catch (e) {
        console.error("saveOntuStats error:", e);
        alert("통계 저장 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.");
      }
    });
  }
}

// ------------------------------------------------------
// 3. 네비게이션용 온투업 설정 (loan-config)
// ------------------------------------------------------

// 메모리 모델
let naviLoanConfig = {
  version: 1,
  lenders: [],
};

let selectedLenderIndex = null;

// 탭 전환
function setupAdminTabs() {
  const tabButtons = document.querySelectorAll(".admin-tab-btn[data-admin-tab-target]");
  const panels = document.querySelectorAll(".admin-tab-panel");

  if (!tabButtons.length || !panels.length) return;

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-admin-tab-target");
      if (!targetId) return;

      tabButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      panels.forEach((panel) => {
        if (panel.id === targetId) {
          panel.classList.remove("hide");
        } else {
          panel.classList.add("hide");
        }
      });
    });
  });
}

// chip 토글 헬퍼
function toggleChip(chipEl) {
  chipEl.classList.toggle("is-on");
}

// ----------------- admin UI 렌더링 --------------------

function renderNaviLendersAdminUI() {
  const listEl = document.getElementById("lenderList");
  if (!listEl) return;

  listEl.innerHTML = "";

  const lenders = naviLoanConfig.lenders || [];

  if (selectedLenderIndex == null && lenders.length > 0) {
    selectedLenderIndex = 0;
  }
  if (selectedLenderIndex != null && selectedLenderIndex >= lenders.length) {
    selectedLenderIndex = lenders.length > 0 ? lenders.length - 1 : null;
  }

  lenders.forEach((l, idx) => {
    const li = document.createElement("li");
    li.className = "admin-lender-item" + (idx === selectedLenderIndex ? " is-active" : "");
    li.dataset.index = String(idx);

    const nameSpan = document.createElement("span");
    nameSpan.textContent = l.displayName || "(이름 없음)";

    const idSpan = document.createElement("small");
    idSpan.textContent = l.lenderId || "";

    li.appendChild(nameSpan);
    li.appendChild(idSpan);

    li.addEventListener("click", () => {
      // 현재 선택된 것 먼저 저장
      captureCurrentLenderFromForm();
      selectedLenderIndex = idx;
      renderNaviLendersAdminUI();
    });

    listEl.appendChild(li);
  });

  fillLenderForm();
}

function fillLenderForm() {
  const lenders = naviLoanConfig.lenders || [];
  const lender =
    selectedLenderIndex != null && lenders[selectedLenderIndex]
      ? lenders[selectedLenderIndex]
      : null;

  const idInput = document.getElementById("lenderIdInput");
  const nameInput = document.getElementById("lenderNameInput");
  const orderInput = document.getElementById("lenderOrderInput");
  const maxLtvInput = document.getElementById("lenderMaxLtvInput");
  const minAptInput = document.getElementById("lenderMinAptAmountInput");
  const minOtherInput = document.getElementById("lenderMinOtherAmountInput");
  const phoneInput = document.getElementById("lenderPhoneInput");
  const kakaoInput = document.getElementById("lenderKakaoUrlInput");
  const notesInput = document.getElementById("lenderNotesInput");

  const basicFlagChips = document.querySelectorAll("#lenderBasicFlags .admin-chip");
  const catChips = document.querySelectorAll("#lenderLoanCategories .admin-chip");
  const regionChips = document.querySelectorAll("#lenderRegions .admin-chip");
  const propChips = document.querySelectorAll("#lenderPropertyTypes .admin-chip");
  const typeChips = document.querySelectorAll("#lenderRealEstateLoanTypes .admin-chip");
  const creditChips = document.querySelectorAll("#lenderCreditBands .admin-chip");
  const blockChips = document.querySelectorAll("#lenderBlockedFlags .admin-chip");

  // 모든 chip 초기화
  function resetChips(chips) {
    chips.forEach((c) => c.classList.remove("is-on"));
  }

  if (!lender) {
    if (idInput) idInput.value = "";
    if (nameInput) nameInput.value = "";
    if (orderInput) orderInput.value = "";
    if (maxLtvInput) maxLtvInput.value = "";
    if (minAptInput) minAptInput.value = "";
    if (minOtherInput) minOtherInput.value = "";
    if (phoneInput) phoneInput.value = "";
    if (kakaoInput) kakaoInput.value = "";
    if (notesInput) notesInput.value = "";

    resetChips(basicFlagChips);
    resetChips(catChips);
    resetChips(regionChips);
    resetChips(propChips);
    resetChips(typeChips);
    resetChips(creditChips);
    resetChips(blockChips);
    return;
  }

  if (idInput) idInput.value = lender.lenderId || "";
  if (nameInput) nameInput.value = lender.displayName || "";
  if (orderInput) orderInput.value =
    typeof lender.displayOrder === "number" ? String(lender.displayOrder) : "";
  if (maxLtvInput)
    maxLtvInput.value =
      lender.realEstateConfig && typeof lender.realEstateConfig.maxTotalLtv === "number"
        ? String(lender.realEstateConfig.maxTotalLtv)
        : "";
  if (minAptInput)
    minAptInput.value =
      lender.realEstateConfig &&
      lender.realEstateConfig.minLoanByProperty &&
      lender.realEstateConfig.minLoanByProperty["아파트"]
        ? String(lender.realEstateConfig.minLoanByProperty["아파트"])
        : "";
  if (minOtherInput)
    minOtherInput.value =
      lender.realEstateConfig &&
      lender.realEstateConfig.minLoanByProperty &&
      lender.realEstateConfig.minLoanByProperty["_기타"]
        ? String(lender.realEstateConfig.minLoanByProperty["_기타"])
        : "";
  if (phoneInput) phoneInput.value = lender.channels?.phoneNumber || "";
  if (kakaoInput) kakaoInput.value = lender.channels?.kakaoUrl || "";
  if (notesInput) notesInput.value = lender.notes || "";

  resetChips(basicFlagChips);
  resetChips(catChips);
  resetChips(regionChips);
  resetChips(propChips);
  resetChips(typeChips);
  resetChips(creditChips);
  resetChips(blockChips);

  basicFlagChips.forEach((chip) => {
    const flagKey = chip.getAttribute("data-flag");
    if (!flagKey) return;
    if (lender[flagKey]) chip.classList.add("is-on");
  });

  const loanCategories = lender.loanCategories || [];
  catChips.forEach((chip) => {
    const cat = chip.getAttribute("data-cat");
    if (loanCategories.includes(cat)) chip.classList.add("is-on");
  });

  const cfg = lender.realEstateConfig || {};
  const regions = cfg.regions || [];
  regionChips.forEach((chip) => {
    const r = chip.getAttribute("data-region");
    if (regions.includes(r)) chip.classList.add("is-on");
  });

  const props = cfg.propertyTypes || [];
  propChips.forEach((chip) => {
    const p = chip.getAttribute("data-prop");
    if (props.includes(p)) chip.classList.add("is-on");
  });

  const loanTypes = cfg.loanTypes || [];
  typeChips.forEach((chip) => {
    const lt = chip.getAttribute("data-loan-type");
    if (loanTypes.includes(lt)) chip.classList.add("is-on");
  });

  const allowedCreditBands = lender.allowedCreditBands || [];
  creditChips.forEach((chip) => {
    const band = chip.getAttribute("data-band");
    if (allowedCreditBands.includes(band)) chip.classList.add("is-on");
  });

  const blockedFlags = lender.blockedFlags || {};
  blockChips.forEach((chip) => {
    const bk = chip.getAttribute("data-block");
    if (blockedFlags[bk]) chip.classList.add("is-on");
  });
}

// 현재 선택된 온투업체의 폼 → naviLoanConfig에 반영
function captureCurrentLenderFromForm() {
  if (selectedLenderIndex == null) return;
  const lenders = naviLoanConfig.lenders || [];
  if (!lenders[selectedLenderIndex]) return;

  const lender = lenders[selectedLenderIndex];

  const idInput = document.getElementById("lenderIdInput");
  const nameInput = document.getElementById("lenderNameInput");
  const orderInput = document.getElementById("lenderOrderInput");
  const maxLtvInput = document.getElementById("lenderMaxLtvInput");
  const minAptInput = document.getElementById("lenderMinAptAmountInput");
  const minOtherInput = document.getElementById("lenderMinOtherAmountInput");
  const phoneInput = document.getElementById("lenderPhoneInput");
  const kakaoInput = document.getElementById("lenderKakaoUrlInput");
  const notesInput = document.getElementById("lenderNotesInput");

  const basicFlagChips = document.querySelectorAll("#lenderBasicFlags .admin-chip");
  const catChips = document.querySelectorAll("#lenderLoanCategories .admin-chip");
  const regionChips = document.querySelectorAll("#lenderRegions .admin-chip");
  const propChips = document.querySelectorAll("#lenderPropertyTypes .admin-chip");
  const typeChips = document.querySelectorAll("#lenderRealEstateLoanTypes .admin-chip");
  const creditChips = document.querySelectorAll("#lenderCreditBands .admin-chip");
  const blockChips = document.querySelectorAll("#lenderBlockedFlags .admin-chip");

  lender.lenderId = idInput?.value.trim() || "";
  lender.displayName = nameInput?.value.trim() || "";
  lender.displayOrder = orderInput && orderInput.value !== "" ? Number(orderInput.value) : null;

  basicFlagChips.forEach((chip) => {
    const flagKey = chip.getAttribute("data-flag");
    if (!flagKey) return;
    lender[flagKey] = chip.classList.contains("is-on");
  });

  lender.loanCategories = [];
  catChips.forEach((chip) => {
    if (chip.classList.contains("is-on")) {
      const cat = chip.getAttribute("data-cat");
      if (cat) lender.loanCategories.push(cat);
    }
  });

  const cfg = lender.realEstateConfig || {};
  cfg.regions = [];
  regionChips.forEach((chip) => {
    if (chip.classList.contains("is-on")) {
      const r = chip.getAttribute("data-region");
      if (r) cfg.regions.push(r);
    }
  });

  cfg.propertyTypes = [];
  propChips.forEach((chip) => {
    if (chip.classList.contains("is-on")) {
      const p = chip.getAttribute("data-prop");
      if (p) cfg.propertyTypes.push(p);
    }
  });

  cfg.loanTypes = [];
  typeChips.forEach((chip) => {
    if (chip.classList.contains("is-on")) {
      const lt = chip.getAttribute("data-loan-type");
      if (lt) cfg.loanTypes.push(lt);
    }
  });

  cfg.maxTotalLtv =
    maxLtvInput && maxLtvInput.value !== "" ? Number(maxLtvInput.value) : null;

  const minMap = cfg.minLoanByProperty || {};
  const aptVal = minAptInput ? stripNonDigits(minAptInput.value) : "";
  const otherVal = minOtherInput ? stripNonDigits(minOtherInput.value) : "";
  minMap["아파트"] = aptVal ? Number(aptVal) : null;
  minMap["_기타"] = otherVal ? Number(otherVal) : null;
  cfg.minLoanByProperty = minMap;

  lender.realEstateConfig = cfg;

  lender.allowedCreditBands = [];
  creditChips.forEach((chip) => {
    if (chip.classList.contains("is-on")) {
      const band = chip.getAttribute("data-band");
      if (band) lender.allowedCreditBands.push(band);
    }
  });

  const blockedFlags = lender.blockedFlags || {};
  blockChips.forEach((chip) => {
    const bk = chip.getAttribute("data-block");
    if (!bk) return;
    blockedFlags[bk] = chip.classList.contains("is-on");
  });
  lender.blockedFlags = blockedFlags;

  lender.channels = lender.channels || {};
  lender.channels.phoneNumber = phoneInput?.value.trim() || "";
  lender.channels.kakaoUrl = kakaoInput?.value.trim() || "";

  lender.notes = notesInput?.value.trim() || "";
}

// 폼 전체 → naviLoanConfig (여러 개 있을 때 통째로 저장하는 용도)
function captureNaviLendersFromAdminForm() {
  captureCurrentLenderFromForm();
}

// 온투업체 추가 / 삭제 버튼
function setupLenderAddDeleteButtons() {
  const addBtn = document.getElementById("addLenderBtn");
  const delBtn = document.getElementById("deleteLenderBtn");

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      captureCurrentLenderFromForm();

      const newLender = {
        lenderId: "",
        displayName: "",
        isActive: true,
        isNewLoanActive: true,
        isPartner: false,
        displayOrder: (naviLoanConfig.lenders?.length || 0) + 1,
        loanCategories: ["부동산담보대출"],
        realEstateConfig: {
          regions: ["전국"],
          propertyTypes: ["아파트"],
          loanTypes: ["일반담보대출"],
          maxTotalLtv: 0.8,
          minLoanByProperty: {
            "아파트": 10000000,
            "_기타": 30000000,
          },
        },
        allowedCreditBands: ["600이상"],
        blockedFlags: {},
        channels: {
          phoneNumber: "",
          kakaoUrl: "",
        },
        notes: "",
      };

      naviLoanConfig.lenders = naviLoanConfig.lenders || [];
      naviLoanConfig.lenders.push(newLender);
      selectedLenderIndex = naviLoanConfig.lenders.length - 1;
      renderNaviLendersAdminUI();
    });
  }

  if (delBtn) {
    delBtn.addEventListener("click", () => {
      if (selectedLenderIndex == null) {
        alert("삭제할 온투업체를 먼저 선택해주세요.");
        return;
      }
      if (!naviLoanConfig.lenders || !naviLoanConfig.lenders[selectedLenderIndex]) {
        alert("삭제할 온투업체가 없습니다.");
        return;
      }
      const target = naviLoanConfig.lenders[selectedLenderIndex];
      const ok = confirm(
        `선택한 온투업체를 삭제하시겠습니까?\n\n[${target.displayName || target.lenderId || "이름 없음"}]`
      );
      if (!ok) return;

      naviLoanConfig.lenders.splice(selectedLenderIndex, 1);
      if (naviLoanConfig.lenders.length === 0) {
        selectedLenderIndex = null;
      } else if (selectedLenderIndex >= naviLoanConfig.lenders.length) {
        selectedLenderIndex = naviLoanConfig.lenders.length - 1;
      }
      renderNaviLendersAdminUI();
    });
  }
}

// chip 클릭 이벤트 연결
function setupLenderChipInteractions() {
  const allChipGroups = [
    "#lenderBasicFlags",
    "#lenderLoanCategories",
    "#lenderRegions",
    "#lenderPropertyTypes",
    "#lenderRealEstateLoanTypes",
    "#lenderCreditBands",
    "#lenderBlockedFlags",
  ];

  allChipGroups.forEach((selector) => {
    const container = document.querySelector(selector);
    if (!container) return;
    container.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("admin-chip")) return;
      toggleChip(target);
    });
  });
}

// 서버/로컬에서 loan-config 로드
async function loadNaviLoanConfig() {
  try {
    const res = await fetch(NAVI_LOAN_CONFIG_ENDPOINT, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.lenders)) {
        naviLoanConfig = json;
        localStorage.setItem(NAVI_LOAN_CONFIG_LOCAL_KEY, JSON.stringify(naviLoanConfig));
        console.log("✅ naviLoanConfig from API:", naviLoanConfig);
        renderNaviLendersAdminUI();
        return;
      }
    } else {
      console.warn(
        "loan-config GET 실패:",
        res.status,
        await res.text().catch(() => "")
      );
    }
  } catch (e) {
    console.warn("loan-config API 불러오기 실패, localStorage로 대체:", e);
  }

  try {
    const raw = localStorage.getItem(NAVI_LOAN_CONFIG_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.lenders)) {
        naviLoanConfig = parsed;
        console.log("✅ naviLoanConfig from localStorage:", naviLoanConfig);
        renderNaviLendersAdminUI();
        return;
      }
    }
  } catch (e) {
    console.warn("loan-config localStorage 로드 실패:", e);
  }

  naviLoanConfig = { version: 1, lenders: [] };
  console.log("ℹ️ loan-config가 없어 기본 구조로 시작:", naviLoanConfig);
  renderNaviLendersAdminUI();
}

// 서버에 loan-config 저장
async function saveNaviLoanConfigToServer() {
  const statusEl = document.getElementById("naviLoanConfigStatus");

  try {
    captureNaviLendersFromAdminForm();
  } catch (e) {
    console.error("admin 폼 데이터 수집 실패:", e);
    if (statusEl) {
      statusEl.textContent = "폼 데이터 수집 중 오류가 발생했습니다.";
    }
    alert("입력값을 다시 확인해주세요.");
    return;
  }

  try {
    const res = await fetch(NAVI_LOAN_CONFIG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(naviLoanConfig),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`loan-config 저장 실패: HTTP ${res.status} ${errText}`);
    }

    const json = await res.json().catch(() => null);
    console.log("✅ loan-config 저장 완료:", json);

    localStorage.setItem(NAVI_LOAN_CONFIG_LOCAL_KEY, JSON.stringify(naviLoanConfig));

    if (statusEl) {
      statusEl.textContent = "온투업 네비게이션 설정이 서버에 저장되었습니다.";
      setTimeout(() => {
        if (statusEl.textContent.includes("저장되었습니다")) {
          statusEl.textContent = "";
        }
      }, 3000);
    }

    alert("네비게이션 설정이 저장되었습니다.");
  } catch (e) {
    console.error("saveNaviLoanConfigToServer error:", e);
    if (statusEl) {
      statusEl.textContent = "서버 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    }
    alert("서버 저장 중 오류가 발생했습니다.");
  }
}

// ------------------------------------------------------
// 상단 MENU 드롭다운
// ------------------------------------------------------
function setupBetaMenu() {
  const toggle = document.getElementById("betaMenuToggle");
  const panel = document.getElementById("betaMenuPanel");
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

  // 관리자 탭
  setupAdminTabs();

  // 네비게이션용 온투업 설정
  setupLenderChipInteractions();
  setupLenderAddDeleteButtons();
  loadNaviLoanConfig();

  const saveBtn = document.getElementById("naviLoanConfigSaveBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      saveNaviLoanConfigToServer();
    });
  }
});
