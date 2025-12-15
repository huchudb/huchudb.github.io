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

/**
 * ✅ 서버 응답 형태가 달라도 살아남는 “강건 로더”
 */
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

/* ---------------- 2) 온투업체 설정 + (C) 검색/필터 ---------------- */
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

const LENDERS_MASTER = [
  { id: "fmfunding", name: "FM펀딩" },
  { id: "8percent", name: "에잇퍼센트" },
  { id: "peoplefund", name: "피플펀드" }
  // TODO: 49개 확장
];

let lendersConfig = { lenders: {} };

// ✅ 검색/필터 + UI 상태(열림 유지 포함)
let lenderUiState = {
  q: "",
  onlyActive: false,
  onlyPartner: false,
  productFilters: new Set(), // key set
  openIds: new Set()         // 펼쳐진 카드 id 유지
};

function ensureLender(id) {
  if (!lendersConfig.lenders) lendersConfig.lenders = {};
  if (!lendersConfig.lenders[id]) {
    lendersConfig.lenders[id] = {
      id,
      name: id,
      isActive: false,
      isPartner: false,
      products: [],
      phoneNumber: "",
      kakaoUrl: ""
    };
  }
  return lendersConfig.lenders[id];
}

function uniq(arr) {
  return Array.from(new Set(Array.isArray(arr) ? arr : []));
}

// ✅ preview는 잦은 업데이트 대비해서 프레임 단위로 합침
let _previewRAF = 0;
function schedulePreviewUpdate() {
  if (_previewRAF) return;
  _previewRAF = requestAnimationFrame(() => {
    _previewRAF = 0;
    updateLendersConfigPreview();
  });
}

// ✅ 상태 갱신 헬퍼 (해결책 A 핵심)
function updateLenderState(id, patch) {
  const lender = ensureLender(id);
  Object.assign(lender, patch);
  schedulePreviewUpdate();
}

// 필터가 켜져있을 때, 상태 변경이 가시 목록에 영향을 주면 다시 렌더
function maybeRerenderBecauseFiltersChanged(changedId) {
  // active/partner 필터
  if (lenderUiState.onlyActive || lenderUiState.onlyPartner) {
    renderLendersList();
    return;
  }
  // 상품군 필터
  if (lenderUiState.productFilters.size > 0) {
    renderLendersList();
    return;
  }
  // 검색어는 상태 변경과 직접 연관이 적어서 패스
  // (단, name/id는 여기서 수정 안 하므로)
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
      products: Array.isArray(existing.products) ? uniq(existing.products) : [],
      phoneNumber: existing.phoneNumber || "",
      kakaoUrl: existing.kakaoUrl || ""
    };
  });

  lendersConfig.lenders = merged;
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

// (C) 상품군 필터 UI 렌더
function renderProductFilterRow() {
  const wrap = document.getElementById("productFilterRow");
  if (!wrap) return;
  wrap.innerHTML = "";

  PRODUCT_GROUPS.forEach((pg) => {
    const label = document.createElement("label");
    label.className = "admin-chip-check admin-chip-check--filter";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = lenderUiState.productFilters.has(pg.key);

    cb.addEventListener("change", () => {
      if (cb.checked) lenderUiState.productFilters.add(pg.key);
      else lenderUiState.productFilters.delete(pg.key);
      renderLendersList();
    });

    const span = document.createElement("span");
    span.textContent = pg.label;

    label.appendChild(cb);
    label.appendChild(span);
    wrap.appendChild(label);
  });
}

function passesFilters(lender) {
  const q = (lenderUiState.q || "").trim().toLowerCase();
  if (q) {
    const hay = `${lender.name} ${lender.id}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (lenderUiState.onlyActive && !lender.isActive) return false;
  if (lenderUiState.onlyPartner && !lender.isPartner) return false;

  if (lenderUiState.productFilters.size > 0) {
    const has = (lender.products || []);
    const ok = [...lenderUiState.productFilters].some((k) => has.includes(k));
    if (!ok) return false;
  }
  return true;
}

function renderLendersList() {
  const container = document.getElementById("lendersList");
  if (!container) return;
  container.innerHTML = "";

  const cfg = lendersConfig.lenders || {};

  const visibleMasters = LENDERS_MASTER.filter((m) => {
    const lender = cfg[m.id];
    if (!lender) return false;
    return passesFilters(lender);
  });

  if (visibleMasters.length === 0) {
    const empty = document.createElement("div");
    empty.className = "admin-empty";
    empty.textContent = "조건에 맞는 온투업체가 없습니다. (검색/필터를 조정해 주세요)";
    container.appendChild(empty);
    return;
  }

  visibleMasters.forEach((m) => {
    const lender = cfg[m.id];
    if (!lender) return;

    const card = document.createElement("div");
    card.className = "lender-card";

    const headerBtn = document.createElement("button");
    headerBtn.type = "button";
    headerBtn.className = "lender-toggle";

    const nameSpan = document.createElement("span");
    nameSpan.className = "lender-toggle__name";
    nameSpan.textContent = lender.name;

    const badgesWrap = document.createElement("span");

    const partnerBadge = document.createElement("span");
    partnerBadge.className = "lender-badge lender-badge--partner";
    partnerBadge.classList.toggle("is-off", !lender.isPartner);
    partnerBadge.textContent = "제휴업체";

    const activeBadge = document.createElement("span");
    activeBadge.className = "lender-badge lender-badge--active";
    activeBadge.classList.toggle("is-off", !lender.isActive);
    activeBadge.textContent = "신규대출취급";

    badgesWrap.appendChild(partnerBadge);
    badgesWrap.appendChild(activeBadge);

    headerBtn.appendChild(nameSpan);
    headerBtn.appendChild(badgesWrap);

    const panel = document.createElement("div");
    panel.className = "lender-panel";
    // ✅ 열림 상태 유지
    panel.classList.toggle("hide", !lenderUiState.openIds.has(lender.id));

    const inner = document.createElement("div");
    inner.className = "lender-panel__inner";

    const switchGroup = document.createElement("div");
    switchGroup.className = "admin-field-grid";

    // 신규대출 취급여부
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

    // 제휴업체 여부
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

    // ✅ 상태 중심 업데이트 (DOM 수집 없음)
    activeInput.addEventListener("change", () => {
      const next = !!activeInput.checked;
      activeBadge.classList.toggle("is-off", !next);
      updateLenderState(lender.id, { isActive: next });
      maybeRerenderBecauseFiltersChanged(lender.id);
    });
    partnerInput.addEventListener("change", () => {
      const next = !!partnerInput.checked;
      partnerBadge.classList.toggle("is-off", !next);
      updateLenderState(lender.id, { isPartner: next });
      maybeRerenderBecauseFiltersChanged(lender.id);
    });

    switchGroup.appendChild(fieldActive);
    switchGroup.appendChild(fieldPartner);
    inner.appendChild(switchGroup);

    // 상품군 설정
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
      cb.id = `lender-product-${lender.id}-${pg.key}`;
      cb.checked = Array.isArray(lender.products) ? lender.products.includes(pg.key) : false;

      cb.addEventListener("change", () => {
        const cur = ensureLender(lender.id);
        const set = new Set(Array.isArray(cur.products) ? cur.products : []);
        if (cb.checked) set.add(pg.key);
        else set.delete(pg.key);
        updateLenderState(lender.id, { products: Array.from(set) });
        maybeRerenderBecauseFiltersChanged(lender.id);
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

    // 상담 채널 정보
    const contactBox = document.createElement("div");
    contactBox.className = "admin-subbox";
    const cTitle = document.createElement("h3");
    cTitle.className = "admin-subbox-title";
    cTitle.textContent = "상담 채널 정보";
    const cHelp = document.createElement("p");
    cHelp.className = "admin-subbox-help";
    cHelp.innerHTML =
      "유선상담 / 카카오톡 채팅상담 등 실제 연결할 정보를 입력하세요.<br />결과 화면에서 버튼으로 노출됩니다.";

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

    // ✅ 입력 즉시 state 반영 (재렌더 없음)
    phoneInput.addEventListener("input", () => {
      updateLenderState(lender.id, { phoneNumber: phoneInput.value });
    });
    phoneInput.addEventListener("blur", () => {
      updateLenderState(lender.id, { phoneNumber: phoneInput.value.trim() });
    });

    kakaoInput.addEventListener("input", () => {
      updateLenderState(lender.id, { kakaoUrl: kakaoInput.value });
    });
    kakaoInput.addEventListener("blur", () => {
      updateLenderState(lender.id, { kakaoUrl: kakaoInput.value.trim() });
    });

    contactGrid.appendChild(phoneField);
    contactGrid.appendChild(kakaoField);

    contactBox.appendChild(cTitle);
    contactBox.appendChild(cHelp);
    contactBox.appendChild(contactGrid);
    inner.appendChild(contactBox);

    panel.appendChild(inner);

    // ✅ 카드 열림/닫힘 상태도 state로 유지
    headerBtn.addEventListener("click", () => {
      const isOpen = lenderUiState.openIds.has(lender.id);
      if (isOpen) lenderUiState.openIds.delete(lender.id);
      else lenderUiState.openIds.add(lender.id);
      panel.classList.toggle("hide", isOpen);
    });

    card.appendChild(headerBtn);
    card.appendChild(panel);
    container.appendChild(card);
  });
}

function setupLendersSaveButton() {
  const btn = document.getElementById("saveLendersConfigBtn");
  const statusEl = document.getElementById("lendersSaveStatus");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    // ✅ 해결책 A: DOM 수집 금지, state 그대로 저장
    const payload = lendersConfig;

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
      lendersConfig = (json && typeof json === "object" && json.lenders) ? json : payload;

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

// (C) 검색/필터 이벤트 연결
function setupLendersControls() {
  renderProductFilterRow();

  const search = document.getElementById("lenderSearchInput");
  const onlyActive = document.getElementById("filterOnlyActive");
  const onlyPartner = document.getElementById("filterOnlyPartner");

  if (search) {
    search.addEventListener("input", () => {
      lenderUiState.q = search.value || "";
      renderLendersList();
    });
  }
  if (onlyActive) {
    onlyActive.addEventListener("change", () => {
      lenderUiState.onlyActive = !!onlyActive.checked;
      renderLendersList();
    });
  }
  if (onlyPartner) {
    onlyPartner.addEventListener("change", () => {
      lenderUiState.onlyPartner = !!onlyPartner.checked;
      renderLendersList();
    });
  }
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
