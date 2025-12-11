// /assets/admin-beta.js

// ------------------------------------------------------
// 공통 상수 / 유틸
// ------------------------------------------------------

const API_BASE = "https://huchudb-github-io.vercel.app";
const LOAN_LOCAL_KEY = "huchu_loan_config_beta";
const STATS_LOCAL_KEY = "huchu_ontu_stats_beta_v2";
const LENDERS_LOCAL_KEY = "huchu_lenders_config_beta";

const REGIONS = ["서울", "경기", "인천", "충청", "전라", "경상", "강원", "제주"];
const PROPERTY_TYPES = ["아파트", "오피스텔", "빌라·연립", "단독·다가구", "토지·임야", "근린생활시설"];
const MORTGAGE_LOAN_TYPES = ["일반담보대출", "임대보증금반환대출", "지분대출", "경락잔금대출", "대환대출"];
const PRODUCT_GROUPS = [
  "부동산담보대출",
  "개인신용대출",
  "스탁론",
  "법인신용대출",
  "매출채권유동화",
  "의료사업자대출",
  "온라인선정산",
  "전자어음"
];

// 샘플 온투업체 마스터(나중에 49개로 확장)
const LENDERS_MASTER = [
  { id: "f-funding", nameKo: "F펀딩" },
  { id: "terra-funding", nameKo: "테라펀딩" },
  { id: "8percent", nameKo: "8퍼센트" }
];

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
// 상단 MENU
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
// 상단 관리자 탭 전환
// ------------------------------------------------------
function setupAdminTabs() {
  const tabButtons = document.querySelectorAll(".admin-tab-btn");
  const panels = document.querySelectorAll(".admin-tab-panel");
  if (!tabButtons.length || !panels.length) return;

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-admin-tab");
      if (!target) return;

      tabButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      panels.forEach((p) => {
        if (p.id === "adminTabStats" && target === "stats") {
          p.classList.add("is-active");
        } else if (p.id === "adminTabLenders" && target === "lenders") {
          p.classList.add("is-active");
        } else {
          p.classList.remove("is-active");
        }
      });
    });
  });
}

// ------------------------------------------------------
// 1. LTV / 금리 설정 (지역별 기본값)
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

// 지역 버튼 클릭
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

    alert("LTV/금리 설정이 저장되었습니다.\n(브라우저 localStorage 기준)");
  });
}

// ------------------------------------------------------
// 2. 온투업 통계 (ontu-stats)
// ------------------------------------------------------

let statsRoot = {
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
    if (amountEl) amountEl.value = cfg.amount != null ? formatWithCommas(String(cfg.amount)) : "";
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
    balance: getMoneyValue(balEl)
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monthKey, summary, products })
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
// 3. 온투업체 설정 (lendersConfig)
// ------------------------------------------------------

let lendersConfig = {
  version: 1,
  updatedAt: null,
  lenders: []
};

function buildDefaultLendersConfig() {
  const lenders = LENDERS_MASTER.map((info, idx) => {
    return {
      id: info.id,
      nameKo: info.nameKo,
      enabledNewLoan: true,
      isPartner: idx === 0 || info.id === "8percent", // 예시로 일부 제휴 표시
      hidden: false,
      sortOrder: (idx + 1) * 10,
      productGroups: {
        부동산담보대출: info.id !== "8percent",
        개인신용대출: info.id !== "terra-funding",
        스탁론: info.id === "8percent",
        법인신용대출: false,
        매출채권유동화: false,
        의료사업자대출: false,
        온라인선정산: false,
        전자어음: false
      },
      mortgageConfig: {
        enabled: info.id !== "8percent",
        regions: ["서울", "경기", "인천"],
        propertyMatrix: {},
        minAmounts: {},
        ltvOverrides: {},
        notes: ""
      },
      nonMortgageConfig: {},
      conditions: {
        income: {
          "근로소득": true,
          "근로외증빙소득": true,
          "증빙소득없음": false,
          "무증빙_이자납입가능": false
        },
        credit: {
          minScore: 600,
          allowBelow600: false
        },
        term: {
          short: true,
          mid: true,
          long: true
        },
        timing: {
          sameDay: true,
          withinWeek: true,
          withinMonth: true
        },
        riskFlags: {
          "세금체납": false,
          "연체기록": false,
          "압류·가압류": false,
          "개인회생": false
        }
      },
      amountRules: {},
      contacts: {
        phone: "",
        kakaoUrl: ""
      },
      meta: {
        adminNote: "",
        tags: []
      }
    };
  });

  lenders.forEach((l) => {
    if (!l.mortgageConfig.propertyMatrix) l.mortgageConfig.propertyMatrix = {};
    PROPERTY_TYPES.forEach((pt) => {
      if (!l.mortgageConfig.propertyMatrix[pt]) {
        l.mortgageConfig.propertyMatrix[pt] = {};
      }
    });
    if (!l.mortgageConfig.minAmounts) {
      l.mortgageConfig.minAmounts = {
        "아파트": 10000000,
        "오피스텔": 10000000,
        "빌라·연립": 30000000,
        "단독·다가구": 30000000,
        "토지·임야": 30000000,
        "근린생활시설": 30000000
      };
    }
  });

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    lenders
  };
}

async function loadLendersConfig() {
  // 1) localStorage 우선
  try {
    const rawLocal = localStorage.getItem(LENDERS_LOCAL_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (parsed && Array.isArray(parsed.lenders)) {
        lendersConfig = parsed;
        console.log("lendersConfig loaded from localStorage");
        return;
      }
    }
  } catch (e) {
    console.warn("lendersConfig local load error:", e);
  }

  // 2) 서버에서 가져오기 (실제 구현 전까지 실패해도 무시)
  try {
    const res = await fetch(`${API_BASE}/api/lenders-config`);
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.lenders)) {
        lendersConfig = json;
        console.log("lendersConfig loaded from server");
        localStorage.setItem(LENDERS_LOCAL_KEY, JSON.stringify(lendersConfig));
        return;
      }
    }
  } catch (e) {
    console.warn("lendersConfig server load error:", e);
  }

  // 3) 전부 실패하면 기본값 생성
  lendersConfig = buildDefaultLendersConfig();
  localStorage.setItem(LENDERS_LOCAL_KEY, JSON.stringify(lendersConfig));
}

function saveLendersConfigLocal() {
  try {
    lendersConfig.updatedAt = new Date().toISOString();
    localStorage.setItem(LENDERS_LOCAL_KEY, JSON.stringify(lendersConfig));
  } catch (e) {
    console.warn("lendersConfig local save error:", e);
  }
}

async function saveLendersConfigToServer() {
  const statusEl = document.getElementById("lendersSaveStatus");
  try {
    const res = await fetch(`${API_BASE}/api/lenders-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lendersConfig)
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`API 실패: HTTP ${res.status} ${errText}`);
    }
    const json = await res.json();
    console.log("lenders-config saved:", json);
    if (statusEl) {
      statusEl.textContent = "온투업체 설정이 서버에 저장되었습니다.";
      setTimeout(() => {
        if (statusEl.textContent.includes("저장되었습니다")) {
          statusEl.textContent = "";
        }
      }, 3000);
    }
    alert("온투업체 설정이 서버에 저장되었습니다.");
  } catch (e) {
    console.error("saveLendersConfig error:", e);
    alert("온투업체 설정 저장 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.");
  }
}

// --------- 온투업체 리스트 렌더링 ---------

function createLenderRow(lender) {
  const wrapper = document.createElement("div");
  wrapper.className = "admin-lender-item";
  wrapper.dataset.lenderId = lender.id;

  wrapper.innerHTML = `
    <div class="admin-lender-item__header">
      <div class="admin-lender-item__title">
        <span class="admin-lender-name">${lender.nameKo}</span>
        <span class="admin-lender-id">(${lender.id})</span>
        <span class="admin-lender-partner-badge ${lender.isPartner ? "" : "is-hidden"}">제휴</span>
      </div>
      <div class="admin-lender-item__toggles">
        <label class="admin-toggle-label">
          신규대출취급
          <input type="checkbox" class="js-lender-enabled" ${lender.enabledNewLoan ? "checked" : ""} />
        </label>
        <label class="admin-toggle-label">
          제휴업체
          <input type="checkbox" class="js-lender-partner" ${lender.isPartner ? "checked" : ""} />
        </label>
        <label class="admin-toggle-label">
          숨기기
          <input type="checkbox" class="js-lender-hidden" ${lender.hidden ? "checked" : ""} />
        </label>
        <label class="admin-toggle-label">
          우선순위
          <input type="number" class="admin-input js-lender-sort" value="${lender.sortOrder ?? ""}" style="width:70px;" />
        </label>
        <button type="button" class="admin-lender-toggle-btn" aria-expanded="false">상세 ▼</button>
      </div>
    </div>
    <div class="admin-lender-item__body" hidden>
      <div class="admin-lender-section">
        <h3 class="admin-subtitle">[1] 취급 상품군</h3>
        <div class="admin-chip-row js-product-groups"></div>
      </div>

      <div class="admin-lender-section">
        <h3 class="admin-subtitle">[2] 부동산 담보대출 설정</h3>
        <label class="admin-toggle-label">
          부동산 담보대출 취급
          <input type="checkbox" class="js-mortgage-enabled" ${lender.mortgageConfig?.enabled ? "checked" : ""} />
        </label>
        <div class="admin-lender-subsection">
          <div class="admin-label">취급 지역</div>
          <div class="admin-chip-row js-mortgage-regions"></div>
        </div>

        <div class="admin-lender-subsection">
          <div class="admin-label">부동산유형 × 대출종류</div>
          <div class="admin-lender-matrix js-mortgage-matrix"></div>
        </div>

        <div class="admin-lender-subsection">
          <div class="admin-label">부동산유형별 최소 대출금액</div>
          <div class="admin-lender-minamounts js-mortgage-minamounts"></div>
        </div>
      </div>

      <div class="admin-lender-section">
        <h3 class="admin-subtitle">[3] 차주 조건 (6-1 매핑)</h3>
        <div class="admin-lender-subsection">
          <div class="admin-label">소득유형</div>
          <div class="admin-chip-row js-income-conditions"></div>
        </div>
        <div class="admin-lender-subsection">
          <div class="admin-label">신용점수 기준</div>
          <div class="admin-inline-row">
            <label>최소 신용점수
              <input type="number" class="admin-input js-credit-minScore" value="${lender.conditions?.credit?.minScore ?? ""}" />
            </label>
            <label class="admin-toggle-label">
              600점 미만도 취급 가능
              <input type="checkbox" class="js-credit-allowBelow600" ${lender.conditions?.credit?.allowBelow600 ? "checked" : ""} />
            </label>
          </div>
        </div>
        <div class="admin-lender-subsection">
          <div class="admin-label">상환계획</div>
          <div class="admin-chip-row js-term-conditions"></div>
        </div>
        <div class="admin-lender-subsection">
          <div class="admin-label">대출금 필요시기</div>
          <div class="admin-chip-row js-timing-conditions"></div>
        </div>
        <div class="admin-lender-subsection">
          <div class="admin-label">기타 리스크 허용</div>
          <div class="admin-chip-row js-risk-conditions"></div>
        </div>
      </div>

      <div class="admin-lender-section">
        <h3 class="admin-subtitle">[4] 상담 채널</h3>
        <div class="admin-inline-row">
          <label style="flex:1;">
            유선상담 전화번호
            <input type="text" class="admin-input js-contact-phone" value="${lender.contacts?.phone ?? ""}" />
          </label>
          <label style="flex:2;">
            채팅상담(카카오톡) URL
            <input type="text" class="admin-input js-contact-kakao" value="${lender.contacts?.kakaoUrl ?? ""}" />
          </label>
        </div>
      </div>

      <div class="admin-lender-section">
        <h3 class="admin-subtitle">[5] 내부 메모</h3>
        <textarea class="admin-textarea js-meta-note" rows="2" placeholder="내부용 메모">${lender.meta?.adminNote ?? ""}</textarea>
      </div>
    </div>
  `;

  return wrapper;
}

// chip-like checkbox UI
function createChip(label, checked) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "admin-chip" + (checked ? " is-selected" : "");
  btn.textContent = label;
  btn.dataset.value = label;
  return btn;
}

function toggleChip(btn) {
  btn.classList.toggle("is-selected");
}

// lender detail 내부 서브UI 채우기
function populateLenderDetailUI(lender, wrapper) {
  // 상품군
  const pgWrap = wrapper.querySelector(".js-product-groups");
  if (pgWrap) {
    pgWrap.innerHTML = "";
    PRODUCT_GROUPS.forEach((pg) => {
      const selected = lender.productGroups?.[pg] ?? false;
      const chip = createChip(pg, selected);
      chip.addEventListener("click", () => {
        toggleChip(chip);
      });
      pgWrap.appendChild(chip);
    });
  }

  // 부동산 담보 - 지역
  const regWrap = wrapper.querySelector(".js-mortgage-regions");
  if (regWrap) {
    regWrap.innerHTML = "";
    const regions = lender.mortgageConfig?.regions || [];
    REGIONS.forEach((r) => {
      const selected = regions.includes(r);
      const chip = createChip(r, selected);
      chip.addEventListener("click", () => toggleChip(chip));
      regWrap.appendChild(chip);
    });
  }

  // 부동산 담보 - matrix
  const matrixWrap = wrapper.querySelector(".js-mortgage-matrix");
  if (matrixWrap) {
    matrixWrap.innerHTML = "";
    const pm = lender.mortgageConfig?.propertyMatrix || {};
    PROPERTY_TYPES.forEach((pt) => {
      const rowDiv = document.createElement("div");
      rowDiv.className = "admin-matrix-row";
      const title = document.createElement("div");
      title.className = "admin-matrix-row__title";
      title.textContent = pt;
      rowDiv.appendChild(title);

      const cellWrap = document.createElement("div");
      cellWrap.className = "admin-matrix-row__cells";

      MORTGAGE_LOAN_TYPES.forEach((lt) => {
        const key = `${pt}__${lt}`;
        const selected = pm?.[pt]?.[lt] ?? false;
        const chip = createChip(lt, selected);
        chip.dataset.pt = pt;
        chip.dataset.lt = lt;
        chip.addEventListener("click", () => toggleChip(chip));
        cellWrap.appendChild(chip);
      });

      rowDiv.appendChild(cellWrap);
      matrixWrap.appendChild(rowDiv);
    });
  }

  // 부동산 담보 - 최소금액
  const minWrap = wrapper.querySelector(".js-mortgage-minamounts");
  if (minWrap) {
    minWrap.innerHTML = "";
    const m = lender.mortgageConfig?.minAmounts || {};
    PROPERTY_TYPES.forEach((pt) => {
      const value = m[pt] ?? (pt === "아파트" || pt === "오피스텔" ? 10000000 : 30000000);
      const row = document.createElement("div");
      row.className = "admin-inline-row";
      row.innerHTML = `
        <label style="flex:1;">
          ${pt}
          <input type="text" class="admin-input js-minAmount" data-ptype="${pt}" data-type="money" value="${formatWithCommas(String(value))}" />
        </label>
      `;
      minWrap.appendChild(row);
    });
  }

  // 소득유형
  const incomeWrap = wrapper.querySelector(".js-income-conditions");
  if (incomeWrap) {
    incomeWrap.innerHTML = "";
    const incomeCfg = lender.conditions?.income || {};
    const keys = ["근로소득", "근로외증빙소득", "증빙소득없음", "무증빙_이자납입가능"];
    keys.forEach((k) => {
      const label = k === "무증빙_이자납입가능" ? "무증빙+이자납입가능" : k;
      const selected = incomeCfg[k] ?? false;
      const chip = createChip(label, selected);
      chip.dataset.key = k;
      chip.addEventListener("click", () => toggleChip(chip));
      incomeWrap.appendChild(chip);
    });
  }

  // 상환계획
  const termWrap = wrapper.querySelector(".js-term-conditions");
  if (termWrap) {
    termWrap.innerHTML = "";
    const termCfg = lender.conditions?.term || {};
    const entries = [
      { key: "short", label: "3개월 내" },
      { key: "mid", label: "3~12개월" },
      { key: "long", label: "1년 이상" }
    ];
    entries.forEach((e) => {
      const chip = createChip(e.label, termCfg[e.key] ?? false);
      chip.dataset.key = e.key;
      chip.addEventListener("click", () => toggleChip(chip));
      termWrap.appendChild(chip);
    });
  }

  // 필요시기
  const timingWrap = wrapper.querySelector(".js-timing-conditions");
  if (timingWrap) {
    timingWrap.innerHTML = "";
    const timingCfg = lender.conditions?.timing || {};
    const entries = [
      { key: "sameDay", label: "당일" },
      { key: "withinWeek", label: "1주일 내" },
      { key: "withinMonth", label: "한달 이내" }
    ];
    entries.forEach((e) => {
      const chip = createChip(e.label, timingCfg[e.key] ?? false);
      chip.dataset.key = e.key;
      chip.addEventListener("click", () => toggleChip(chip));
      timingWrap.appendChild(chip);
    });
  }

  // 리스크
  const riskWrap = wrapper.querySelector(".js-risk-conditions");
  if (riskWrap) {
    riskWrap.innerHTML = "";
    const riskCfg = lender.conditions?.riskFlags || {};
    const keys = ["세금체납", "연체기록", "압류·가압류", "개인회생"];
    keys.forEach((k) => {
      const chip = createChip(k, riskCfg[k] ?? false);
      chip.dataset.key = k;
      chip.addEventListener("click", () => toggleChip(chip));
      riskWrap.appendChild(chip);
    });
  }

  // 금액 포맷
  setupMoneyInputs();
}

function renderLendersList() {
  const container = document.getElementById("lenderListContainer");
  if (!container) return;

  const searchInput = document.getElementById("lenderSearchInput");
  const keyword = (searchInput?.value || "").trim();

  let list = [...(lendersConfig.lenders || [])];

  if (keyword) {
    list = list.filter((l) => l.nameKo.includes(keyword) || l.id.includes(keyword));
  }

  // 정렬: partner 먼저, sortOrder
  list.sort((a, b) => {
    if (a.isPartner && !b.isPartner) return -1;
    if (!a.isPartner && b.isPartner) return 1;
    const sa = a.sortOrder ?? 9999;
    const sb = b.sortOrder ?? 9999;
    return sa - sb;
  });

  container.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("p");
    empty.style.fontSize = "13px";
    empty.style.color = "#6b7280";
    empty.textContent = "등록된 온투업체가 없습니다. (또는 검색 결과 없음)";
    container.appendChild(empty);
    return;
  }

  list.forEach((lender) => {
    const row = createLenderRow(lender);
    container.appendChild(row);
    populateLenderDetailUI(lender, row);
  });

  // 상세 토글
  container.querySelectorAll(".admin-lender-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".admin-lender-item");
      if (!item) return;
      const body = item.querySelector(".admin-lender-item__body");
      if (!body) return;
      const expanded = btn.getAttribute("aria-expanded") === "true";
      if (expanded) {
        body.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        btn.textContent = "상세 ▼";
      } else {
        body.hidden = false;
        btn.setAttribute("aria-expanded", "true");
        btn.textContent = "상세 ▲";
      }
    });
  });
}

// 폼에서 lendersConfig로 값 반영
function captureLendersFromForm() {
  const container = document.getElementById("lenderListContainer");
  if (!container) return;
  const items = container.querySelectorAll(".admin-lender-item");
  const mapById = {};
  lendersConfig.lenders.forEach((l) => (mapById[l.id] = l));

  items.forEach((item) => {
    const id = item.dataset.lenderId;
    const lender = mapById[id];
    if (!lender) return;

    const enabledEl = item.querySelector(".js-lender-enabled");
    const partnerEl = item.querySelector(".js-lender-partner");
    const hiddenEl = item.querySelector(".js-lender-hidden");
    const sortEl = item.querySelector(".js-lender-sort");
    lender.enabledNewLoan = !!(enabledEl && enabledEl.checked);
    lender.isPartner = !!(partnerEl && partnerEl.checked);
    lender.hidden = !!(hiddenEl && hiddenEl.checked);
    lender.sortOrder = sortEl && sortEl.value !== "" ? Number(sortEl.value) : null;

    // 상품군
    const pgWrap = item.querySelector(".js-product-groups");
    if (pgWrap) {
      const chips = pgWrap.querySelectorAll(".admin-chip");
      lender.productGroups = lender.productGroups || {};
      chips.forEach((chip) => {
        const pg = chip.dataset.value;
        lender.productGroups[pg] = chip.classList.contains("is-selected");
      });
    }

    // mortgage
    lender.mortgageConfig = lender.mortgageConfig || {
      enabled: false,
      regions: [],
      propertyMatrix: {},
      minAmounts: {},
      ltvOverrides: {},
      notes: ""
    };
    const mCfg = lender.mortgageConfig;

    const mEnabledEl = item.querySelector(".js-mortgage-enabled");
    mCfg.enabled = !!(mEnabledEl && mEnabledEl.checked);

    const regWrap = item.querySelector(".js-mortgage-regions");
    if (regWrap) {
      const chips = regWrap.querySelectorAll(".admin-chip");
      mCfg.regions = [];
      chips.forEach((chip) => {
        if (chip.classList.contains("is-selected")) {
          mCfg.regions.push(chip.dataset.value);
        }
      });
    }

    const matrixWrap = item.querySelector(".js-mortgage-matrix");
    if (matrixWrap) {
      mCfg.propertyMatrix = {};
      PROPERTY_TYPES.forEach((pt) => {
        mCfg.propertyMatrix[pt] = {};
      });

      const chips = matrixWrap.querySelectorAll(".admin-chip");
      chips.forEach((chip) => {
        const pt = chip.dataset.pt;
        const lt = chip.dataset.lt;
        if (!pt || !lt) return;
        if (!mCfg.propertyMatrix[pt]) mCfg.propertyMatrix[pt] = {};
        mCfg.propertyMatrix[pt][lt] = chip.classList.contains("is-selected");
      });
    }

    const minWrap = item.querySelector(".js-mortgage-minamounts");
    if (minWrap) {
      const inputs = minWrap.querySelectorAll(".js-minAmount");
      mCfg.minAmounts = {};
      inputs.forEach((inp) => {
        const pt = inp.dataset.ptype;
        if (!pt) return;
        mCfg.minAmounts[pt] = getMoneyValue(inp);
      });
    }

    // conditions
    lender.conditions = lender.conditions || {
      income: {},
      credit: {},
      term: {},
      timing: {},
      riskFlags: {}
    };
    const cond = lender.conditions;

    // income
    const incomeWrap = item.querySelector(".js-income-conditions");
    if (incomeWrap) {
      cond.income = {};
      const chips = incomeWrap.querySelectorAll(".admin-chip");
      chips.forEach((chip) => {
        const key = chip.dataset.key;
        if (!key) return;
        cond.income[key] = chip.classList.contains("is-selected");
      });
    }

    // credit
    const minScoreEl = item.querySelector(".js-credit-minScore");
    const allowBelowEl = item.querySelector(".js-credit-allowBelow600");
    cond.credit = {
      minScore: minScoreEl && minScoreEl.value !== "" ? Number(minScoreEl.value) : null,
      allowBelow600: !!(allowBelowEl && allowBelowEl.checked)
    };

    // term
    const termWrap = item.querySelector(".js-term-conditions");
    if (termWrap) {
      cond.term = {};
      const chips = termWrap.querySelectorAll(".admin-chip");
      chips.forEach((chip) => {
        const key = chip.dataset.key;
        if (!key) return;
        cond.term[key] = chip.classList.contains("is-selected");
      });
    }

    // timing
    const timingWrap = item.querySelector(".js-timing-conditions");
    if (timingWrap) {
      cond.timing = {};
      const chips = timingWrap.querySelectorAll(".admin-chip");
      chips.forEach((chip) => {
        const key = chip.dataset.key;
        if (!key) return;
        cond.timing[key] = chip.classList.contains("is-selected");
      });
    }

    // risk
    const riskWrap = item.querySelector(".js-risk-conditions");
    if (riskWrap) {
      cond.riskFlags = {};
      const chips = riskWrap.querySelectorAll(".admin-chip");
      chips.forEach((chip) => {
        const key = chip.dataset.key;
        if (!key) return;
        cond.riskFlags[key] = chip.classList.contains("is-selected");
      });
    }

    // contacts
    lender.contacts = lender.contacts || {};
    const phoneEl = item.querySelector(".js-contact-phone");
    const kakaoEl = item.querySelector(".js-contact-kakao");
    lender.contacts.phone = phoneEl ? phoneEl.value.trim() : "";
    lender.contacts.kakaoUrl = kakaoEl ? kakaoEl.value.trim() : "";

    // meta
    lender.meta = lender.meta || {};
    const noteEl = item.querySelector(".js-meta-note");
    lender.meta.adminNote = noteEl ? noteEl.value.trim() : "";
  });

  lendersConfig.updatedAt = new Date().toISOString();
}

// 온투업체 탭 초기화
async function setupLendersAdmin() {
  await loadLendersConfig();
  renderLendersList();

  const searchInput = document.getElementById("lenderSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderLendersList();
    });
  }

  const saveBtn = document.getElementById("saveLendersConfigBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      captureLendersFromForm();
      saveLendersConfigLocal();
      await saveLendersConfigToServer();
    });
  }
}

// ------------------------------------------------------
// 초기화
// ------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  setupBetaMenu();
  setupAdminTabs();
  setupMoneyInputs();

  // LTV/금리 설정
  loadLoanConfigFromStorage();
  setupRegionTabs();
  fillLoanConfigForm(currentRegion);
  setupLoanConfigSaveButton();

  // 통계
  loadStatsFromStorage();
  setupStatsInteractions();

  // 온투업체 설정
  setupLendersAdmin();
});
