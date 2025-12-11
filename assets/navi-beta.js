// /assets/navi-beta.js  (후추 네비게이션 – 베타용)

// ------------------------------------------------------
// 공통 상수 / 유틸
// ------------------------------------------------------

const API_BASE = "https://huchudb-github-io.vercel.app";
const NAVI_LOAN_CONFIG_ENDPOINT = `${API_BASE}/api/loan-config`;
const NAVI_LOAN_CONFIG_LOCAL_KEY = "huchu_navi_loan_config_v1";

// 숫자 유틸
function stripNonDigits(str) {
  return (str || "").replace(/[^\d]/g, "");
}
function formatWithCommas(str) {
  const digits = stripNonDigits(str);
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function getMoneyValueById(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const digits = stripNonDigits(el.value);
  return digits ? Number(digits) : 0;
}
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

// chip helpers
function singleSelectChip(container, target) {
  const chips = container.querySelectorAll(".navi-chip");
  chips.forEach((c) => c.classList.remove("is-selected"));
  target.classList.add("is-selected");
}
function toggleChip(target) {
  target.classList.toggle("is-selected");
}

// 상단 MENU
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
// 네비게이션 상태
// ------------------------------------------------------

let naviLoanConfig = {
  version: 1,
  lenders: [],
};

const userState = {
  mainCategory: null, // 부동산담보대출, 개인신용대출 ...
  region: null,
  propertyType: null,
  realEstateLoanType: null, // 일반담보대출, 임대보증금반환대출, ...
  occupancy: null, // self | rental
  // 핵심 숫자 입력
  propertyValue: 0,
  sharePercent: 100,
  seniorLoan: 0,
  deposit: 0,
  refinanceAmount: 0,
  requestedAmount: 0,
  // 추가 정보
  extra: {
    incomeType: null,
    creditBand: null,
    repayPlan: null,
    needTiming: null,
    others: [], // 세금체납, 연체기록, ...
  },
};

// ------------------------------------------------------
// loan-config 불러오기
// ------------------------------------------------------

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
        console.log("✅ loan-config from API:", naviLoanConfig);
        return;
      }
    } else {
      console.warn("loan-config GET 실패:", res.status, await res.text().catch(() => ""));
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
        console.log("✅ loan-config from localStorage:", naviLoanConfig);
        return;
      }
    }
  } catch (e) {
    console.warn("loan-config localStorage 로드 실패:", e);
  }

  console.log("ℹ️ loan-config 없음, 빈 구조로 시작");
  naviLoanConfig = { version: 1, lenders: [] };
}

// ------------------------------------------------------
// UI 이벤트 바인딩
// ------------------------------------------------------

function setupStep1() {
  const container = document.getElementById("naviLoanCategoryChips");
  if (!container) return;
  container.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("navi-chip")) return;

    singleSelectChip(container, target);
    userState.mainCategory = target.getAttribute("data-main-cat");

    // 부동산담보대출이 아닐 경우, 3·4·5단계 일부 선택은 옵션
    recalcAndUpdateSummary();
  });
}

function setupStep2() {
  const container = document.getElementById("naviRegionChips");
  if (!container) return;
  container.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("navi-chip")) return;

    singleSelectChip(container, target);
    userState.region = target.getAttribute("data-region");
    recalcAndUpdateSummary();
  });
}

function setupStep3() {
  const container = document.getElementById("naviPropertyTypeChips");
  if (!container) return;
  container.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("navi-chip")) return;

    singleSelectChip(container, target);
    userState.propertyType = target.getAttribute("data-prop");
    recalcAndUpdateSummary();
  });
}

function setupStep4() {
  const container = document.getElementById("naviRealEstateLoanTypeChips");
  const helpEl = document.getElementById("naviLoanTypeHelp");
  if (!container) return;

  const helpTexts = {
    일반담보대출: "시세·선순위대출·임대보증금·필요대출금액을 합산해 LTV를 계산합니다.",
    임대보증금반환대출:
      "기존 임대보증금을 반환하기 위한 대출입니다. 임대보증금 + 선순위 + 필요대출금액 기준으로 LTV를 계산합니다.",
    지분대출: "지분율만큼 시세를 반영하여 LTV를 계산합니다. (예: 시세 5억, 지분 50% → 2.5억 기준)",
    경락잔금대출:
      "낙찰가(또는 감정가)와 선순위·필요대출금액을 기준으로 잔금대출 LTV를 계산합니다.",
    대환대출:
      "선순위 대출/보증금 중 상환 예정금액 + 신규 필요대출금액을 합산하여 대환 후 LTV를 계산합니다.",
  };

  container.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("navi-chip")) return;

    singleSelectChip(container, target);
    const loanType = target.getAttribute("data-loan-type");
    userState.realEstateLoanType = loanType;

    if (helpEl && loanType && helpTexts[loanType]) {
      helpEl.textContent = "※ " + helpTexts[loanType];
    }

    recalcAndUpdateSummary();
  });
}

function setupStep5() {
  const amountWarningEl = document.getElementById("naviAmountWarning");
  const occContainer = document.getElementById("naviOccupancyChips");

  ["naviInputPropertyValue", "naviInputSharePercent", "naviInputSeniorLoan", "naviInputDeposit", "naviInputRefinanceAmount", "naviInputRequestedAmount"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", () => {
        // 금액 포맷은 setupMoneyInputs에서 처리
        recalcAndUpdateSummary();
      });
    }
  );

  if (occContainer) {
    occContainer.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("navi-chip")) return;

      singleSelectChip(occContainer, target);
      userState.occupancy = target.getAttribute("data-occ");
      recalcAndUpdateSummary();
    });
  }

  // 최소 대출금액 안내는 recalc 안에서 갱신
  if (amountWarningEl) {
    amountWarningEl.style.display = "none";
  }
}

function setupStep6Extra() {
  // 소득유형 (단일 선택)
  const incomeContainer = document.getElementById("naviExtraIncomeType");
  if (incomeContainer) {
    incomeContainer.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("navi-chip")) return;
      singleSelectChip(incomeContainer, target);
      userState.extra.incomeType = target.getAttribute("data-income");
      recalcAndUpdateSummary(true);
    });
  }

  // 신용점수 구간 (단일 선택)
  const creditContainer = document.getElementById("naviExtraCreditBand");
  if (creditContainer) {
    creditContainer.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("navi-chip")) return;
      singleSelectChip(creditContainer, target);
      userState.extra.creditBand = target.getAttribute("data-credit");
      recalcAndUpdateSummary(true);
    });
  }

  // 상환계획 (단일 선택)
  const repayContainer = document.getElementById("naviExtraRepayPlan");
  if (repayContainer) {
    repayContainer.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("navi-chip")) return;
      singleSelectChip(repayContainer, target);
      userState.extra.repayPlan = target.getAttribute("data-repay");
      recalcAndUpdateSummary(true);
    });
  }

  // 대출금 필요시기 (단일 선택)
  const needContainer = document.getElementById("naviExtraNeedTiming");
  if (needContainer) {
    needContainer.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("navi-chip")) return;
      singleSelectChip(needContainer, target);
      userState.extra.needTiming = target.getAttribute("data-need");
      recalcAndUpdateSummary(true);
    });
  }

  // 기타사항 (복수 선택)
  const othersContainer = document.getElementById("naviExtraOthers");
  if (othersContainer) {
    othersContainer.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("navi-chip")) return;

      toggleChip(target);
      const val = target.getAttribute("data-etc");
      if (!val) return;

      const arr = userState.extra.others || [];
      const idx = arr.indexOf(val);
      if (target.classList.contains("is-selected")) {
        if (idx === -1) arr.push(val);
      } else {
        if (idx !== -1) arr.splice(idx, 1);
      }
      userState.extra.others = arr;
      recalcAndUpdateSummary(true);
    });
  }
}

// 버튼들
function setupResultButtons() {
  const recalcBtn = document.getElementById("naviRecalcBtn");
  if (recalcBtn) {
    recalcBtn.addEventListener("click", () => {
      recalcAndUpdateSummary();
    });
  }

  const showBtn = document.getElementById("naviShowResultBtn");
  if (showBtn) {
    showBtn.addEventListener("click", () => {
      renderFinalResult();
    });
  }

  const adjustBtn = document.getElementById("naviAdjustConditionBtn");
  if (adjustBtn) {
    adjustBtn.addEventListener("click", () => {
      // 스크롤을 상단 입력 영역으로
      const target = document.getElementById("navi-step1");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  const captureBtn = document.getElementById("naviCaptureBtn");
  if (captureBtn) {
    captureBtn.addEventListener("click", async () => {
      const panel = document.getElementById("naviResultWrapper");
      if (!panel || typeof html2canvas === "undefined") {
        alert("이미지 저장 기능을 사용할 수 없습니다. 브라우저의 캡처 기능을 이용해주세요.");
        return;
      }
      try {
        const canvas = await html2canvas(panel, {
          backgroundColor: "#ffffff",
          scale: window.devicePixelRatio || 2,
        });
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "huchu-navi-result.png";
        link.click();
      } catch (e) {
        console.error("capture error:", e);
        alert("이미지 생성 중 오류가 발생했습니다. 브라우저 캡처 기능을 이용해주세요.");
      }
    });
  }
}

// ------------------------------------------------------
// 필터링 / 계산 로직
// ------------------------------------------------------

// 입력값을 userState에 반영
function syncInputsToState() {
  userState.propertyValue = getMoneyValueById("naviInputPropertyValue");
  const shareEl = document.getElementById("naviInputSharePercent");
  userState.sharePercent =
    shareEl && shareEl.value !== "" ? Number(shareEl.value) : 100;

  userState.seniorLoan = getMoneyValueById("naviInputSeniorLoan");
  userState.deposit = getMoneyValueById("naviInputDeposit");
  userState.refinanceAmount = getMoneyValueById("naviInputRefinanceAmount");
  userState.requestedAmount = getMoneyValueById("naviInputRequestedAmount");
}

// LTV 계산
function calcLtv() {
  const {
    propertyValue,
    sharePercent,
    seniorLoan,
    deposit,
    refinanceAmount,
    requestedAmount,
    realEstateLoanType,
  } = userState;

  if (!propertyValue || !requestedAmount) {
    return { ltv: null, totalDebtAfter: null, baseValue: null };
  }

  const ratio = sharePercent && sharePercent > 0 ? sharePercent / 100 : 1;
  const baseValue = propertyValue * ratio;

  let totalDebtAfter = 0;

  const seniorPlusDeposit = seniorLoan + deposit;

  if (!realEstateLoanType || realEstateLoanType === "일반담보대출") {
    totalDebtAfter = seniorPlusDeposit + requestedAmount;
  } else if (realEstateLoanType === "임대보증금반환대출") {
    totalDebtAfter = seniorPlusDeposit + requestedAmount;
  } else if (realEstateLoanType === "지분대출") {
    totalDebtAfter = seniorPlusDeposit + requestedAmount;
  } else if (realEstateLoanType === "경락잔금대출") {
    totalDebtAfter = seniorLoan + requestedAmount;
  } else if (realEstateLoanType === "대환대출") {
    const remaining = seniorPlusDeposit - refinanceAmount;
    totalDebtAfter = (remaining > 0 ? remaining : 0) + requestedAmount;
  }

  if (!baseValue) {
    return { ltv: null, totalDebtAfter, baseValue };
  }

  const ltv = totalDebtAfter / baseValue;
  return { ltv, totalDebtAfter, baseValue };
}

// 최소 대출금액 체크 (사용자 규칙 + 개별 온투업 최소금액은 필터에서 추가)
function checkGlobalMinAmount() {
  const warningEl = document.getElementById("naviAmountWarning");
  if (!warningEl) return;

  const amt = userState.requestedAmount;
  if (!amt) {
    warningEl.style.display = "none";
    warningEl.textContent = "";
    return;
  }

  const prop = userState.propertyType;
  if (!prop) {
    warningEl.style.display = "none";
    warningEl.textContent = "";
    return;
  }

  const isAptOrOfficetel = prop === "아파트" || prop === "오피스텔";

  const minByUserRule = isAptOrOfficetel ? 10000000 : 30000000; // 1,000만 / 3,000만
  if (amt < minByUserRule) {
    warningEl.style.display = "block";
    const txt = isAptOrOfficetel
      ? "주의: 아파트/오피스텔은 최소 대출금액 1,000만원 이상부터 가능합니다."
      : "주의: 해당 부동산 유형은 최소 대출금액 3,000만원 이상부터 가능합니다.";
    warningEl.textContent = txt;
  } else {
    warningEl.style.display = "none";
    warningEl.textContent = "";
  }
}

// 온투업 리스트 필터링 (추가조건 미적용 / 적용 두 케이스 모두 사용)
function filterLenders(applyExtras = false) {
  const lenders = naviLoanConfig.lenders || [];
  if (!lenders.length) return [];

  const {
    mainCategory,
    region,
    propertyType,
    realEstateLoanType,
    requestedAmount,
    extra,
  } = userState;

  // 공유 계산 먼저
  const { ltv } = calcLtv();

  const filtered = lenders.filter((l) => {
    if (!l.isActive) return false;
    if (l.isNewLoanActive === false) return false;

    // 상품군 매칭
    if (mainCategory) {
      const cats = l.loanCategories || [];
      if (!cats.includes(mainCategory)) return false;
    }

    // 부동산담보대출인 경우 추가 조건
    if (mainCategory === "부동산담보대출") {
      const cfg = l.realEstateConfig || {};

      // 지역
      if (region) {
        const rgs = cfg.regions || [];
        if (!rgs.includes("전국") && !rgs.includes(region)) return false;
      }

      // 부동산 유형
      if (propertyType) {
        const props = cfg.propertyTypes || [];
        if (!props.includes(propertyType)) return false;
      }

      // 대출종류
      if (realEstateLoanType) {
        const types = cfg.loanTypes || [];
        if (!types.includes(realEstateLoanType)) return false;
      }

      // 최소 대출금액 (온투업별)
      if (requestedAmount) {
        const minMap = cfg.minLoanByProperty || {};
        const aptMin = minMap["아파트"] ?? 0;
        const otherMin = minMap["_기타"] ?? 0;
        const isApt = propertyType === "아파트";
        const lenderMin = isApt ? aptMin : otherMin;
        if (lenderMin && requestedAmount < lenderMin) return false;
      }

      // LTV 한도
      if (typeof cfg.maxTotalLtv === "number" && cfg.maxTotalLtv > 0) {
        if (ltv != null && ltv > cfg.maxTotalLtv + 1e-6) {
          return false;
        }
      }
    }

    // 추가조건 필터링
    if (applyExtras) {
      // 신용 구간
      if (extra.creditBand) {
        const bands = l.allowedCreditBands || [];
        if (bands.length && !bands.includes(extra.creditBand)) return false;
      }

      // 기타사항: 세금체납/연체/압류/개인회생 등
      if (extra.others && extra.others.length) {
        const blocked = l.blockedFlags || {};
        for (const tag of extra.others) {
          if (tag === "세금체납" && blocked["taxArrears"]) return false;
          if (tag === "연체기록" && blocked["delinquency"]) return false;
          if (tag === "압류·가압류" && blocked["seizure"]) return false;
          if (tag === "개인회생" && blocked["bankruptcy"]) return false;
        }
      }
    }

    return true;
  });

  // 정렬: 제휴업체 우선 → displayOrder → 이름
  filtered.sort((a, b) => {
    if (a.isPartner && !b.isPartner) return -1;
    if (!a.isPartner && b.isPartner) return 1;

    const ao = typeof a.displayOrder === "number" ? a.displayOrder : 9999;
    const bo = typeof b.displayOrder === "number" ? b.displayOrder : 9999;
    if (ao !== bo) return ao - bo;

    const an = a.displayName || "";
    const bn = b.displayName || "";
    return an.localeCompare(bn, "ko");
  });

  return filtered;
}

// ------------------------------------------------------
// 계산 결과 요약 / 카운트 업데이트
// ------------------------------------------------------

function recalcAndUpdateSummary(onlyExtra = false) {
  syncInputsToState();
  checkGlobalMinAmount();

  const calcTextEl = document.getElementById("naviCalcSummaryText");
  const calcSubEl = document.getElementById("naviCalcSubText");
  const countInfoEl = document.getElementById("naviCalcCountInfo");
  const extraCountEl = document.getElementById("naviExtraCountInfo");
  const resultSummaryEl = document.getElementById("naviResultSummary");

  if (!calcTextEl || !calcSubEl || !resultSummaryEl) return;

  const { mainCategory, propertyType, realEstateLoanType } = userState;

  if (!mainCategory) {
    calcTextEl.textContent =
      "대출 상품군이 선택되지 않았습니다. 1단계에서 먼저 대출 상품군을 선택해주세요.";
    calcSubEl.textContent = "";
    if (countInfoEl) countInfoEl.style.display = "none";
    if (extraCountEl) extraCountEl.style.display = "none";
    resultSummaryEl.textContent =
      "상품군, 지역, 대출종류를 입력하시면 추천 온투업 결과를 볼 수 있습니다.";
    return;
  }

  // 기본 메시지 구성
  let baseSummary = `선택 상품군: ${mainCategory}`;
  if (propertyType) baseSummary += ` / 부동산 유형: ${propertyType}`;
  if (realEstateLoanType) baseSummary += ` / 대출종류: ${realEstateLoanType}`;
  calcTextEl.textContent = baseSummary;

  // LTV 관련
  const { ltv, totalDebtAfter, baseValue } = calcLtv();
  if (ltv == null || !baseValue) {
    calcSubEl.textContent =
      "시세(또는 낙찰가)와 필요 대출금액을 포함한 핵심 정보가 부족하여 LTV를 계산할 수 없습니다.";
  } else {
    const pct = (ltv * 100).toFixed(1);
    const totalStr = formatWithCommas(String(Math.round(totalDebtAfter)));
    const baseStr = formatWithCommas(String(Math.round(baseValue)));
    calcSubEl.textContent = `예상 총 부담액은 약 ${totalStr}원, 지분 기준 담보가치는 약 ${baseStr}원으로 예상 LTV는 약 ${pct}% 수준입니다.`;
  }

  // 온투업 매칭 카운트 (핵심조건 기준)
  const matched = filterLenders(false);
  if (countInfoEl) {
    if (!matched.length) {
      countInfoEl.style.display = "inline-block";
      countInfoEl.textContent =
        "현재 입력 기준으로 매칭되는 온투업체가 없습니다. 대출금액·부동산 유형·지역 등을 조정하면 가능한 온투업체가 있을 수 있습니다.";
    } else {
      countInfoEl.style.display = "inline-block";
      countInfoEl.textContent = `핵심 조건 기준 추천 가능 온투업체: ${matched.length}곳`;
    }
  }

  // 추가조건 적용 카운트
  const matchedWithExtra = filterLenders(true);
  if (extraCountEl) {
    if (!matchedWithExtra.length) {
      extraCountEl.style.display = "inline-block";
      extraCountEl.textContent =
        "현재 추가조건까지 고려하면 추천 가능한 온투업체가 없습니다. 일부 추가조건(신용점수, 기타사항)을 완화해보세요.";
    } else {
      extraCountEl.style.display = "inline-block";
      extraCountEl.textContent = `추가조건까지 반영한 추천 온투업체: ${matchedWithExtra.length}곳`;
    }
  }

  resultSummaryEl.textContent =
    "현재 입력 기준 예상 LTV 및 온투업 매칭 가능성은 위 요약을 참고해주세요.";
}

// ------------------------------------------------------
// 최종 결과 렌더링
// ------------------------------------------------------

function renderFinalResult() {
  const panel = document.getElementById("naviResultPanel");
  const summaryEl = document.getElementById("naviResultSummary");
  if (!panel || !summaryEl) return;

  const { mainCategory } = userState;
  if (!mainCategory) {
    alert("먼저 1단계에서 대출 상품군을 선택해주세요.");
    return;
  }

  // 계산 / 필터
  syncInputsToState();
  const matched = filterLenders(true);

  if (!matched.length) {
    summaryEl.textContent =
      "현재 조건에 맞는 온투업체가 없습니다. 대출금액 등 조건을 조정하면 가능한 온투업체가 있을 수 있습니다.";
    panel.innerHTML = `
      <div class="navi-empty-card">
        <div style="font-weight:600;margin-bottom:4px;">조건에 맞는 온투업체가 없습니다.</div>
        <div style="font-size:11px;">
          · 대출금액을 소폭 줄이거나, LTV를 낮출 수 있는 방향으로 조정해보세요.<br/>
          · 부동산 유형이나 지역을 넓혀보면 선택지가 늘어날 수 있습니다.<br/>
          · 추가정보(신용점수 구간, 기타사항)를 완화하면 가능성이 높아질 수 있습니다.
        </div>
        <ul class="navi-tip-list">
          <li>선순위 대출 일부 상환 또는 필요 대출금액 조정</li>
          <li>경매 낙찰/감정가 대비 LTV 80% 이내로 맞추기</li>
          <li>보증금 반환 시, 일부를 자가 자금으로 마련하여 LTV 낮추기</li>
        </ul>
      </div>
    `;
    return;
  }

  const { ltv } = calcLtv();
  const ltvText =
    ltv != null ? ` / 예상 LTV 약 ${(ltv * 100).toFixed(1)}%` : "";

  summaryEl.textContent = `추가조건까지 반영한 추천 온투업체 ${matched.length}곳${ltvText}`;

  // 조건 요약 문장
  const condParts = [];
  if (userState.mainCategory) condParts.push(userState.mainCategory);
  if (userState.propertyType) condParts.push(userState.propertyType);
  if (userState.realEstateLoanType) condParts.push(userState.realEstateLoanType);
  if (userState.region) condParts.push(userState.region);
  const condSummary = condParts.join(" / ");

  const reqAmt = userState.requestedAmount
    ? formatWithCommas(String(userState.requestedAmount)) + "원"
    : "입력 없음";

  let html = "";
  html += `<div style="margin-bottom:8px;font-size:12px;color:#374151;">`;
  html += `<div>요청 조건 요약: <strong>${condSummary || "조건 미입력"}</strong></div>`;
  html += `<div>필요 대출금액: <strong>${reqAmt}</strong></div>`;
  html += `</div>`;

  matched.forEach((l) => {
    const cats = l.loanCategories || [];
    const cfg = l.realEstateConfig || {};
    const regions = cfg.regions || [];
    const props = cfg.propertyTypes || [];
    const types = cfg.loanTypes || [];
    const phone = l.channels?.phoneNumber || "";
    const kakao = l.channels?.kakaoUrl || "";

    html += `<div class="navi-lender-item">`;
    html += `<div class="navi-lender-name">${l.displayName || "(이름 없음)"}`;
    if (l.isPartner) {
      html += ` <span class="navi-tag" style="background:#111827;color:#f9fafb;border-color:#111827;">제휴 온투업체</span>`;
    }
    html += `</div>`;

    html += `<div class="navi-lender-meta">`;
    if (cats.length) html += `상품군: ${cats.join(", ")} `;
    if (regions.length) html += `| 취급지역: ${regions.join(", ")} `;
    if (props.length) html += `| 담보유형: ${props.join(", ")} `;
    if (types.length) html += `| 대출종류: ${types.join(", ")} `;
    html += `</div>`;

    html += `<div>`;
    if (l.isPartner) {
      html += `<span class="navi-tag">후추와 제휴된 온투업체 (광고비 지급)</span>`;
      html += `<span class="navi-tag">※ 제휴업체는 동일 조건일 때 보다 낮은 비용·우선 상담 가능</span>`;
    } else {
      html += `<span class="navi-tag">비제휴 온투업체 (정보제공용)</span>`;
    }
    html += `</div>`;

    html += `<div class="navi-lender-actions">`;
    if (phone) {
      const telHref = phone.replace(/\s+/g, "");
      html += `<a class="navi-btn-secondary" href="tel:${telHref}">유선 상담 (${phone})</a>`;
    } else {
      html += `<span class="navi-btn-secondary" style="cursor:default;opacity:.7;">유선 상담 번호 미등록</span>`;
    }
    if (kakao) {
      html += `<a class="navi-btn-primary" href="${kakao}" target="_blank" rel="noopener noreferrer">카카오톡 채팅상담 바로가기</a>`;
    } else {
      html += `<span class="navi-btn-secondary" style="cursor:default;opacity:.7;">카카오톡 채널 미등록</span>`;
    }
    html += `</div>`;

    html += `</div>`;
  });

  panel.innerHTML = html;
}

// ------------------------------------------------------
// 초기화
// ------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ navi-beta.js loaded");
  setupBetaMenu();
  setupMoneyInputs();

  await loadNaviLoanConfig();

  setupStep1();
  setupStep2();
  setupStep3();
  setupStep4();
  setupStep5();
  setupStep6Extra();
  setupResultButtons();

  // 첫 계산
  recalcAndUpdateSummary();
});
