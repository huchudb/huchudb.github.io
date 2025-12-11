// /assets/navi-beta.js
// 후추 네비게이션 (베타) – UI/로직 스크립트

console.log("✅ navi-beta.js loaded");

// ------------------------------------------------------
// 공통 상수 / 유틸
// ------------------------------------------------------

const NAVI_API_BASE = "https://huchudb-github-io.vercel.app/api";

// 지역, 부동산 유형, 최소 대출금액 규칙
const REGION_LABELS = ["서울", "경기", "인천", "충청", "전라", "경상", "강원", "제주"];
const PROPERTY_TYPES_APT_GROUP = ["아파트", "오피스텔"];
const MIN_LOAN_APT = 10_000_000; // 1,000만
const MIN_LOAN_OTHERS = 30_000_000; // 3,000만

// 숫자 유틸
function stripNonDigits(str) {
  return (str || "").replace(/[^\d]/g, "");
}
function formatWithCommas(value) {
  if (value === null || value === undefined) return "";
  const digits = stripNonDigits(String(value));
  if (!digits) return "";
  // ✅ \B 뒤에 ? 제거
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function parseMoneyInput(inputEl) {
  if (!inputEl) return 0;
  const digits = stripNonDigits(inputEl.value);
  return digits ? Number(digits) : 0;
}
function setupMoneyInputs(root = document) {
  const moneyInputs = root.querySelectorAll('input[data-type="money"]');
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

// 간단한 경고 표시
function showToast(message) {
  alert(message); // 베타: 일단 alert, 나중에 토스트 UI로 교체 가능
}

// ------------------------------------------------------
// 전역 상태
// ------------------------------------------------------

const naviState = {
  stepOrder: ["1", "2", "3", "4", "5", "6", "6-1", "7"],
  currentStep: "1",

  // 기본 선택값
  lenderCategory: "온투업",
  region: null,
  propertyType: null,
  loanType: null,

  // 대출 입력값 (loanType별로 재사용)
  loanInputs: {},

  // 차주 추가정보(6-1)
  extras: {
    income: [],      // data-navi-multi="income"
    creditBand: null,
    term: [],        // data-navi-multi="term"
    timing: [],      // data-navi-multi="timing"
    risk: []         // data-navi-multi="risk"
  },

  // 자동 계산 결과
  calc: {
    effectiveCollateral: 0,
    seniorTotalDisplay: 0,
    debtAfter: 0,
    requestedAmount: 0,
    totalLtv: null
  },

  // 추천 결과
  matchedLenders: []
};

// lendersConfig (관리자에서 설정한 온투업 정보)
let lendersConfig = {
  version: 1,
  lenders: []
};

// ------------------------------------------------------
// STEP 전환 로직
// ------------------------------------------------------

function findStepIndex(stepId) {
  return naviState.stepOrder.indexOf(stepId);
}

function goToStep(stepId) {
  const { stepOrder } = naviState;
  if (!stepOrder.includes(stepId)) return;

  naviState.currentStep = stepId;

  // 패널 표시/숨김
  const panels = document.querySelectorAll(".navi-step-panel");
  panels.forEach((panel) => {
    const panelId = panel.getAttribute("data-step-panel");
    if (panelId === stepId) {
      panel.classList.add("is-active");
      panel.style.display = "";
    } else {
      panel.classList.remove("is-active");
      // 7번은 모달 공용이라 display:none 유지
      if (panelId === "7") {
        panel.style.display = "none";
      }
    }
  });

  // 스텝퍼 표시
  const stepperItems = document.querySelectorAll(".navi-stepper__item");
  stepperItems.forEach((item) => {
    const itemStep = item.getAttribute("data-step");
    if (itemStep === stepId) {
      item.classList.add("is-active");
    } else {
      item.classList.remove("is-active");
    }
  });
}

function goToNextStep() {
  const idx = findStepIndex(naviState.currentStep);
  if (idx < 0) return;

  const current = naviState.currentStep;
  const nextId = naviState.stepOrder[idx + 1];

  // 각 스텝별 사전 검증/후처리
  if (current === "1") {
    // 대출기관: 온투업 고정, 검증 없음
  } else if (current === "2") {
    if (!naviState.region) {
      showToast("지역을 선택해주세요.");
      return;
    }
  } else if (current === "3") {
    if (!naviState.propertyType) {
      showToast("부동산 유형을 선택해주세요.");
      return;
    }
    updateMinAmountHints(); // 부동산 유형에 따라 최소 대출금액 안내 갱신
  } else if (current === "4") {
    if (!naviState.loanType) {
      showToast("대출종류를 선택해주세요.");
      return;
    }
    syncSummaryChips();
    toggleLoanForms();
  } else if (current === "5") {
    // 폼 입력값 수집 + 검증 + 자동 계산
    if (!collectLoanInputs()) return;
    recomputeCalculations();
  } else if (current === "6") {
    // 6 → 6-1은 "추가 정보 입력" 여부 확인
    const wantExtra = confirm("추가 정보를 입력하시겠습니까?\n(입력 시 보다 정확한 온투업체 매칭이 가능합니다.)");
    if (!wantExtra) {
      // 추가정보 없이 바로 결과
      openResultModal();
      return;
    }
  } else if (current === "6-1") {
    // 6-1 → 결과
    openResultModal();
    return;
  }

  if (!nextId) return;
  goToStep(nextId);
}

function goToPrevStep() {
  const idx = findStepIndex(naviState.currentStep);
  if (idx <= 0) return;
  const prevId = naviState.stepOrder[idx - 1];

  // 6-1 이전은 6
  if (naviState.currentStep === "6-1") {
    goToStep("6");
    return;
  }

  goToStep(prevId);
}

// ------------------------------------------------------
// CHIP / INPUT 바인딩
// ------------------------------------------------------

function setupSingleSelectChips() {
  // data-navi-field (단일 선택)
  const singleChips = document.querySelectorAll("[data-navi-field]");
  singleChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const field = chip.getAttribute("data-navi-field");
      const value = chip.getAttribute("data-navi-value");

      // 비활성(대부업 등) 방지
      if (chip.disabled || chip.classList.contains("navi-chip--disabled")) return;

      // 같은 필드 내에서 단일 선택
      const group = document.querySelectorAll(`[data-navi-field="${field}"]`);
      group.forEach((btn) => btn.classList.remove("is-selected"));
      chip.classList.add("is-selected");

      // 상태 저장
      if (field === "lenderCategory") {
        naviState.lenderCategory = value;
      } else if (field === "region") {
        naviState.region = value;
      } else if (field === "propertyType") {
        naviState.propertyType = value;
      } else if (field === "loanType") {
        naviState.loanType = value;
      } else if (field === "creditBand") {
        naviState.extras.creditBand = value;
      }
      syncSummaryChips();
      updateMinAmountHints();
    });
  });
}

function setupMultiSelectChips() {
  // data-navi-multi (복수 선택)
  const multiChips = document.querySelectorAll("[data-navi-multi]");
  multiChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const key = chip.getAttribute("data-navi-multi"); // income / term / timing / risk
      const value = chip.getAttribute("data-navi-value");
      const arr = naviState.extras[key] || [];

      const idx = arr.indexOf(value);
      if (idx >= 0) {
        arr.splice(idx, 1);
        chip.classList.remove("is-selected");
      } else {
        arr.push(value);
        chip.classList.add("is-selected");
      }
      naviState.extras[key] = arr;
    });
  });
}

function syncSummaryChips() {
  const regionEl = document.getElementById("summaryRegion");
  const propEl = document.getElementById("summaryPropertyType");
  const loanEl = document.getElementById("summaryLoanType");

  if (regionEl) regionEl.textContent = `지역: ${naviState.region || "-"}`;
  if (propEl) propEl.textContent = `부동산: ${naviState.propertyType || "-"}`;
  if (loanEl) loanEl.textContent = `대출종류: ${naviState.loanType || "-"}`;
}

// ------------------------------------------------------
// STEP 5: 대출종류별 폼 제어
// ------------------------------------------------------

function toggleLoanForms() {
  const forms = document.querySelectorAll(".navi-loan-form");
  forms.forEach((form) => {
    const type = form.getAttribute("data-loan-form");
    if (type === naviState.loanType) {
      form.style.display = "";
    } else {
      form.style.display = "none";
    }
  });

  // occupancy, hasSeniorLoan 등 조건부 필드도 1차 초기화
  updateConditionalFields();
}

function updateConditionalFields() {
  const allConditional = document.querySelectorAll("[data-conditional]");
  allConditional.forEach((el) => {
    const cond = el.getAttribute("data-conditional"); // e.g. "occupancy=임대중"
    if (!cond) return;
    const [field, expect] = cond.split("=");
    let value = null;

    if (field === "occupancy") {
      // 현재 loanInputs에도 저장되어 있을 수 있으나, CHIP 상태를 먼저 본다
      const sel = document.querySelector('.navi-chip[data-navi-input="occupancy"].is-selected');
      value = sel ? sel.getAttribute("data-navi-value") : null;
    } else if (field === "hasSeniorLoan") {
      const sel = document.querySelector('.navi-chip[data-navi-input="hasSeniorLoan"].is-selected');
      value = sel ? sel.getAttribute("data-navi-value") : null;
    }

    if (value === expect) {
      el.style.display = "";
    } else {
      el.style.display = "none";
    }
  });
}

function setupLoanFormChips() {
  // data-navi-input (loan form용 chip)
  const formChips = document.querySelectorAll("[data-navi-input]");
  formChips.forEach((chip) => {
    const inputKey = chip.getAttribute("data-navi-input");
    const isChip = chip.tagName.toLowerCase() === "button";

    if (!isChip) return;

    chip.addEventListener("click", () => {
      const value = chip.getAttribute("data-navi-value");
      // 같은 data-navi-input 그룹 내 단일 선택
      const group = document.querySelectorAll(`[data-navi-input="${inputKey}"]`);
      group.forEach((btn) => btn.classList.remove("is-selected"));
      chip.classList.add("is-selected");

      if (!naviState.loanInputs[naviState.loanType]) {
        naviState.loanInputs[naviState.loanType] = {};
      }
      naviState.loanInputs[naviState.loanType][inputKey] = value;

      updateConditionalFields();
    });
  });
}

// STEP 3: 부동산 유형에 따른 최소 대출금액 안내 문구 갱신
function updateMinAmountHints() {
  const propertyType = naviState.propertyType;
  if (!propertyType) return;

  const minAmount =
    PROPERTY_TYPES_APT_GROUP.includes(propertyType) ? MIN_LOAN_APT : MIN_LOAN_OTHERS;

  const hintEls = document.querySelectorAll("[data-min-amount-hint]");
  hintEls.forEach((el) => {
    el.textContent = `최소 대출금액은 ${formatWithCommas(minAmount)}원 이상입니다.`;
  });
}

// ------------------------------------------------------
// STEP 5: 입력값 수집 & 검증
// ------------------------------------------------------

function collectLoanInputs() {
  const loanType = naviState.loanType;
  if (!loanType) {
    showToast("대출종류를 먼저 선택해주세요.");
    return false;
  }

  const form = document.querySelector(`.navi-loan-form[data-loan-form="${loanType}"]`);
  if (!form) {
    showToast("선택한 대출종류에 대한 입력폼을 찾을 수 없습니다.");
    return false;
  }

  const inputs = naviState.loanInputs[loanType] || {};
  const moneyInputs = form.querySelectorAll('input[data-type="money"][data-navi-input]');
  moneyInputs.forEach((input) => {
    const key = input.getAttribute("data-navi-input");
    inputs[key] = parseMoneyInput(input);
  });

  const numberInputs = form.querySelectorAll('input[type="number"][data-navi-input]');
  numberInputs.forEach((input) => {
    const key = input.getAttribute("data-navi-input");
    const v = input.value !== "" ? Number(input.value) : null;
    inputs[key] = v;
  });

  // chip 기반 필드(occupancy, hasSeniorLoan 등)는 이미 naviState.loanInputs에 들어있지 않을 수 있으니 다시 수집
  const chipKeys = ["occupancy", "hasSeniorLoan"];
  chipKeys.forEach((key) => {
    const sel = form.querySelector(`.navi-chip[data-navi-input="${key}"].is-selected`);
    if (sel) {
      inputs[key] = sel.getAttribute("data-navi-value");
    }
  });

  naviState.loanInputs[loanType] = inputs;

  // 공통 검증: 시세, 필요대출금액 등
  const { propertyType } = naviState;
  const minAmount =
    PROPERTY_TYPES_APT_GROUP.includes(propertyType) ? MIN_LOAN_APT : MIN_LOAN_OTHERS;

  const requested = inputs.requestedAmount || 0;
  if (!requested || requested < minAmount) {
    showToast(
      `필요 대출금액이 최소 기준보다 작습니다.\n최소 대출금액은 ${formatWithCommas(
        minAmount
      )}원 이상입니다.`
    );
    return false;
  }

  // 임대보증금반환대출: 필요금액 < 보증금액 경고
  if (loanType === "임대보증금반환대출") {
    const deposit = inputs.depositAmount || 0;
    const warnEl = form.querySelector('[data-warning="deposit-lower"]');
    if (warnEl) {
      if (deposit && requested < deposit) {
        warnEl.style.display = "";
      } else {
        warnEl.style.display = "none";
      }
    }
  }

  // 대환대출: 필요금액 < 상환금액 경고
  if (loanType === "대환대출") {
    const payoff = inputs.refinancePayoffAmount || 0;
    const warnEl = form.querySelector('[data-warning="refinance-lower"]');
    if (warnEl) {
      if (payoff && requested < payoff) {
        warnEl.style.display = "";
      } else {
        warnEl.style.display = "none";
      }
    }
  }

  return true;
}

// ------------------------------------------------------
// STEP 6: 자동 계산 로직
// ------------------------------------------------------

function recomputeCalculations() {
  const loanType = naviState.loanType;
  const propertyType = naviState.propertyType;
  if (!loanType || !propertyType) return;

  const inputs = naviState.loanInputs[loanType] || {};

  const marketPrice = inputs.marketPrice || 0;
  const requestedAmount = inputs.requestedAmount || 0;
  const depositAmount = inputs.depositAmount || 0;
  const seniorLoanAmount = inputs.seniorLoanAmount || 0;
  const seniorDepositAmount = inputs.seniorDepositAmount || 0;
  const shareRatio = inputs.shareRatio || null;
  const occupancy = inputs.occupancy || null;
  const hasSeniorLoan = inputs.hasSeniorLoan || null;
  const refinancePayoffAmount = inputs.refinancePayoffAmount || 0;

  // 1) 담보인정 시세
  let effectiveCollateral = marketPrice;
  if (loanType === "지분대출" && shareRatio) {
    effectiveCollateral = Math.round(marketPrice * (shareRatio / 100));
  }

  // 2) 선순위 + 임대보증금 합계 (표시용)
  let seniorTotalDisplay = 0;
  if (loanType === "일반담보대출") {
    if (occupancy === "임대중") {
      seniorTotalDisplay = seniorLoanAmount + depositAmount;
    } else {
      seniorTotalDisplay = seniorLoanAmount;
    }
  } else if (loanType === "임대보증금반환대출") {
    if (hasSeniorLoan === "yes") {
      seniorTotalDisplay = seniorLoanAmount + depositAmount;
    } else {
      seniorTotalDisplay = depositAmount;
    }
  } else if (loanType === "지분대출") {
    if (occupancy === "임대중") {
      seniorTotalDisplay = seniorLoanAmount + depositAmount;
    } else {
      seniorTotalDisplay = seniorLoanAmount;
    }
  } else if (loanType === "경락잔금대출") {
    seniorTotalDisplay = seniorLoanAmount;
  } else if (loanType === "대환대출") {
    const existingTotal =
      seniorLoanAmount + (occupancy === "임대중" ? seniorDepositAmount : 0);
    seniorTotalDisplay = existingTotal;
  }

  // 3) LTV 계산용 최종 부채 (대출 실행 후)
  let debtAfter = 0;

  if (loanType === "임대보증금반환대출") {
    // 보증금 의무 → 새 대출로 대체된다고 보고
    const seniorAfter = hasSeniorLoan === "yes" ? seniorLoanAmount : 0;
    debtAfter = seniorAfter + requestedAmount;
  } else if (loanType === "대환대출") {
    // 기존 선순위/보증 중 일부를 상환하고 새 대출로 대체
    const existingTotal =
      seniorLoanAmount + (occupancy === "임대중" ? seniorDepositAmount : 0);
    debtAfter = existingTotal - refinancePayoffAmount + requestedAmount;
  } else {
    // 나머지: 단순 합
    debtAfter = seniorTotalDisplay + requestedAmount;
  }

  let totalLtv = null;
  if (effectiveCollateral > 0) {
    totalLtv = debtAfter / effectiveCollateral;
  }

  naviState.calc = {
    effectiveCollateral,
    seniorTotalDisplay,
    debtAfter,
    requestedAmount,
    totalLtv
  };

  // UI 반영
  const effEl = document.getElementById("calcEffectiveCollateral");
  const seniorEl = document.getElementById("calcSeniorTotal");
  const reqEl = document.getElementById("calcRequestedAmount");
  const ltvEl = document.getElementById("calcTotalLtv");

  if (effEl) effEl.textContent = effectiveCollateral ? `${formatWithCommas(effectiveCollateral)}원` : "-";
  if (seniorEl) seniorEl.textContent = seniorTotalDisplay ? `${formatWithCommas(seniorTotalDisplay)}원` : "-";
  if (reqEl) reqEl.textContent = requestedAmount ? `${formatWithCommas(requestedAmount)}원` : "-";
  if (ltvEl) {
    if (totalLtv != null && isFinite(totalLtv)) {
      ltvEl.textContent = `${(totalLtv * 100).toFixed(1)}%`;
    } else {
      ltvEl.textContent = "-";
    }
  }
}

// ------------------------------------------------------
// lendersConfig 불러오기 + 매칭 로직
// ------------------------------------------------------

async function loadLendersConfig() {
  // 1) 서버에서 시도
  try {
    const res = await fetch(`${NAVI_API_BASE}/lenders-config`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.lenders)) {
        lendersConfig = json;
        console.log("✅ lendersConfig from API:", lendersConfig);
        return;
      }
    }
  } catch (e) {
    console.warn("lenders-config API 불러오기 실패, localStorage로 대체:", e);
  }

  // 2) localStorage fallback
  try {
    const raw = localStorage.getItem("huchu_lenders_config_beta");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.lenders)) {
        lendersConfig = parsed;
        console.log("✅ lendersConfig from localStorage:", lendersConfig);
        return;
      }
    }
  } catch (e) {
    console.warn("lenders-config localStorage 로드 실패:", e);
  }

  console.warn("⚠️ lendersConfig 데이터를 찾을 수 없습니다. (테스트용 빈 배열 사용)");
  lendersConfig = { version: 1, lenders: [] };
}

function matchLenders() {
  const { lenders } = lendersConfig;
  const {
    lenderCategory,
    region,
    propertyType,
    loanType,
    calc,
    loanInputs,
    extras
  } = naviState;

  const results = [];
  if (!lenderCategory || !region || !propertyType || !loanType) {
    return results;
  }

  const loanData = loanInputs[loanType] || {};
  const minAmount =
    PROPERTY_TYPES_APT_GROUP.includes(propertyType) ? MIN_LOAN_APT : MIN_LOAN_OTHERS;
  const requestedAmount = loanData.requestedAmount || 0;
  const totalLtv = calc.totalLtv;

  lenders.forEach((lender) => {
    if (!lender.isActive) return;
    if (lenderCategory !== "온투업") return;

    const reCfg = lender.realEstateConfig || {};
    const regions = reCfg.regions || [];
    const props = reCfg.propertyTypes || [];
    const loanTypes = reCfg.loanTypes || [];
    const minLoanByProperty = reCfg.minLoanByProperty || {};
    const maxTotalLtv = typeof reCfg.maxTotalLtv === "number" ? reCfg.maxTotalLtv : null;

    // 1) 부동산 담보대출 취급 여부
    if (!loanTypes.includes(loanType)) return;

    // 2) 지역 필터 (전국 포함 or 해당 지역)
    if (regions.length > 0 && !regions.includes("전국") && !regions.includes(region)) {
      return;
    }

    // 3) 부동산 유형 필터
    if (props.length > 0 && !props.includes(propertyType)) {
      return;
    }

    // 4) 최소 대출금액 (업체별 값 > 기본값이면 그 값을 사용)
    let lenderMinLoan = minAmount;
    if (minLoanByProperty[propertyType]) {
      lenderMinLoan = Math.max(lenderMinLoan, Number(minLoanByProperty[propertyType]));
    }
    if (requestedAmount < lenderMinLoan) {
      return;
    }

    // 5) LTV 기준
    if (maxTotalLtv != null && totalLtv != null && isFinite(totalLtv)) {
      if (totalLtv > maxTotalLtv) {
        return;
      }
    }

    // 6) 차주 추가정보(extras) 매칭은 베타에선 "강한 필터"로 쓰지 않고,
    //    score(가중치 용도) 정도로만 사용 가능하도록 남겨둔다.
    let score = 0;
    if (extras.creditBand && Array.isArray(lender.allowedCreditBands)) {
      if (lender.allowedCreditBands.includes(extras.creditBand)) {
        score += 1;
      } else {
        // 허용 크레딧 밴드가 있는데 안맞으면 점수 낮게
        score -= 1;
      }
    }

    results.push({
      lender,
      score,
      isPartner: !!lender.isPartner,
      isNewLoanActive: lender.isNewLoanActive !== false
    });
  });

  // 정렬: 제휴업체 우선 → score desc → displayOrder asc → 이름
  results.sort((a, b) => {
    if (a.isPartner !== b.isPartner) return a.isPartner ? -1 : 1;
    if (a.score !== b.score) return b.score - a.score;

    const orderA =
      typeof a.lender.displayOrder === "number" ? a.lender.displayOrder : 999;
    const orderB =
      typeof b.lender.displayOrder === "number" ? b.lender.displayOrder : 999;
    if (orderA !== orderB) return orderA - orderB;

    return (a.lender.displayName || "").localeCompare(b.lender.displayName || "");
  });

  return results;
}

// ------------------------------------------------------
// 결과 모달 렌더링 + 로그 저장
// ------------------------------------------------------

function openResultModal() {
  // 추천 매칭
  const matched = matchLenders();
  naviState.matchedLenders = matched;

  // 상단 요약
  const regionEl = document.getElementById("resultRegion");
  const propEl = document.getElementById("resultPropertyType");
  const loanEl = document.getElementById("resultLoanType");
  const reqEl = document.getElementById("resultRequestedAmount");

  if (regionEl) regionEl.textContent = naviState.region || "-";
  if (propEl) propEl.textContent = naviState.propertyType || "-";
  if (loanEl) loanEl.textContent = naviState.loanType || "-";

  const loanData = naviState.loanInputs[naviState.loanType] || {};
  const requestedAmount = loanData.requestedAmount || 0;
  if (reqEl) {
    reqEl.textContent = requestedAmount ? `${formatWithCommas(requestedAmount)}원` : "-";
  }

  // 추천 리스트 렌더링
  const listWrap = document.getElementById("naviRecommendedList");
  const noMatchPanel = document.getElementById("naviNoMatchPanel");
  const helper = document.getElementById("naviResultHelperText");

  if (listWrap) listWrap.innerHTML = "";

  if (!matched.length) {
    if (listWrap) listWrap.style.display = "none";
    if (noMatchPanel) noMatchPanel.style.display = "";
    if (helper)
      helper.textContent =
        "입력하신 조건과 관리자에 등록된 기준을 바탕으로, 현재 추천 가능한 온투업체가 없습니다.";
  } else {
    if (listWrap) listWrap.style.display = "";
    if (noMatchPanel) noMatchPanel.style.display = "none";

    const partnerCount = matched.filter((m) => m.isPartner).length;
    const totalCount = matched.length;

    if (helper) {
      helper.textContent = `총 ${totalCount}개 온투업체가 조건에 부합합니다. (제휴 ${partnerCount} / 비제휴 ${
        totalCount - partnerCount
      })`;
    }

    matched.forEach(({ lender, isPartner, isNewLoanActive }) => {
      const card = document.createElement("div");
      card.className = "navi-lender-card";

      const header = document.createElement("div");
      header.className = "navi-lender-card__header";

      const nameEl = document.createElement("span");
      nameEl.className = "navi-lender-name";
      nameEl.textContent = lender.displayName || lender.lenderId || "온투업체";

      header.appendChild(nameEl);

      if (isPartner) {
        const partnerBadge = document.createElement("span");
        partnerBadge.className = "navi-lender-badge navi-lender-badge--partner";
        partnerBadge.textContent = "제휴 온투업체";
        header.appendChild(partnerBadge);
      }

      if (!isNewLoanActive) {
        const pausedBadge = document.createElement("span");
        pausedBadge.className = "navi-lender-badge navi-lender-badge--paused";
        pausedBadge.textContent = "신규대출 중단";
        header.appendChild(pausedBadge);
      }

      const body = document.createElement("div");
      body.className = "navi-lender-card__body";

      const reCfg = lender.realEstateConfig || {};
      const regions = reCfg.regions || [];
      const props = reCfg.propertyTypes || [];
      const loanTypes = reCfg.loanTypes || [];

      const metaLines = [];
      if (loanTypes.length) {
        metaLines.push(`취급 대출유형: ${loanTypes.join(", ")}`);
      }
      if (regions.length) {
        metaLines.push(`취급 지역: ${regions.join(", ")}`);
      }
      if (props.length) {
        metaLines.push(`취급 부동산: ${props.join(", ")}`);
      }

      const metaP = document.createElement("p");
      metaP.className = "navi-lender-meta";
      metaP.textContent = metaLines.join(" / ") || "등록된 상세조건이 없습니다.";
      body.appendChild(metaP);

      const footer = document.createElement("div");
      footer.className = "navi-lender-card__footer";

      const channels = lender.channels || {};
      const hasPhone = !!channels.phoneNumber;
      const hasKakao = !!channels.kakaoUrl;

      if (hasPhone) {
        const phoneBtn = document.createElement("a");
        phoneBtn.className = "navi-btn navi-btn--outline";
        phoneBtn.href = `tel:${channels.phoneNumber.replace(/-/g, "")}`;
        phoneBtn.textContent = "유선상담";
        footer.appendChild(phoneBtn);
      }

      if (hasKakao) {
        const kakaoBtn = document.createElement("a");
        kakaoBtn.className = "navi-btn navi-btn--kakao";
        kakaoBtn.href = channels.kakaoUrl;
        kakaoBtn.target = "_blank";
        kakaoBtn.rel = "noopener noreferrer";
        kakaoBtn.textContent = "카카오톡 상담";
        footer.appendChild(kakaoBtn);
      }

      if (!hasPhone && !hasKakao) {
        const info = document.createElement("span");
        info.className = "navi-lender-contact-hint";
        info.textContent = "등록된 상담 채널이 없습니다.";
        footer.appendChild(info);
      }

      card.appendChild(header);
      card.appendChild(body);
      card.appendChild(footer);

      if (listWrap) listWrap.appendChild(card);
    });
  }

  // 사용 로그 전송 (실패해도 무시)
  sendNavigationLog().catch((e) =>
    console.warn("navi log 전송 실패(무시):", e)
  );

  // 모달 열기
  const modal = document.getElementById("naviResultModal");
  if (modal) {
    modal.classList.remove("navi-modal--hidden");
    modal.setAttribute("aria-hidden", "false");
  }
}

function closeResultModal() {
  const modal = document.getElementById("naviResultModal");
  if (modal) {
    modal.classList.add("navi-modal--hidden");
    modal.setAttribute("aria-hidden", "true");
  }
}

// 조건 조정하기: 결과 닫고 5번으로 회귀 (입력값 유지)
function adjustConditions() {
  closeResultModal();
  goToStep("5");
}

// 네비 사용 로그 전송
async function sendNavigationLog() {
  try {
    const payload = {
      ts: new Date().toISOString(),
      region: naviState.region,
      propertyType: naviState.propertyType,
      loanType: naviState.loanType,
      calc: naviState.calc,
      extras: naviState.extras,
      matchedLenders: (naviState.matchedLenders || []).map((m) => ({
        lenderId: m.lender.lenderId,
        isPartner: m.isPartner
      }))
    };

    await fetch(`${NAVI_API_BASE}/navi-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    // 베타: 실패해도 조용히 무시
    console.warn("navi-log error:", e);
  }
}

// ------------------------------------------------------
// 결과 이미지 저장/공유 (html2canvas)
// ------------------------------------------------------

async function captureResultAsImage() {
  const captureArea = document.getElementById("naviResultCaptureArea");
  if (!captureArea) {
    showToast("결과 영역을 찾을 수 없습니다.");
    return;
  }

  if (typeof window.html2canvas !== "function") {
    showToast(
      "이미지 저장 기능을 사용하려면 html2canvas 스크립트가 필요합니다.\n(\n예: https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js\n)"
    );
    return;
  }

  try {
    const canvas = await window.html2canvas(captureArea, {
      scale: 2
    });
    canvas.toBlob((blob) => {
      if (!blob) {
        showToast("이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const now = new Date();
      const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
      ].join("");
      a.href = url;
      a.download = `huchu-navi-result-${stamp}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  } catch (e) {
    console.error("captureResultAsImage error:", e);
    showToast("이미지 저장 중 오류가 발생했습니다.");
  }
}

// ------------------------------------------------------
// 상단 MENU (기존 베타와 동일)
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

document.addEventListener("DOMContentLoaded", async () => {
  setupBetaMenu();
  setupMoneyInputs(document);

  // 네비 전용 바인딩
  setupSingleSelectChips();
  setupMultiSelectChips();
  setupLoanFormChips();

  // Next / Prev 버튼
  const nextButtons = document.querySelectorAll("[data-navi-next]");
  nextButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      goToNextStep();
    });
  });

  const prevButtons = document.querySelectorAll("[data-navi-prev]");
  prevButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      goToPrevStep();
    });
  });

  // 결과 모달 닫기
  const closeModalBtns = document.querySelectorAll("[data-navi-close-modal]");
  closeModalBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      closeResultModal();
    });
  });

  // 조건 조정하기
  const adjustBtn = document.querySelector("[data-navi-adjust-conditions]");
  if (adjustBtn) {
    adjustBtn.addEventListener("click", () => {
      adjustConditions();
    });
  }

  // 결과 이미지 저장/공유
  const shareBtn = document.getElementById("naviShareImageBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      captureResultAsImage();
    });
  }

  // 초기 요약 반영
  syncSummaryChips();
  updateMinAmountHints();

  // lendersConfig 로딩
  await loadLendersConfig();
});
