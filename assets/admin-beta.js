// /assets/admin-beta.js
// 후추 베타 관리자 스크립트
// - 탭 전환
// - 온투 통계 저장 (/api/ontu-stats)
// - 온투업체 네비게이션 설정 (/api/loan-config)

console.log("✅ admin-beta.js loaded");

// ------------------------------------------------------
// 공통: 메뉴 토글, 숫자 유틸, 금액 포맷
// ------------------------------------------------------

// 상단 MENU 드롭다운
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

// 탭 전환 (온투업 통계 저장 / 온투업체 정보 등록)
function setupAdminTabs() {
  const tabButtons = document.querySelectorAll(".admin-tab-btn");
  const panelStats = document.getElementById("admin-tab-stats");
  const panelLenders = document.getElementById("admin-tab-lenders");
  if (!tabButtons.length || !panelStats || !panelLenders) return;

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      // 버튼 active 토글
      tabButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      // 패널 show/hide
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
function setupMoneyInputs(root) {
  const scope = root || document;
  const moneyInputs = scope.querySelectorAll('input[data-type="money"]');
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
// 1. 온투업 통계 저장 (ontu-stats)
// ------------------------------------------------------

const STATS_LOCAL_KEY = "huchu_ontu_stats_beta_v2";

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
      // money 포맷 재적용
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
        // 1) 서버로 저장
        const res = await fetch("/api/ontu-stats", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            monthKey,
            summary,
            products
          })
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`API 실패: HTTP ${res.status} ${errText}`);
        }

        const json = await res.json().catch(() => null);
        console.log("ontu-stats saved:", json);

        // 2) localStorage에도 저장
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
// 2. 온투업체 네비게이션 설정 (loan-config)
//   : 최소 스펙 = 신규대출취급, 제휴업체, 취급 상품군, 연락처
// ------------------------------------------------------

// 네비 첫 화면에서 선택하는 상품군 키와 동일하게 맞춤
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

// 기본 온투업체 목록 (id는 영문 고정키, name은 화면 표시용)
// → 나중에 여기 배열만 늘려도 UI 자동 생성됨
const LENDERS_MASTER = [
  { id: "fmfunding", name: "FM펀딩" },
  { id: "8percent", name: "에잇퍼센트" },
  { id: "peoplefund", name: "피플펀드" }
  // TODO: 나중에 실제 49개 목록으로 확장
];

let lendersConfig = {
  // lenders: {
  //   fmfunding: { id, name, isActive, isPartner, products:[], phoneNumber, kakaoUrl }
  // }
  lenders: {}
};

// 서버 → lendersConfig 로드
async function loadLendersConfigFromServer() {
  try {
    const res = await fetch("/api/loan-config", { method: "GET" });
    if (!res.ok) {
      console.warn("loan-config GET 실패, 빈 설정으로 시작:", res.status);
      lendersConfig = { lenders: {} };
    } else {
      const json = await res.json().catch(() => null);
      if (json && typeof json === "object" && json.lenders) {
        lendersConfig = json;
      } else {
        lendersConfig = { lenders: {} };
      }
    }
  } catch (e) {
    console.warn("loan-config fetch error:", e);
    lendersConfig = { lenders: {} };
  }

  mergeLendersWithMaster();
  renderLendersList();
  updateLendersConfigPreview();
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
      isActive: typeof existing.isActive === "boolean" ? existing.isActive : false,
      isPartner: typeof existing.isPartner === "boolean" ? existing.isPartner : false,
      products: Array.isArray(existing.products) ? existing.products : [],
      phoneNumber: existing.phoneNumber || "",
      kakaoUrl: existing.kakaoUrl || ""
    };
  });

  lendersConfig.lenders = merged;
}

// 온투업체 리스트 렌더링
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

    // 제휴업체 배지
    const partnerBadge = document.createElement("span");
    partnerBadge.className = "lender-badge lender-badge--partner";
    if (!lender.isPartner) partnerBadge.classList.add("is-off");
    partnerBadge.textContent = "제휴업체";

    // 신규대출취급 배지
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

    // 1) on/off 스위치
    const switchGroup = document.createElement("div");
    switchGroup.className = "admin-field-grid";

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

    switchGroup.appendChild(fieldActive);
    switchGroup.appendChild(fieldPartner);

    inner.appendChild(switchGroup);

    // 2) 취급 상품군 체크박스
    const productsBox = document.createElement("div");
    productsBox.className = "admin-subbox";
    const pTitle = document.createElement("h3");
    pTitle.className = "admin-subbox-title";
    pTitle.textContent = "취급 상품군 설정";
    const pHelp = document.createElement("p");
    pHelp.className = "admin-subbox-help";
    pHelp.textContent =
      "후추 네비게이션 첫 화면에서 선택 가능한 상품군입니다. 해당 온투업체가 실제로 취급하는 상품만 체크해주세요.";
    const chipRow = document.createElement("div");
    chipRow.className = "admin-chip-row";

    (PRODUCT_GROUPS || []).forEach((pg) => {
      const label = document.createElement("label");
      label.className = "admin-chip-check";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = `lender-product-${lender.id}-${pg.key}`;
      cb.checked = Array.isArray(lender.products)
        ? lender.products.includes(pg.key)
        : false;
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

    // 3) 상담 채널
    const contactBox = document.createElement("div");
    contactBox.className = "admin-subbox";
    const cTitle = document.createElement("h3");
    cTitle.className = "admin-subbox-title";
    cTitle.textContent = "상담 채널 정보";
    const cHelp = document.createElement("p");
    cHelp.className = "admin-subbox-help";
    cHelp.innerHTML =
      "유선상담 / 카카오톡 채팅상담 등 실제로 연결할 채널 정보를 입력해주세요.<br />" +
      "네비게이션 결과 화면에서 온투업체 카드에 버튼으로 노출됩니다.";

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
      const isHidden = panel.classList.contains("hide");
      if (isHidden) {
        panel.classList.remove("hide");
      } else {
        panel.classList.add("hide");
      }
    });

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

    const activeInput = document.getElementById(`lender-active-${id}`);
    const partnerInput = document.getElementById(`lender-partner-${id}`);
    const phoneInput = document.getElementById(`lender-phone-${id}`);
    const kakaoInput = document.getElementById(`lender-kakao-${id}`);

    const products = [];
    PRODUCT_GROUPS.forEach((pg) => {
      const cb = document.getElementById(`lender-product-${id}-${pg.key}`);
      if (cb && cb.checked) products.push(pg.key);
    });

    result.lenders[id] = {
      id,
      name,
      isActive: !!(activeInput && activeInput.checked),
      isPartner: !!(partnerInput && partnerInput.checked),
      products,
      phoneNumber: phoneInput ? phoneInput.value.trim() : "",
      kakaoUrl: kakaoInput ? kakaoInput.value.trim() : ""
    };
  });

  return result;
}

// 미리보기 영역 업데이트
function updateLendersConfigPreview() {
  const pre = document.getElementById("lendersConfigPreview");
  if (!pre) return;
  try {
    pre.textContent = JSON.stringify(lendersConfig, null, 2);
  } catch (e) {
    pre.textContent = "(미리보기 생성 중 오류)";
  }
}

// 저장 버튼 핸들러
function setupLendersSaveButton() {
  const btn = document.getElementById("saveLendersConfigBtn");
  const statusEl = document.getElementById("lendersSaveStatus");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const payload = collectLendersConfigFromForm();

    try {
      const res = await fetch("/api/loan-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`API 실패: HTTP ${res.status} ${errText}`);
      }

      const json = await res.json().catch(() => null);
      console.log("loan-config saved:", json);

      // 서버 응답이 lenders 구조를 돌려주면 반영
      if (json && typeof json === "object" && json.lenders) {
        lendersConfig = json;
      } else {
        lendersConfig = payload;
      }

      mergeLendersWithMaster();
      updateLendersConfigPreview();

      if (statusEl) {
        statusEl.textContent = "온투업체 설정이 서버에 저장되었습니다.";
        setTimeout(() => {
          if (statusEl.textContent.includes("저장되었습니다")) {
            statusEl.textContent = "";
          }
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
  // 공통
  setupBetaMenu();
  setupAdminTabs();
  setupMoneyInputs();

  // 통계
  loadStatsFromStorage();
  setupStatsInteractions();

  // 온투업체 설정
  renderLendersList(); // 서버 로드 전, 빈 상태라도 기본 구조만 만들어두기
  updateLendersConfigPreview();
  setupLendersSaveButton();
  loadLendersConfigFromServer();
});
