// /assets/admin-beta.js
console.log("✅ admin-beta.js loaded");

const API_BASE =
  (typeof window !== "undefined" && window.API_BASE) ? String(window.API_BASE) : "";

/* ---------------- 공통/유틸 ---------------- */
function setupBetaMenu() {
  const toggle = document.getElementById("betaMenuToggle");
  const panel = document.getElementById("betaMenuPanel");
  if (!toggle || !panel) return;

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = panel.classList.contains("hide");
    panel.classList.toggle("hide", !isHidden);
    toggle.setAttribute("aria-expanded", isHidden ? "true" : "false");
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

      panelStats.classList.toggle("hide", tab !== "stats");
      panelLenders.classList.toggle("hide", tab !== "lenders");
    });
  });
}

function stripNonDigits(str) { return (str || "").replace(/[^\d]/g, ""); }
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

/* ---------------- 1) 온투 통계 ---------------- */
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
  try { localStorage.setItem(STATS_LOCAL_KEY, JSON.stringify(statsRoot)); }
  catch (e) { console.warn("ontu-stats save error:", e); }
}
function getCurrentMonthKey() {
  const m = document.getElementById("statsMonth");
  return m ? (m.value || "").trim() : "";
}
function clearStatsForm() {
  ["statsRegisteredFirms","statsDataFirms","statsTotalLoan","statsTotalRepaid","statsBalance"]
    .forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });

  document.querySelectorAll("#productRows .js-ratio").forEach((el) => (el.value = ""));
  document.querySelectorAll("#productRows .js-amount").forEach((el) => (el.value = ""));
}
function fillStatsForm(stat) {
  if (!stat) { clearStatsForm(); return; }
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
    if (!balance || isNaN(ratio)) { amountEl.value = ""; return; }

    const amt = Math.round(balance * (ratio / 100));
    amountEl.value = formatWithCommas(String(amt));
  });
}

function normalizeOntuStatsResponseToMonth(json, monthKey) {
  if (!json) return null;

  if (json.byMonth && typeof json.byMonth === "object") {
    const hit = json.byMonth[monthKey];
    if (hit && typeof hit === "object") {
      return { summary: hit.summary || {}, products: hit.products || {} };
    }
  }

  if (Array.isArray(json)) {
    const found = json.find((x) => x && typeof x === "object" && x.monthKey === monthKey);
    if (found) return { summary: found.summary || {}, products: found.products || {} };
  }

  if (typeof json === "object") {
    if (json.summary || json.products) {
      return { summary: json.summary || {}, products: json.products || {} };
    }
    if (json.data && (json.data.summary || json.data.products)) {
      return { summary: json.data.summary || {}, products: json.data.products || {} };
    }
  }

  return null;
}

async function loadOntuStatsFromServer(monthKey) {
  if (!monthKey) return null;

  try {
    const url = `${API_BASE}/api/ontu-stats?monthKey=${encodeURIComponent(monthKey)}`;
    const res = await fetch(url, { method: "GET" });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const normalized = normalizeOntuStatsResponseToMonth(json, monthKey);
      if (normalized) return normalized;
    }
  } catch (e) {
    console.warn("ontu-stats server load (query) error:", e);
  }

  try {
    const urlAll = `${API_BASE}/api/ontu-stats`;
    const resAll = await fetch(urlAll, { method: "GET" });
    if (!resAll.ok) return null;
    const jsonAll = await resAll.json().catch(() => null);
    const normalized = normalizeOntuStatsResponseToMonth(jsonAll, monthKey);
    return normalized || null;
  } catch (e) {
    console.warn("ontu-stats server load (all) error:", e);
    return null;
  }
}

function setupStatsInteractions() {
  const monthInput = document.getElementById("statsMonth");
  if (monthInput) {
    monthInput.addEventListener("change", async () => {
      const m = getCurrentMonthKey();
      if (!m) { clearStatsForm(); return; }

      const serverStat = await loadOntuStatsFromServer(m);
      if (serverStat) {
        fillStatsForm(serverStat);
        statsRoot.byMonth[m] = serverStat;
        saveStatsToStorage();
      } else {
        fillStatsForm(statsRoot.byMonth[m] || null);
      }

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

  document.querySelectorAll("#productRows .js-ratio")
    .forEach((el) => el.addEventListener("input", recalcProductAmounts));

  const saveBtn = document.getElementById("saveOntuStatsBtn");
  const statusEl = document.getElementById("statsSaveStatus");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const payload = collectStatsFormData();
      if (!payload) { alert("먼저 조회년월을 선택해주세요."); return; }

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

/* ---------------- 2) 온투업체 설정 (필터 삭제, 검색만 유지) ---------------- */
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

// ===== 상세 설정: 지역/유형/대출종류 =====
const REGIONS = [
  { key: "seoul", label: "서울" },
  { key: "gyeonggi", label: "경기" },
  { key: "incheon", label: "인천" },
  { key: "chungcheong", label: "충청" },
  { key: "jeolla", label: "전라" },
  { key: "gyeongsang", label: "경상" },
  { key: "gangwon", label: "강원" },
  { key: "jeju", label: "제주" }
];

const PROPERTY_TYPES = [
  { key: "apt", label: "아파트", loanSet: "aptv" },
  { key: "villa", label: "다세대/연립", loanSet: "aptv" }, // ✅ 아파트/빌라만 7종 적용
  { key: "officetel", label: "오피스텔", loanSet: "base" },
  { key: "detached", label: "단독·다가구", loanSet: "base" },
  { key: "land", label: "토지·임야", loanSet: "base" },
  { key: "commercial", label: "근린생활시설", loanSet: "base" }
];

const LOAN_TYPES_BASE = [
  { key: "일반담보대출", label: "일반담보대출" },
  { key: "임대보증금반환대출", label: "임대보증금반환대출" },
  { key: "지분대출", label: "지분대출" },
  { key: "경락잔금대출", label: "경락잔금대출" },
  { key: "대환대출", label: "대환대출" }
];

const LOAN_TYPES_APTVILLA = [
  ...LOAN_TYPES_BASE,
  { key: "매입잔금_일반", label: "매입잔금(일반)" },
  { key: "매입잔금_분양", label: "매입잔금(분양)" }
];

const LENDERS_MASTER = [
  { id: "fmfunding", name: "FM펀딩" },
  { id: "8percent", name: "에잇퍼센트" },
  { id: "peoplefund", name: "피플펀드" }
  // TODO: 49개 확장
];

let lendersConfig = { lenders: {} };

// ✅ 검색 + 펼침 유지 + 지역 탭 상태
let lenderUiState = {
  q: "",
  openIds: new Set(),
  activeRegionById: {} // { [lenderId]: regionKey }
};

function uniq(arr) {
  return Array.from(new Set(Array.isArray(arr) ? arr : []));
}

function ensureLender(id) {
  if (!lendersConfig.lenders) lendersConfig.lenders = {};
  if (!lendersConfig.lenders[id]) {
    lendersConfig.lenders[id] = {
      id,
      name: id,
      isActive: false,
      isPartner: false,
      partnerOrder: 0,
      products: [],
      phoneNumber: "",
      kakaoUrl: "",
      regions: {}
    };
  }
  return lendersConfig.lenders[id];
}

function ensureLenderDeepDefaults(lender) {
  if (!lender) return;
  if (typeof lender.partnerOrder !== "number") lender.partnerOrder = 0;
  if (!Array.isArray(lender.products)) lender.products = [];
  lender.products = uniq(lender.products);

  if (!lender.regions || typeof lender.regions !== "object") lender.regions = {};

  REGIONS.forEach((r) => {
    if (!lender.regions[r.key] || typeof lender.regions[r.key] !== "object") lender.regions[r.key] = {};
    PROPERTY_TYPES.forEach((pt) => {
      const prev = lender.regions[r.key][pt.key] || {};
      lender.regions[r.key][pt.key] = {
        enabled: !!prev.enabled,
        ltvMin: prev.ltvMin ?? "",
        ltvMax: prev.ltvMax ?? "",
        loanTypes: Array.isArray(prev.loanTypes) ? uniq(prev.loanTypes) : []
      };
    });
  });
}

// preview는 잦은 업데이트 대비
let _previewRAF = 0;
function schedulePreviewUpdate() {
  if (_previewRAF) return;
  _previewRAF = requestAnimationFrame(() => {
    _previewRAF = 0;
    updateLendersConfigPreview();
  });
}

function updateLenderState(id, patch) {
  const lender = ensureLender(id);
  Object.assign(lender, patch);
  ensureLenderDeepDefaults(lender);
  schedulePreviewUpdate();
}

function mergeLendersWithMaster() {
  const merged = {};
  const current = (lendersConfig && lendersConfig.lenders) || {};

  LENDERS_MASTER.forEach((m) => {
    const existing = current[m.id] || {};
    merged[m.id] = {
      id: m.id,
      name: m.name,
      isActive: typeof existing.isActive === "boolean" ? existing.isActive : false,
      isPartner: typeof existing.isPartner === "boolean" ? existing.isPartner : false,
      partnerOrder: typeof existing.partnerOrder === "number" ? existing.partnerOrder : 0,
      products: Array.isArray(existing.products) ? uniq(existing.products) : [],
      phoneNumber: existing.phoneNumber || "",
      kakaoUrl: existing.kakaoUrl || "",
      regions: (existing.regions && typeof existing.regions === "object") ? existing.regions : {}
    };
  });

  lendersConfig.lenders = merged;
  Object.values(lendersConfig.lenders).forEach(ensureLenderDeepDefaults);
}

async function loadLendersConfigFromServer() {
  try {
    const res = await fetch(`${API_BASE}/api/loan-config`, { method: "GET" });
    if (!res.ok) {
      console.warn("loan-config GET 실패, 빈 설정으로 시작:", res.status);
      lendersConfig = { lenders: {} };
    } else {
      const json = await res.json().catch(() => null);
      lendersConfig = (json && typeof json === "object" && json.lenders) ? json : { lenders: {} };
    }
  } catch (e) {
    console.warn("loan-config fetch error:", e);
    lendersConfig = { lenders: {} };
  }

  mergeLendersWithMaster();
  renderLendersList();
  updateLendersConfigPreview();
}

function updateLendersConfigPreview() {
  const pre = document.getElementById("lendersConfigPreview");
  if (!pre) return;
  try { pre.textContent = JSON.stringify(lendersConfig, null, 2); }
  catch { pre.textContent = "(미리보기 생성 중 오류)"; }
}

function passesSearch(lender) {
  const q = (lenderUiState.q || "").trim().toLowerCase();
  if (!q) return true;
  const hay = `${lender.name} ${lender.id}`.toLowerCase();
  return hay.includes(q);
}

function getActiveRegionFor(id) {
  const cur = lenderUiState.activeRegionById[id];
  if (cur) return cur;
  lenderUiState.activeRegionById[id] = REGIONS[0].key;
  return REGIONS[0].key;
}

function setPartnerOrderUnique(targetId, orderNum) {
  // 같은 숫자를 다른 제휴업체가 쓰고 있으면 0으로 해제
  Object.values(lendersConfig.lenders || {}).forEach((l) => {
    if (!l || l.id === targetId) return;
    if (l.partnerOrder === orderNum) l.partnerOrder = 0;
  });
  updateLenderState(targetId, { partnerOrder: orderNum });
}

async function postLendersConfigToServer(successText) {
  const payload = lendersConfig;

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
  lendersConfig = (json && typeof json === "object" && json.lenders) ? json : payload;

  mergeLendersWithMaster();
  renderLendersList();
  updateLendersConfigPreview();

  return successText || "저장되었습니다.";
}

function renderLendersList() {
  const container = document.getElementById("lendersList");
  if (!container) return;
  container.innerHTML = "";

  const cfg = lendersConfig.lenders || {};
  const visibleMasters = LENDERS_MASTER.filter((m) => {
    const lender = cfg[m.id];
    if (!lender) return false;
    return passesSearch(lender);
  });

  if (visibleMasters.length === 0) {
    const empty = document.createElement("div");
    empty.className = "admin-empty";
    empty.textContent = "검색 조건에 맞는 온투업체가 없습니다.";
    container.appendChild(empty);
    return;
  }

  visibleMasters.forEach((m) => {
    const lender = cfg[m.id];
    if (!lender) return;

    const card = document.createElement("div");
    card.className = "lender-card";

    /* ---------- 헤더: 업체명+뱃지 + 스위치 + (제휴ON)표시순서 ---------- */
    const head = document.createElement("div");
    head.className = "lender-head";

    const left = document.createElement("div");
    left.className = "lender-head__left";

    const topline = document.createElement("div");
    topline.className = "lender-head__topline";

    const name = document.createElement("span");
    name.className = "lender-name";
    name.textContent = lender.name;

    const partnerBadge = document.createElement("span");
    partnerBadge.className = "lender-badge lender-badge--partner";
    partnerBadge.classList.toggle("is-off", !lender.isPartner);
    partnerBadge.textContent = "제휴업체";

    const activeBadge = document.createElement("span");
    activeBadge.className = "lender-badge lender-badge--active";
    activeBadge.classList.toggle("is-off", !lender.isActive);
    activeBadge.textContent = "신규대출취급";

    topline.appendChild(name);
    topline.appendChild(partnerBadge);
    topline.appendChild(activeBadge);
    left.appendChild(topline);

    const right = document.createElement("div");
    right.className = "lender-head__right";

    const switchRow = document.createElement("div");
    switchRow.className = "lender-switch-row";

    // 신규대출 스위치
    const activeItem = document.createElement("div");
    activeItem.className = "lender-switch-item";
    const activeText = document.createElement("span");
    activeText.textContent = "신규대출 취급여부";
    const activeSwitchWrap = document.createElement("label");
    activeSwitchWrap.className = "admin-switch";
    const activeInput = document.createElement("input");
    activeInput.type = "checkbox";
    activeInput.checked = !!lender.isActive;
    activeSwitchWrap.appendChild(activeInput);
    activeItem.appendChild(activeText);
    activeItem.appendChild(activeSwitchWrap);

    // 제휴 스위치
    const partnerItem = document.createElement("div");
    partnerItem.className = "lender-switch-item";
    const partnerText = document.createElement("span");
    partnerText.textContent = "제휴업체 여부";
    const partnerSwitchWrap = document.createElement("label");
    partnerSwitchWrap.className = "admin-switch";
    const partnerInput = document.createElement("input");
    partnerInput.type = "checkbox";
    partnerInput.checked = !!lender.isPartner;
    partnerSwitchWrap.appendChild(partnerInput);
    partnerItem.appendChild(partnerText);
    partnerItem.appendChild(partnerSwitchWrap);

    switchRow.appendChild(activeItem);
    switchRow.appendChild(partnerItem);

    // 펼치기 버튼 (스위치 클릭과 충돌 방지용)
    const expandBtn = document.createElement("button");
    expandBtn.type = "button";
    expandBtn.className = "lender-expand-btn";
    expandBtn.textContent = lenderUiState.openIds.has(lender.id) ? "접기" : "상세";

    // 이벤트
    activeInput.addEventListener("change", () => {
      const next = !!activeInput.checked;
      activeBadge.classList.toggle("is-off", !next);
      updateLenderState(lender.id, { isActive: next });
    });

    partnerInput.addEventListener("change", () => {
      const next = !!partnerInput.checked;
      partnerBadge.classList.toggle("is-off", !next);

      // 제휴 OFF로 바꾸면 표시순서 0으로 정리
      const patch = { isPartner: next };
      if (!next) patch.partnerOrder = 0;

      updateLenderState(lender.id, patch);

      // 헤더에 표시순서 UI가 있어서, 토글 후 즉시 UI 반영 필요 → 재렌더
      renderLendersList();
    });

    // (제휴 ON일 때만) 표시순서 칩
    const orderRow = document.createElement("div");
    orderRow.className = "admin-order-row";
    orderRow.style.display = lender.isPartner ? "flex" : "none";

    const orderTitle = document.createElement("span");
    orderTitle.className = "admin-order-title";
    orderTitle.textContent = "제휴업체 표시순서";

    const orderChips = document.createElement("div");
    orderChips.className = "admin-order-chips";

    const N = Math.max(5, LENDERS_MASTER.length); // 최소 5개는 보이게
    for (let i = 1; i <= N; i++) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "admin-order-chip";
      chip.textContent = String(i);
      chip.classList.toggle("is-active", lender.partnerOrder === i);

      chip.addEventListener("click", () => {
        setPartnerOrderUnique(lender.id, i);
        renderLendersList();
      });

      orderChips.appendChild(chip);
    }

    orderRow.appendChild(orderTitle);
    orderRow.appendChild(orderChips);

    right.appendChild(switchRow);
    right.appendChild(orderRow);
    right.appendChild(expandBtn);

    head.appendChild(left);
    head.appendChild(right);

    /* ---------- 패널 ---------- */
    const panel = document.createElement("div");
    panel.className = "lender-panel";
    panel.classList.toggle("hide", !lenderUiState.openIds.has(lender.id));

    const inner = document.createElement("div");
    inner.className = "lender-panel__inner";

    expandBtn.addEventListener("click", () => {
      const isOpen = lenderUiState.openIds.has(lender.id);
      if (isOpen) lenderUiState.openIds.delete(lender.id);
      else lenderUiState.openIds.add(lender.id);

      panel.classList.toggle("hide", isOpen);
      expandBtn.textContent = isOpen ? "상세" : "접기";
    });

    /* ---------- 1) 상품군 ---------- */
    const productsBox = document.createElement("div");
    productsBox.className = "admin-subbox";

    const pTitle = document.createElement("h3");
    pTitle.className = "admin-subbox-title";
    pTitle.textContent = "취급 상품군 설정";

    const pHelp = document.createElement("p");
    pHelp.className = "admin-subbox-help";
    pHelp.textContent = "네비게이션 첫 화면에서 선택 가능한 상품군입니다. 실제 취급 상품만 체크하세요.";

    const chipRow = document.createElement("div");
    chipRow.className = "admin-chip-row";

    PRODUCT_GROUPS.forEach((pg) => {
      const label = document.createElement("label");
      label.className = "admin-chip-check";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = Array.isArray(lender.products) ? lender.products.includes(pg.key) : false;

      cb.addEventListener("change", () => {
        const cur = ensureLender(lender.id);
        const set = new Set(Array.isArray(cur.products) ? cur.products : []);
        if (cb.checked) set.add(pg.key);
        else set.delete(pg.key);
        updateLenderState(lender.id, { products: Array.from(set) });
      });

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

    /* ---------- 2) 지역/유형/LTV/대출종류 ---------- */
    const matrixBox = document.createElement("div");
    matrixBox.className = "admin-subbox";

    const mTitle = document.createElement("h3");
    mTitle.className = "admin-subbox-title";
    mTitle.textContent = "지역/유형별 취급여부 + LTV + 취급 대출 종류";

    const mHelp = document.createElement("p");
    mHelp.className = "admin-subbox-help";
    mHelp.textContent = "지역 탭을 선택한 뒤, 부동산 유형별로 취급여부/최소~최대 LTV/취급 대출 종류를 설정하세요.";

    const regionTabs = document.createElement("div");
    regionTabs.className = "admin-region-tabs";

    const activeRegion = getActiveRegionFor(lender.id);

    REGIONS.forEach((r) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "admin-region-tab";
      btn.textContent = r.label;
      btn.classList.toggle("is-active", activeRegion === r.key);

      btn.addEventListener("click", () => {
        lenderUiState.activeRegionById[lender.id] = r.key;
        renderLendersList();
        // 펼친 상태 유지
        lenderUiState.openIds.add(lender.id);
      });

      regionTabs.appendChild(btn);
    });

    const table = document.createElement("table");
    table.className = "admin-matrix";

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th style="width:160px;">부동산 유형</th>
        <th class="cell-center" style="width:90px;">취급여부</th>
        <th style="width:230px;">LTV 설정</th>
        <th>취급 대출 종류</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    PROPERTY_TYPES.forEach((pt) => {
      const tr = document.createElement("tr");

      // data
      const cell = lender.regions[activeRegion][pt.key];

      // 부동산 유형
      const tdType = document.createElement("td");
      tdType.textContent = pt.label;

      // 취급여부
      const tdEnable = document.createElement("td");
      tdEnable.className = "cell-center";
      const enable = document.createElement("input");
      enable.type = "checkbox";
      enable.checked = !!cell.enabled;
      enable.addEventListener("change", () => {
        const cur = ensureLender(lender.id);
        cur.regions[activeRegion][pt.key].enabled = !!enable.checked;
        schedulePreviewUpdate();
      });
      tdEnable.appendChild(enable);

      // LTV
      const tdLtv = document.createElement("td");
      const ltvWrap = document.createElement("div");
      ltvWrap.style.display = "flex";
      ltvWrap.style.alignItems = "center";
      ltvWrap.style.gap = "8px";
      ltvWrap.style.flexWrap = "wrap";

      const min = document.createElement("input");
      min.type = "number";
      min.className = "admin-mini-input";
      min.placeholder = "최소";
      min.value = cell.ltvMin ?? "";
      min.addEventListener("input", () => {
        const cur = ensureLender(lender.id);
        cur.regions[activeRegion][pt.key].ltvMin = min.value;
        schedulePreviewUpdate();
      });

      const mid = document.createElement("span");
      mid.textContent = "% ~";

      const max = document.createElement("input");
      max.type = "number";
      max.className = "admin-mini-input";
      max.placeholder = "최대";
      max.value = cell.ltvMax ?? "";
      max.addEventListener("input", () => {
        const cur = ensureLender(lender.id);
        cur.regions[activeRegion][pt.key].ltvMax = max.value;
        schedulePreviewUpdate();
      });

      const pct = document.createElement("span");
      pct.textContent = "%";

      ltvWrap.appendChild(min);
      ltvWrap.appendChild(mid);
      ltvWrap.appendChild(max);
      ltvWrap.appendChild(pct);
      tdLtv.appendChild(ltvWrap);

      // 대출 종류 칩
      const tdLoans = document.createElement("td");
      const loanRow = document.createElement("div");
      loanRow.className = "admin-chip-row admin-chip-row--tight";

      const loanTypes = (pt.loanSet === "aptv") ? LOAN_TYPES_APTVILLA : LOAN_TYPES_BASE;

      loanTypes.forEach((lt) => {
        const label = document.createElement("label");
        label.className = "admin-chip-check admin-chip-check--tiny";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = Array.isArray(cell.loanTypes) ? cell.loanTypes.includes(lt.key) : false;

        cb.addEventListener("change", () => {
          const cur = ensureLender(lender.id);
          const arr = cur.regions[activeRegion][pt.key].loanTypes || [];
          const set = new Set(arr);
          if (cb.checked) set.add(lt.key);
          else set.delete(lt.key);
          cur.regions[activeRegion][pt.key].loanTypes = Array.from(set);
          schedulePreviewUpdate();
        });

        const span = document.createElement("span");
        span.textContent = lt.label;

        label.appendChild(cb);
        label.appendChild(span);
        loanRow.appendChild(label);
      });

      tdLoans.appendChild(loanRow);

      tr.appendChild(tdType);
      tr.appendChild(tdEnable);
      tr.appendChild(tdLtv);
      tr.appendChild(tdLoans);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    matrixBox.appendChild(mTitle);
    matrixBox.appendChild(mHelp);
    matrixBox.appendChild(regionTabs);
    matrixBox.appendChild(table);
    inner.appendChild(matrixBox);

    /* ---------- 3) 상담채널 ---------- */
    const contactBox = document.createElement("div");
    contactBox.className = "admin-subbox";

    const cTitle = document.createElement("h3");
    cTitle.className = "admin-subbox-title";
    cTitle.textContent = "상담 채널 정보";

    const cHelp = document.createElement("p");
    cHelp.className = "admin-subbox-help";
    cHelp.innerHTML = "유선상담 / 카카오톡 채팅상담 등 실제 연결할 정보를 입력하세요.<br />결과 화면에서 버튼으로 노출됩니다.";

    const contactGrid = document.createElement("div");
    contactGrid.className = "admin-field-grid";

    const phoneField = document.createElement("div");
    phoneField.className = "admin-field";
    const phoneLabel = document.createElement("label");
    phoneLabel.textContent = "유선상담 전화번호";
    const phoneInput = document.createElement("input");
    phoneInput.type = "text";
    phoneInput.className = "admin-input";
    phoneInput.placeholder = "예) 02-1234-5678";
    phoneInput.value = lender.phoneNumber || "";
    phoneInput.addEventListener("input", () => updateLenderState(lender.id, { phoneNumber: phoneInput.value }));
    phoneInput.addEventListener("blur", () => updateLenderState(lender.id, { phoneNumber: phoneInput.value.trim() }));
    phoneField.appendChild(phoneLabel);
    phoneField.appendChild(phoneInput);

    const kakaoField = document.createElement("div");
    kakaoField.className = "admin-field";
    const kakaoLabel = document.createElement("label");
    kakaoLabel.textContent = "카카오톡 채팅상담 URL";
    const kakaoInput = document.createElement("input");
    kakaoInput.type = "text";
    kakaoInput.className = "admin-input";
    kakaoInput.placeholder = "예) https://pf.kakao.com/...";
    kakaoInput.value = lender.kakaoUrl || "";
    kakaoInput.addEventListener("input", () => updateLenderState(lender.id, { kakaoUrl: kakaoInput.value }));
    kakaoInput.addEventListener("blur", () => updateLenderState(lender.id, { kakaoUrl: kakaoInput.value.trim() }));
    kakaoField.appendChild(kakaoLabel);
    kakaoField.appendChild(kakaoInput);

    contactGrid.appendChild(phoneField);
    contactGrid.appendChild(kakaoField);

    contactBox.appendChild(cTitle);
    contactBox.appendChild(cHelp);
    contactBox.appendChild(contactGrid);
    inner.appendChild(contactBox);

    /* ---------- 4) 카드별 저장 ---------- */
    const saveRow = document.createElement("div");
    saveRow.className = "lender-save-row";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "lender-save-btn";
    saveBtn.textContent = "저장";

    saveBtn.addEventListener("click", async () => {
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = "저장중...";
        await postLendersConfigToServer("저장되었습니다.");
        alert(`${lender.name} 설정이 저장되었습니다.`);
      } catch (e) {
        console.error("per-card save error:", e);
        alert("저장 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "저장";
      }
    });

    saveRow.appendChild(saveBtn);
    inner.appendChild(saveRow);

    panel.appendChild(inner);

    card.appendChild(head);
    card.appendChild(panel);
    container.appendChild(card);
  });
}

function setupLendersControls() {
  const search = document.getElementById("lenderSearchInput");
  if (search) {
    search.addEventListener("input", () => {
      lenderUiState.q = search.value || "";
      renderLendersList();
    });
  }
}

function setupLendersSaveButton() {
  const btn = document.getElementById("saveLendersConfigBtn");
  const statusEl = document.getElementById("lendersSaveStatus");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      btn.disabled = true;
      const prevText = btn.textContent;
      btn.textContent = "저장중...";

      await postLendersConfigToServer("전체 저장되었습니다.");

      if (statusEl) {
        statusEl.textContent = "온투업체 설정이 서버에 저장되었습니다.";
        setTimeout(() => {
          if (statusEl.textContent.includes("저장되었습니다")) statusEl.textContent = "";
        }, 3000);
      }
      alert("전체 설정이 저장되었습니다.");

      btn.textContent = prevText;
      btn.disabled = false;
    } catch (e) {
      console.error("saveLendersConfig error:", e);
      btn.disabled = false;
      btn.textContent = "전체 저장";
      alert("온투업체 설정 저장 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.");
    }
  });
}

/* ---------------- 초기화 ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  setupBetaMenu();
  setupAdminTabs();
  setupMoneyInputs();

  loadStatsFromStorage();
  setupStatsInteractions();

  mergeLendersWithMaster();
  setupLendersControls();
  renderLendersList();
  updateLendersConfigPreview();
  setupLendersSaveButton();
  loadLendersConfigFromServer();
});
