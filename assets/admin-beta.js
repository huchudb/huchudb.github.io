// /assets/admin-beta.js
// 후추 베타 관리자 스크립트
// - 탭 전환
// - 온투 통계 저장 (/api/ontu-stats)
// - 온투업체 네비게이션 설정 (/api/loan-config)
//
// ✅ 이번 수정 핵심:
// - "취급 대출 종류(enum)"는 기본 5개
// - 단, "아파트"와 "빌라"에만 2개 추가(매입잔금_일반, 매입잔금_분양) = 총 7개
// - 제휴 ON 업체만 입력 가능(제휴 OFF면 입력 UI 잠금/비활성)

console.log("✅ admin-beta.js loaded");

// ------------------------------------------------------
// 공통: API_BASE (shared.js가 있으면 거기 값 우선)
// ------------------------------------------------------
const API_BASE =
  (window && window.API_BASE) ||
  (location.hostname === "localhost"
    ? "http://localhost:3000"
    : ""); // same-origin default

// ------------------------------------------------------
// 공통: 메뉴 토글, 숫자 유틸, 금액 포맷
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

function setupAdminTabs() {
  const tabButtons = document.querySelectorAll(".admin-tab-btn");
  const panelStats = document.getElementById("admin-tab-stats");
  const panelLenders = document.getElementById("admin-tab-lenders");
  if (!tabButtons.length || !panelStats || !panelLenders) return;

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      tabButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      if (tab === "stats") {
        panelStats.classList.remove("hide");
        panelLenders.classList.add("hide");
      } else if (tab === "lenders") {
        panelLenders.classList.remove("hide");
        panelStats.classList.add("hide");
      }
    });
  });
}

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
function setupMoneyInputs(root) {
  const scope = root || document;
  const moneyInputs = scope.querySelectorAll('input[data-type="money"]');
  moneyInputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      e.target.value = formatWithCommas(e.target.value);
    });
    if (input.value) input.value = formatWithCommas(input.value);
  });
}

// ------------------------------------------------------
// 1. 온투업 통계 저장 (ontu-stats) — 기존 유지
// ------------------------------------------------------
const STATS_LOCAL_KEY = "huchu_ontu_stats_beta_v2";

let statsRoot = { byMonth: {} };

function loadStatsFromStorage() {
  try {
    const raw = localStorage.getItem(STATS_LOCAL_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.byMonth) statsRoot = parsed;
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

  tbody.querySelectorAll("tr[data-key]").forEach((row) => {
    const key = row.getAttribute("data-key");
    const cfg = p[key] || {};
    const ratioEl = row.querySelector(".js-ratio");
    const amountEl = row.querySelector(".js-amount");
    if (ratioEl) ratioEl.value = cfg.ratioPercent != null ? cfg.ratioPercent : "";
    if (amountEl) amountEl.value = cfg.amount != null ? formatWithCommas(String(cfg.amount)) : "";
  });
}
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
  document.querySelectorAll("#productRows tr[data-key]").forEach((row) => {
    const key = row.getAttribute("data-key");
    if (!key) return;

    const ratioEl = row.querySelector(".js-ratio");
    const amountEl = row.querySelector(".js-amount");

    const ratioPercent = ratioEl && ratioEl.value !== "" ? Number(ratioEl.value) : 0;
    const amount = getMoneyValue(amountEl);

    if (ratioPercent === 0 && amount === 0) return;
    products[key] = { ratioPercent, amount };
  });

  return { monthKey, summary, products };
}
function recalcProductAmounts() {
  const balEl = document.getElementById("statsBalance");
  if (!balEl) return;
  const balance = getMoneyValue(balEl);

  document.querySelectorAll("#productRows tr[data-key]").forEach((row) => {
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

  document.querySelectorAll("#productRows .js-ratio").forEach((el) => {
    el.addEventListener("input", () => recalcProductAmounts());
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
        const res = await fetch("/api/ontu-stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monthKey, summary, products })
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`API 실패: HTTP ${res.status} ${errText}`);
        }

        await res.json().catch(() => null);

        statsRoot.byMonth[monthKey] = { summary, products };
        saveStatsToStorage();

        if (statusEl) {
          statusEl.textContent = "통계 데이터가 서버에 저장되었습니다.";
          setTimeout(() => {
            if (statusEl.textContent.includes("저장되었습니다")) statusEl.textContent = "";
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
// 2. 온투업체 네비게이션 설정 (loan-config)
// ------------------------------------------------------

// ✅ 네비 첫 화면 상품군(상위)
const PRODUCT_GROUPS = [
  { key: "부동산담보대출", label: "부동산 담보대출" },
  { key: "개인신용대출", label: "개인신용대출" },
  { key: "스탁론", label: "스탁론" },
  { key: "법인신용대출", label: "법인신용대출" },
  { key: "매출채권유동화", label: "매출채권유동화" },
  { key: "의료사업자대출", label: "의료사업자대출" },
  { key: "온라인선정산", label: "온라인선정산" },
  { key: "전자어음", label: "전자어음" }
];

// ✅ 부동산 유형(네비와 동일하게 적용)
// - 아파트/오피스텔 분리
const REAL_ESTATE_TYPES = [
  { key: "아파트", label: "아파트" },
  { key: "오피스텔", label: "오피스텔" },
  { key: "빌라", label: "빌라(연립·다세대)" },
  { key: "단독", label: "단독·다가구" },
  { key: "상가", label: "상가·근린" },
  { key: "토지", label: "토지" }
];

// ✅ “취급 대출 종류” enum
// - 기본 5개: (시안 5개 고정)
// - 아파트/빌라에만 2개 추가 → 7개
const LOAN_TYPES_BASE_5 = [
  { key: "일반", label: "일반" },
  { key: "대환", label: "대환" },
  { key: "임대보증금", label: "임대보증금" },
  { key: "경락잔금", label: "경락잔금" },
  { key: "사업자", label: "사업자" }
];

const LOAN_TYPES_EXTRA_APT_VILLA_2 = [
  { key: "매입잔금_일반", label: "매입잔금(일반)" },
  { key: "매입잔금_분양", label: "매입잔금(분양)" }
];

function getLoanTypesForRealEstateType(typeKey) {
  // ✅ 요청 반영: 7개 enum은 아파트/빌라에만 적용
  if (typeKey === "아파트" || typeKey === "빌라") {
    return [...LOAN_TYPES_BASE_5, ...LOAN_TYPES_EXTRA_APT_VILLA_2];
  }
  return [...LOAN_TYPES_BASE_5];
}

// (임시) 업체 목록 — 실제는 49개로 확장
const LENDERS_MASTER = [
  { id: "fmfunding", name: "FM펀딩" },
  { id: "8percent", name: "에잇퍼센트" },
  { id: "peoplefund", name: "피플펀드" }
];

let lendersConfig = { lenders: {} };

// 서버 → lendersConfig 로드
async function loadLendersConfigFromServer() {
  try {
    const res = await fetch(`${API_BASE}/api/loan-config`, { method: "GET" });
    if (!res.ok) {
      console.warn("loan-config GET 실패, 빈 설정으로 시작:", res.status);
      lendersConfig = { lenders: {} };
    } else {
      const json = await res.json().catch(() => null);
      if (json && typeof json === "object" && json.lenders) lendersConfig = json;
      else lendersConfig = { lenders: {} };
    }
  } catch (e) {
    console.warn("loan-config fetch error:", e);
    lendersConfig = { lenders: {} };
  }

  mergeLendersWithMaster();
  renderLendersList();
  updateLendersConfigPreview();
}

function getDefaultRealEstateConfig() {
  const types = {};
  REAL_ESTATE_TYPES.forEach((t) => {
    types[t.key] = {
      enabled: false,
      loanTypes: [] // selected loan type keys (for this property type)
    };
  });

  return {
    // ✅ 취급지역은 “부동산 담보대출 설정”에만 존재
    regions: [],
    propertyTypes: types
  };
}

// MASTER 기준으로 누락된 업체 채워넣기
function mergeLendersWithMaster() {
  const merged = {};
  const current = (lendersConfig && lendersConfig.lenders) || {};

  LENDERS_MASTER.forEach((m) => {
    const existing = current[m.id] || {};
    merged[m.id] = {
      id: m.id,
      name: m.name,

      // ✅ 입력 가능 조건 판단은 "isPartner"
      isPartner: typeof existing.isPartner === "boolean" ? existing.isPartner : false,

      // 신규대출취급
      isActive: typeof existing.isActive === "boolean" ? existing.isActive : false,

      // 상위 상품군
      products: Array.isArray(existing.products) ? existing.products : [],

      // 상담 채널
      phoneNumber: existing.phoneNumber || "",
      kakaoUrl: existing.kakaoUrl || "",

      // ✅ 부동산 담보대출 상세
      realEstate: existing.realEstate && typeof existing.realEstate === "object"
        ? {
            regions: Array.isArray(existing.realEstate.regions) ? existing.realEstate.regions : [],
            propertyTypes:
              existing.realEstate.propertyTypes && typeof existing.realEstate.propertyTypes === "object"
                ? existing.realEstate.propertyTypes
                : getDefaultRealEstateConfig().propertyTypes
          }
        : getDefaultRealEstateConfig()
    };
  });

  // propertyTypes 누락 키 보정
  Object.keys(merged).forEach((id) => {
    const re = merged[id].realEstate || getDefaultRealEstateConfig();
    const fixedTypes = {};
    REAL_ESTATE_TYPES.forEach((t) => {
      const ext = (re.propertyTypes && re.propertyTypes[t.key]) || {};
      fixedTypes[t.key] = {
        enabled: typeof ext.enabled === "boolean" ? ext.enabled : false,
        loanTypes: Array.isArray(ext.loanTypes) ? ext.loanTypes : []
      };
    });
    merged[id].realEstate = {
      regions: Array.isArray(re.regions) ? re.regions : [],
      propertyTypes: fixedTypes
    };
  });

  lendersConfig.lenders = merged;
}

// ------------------------------------------------------
// UI helpers: partner OFF면 입력 잠금
// ------------------------------------------------------
function setPanelEditable(panelEl, editable) {
  if (!panelEl) return;
  const inputs = panelEl.querySelectorAll("input, select, textarea, button");
  inputs.forEach((el) => {
    // 펼침/접기 버튼은 건드리면 안 됨 (패널 내부 button 있을 수 있어)
    if (el.classList && (el.classList.contains("lender-toggle") || el.id === "saveLendersConfigBtn")) return;

    if (!editable) {
      el.setAttribute("disabled", "disabled");
    } else {
      el.removeAttribute("disabled");
    }
  });

  // 힌트 표시(선택)
  const lockNote = panelEl.querySelector(".js-partner-lock-note");
  if (lockNote) lockNote.classList.toggle("hide", editable);
}

// ------------------------------------------------------
// 온투업체 리스트 렌더링
// ------------------------------------------------------
function renderLendersList() {
  const container = document.getElementById("lendersList");
  if (!container) return;
  container.innerHTML = "";

  const cfg = lendersConfig.lenders || {};

  LENDERS_MASTER.forEach((m) => {
    const lender = cfg[m.id];
    if (!lender) return;

    const card = document.createElement("div");
    card.className = "lender-card";

    // 헤더(접기/펼치기 버튼)
    const headerBtn = document.createElement("button");
    headerBtn.type = "button";
    headerBtn.className = "lender-toggle";

    const nameSpan = document.createElement("span");
    nameSpan.className = "lender-toggle__name";
    nameSpan.textContent = lender.name;

    const badgesWrap = document.createElement("span");

    const partnerBadge = document.createElement("span");
    partnerBadge.className = "lender-badge lender-badge--partner";
    if (!lender.isPartner) partnerBadge.classList.add("is-off");
    partnerBadge.textContent = "제휴업체";

    const activeBadge = document.createElement("span");
    activeBadge.className = "lender-badge lender-badge--active";
    if (!lender.isActive) activeBadge.classList.add("is-off");
    activeBadge.textContent = "신규대출취급";

    badgesWrap.appendChild(partnerBadge);
    badgesWrap.appendChild(activeBadge);

    headerBtn.appendChild(nameSpan);
    headerBtn.appendChild(badgesWrap);

    // 펼침 패널
    const panel = document.createElement("div");
    panel.className = "lender-panel hide";

    const inner = document.createElement("div");
    inner.className = "lender-panel__inner";

    // partner OFF 안내
    const lockNote = document.createElement("div");
    lockNote.className = "notice error js-partner-lock-note";
    lockNote.innerHTML = "<strong>제휴 OFF</strong> 상태입니다. 이 업체는 관리자 입력(설정)이 잠겨 있습니다.";
    inner.appendChild(lockNote);

    // 1) 스위치 (제휴/신규대출취급)
    const switchGroup = document.createElement("div");
    switchGroup.className = "admin-field-grid";

    const fieldPartner = document.createElement("div");
    fieldPartner.className = "admin-field admin-switch-field";
    const partnerLabel = document.createElement("span");
    partnerLabel.className = "admin-switch-label";
    partnerLabel.textContent = "제휴업체 여부";
    const partnerSwitchWrap = document.createElement("label");
    partnerSwitchWrap.className = "admin-switch";
    const partnerInput = document.createElement("input");
    partnerInput.type = "checkbox";
    partnerInput.id = `lender-partner-${lender.id}`;
    partnerInput.checked = !!lender.isPartner;
    partnerSwitchWrap.appendChild(partnerInput);
    fieldPartner.appendChild(partnerLabel);
    fieldPartner.appendChild(partnerSwitchWrap);

    const fieldActive = document.createElement("div");
    fieldActive.className = "admin-field admin-switch-field";
    const activeLabel = document.createElement("span");
    activeLabel.className = "admin-switch-label";
    activeLabel.textContent = "신규대출 취급여부";
    const activeSwitchWrap = document.createElement("label");
    activeSwitchWrap.className = "admin-switch";
    const activeInput = document.createElement("input");
    activeInput.type = "checkbox";
    activeInput.id = `lender-active-${lender.id}`;
    activeInput.checked = !!lender.isActive;
    activeSwitchWrap.appendChild(activeInput);
    fieldActive.appendChild(activeLabel);
    fieldActive.appendChild(activeSwitchWrap);

    switchGroup.appendChild(fieldPartner);
    switchGroup.appendChild(fieldActive);
    inner.appendChild(switchGroup);

    // 2) 취급 상품군 체크박스
    const productsBox = document.createElement("div");
    productsBox.className = "admin-subbox";

    const pTitle = document.createElement("h3");
    pTitle.className = "admin-subbox-title";
    pTitle.textContent = "취급 상품군 설정";

    const pHelp = document.createElement("p");
    pHelp.className = "admin-subbox-help";
    pHelp.textContent = "네비 첫 화면 상품군과 매핑됩니다. 실제 취급하는 것만 체크하세요.";

    const chipRow = document.createElement("div");
    chipRow.className = "admin-chip-row";

    PRODUCT_GROUPS.forEach((pg) => {
      const label = document.createElement("label");
      label.className = "admin-chip-check";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = `lender-product-${lender.id}-${pg.key}`;
      cb.checked = Array.isArray(lender.products) ? lender.products.includes(pg.key) : false;
      const span = document.createElement("span");
      span.textContent = pg.label;
      label.appendChild(cb);
      label.appendChild(span);
      chipRow.appendChild(label);
    });

    productsBox.appendChild(pTitle);
    productsBox.appendChild(pHelp);
    productsBox.appendChild(chipRow);
    inner.appendChild(productsBox);

    // 3) 부동산 담보대출 상세 (취급지역 + 부동산유형별 취급/대출종류)
    const reBox = document.createElement("div");
    reBox.className = "admin-subbox";
    const reTitle = document.createElement("h3");
    reTitle.className = "admin-subbox-title";
    reTitle.textContent = "부동산 담보대출 설정";

    const reHelp = document.createElement("p");
    reHelp.className = "admin-subbox-help";
    reHelp.textContent =
      "부동산 담보대출을 취급하는 경우에만 의미가 있습니다. (비부동산 상품군은 현재 필터/매칭 없음)";

    // 지역(텍스트 간단 입력 — 추후 버튼 UI로 확장 가능)
    const regionField = document.createElement("div");
    regionField.className = "admin-field";
    const regionLabel = document.createElement("label");
    regionLabel.setAttribute("for", `lender-regions-${lender.id}`);
    regionLabel.textContent = "취급지역 (쉼표로 구분)";
    const regionInput = document.createElement("input");
    regionInput.type = "text";
    regionInput.className = "admin-input";
    regionInput.id = `lender-regions-${lender.id}`;
    regionInput.placeholder = "예) 서울, 경기, 인천";
    regionInput.value = (lender.realEstate?.regions || []).join(", ");

    regionField.appendChild(regionLabel);
    regionField.appendChild(regionInput);

    // 부동산 유형별 체크 + 하위 대출종류(enum)
    const typeWrap = document.createElement("div");
    typeWrap.className = "admin-loantype-grid";

    REAL_ESTATE_TYPES.forEach((t) => {
      const row = document.createElement("div");
      row.className = "admin-loantype-row";

      const topLine = document.createElement("div");
      topLine.className = "admin-switch-field";

      const tLabel = document.createElement("span");
      tLabel.className = "admin-switch-label";
      tLabel.textContent = `${t.label} 취급여부`;

      const tSwitchWrap = document.createElement("label");
      tSwitchWrap.className = "admin-switch";
      const tEnable = document.createElement("input");
      tEnable.type = "checkbox";
      tEnable.id = `lender-retype-${lender.id}-${t.key}`;
      tEnable.checked = !!lender.realEstate?.propertyTypes?.[t.key]?.enabled;
      tSwitchWrap.appendChild(tEnable);

      topLine.appendChild(tLabel);
      topLine.appendChild(tSwitchWrap);

      const fields = document.createElement("div");
      fields.className = "admin-loantype-fields";

      const typesForThis = getLoanTypesForRealEstateType(t.key); // ✅ 핵심(아파트/빌라만 7개)
      const selected = lender.realEstate?.propertyTypes?.[t.key]?.loanTypes || [];

      typesForThis.forEach((lt) => {
        const lab = document.createElement("label");
        lab.className = "admin-chip-check";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.id = `lender-loantype-${lender.id}-${t.key}-${lt.key}`;
        cb.checked = Array.isArray(selected) ? selected.includes(lt.key) : false;

        const sp = document.createElement("span");
        sp.textContent = lt.label;

        lab.appendChild(cb);
        lab.appendChild(sp);
        fields.appendChild(lab);
      });

      // 취급여부 OFF면 하위 체크 disable
      const syncDisable = () => {
        const on = !!tEnable.checked;
        fields.querySelectorAll("input[type='checkbox']").forEach((c) => {
          c.disabled = !on;
          if (!on) c.checked = false;
        });
      };
      tEnable.addEventListener("change", syncDisable);
      syncDisable();

      row.appendChild(topLine);
      row.appendChild(fields);
      typeWrap.appendChild(row);
    });

    reBox.appendChild(reTitle);
    reBox.appendChild(reHelp);
    reBox.appendChild(regionField);
    reBox.appendChild(typeWrap);
    inner.appendChild(reBox);

    // 4) 상담 채널
    const contactBox = document.createElement("div");
    contactBox.className = "admin-subbox";

    const cTitle = document.createElement("h3");
    cTitle.className = "admin-subbox-title";
    cTitle.textContent = "상담 채널 정보";

    const cHelp = document.createElement("p");
    cHelp.className = "admin-subbox-help";
    cHelp.innerHTML =
      "결과 화면에서 <strong>유선상담</strong> / <strong>채팅상담(카카오톡)</strong> 버튼으로 노출됩니다.";

    const contactGrid = document.createElement("div");
    contactGrid.className = "admin-field-grid";

    const phoneField = document.createElement("div");
    phoneField.className = "admin-field";
    const phoneLabel = document.createElement("label");
    phoneLabel.setAttribute("for", `lender-phone-${lender.id}`);
    phoneLabel.textContent = "유선상담 전화번호";
    const phoneInput = document.createElement("input");
    phoneInput.type = "text";
    phoneInput.className = "admin-input";
    phoneInput.id = `lender-phone-${lender.id}`;
    phoneInput.placeholder = "예) 02-1234-5678";
    phoneInput.value = lender.phoneNumber || "";
    phoneField.appendChild(phoneLabel);
    phoneField.appendChild(phoneInput);

    const kakaoField = document.createElement("div");
    kakaoField.className = "admin-field";
    const kakaoLabel = document.createElement("label");
    kakaoLabel.setAttribute("for", `lender-kakao-${lender.id}`);
    kakaoLabel.textContent = "카카오톡 채팅상담 URL";
    const kakaoInput = document.createElement("input");
    kakaoInput.type = "text";
    kakaoInput.className = "admin-input";
    kakaoInput.id = `lender-kakao-${lender.id}`;
    kakaoInput.placeholder = "예) https://pf.kakao.com/...";
    kakaoInput.value = lender.kakaoUrl || "";
    kakaoField.appendChild(kakaoLabel);
    kakaoField.appendChild(kakaoInput);

    contactGrid.appendChild(phoneField);
    contactGrid.appendChild(kakaoField);

    contactBox.appendChild(cTitle);
    contactBox.appendChild(cHelp);
    contactBox.appendChild(contactGrid);
    inner.appendChild(contactBox);

    panel.appendChild(inner);

    // 토글 이벤트
    headerBtn.addEventListener("click", () => {
      panel.classList.toggle("hide");
    });

    // ✅ 제휴 OFF면 입력 잠금(단, 제휴 스위치 자체는 켤 수 있어야 함)
    const applyPartnerEditable = () => {
      // 기본 잠금 처리
      setPanelEditable(panel, !!partnerInput.checked);

      // 예외: partner 스위치는 항상 가능
      partnerInput.disabled = false;

      // 예외: partner ON/OFF 바꿀 때 락 노트 보여줌/숨김
      const editable = !!partnerInput.checked;
      lockNote.classList.toggle("hide", editable);

      // partner OFF로 끄면: 입력값을 안전하게 초기화(요청: 제휴 ON만 입력 가능)
      if (!editable) {
        // isActive는 false로
        activeInput.checked = false;
        // products 해제
        panel.querySelectorAll(`input[id^="lender-product-${lender.id}-"]`).forEach((c) => (c.checked = false));
        // regions 비움
        regionInput.value = "";
        // 부동산 유형 OFF
        panel.querySelectorAll(`input[id^="lender-retype-${lender.id}-"]`).forEach((c) => {
          c.checked = false;
          c.dispatchEvent(new Event("change"));
        });
        // 연락처 비움
        phoneInput.value = "";
        kakaoInput.value = "";
      }
    };

    partnerInput.addEventListener("change", applyPartnerEditable);
    applyPartnerEditable();

    card.appendChild(headerBtn);
    card.appendChild(panel);
    container.appendChild(card);
  });
}

// 폼 → lendersConfig JSON 만들기
function collectLendersConfigFromForm() {
  const result = { lenders: {} };

  LENDERS_MASTER.forEach((m) => {
    const id = m.id;
    const name = m.name;

    const partnerInput = document.getElementById(`lender-partner-${id}`);
    const isPartner = !!(partnerInput && partnerInput.checked);

    // ✅ 제휴 OFF 업체는 “저장 대상에서 기본값만” (입력값/세부조건은 저장하지 않음)
    if (!isPartner) {
      result.lenders[id] = {
        id,
        name,
        isPartner: false,
        isActive: false,
        products: [],
        phoneNumber: "",
        kakaoUrl: "",
        realEstate: getDefaultRealEstateConfig()
      };
      return;
    }

    const activeInput = document.getElementById(`lender-active-${id}`);
    const phoneInput = document.getElementById(`lender-phone-${id}`);
    const kakaoInput = document.getElementById(`lender-kakao-${id}`);
    const regionInput = document.getElementById(`lender-regions-${id}`);

    const products = [];
    PRODUCT_GROUPS.forEach((pg) => {
      const cb = document.getElementById(`lender-product-${id}-${pg.key}`);
      if (cb && cb.checked) products.push(pg.key);
    });

    const regions = (regionInput ? regionInput.value : "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const propertyTypes = {};
    REAL_ESTATE_TYPES.forEach((t) => {
      const enabledEl = document.getElementById(`lender-retype-${id}-${t.key}`);
      const enabled = !!(enabledEl && enabledEl.checked);

      const loanTypes = [];
      const enumList = getLoanTypesForRealEstateType(t.key); // ✅ 핵심
      enumList.forEach((lt) => {
        const cb = document.getElementById(`lender-loantype-${id}-${t.key}-${lt.key}`);
        if (cb && cb.checked) loanTypes.push(lt.key);
      });

      propertyTypes[t.key] = { enabled, loanTypes: enabled ? loanTypes : [] };
    });

    result.lenders[id] = {
      id,
      name,
      isPartner: true,
      isActive: !!(activeInput && activeInput.checked),
      products,
      phoneNumber: phoneInput ? phoneInput.value.trim() : "",
      kakaoUrl: kakaoInput ? kakaoInput.value.trim() : "",
      realEstate: { regions, propertyTypes }
    };
  });

  return result;
}

function updateLendersConfigPreview() {
  const pre = document.getElementById("lendersConfigPreview");
  if (!pre) return;
  try {
    pre.textContent = JSON.stringify(lendersConfig, null, 2);
  } catch (e) {
    pre.textContent = "(미리보기 생성 중 오류)";
  }
}

function setupLendersSaveButton() {
  const btn = document.getElementById("saveLendersConfigBtn");
  const statusEl = document.getElementById("lendersSaveStatus");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const payload = collectLendersConfigFromForm();

    try {
      const res = await fetch(`${API_BASE}/api/loan-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`API 실패: HTTP ${res.status} ${errText}`);
      }

      const json = await res.json().catch(() => null);
      console.log("loan-config saved:", json);

      if (json && typeof json === "object" && json.lenders) lendersConfig = json;
      else lendersConfig = payload;

      mergeLendersWithMaster();
      renderLendersList();
      updateLendersConfigPreview();

      if (statusEl) {
        statusEl.textContent = "온투업체 설정이 서버에 저장되었습니다.";
        setTimeout(() => {
          if (statusEl.textContent.includes("저장되었습니다")) statusEl.textContent = "";
        }, 3000);
      }

      alert("온투업체 설정이 저장되었습니다.");
    } catch (e) {
      console.error("saveLendersConfig error:", e);
      alert("온투업체 설정 저장 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.");
    }
  });
}

// ------------------------------------------------------
// 초기화
// ------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setupBetaMenu();
  setupAdminTabs();
  setupMoneyInputs();

  // 통계
  loadStatsFromStorage();
  setupStatsInteractions();

  // 온투업체 설정
  renderLendersList();
  updateLendersConfigPreview();
  setupLendersSaveButton();
  loadLendersConfigFromServer();
});
