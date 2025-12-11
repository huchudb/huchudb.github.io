// /assets/admin-beta.js  (온투업 베타 관리자 스크립트)
console.log("✅ admin-beta.js loaded");

// ------------------------------------------------------
// 공통 유틸
// ------------------------------------------------------
const STATS_LOCAL_KEY   = "huchu_ontu_stats_beta_v2";      // 기존 통계용
const LENDERS_LOCAL_KEY = "huchu_lenders_config_beta_v1";  // 온투업체 설정용

// 숫자 관련 유틸
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

// 금액 input에 3자리 쉼표 자동 적용
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

// 상단 MENU 드롭다운
function setupBetaMenu() {
  const toggle = document.getElementById("betaMenuToggle");
  const panel  = document.getElementById("betaMenuPanel");
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
// 1. 온투업 통계(기존 ontu-stats) 관리자
// ------------------------------------------------------

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

// stats 객체 → 폼에 세팅
function fillStatsForm(stat) {
  if (!stat) {
    clearStatsForm();
    return;
  }

  const s = stat.summary || {};
  const p = stat.products || {};

  const regEl   = document.getElementById("statsRegisteredFirms");
  const dataEl  = document.getElementById("statsDataFirms");
  const tlEl    = document.getElementById("statsTotalLoan");
  const trEl    = document.getElementById("statsTotalRepaid");
  const balEl   = document.getElementById("statsBalance");

  if (regEl) regEl.value = s.registeredFirms ?? "";
  if (dataEl) dataEl.value = s.dataFirms ?? "";
  if (tlEl)   tlEl.value   = s.totalLoan ? formatWithCommas(String(s.totalLoan)) : "";
  if (trEl)   trEl.value   = s.totalRepaid ? formatWithCommas(String(s.totalRepaid)) : "";
  if (balEl)  balEl.value  = s.balance ? formatWithCommas(String(s.balance)) : "";

  const tbody = document.getElementById("productRows");
  if (!tbody) return;

  const rows = tbody.querySelectorAll("tr[data-key]");
  rows.forEach((row) => {
    const key = row.getAttribute("data-key");
    const cfg = p[key] || {};
    const ratioEl  = row.querySelector(".js-ratio");
    const amountEl = row.querySelector(".js-amount");
    if (ratioEl)  ratioEl.value  = cfg.ratioPercent != null ? cfg.ratioPercent : "";
    if (amountEl) amountEl.value = cfg.amount != null ? formatWithCommas(String(cfg.amount)) : "";
  });
}

// 폼 → stats 객체
function collectStatsFormData() {
  const monthKey = getCurrentMonthKey();
  if (!monthKey) return null;

  const regEl   = document.getElementById("statsRegisteredFirms");
  const dataEl  = document.getElementById("statsDataFirms");
  const tlEl    = document.getElementById("statsTotalLoan");
  const trEl    = document.getElementById("statsTotalRepaid");
  const balEl   = document.getElementById("statsBalance");

  const summary = {
    registeredFirms: regEl ? Number(regEl.value || 0) : 0,
    dataFirms:      dataEl ? Number(dataEl.value || 0) : 0,
    totalLoan:      getMoneyValue(tlEl),
    totalRepaid:    getMoneyValue(trEl),
    balance:        getMoneyValue(balEl)
  };

  const products = {};
  const rows = document.querySelectorAll("#productRows tr[data-key]");
  rows.forEach((row) => {
    const key = row.getAttribute("data-key");
    if (!key) return;
    const ratioEl  = row.querySelector(".js-ratio");
    const amountEl = row.querySelector(".js-amount");

    const ratioPercent = ratioEl && ratioEl.value !== "" ? Number(ratioEl.value) : 0;
    const amount       = getMoneyValue(amountEl);

    if (ratioPercent === 0 && amount === 0) return;

    products[key] = {
      ratioPercent,
      amount
    };
  });

  return { monthKey, summary, products };
}

// 비율/잔액 → 상품별 금액 자동계산
function recalcProductAmounts() {
  const balEl = document.getElementById("statsBalance");
  if (!balEl) return;
  const balance = getMoneyValue(balEl);
  const rows = document.querySelectorAll("#productRows tr[data-key]");

  rows.forEach((row) => {
    const ratioEl  = row.querySelector(".js-ratio");
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
      setupMoneyInputs(); // 포맷 재적용
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
        // 1) 서버 저장
        const res = await fetch("https://huchudb-github-io.vercel.app/api/ontu-stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monthKey, summary, products })
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`API 실패: HTTP ${res.status} ${errText}`);
        }

        const json = await res.json().catch(() => null);
        console.log("ontu-stats saved:", json);

        // 2) localStorage 백업
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
// 2. 온투업체 정보 등록 (lendersConfig)
// ------------------------------------------------------

let lendersConfig = {
  version: 1,
  updatedAt: null,
  lenders: []
};

// 초깃값 템플릿용 (새 온투업체 추가 시)
function createEmptyLender() {
  return {
    id: "",
    nameKo: "",
    enabledNewLoan: true,
    isPartner: false,
    hidden: false,
    sortOrder: 100,
    productGroups: {
      "부동산담보대출": false,
      "개인신용대출": false,
      "스탁론": false,
      "법인신용대출": false,
      "매출채권유동화": false,
      "의료사업자대출": false,
      "온라인선정산": false,
      "전자어음": false
    },
    mortgageConfig: {
      enabled: false,
      regions: [],
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
}

function loadLendersFromStorage() {
  try {
    const raw = localStorage.getItem(LENDERS_LOCAL_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.lenders)) {
      lendersConfig = parsed;
    }
  } catch (e) {
    console.warn("lendersConfig load error:", e);
  }
}

function saveLendersToStorage() {
  try {
    lendersConfig.updatedAt = new Date().toISOString();
    localStorage.setItem(LENDERS_LOCAL_KEY, JSON.stringify(lendersConfig));
  } catch (e) {
    console.warn("lendersConfig save error:", e);
  }
}

// 리스트에서 id로 lender 찾기
function findLenderById(id) {
  return lendersConfig.lenders.find((l) => l.id === id) || null;
}

// 리스트 재렌더링
function renderLendersList() {
  const listEl = document.getElementById("lendersList");
  const detailEl = document.getElementById("lenderDetailPanel");
  if (!listEl || !detailEl) return;

  listEl.innerHTML = "";
  detailEl.innerHTML = "";

  lendersConfig.lenders
    .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999))
    .forEach((lender) => {
      const row = document.createElement("div");
      row.className = "lender-row";
      row.dataset.lenderId = lender.id;

      row.innerHTML = `
        <div class="lender-row__main">
          <div class="lender-row__name">
            <span class="lender-row__name-text">${lender.nameKo || "(이름 미입력)"}</span>
            ${lender.isPartner ? '<span class="lender-row__badge lender-row__badge--partner">제휴</span>' : ""}
            ${lender.hidden ? '<span class="lender-row__badge lender-row__badge--hidden">숨김</span>' : ""}
          </div>
          <div class="lender-row__meta">
            <label class="lender-row__toggle">
              <input type="checkbox" class="js-lender-enabled" ${lender.enabledNewLoan ? "checked" : ""} />
              <span>신규대출취급</span>
            </label>
            <label class="lender-row__toggle">
              <input type="checkbox" class="js-lender-partner" ${lender.isPartner ? "checked" : ""} />
              <span>제휴업체</span>
            </label>
            <label class="lender-row__sort">
              <span>정렬순서</span>
              <input type="number" class="admin-input js-lender-sort" value="${lender.sortOrder ?? ""}" />
            </label>
          </div>
        </div>
        <button type="button" class="lender-row__expand-btn">상세 설정</button>
      `;

      listEl.appendChild(row);

      // 상세 패널 생성
      const detail = document.createElement("div");
      detail.className = "lender-detail";
      detail.dataset.lenderId = lender.id;
      detail.innerHTML = createLenderDetailHTML(lender);
      detailEl.appendChild(detail);

      // 이벤트 바인딩
      bindLenderRowEvents(row, detail, lender.id);
      bindLenderDetailEvents(detail, lender.id);
    });
}

// 상세 패널 HTML 생성
function createLenderDetailHTML(lender) {
  const pg = lender.productGroups || {};
  const mc = lender.mortgageConfig || {};
  const cond = lender.conditions || {};
  const amtRules = lender.amountRules || {};
  const contacts = lender.contacts || {};
  const meta = lender.meta || {};

  const income = cond.income || {};
  const credit = cond.credit || {};
  const term = cond.term || {};
  const timing = cond.timing || {};
  const risk = cond.riskFlags || {};

  const mr = mc.regions || [];
  const minAmt = mc.minAmounts || {};
  const ltvOverrides = mc.ltvOverrides || {};

  const pgKeys = [
    "부동산담보대출",
    "개인신용대출",
    "스탁론",
    "법인신용대출",
    "매출채권유동화",
    "의료사업자대출",
    "온라인선정산",
    "전자어음"
  ];

  const regionsAll = ["서울", "경기", "인천", "충청", "전라", "경상", "강원", "제주"];
  const propertyTypes = ["아파트", "오피스텔", "빌라·연립", "단독·다가구", "토지·임야", "근린생활시설"];
  const loanTypes = ["일반담보대출", "임대보증금반환대출", "지분대출", "경락잔금대출", "대환대출"];

  function isCheckedProductGroup(key) {
    return pg[key] ? "checked" : "";
  }
  function isCheckedRegion(key) {
    return mr.includes(key) ? "checked" : "";
  }
  function getMinAmount(prop) {
    return minAmt[prop] != null ? formatWithCommas(String(minAmt[prop])) : "";
  }
  function getLtvOverride(prop) {
    return ltvOverrides[prop] != null ? String(Math.round(ltvOverrides[prop] * 1000) / 10) : "";
  }

  // propertyMatrix는 디테일 패널에서 체크박스로 렌더링
  const pm = mc.propertyMatrix || {};

  const propertyMatrixHTML = propertyTypes
    .map((pt) => {
      const rowCfg = pm[pt] || {};
      const cells = loanTypes
        .map((lt) => {
          const checked = rowCfg[lt] ? "checked" : "";
          return `
            <td class="lender-matrix-cell">
              <label class="lender-checkbox">
                <input type="checkbox"
                       class="js-mortgage-matrix"
                       data-prop="${pt}"
                       data-loan-type="${lt}"
                       ${checked} />
                <span></span>
              </label>
            </td>
          `;
        })
        .join("");

      return `
        <tr>
          <th class="lender-matrix-prop">${pt}</th>
          ${cells}
        </tr>
      `;
    })
    .join("");

  return `
    <div class="lender-detail__inner">
      <h3 class="lender-detail__title">[${lender.nameKo || "신규 온투업체"}] 상세 설정</h3>

      <!-- 기본 정보 -->
      <section class="lender-section">
        <h4 class="lender-section__title">1. 기본 정보</h4>
        <div class="lender-grid">
          <label class="admin-field">
            온투업체 ID (영문/숫자)
            <input type="text" class="admin-input js-lender-id" value="${lender.id || ""}" />
          </label>
          <label class="admin-field">
            온투업체명(표시용)
            <input type="text" class="admin-input js-lender-name" value="${lender.nameKo || ""}" />
          </label>
        </div>
      </section>

      <!-- 상품군 선택 -->
      <section class="lender-section">
        <h4 class="lender-section__title">2. 취급 대출상품군</h4>
        <div class="lender-chip-row">
          ${pgKeys
            .map(
              (k) => `
            <label class="lender-chip">
              <input type="checkbox" class="js-pg" data-pg="${k}" ${isCheckedProductGroup(k)} />
              <span>${k}</span>
            </label>
          `
            )
            .join("")}
        </div>
        <p class="lender-help-text">
          · 부동산담보대출에 체크하면 아래 부동산 유형/대출종류 매트릭스를 설정할 수 있습니다.<br />
          · 개인신용대출, 스탁론 등 비부동산 상품군은 현재 취급 여부만으로 네비게이션에 노출됩니다.
        </p>
      </section>

      <!-- 부동산담보 설정 -->
      <section class="lender-section">
        <h4 class="lender-section__title">3. 부동산담보 설정</h4>
        <label class="lender-row__toggle" style="margin-bottom:8px;">
          <input type="checkbox" class="js-mortgage-enabled" ${mc.enabled ? "checked" : ""} />
          <span>부동산담보대출 실제로 취급함</span>
        </label>

        <div class="lender-subsection">
          <h5 class="lender-subsection__title">3-1. 취급 지역</h5>
          <div class="lender-chip-row">
            ${regionsAll
              .map(
                (r) => `
              <label class="lender-chip">
                <input type="checkbox" class="js-region" data-region="${r}" ${isCheckedRegion(r)} />
                <span>${r}</span>
              </label>
            `
              )
              .join("")}
          </div>
        </div>

        <div class="lender-subsection">
          <h5 class="lender-subsection__title">3-2. 부동산 유형 × 대출종류 매트릭스</h5>
          <div class="lender-table-wrap">
            <table class="admin-table lender-matrix-table">
              <thead>
                <tr>
                  <th>부동산 유형</th>
                  ${loanTypes.map((lt) => `<th>${lt}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${propertyMatrixHTML}
              </tbody>
            </table>
          </div>
        </div>

        <div class="lender-subsection">
          <h5 class="lender-subsection__title">3-3. 부동산 유형별 최소 대출금액</h5>
          <div class="lender-grid">
            ${propertyTypes
              .map(
                (pt) => `
              <label class="admin-field">
                ${pt} 최소금액(원)
                <input type="text"
                       class="admin-input js-min-amount"
                       data-prop="${pt}"
                       data-type="money"
                       value="${getMinAmount(pt)}" />
              </label>
            `
              )
              .join("")}
          </div>
        </div>

        <div class="lender-subsection">
          <h5 class="lender-subsection__title">3-4. 부동산 유형별 개별 최대 LTV(선택)</h5>
          <div class="lender-grid">
            ${propertyTypes
              .map(
                (pt) => `
              <label class="admin-field">
                ${pt} 최대 LTV (%, 예: 78)
                <input type="number"
                       class="admin-input js-ltv-override"
                       data-prop="${pt}"
                       step="0.1"
                       min="0"
                       max="100"
                       value="${getLtvOverride(pt)}" />
              </label>
            `
              )
              .join("")}
          </div>
        </div>

        <div class="lender-subsection">
          <h5 class="lender-subsection__title">3-5. 메모</h5>
          <textarea class="admin-textarea js-mortgage-notes" rows="2">${
            mc.notes || ""
          }</textarea>
        </div>
      </section>

      <!-- 차주 조건(6-1과 매핑) -->
      <section class="lender-section">
        <h4 class="lender-section__title">4. 차주 추가정보 조건(6-1 매핑)</h4>

        <div class="lender-subsection">
          <h5 class="lender-subsection__title">4-1. 소득유형</h5>
          <div class="lender-chip-row">
            <label class="lender-chip">
              <input type="checkbox" class="js-income" data-key="근로소득" ${
                income["근로소득"] ? "checked" : ""
              } />
              <span>근로소득</span>
            </label>
            <label class="lender-chip">
              <input type="checkbox" class="js-income" data-key="근로외증빙소득" ${
                income["근로외증빙소득"] ? "checked" : ""
              } />
              <span>근로외 증빙소득</span>
            </label>
            <label class="lender-chip">
              <input type="checkbox" class="js-income" data-key="증빙소득없음" ${
                income["증빙소득없음"] ? "checked" : ""
              } />
              <span>증빙소득 없음</span>
            </label>
            <label class="lender-chip">
              <input type="checkbox" class="js-income" data-key="무증빙_이자납입가능" ${
                income["무증빙_이자납입가능"] ? "checked" : ""
              } />
              <span>무증빙+이자납입 가능</span>
            </label>
          </div>
        </div>

        <div class="lender-subsection">
          <h5 class="lender-subsection__title">4-2. 신용점수</h5>
          <div class="lender-grid">
            <label class="admin-field">
              최소 신용점수 (예: 600)
              <input type="number"
                     class="admin-input js-credit-min"
                     value="${credit.minScore != null ? credit.minScore : ""}" />
            </label>
            <label class="lender-row__toggle" style="margin-top:22px;">
              <input type="checkbox" class="js-credit-below600" ${
                credit.allowBelow600 ? "checked" : ""
              } />
              <span>600점 미만도 예외적으로 취급 가능</span>
            </label>
          </div>
        </div>

        <div class="lender-subsection">
          <h5 class="lender-subsection__title">4-3. 상환계획</h5>
          <div class="lender-chip-row">
            <label class="lender-chip">
              <input type="checkbox" class="js-term" data-key="short" ${
                term.short ? "checked" : ""
              } />
              <span>3개월 내</span>
            </label>
            <label class="lender-chip">
              <input type="checkbox" class="js-term" data-key="mid" ${
                term.mid ? "checked" : ""
              } />
              <span>3개월 이상 ~ 1년 미만</span>
            </label>
            <label class="lender-chip">
              <input type="checkbox" class="js-term" data-key="long" ${
                term.long ? "checked" : ""
              } />
              <span>1년 이상</span>
            </label>
          </div>
        </div>

        <div class="lender-subsection">
          <h5 class="lender-subsection__title">4-4. 대출금 필요시기</h5>
          <div class="lender-chip-row">
            <label class="lender-chip">
              <input type="checkbox" class="js-timing" data-key="sameDay" ${
                timing.sameDay ? "checked" : ""
              } />
              <span>당일</span>
            </label>
            <label class="lender-chip">
              <input type="checkbox" class="js-timing" data-key="withinWeek" ${
                timing.withinWeek ? "checked" : ""
              } />
              <span>1주일 내</span>
            </label>
            <label class="lender-chip">
              <input type="checkbox" class="js-timing" data-key="withinMonth" ${
                timing.withinMonth ? "checked" : ""
              } />
              <span>한달 이내</span>
            </label>
          </div>
        </div>

        <div class="lender-subsection">
          <h5 class="lender-subsection__title">4-5. 기타사항(리스크)</h5>
          <div class="lender-chip-row">
            <label class="lender-chip">
              <input type="checkbox" class="js-risk" data-key="세금체납" ${
                risk["세금체납"] ? "checked" : ""
              } />
              <span>세금체납 취급 가능</span>
            </label>
            <label class="lender-chip">
              <input type="checkbox" class="js-risk" data-key="연체기록" ${
                risk["연체기록"] ? "checked" : ""
              } />
              <span>연체기록 취급 가능</span>
            </label>
            <label class="lender-chip">
              <input type="checkbox" class="js-risk" data-key="압류·가압류" ${
                risk["압류·가압류"] ? "checked" : ""
              } />
              <span>압류·가압류 취급 가능</span>
            </label>
            <label class="lender-chip">
              <input type="checkbox" class="js-risk" data-key="개인회생" ${
                risk["개인회생"] ? "checked" : ""
              } />
              <span>개인회생 이력 취급 가능</span>
            </label>
          </div>
        </div>
      </section>

      <!-- 상담채널 / 메타 -->
      <section class="lender-section">
        <h4 class="lender-section__title">5. 상담 채널 & 메타 정보</h4>
        <div class="lender-grid">
          <label class="admin-field">
            유선상담 전화번호
            <input type="text" class="admin-input js-phone" value="${contacts.phone || ""}" />
          </label>
          <label class="admin-field">
            채팅상담(카카오톡) URL
            <input type="text" class="admin-input js-kakao" value="${contacts.kakaoUrl || ""}" />
          </label>
        </div>
        <div class="lender-subsection">
          <h5 class="lender-subsection__title">관리자 메모</h5>
          <textarea class="admin-textarea js-admin-note" rows="2">${
            meta.adminNote || ""
          }</textarea>
        </div>
      </section>
    </div>
  `;
}

// 리스트 행 이벤트
function bindLenderRowEvents(row, detail, lenderId) {
  const enabledChk = row.querySelector(".js-lender-enabled");
  const partnerChk = row.querySelector(".js-lender-partner");
  const sortInput  = row.querySelector(".js-lender-sort");
  const expandBtn  = row.querySelector(".lender-row__expand-btn");

  const lender = findLenderById(lenderId);
  if (!lender) return;

  if (enabledChk) {
    enabledChk.addEventListener("change", () => {
      lender.enabledNewLoan = !!enabledChk.checked;
      saveLendersToStorage();
    });
  }
  if (partnerChk) {
    partnerChk.addEventListener("change", () => {
      lender.isPartner = !!partnerChk.checked;
      saveLendersToStorage();
      renderLendersList(); // 뱃지 갱신
    });
  }
  if (sortInput) {
    sortInput.addEventListener("input", () => {
      lender.sortOrder = sortInput.value === "" ? null : Number(sortInput.value);
      saveLendersToStorage();
    });
  }
  if (expandBtn) {
    expandBtn.addEventListener("click", () => {
      const isOpen = detail.classList.contains("is-open");
      document.querySelectorAll(".lender-detail").forEach((el) => el.classList.remove("is-open"));
      if (!isOpen) {
        detail.classList.add("is-open");
        // 상세에 money input 포맷 적용
        setupMoneyInputs(detail);
      }
    });
  }
}

// 상세 패널 이벤트
function bindLenderDetailEvents(detail, lenderId) {
  const lender = findLenderById(lenderId);
  if (!lender) return;

  // 기본 정보
  const idInput   = detail.querySelector(".js-lender-id");
  const nameInput = detail.querySelector(".js-lender-name");
  if (idInput) {
    idInput.addEventListener("input", () => {
      lender.id = (idInput.value || "").trim();
      // 리스트 row dataset 갱신 필요 시 다시 렌더
      saveLendersToStorage();
      renderLendersList();
    });
  }
  if (nameInput) {
    nameInput.addEventListener("input", () => {
      lender.nameKo = nameInput.value || "";
      saveLendersToStorage();
      renderLendersList();
    });
  }

  // 상품군
  detail.querySelectorAll(".js-pg").forEach((chk) => {
    chk.addEventListener("change", () => {
      const key = chk.getAttribute("data-pg");
      if (!key) return;
      if (!lender.productGroups) lender.productGroups = {};
      lender.productGroups[key] = !!chk.checked;
      saveLendersToStorage();
    });
  });

  // 부동산담보 enabled
  const mcEnabled = detail.querySelector(".js-mortgage-enabled");
  if (mcEnabled) {
    mcEnabled.addEventListener("change", () => {
      if (!lender.mortgageConfig) lender.mortgageConfig = {};
      lender.mortgageConfig.enabled = !!mcEnabled.checked;
      saveLendersToStorage();
    });
  }

  // 취급 지역
  detail.querySelectorAll(".js-region").forEach((chk) => {
    chk.addEventListener("change", () => {
      if (!lender.mortgageConfig) lender.mortgageConfig = {};
      let regions = lender.mortgageConfig.regions || [];
      const region = chk.getAttribute("data-region");
      if (!region) return;
      if (chk.checked) {
        if (!regions.includes(region)) regions.push(region);
      } else {
        regions = regions.filter((r) => r !== region);
      }
      lender.mortgageConfig.regions = regions;
      saveLendersToStorage();
    });
  });

  // propertyMatrix
  detail.querySelectorAll(".js-mortgage-matrix").forEach((chk) => {
    chk.addEventListener("change", () => {
      const prop = chk.getAttribute("data-prop");
      const lt   = chk.getAttribute("data-loan-type");
      if (!prop || !lt) return;

      if (!lender.mortgageConfig) lender.mortgageConfig = {};
      if (!lender.mortgageConfig.propertyMatrix) lender.mortgageConfig.propertyMatrix = {};
      const pm = lender.mortgageConfig.propertyMatrix;

      if (!pm[prop]) pm[prop] = {};
      pm[prop][lt] = !!chk.checked;

      saveLendersToStorage();
    });
  });

  // minAmounts
  detail.querySelectorAll(".js-min-amount").forEach((input) => {
    input.addEventListener("input", () => {
      const prop = input.getAttribute("data-prop");
      if (!prop) return;
      if (!lender.mortgageConfig) lender.mortgageConfig = {};
      if (!lender.mortgageConfig.minAmounts) lender.mortgageConfig.minAmounts = {};
      const v = getMoneyValue(input);
      if (v > 0) {
        lender.mortgageConfig.minAmounts[prop] = v;
      } else {
        delete lender.mortgageConfig.minAmounts[prop];
      }
      saveLendersToStorage();
    });
  });

  // LTV overrides
  detail.querySelectorAll(".js-ltv-override").forEach((input) => {
    input.addEventListener("input", () => {
      const prop = input.getAttribute("data-prop");
      if (!prop) return;
      if (!lender.mortgageConfig) lender.mortgageConfig = {};
      if (!lender.mortgageConfig.ltvOverrides) lender.mortgageConfig.ltvOverrides = {};
      const val = input.value === "" ? null : Number(input.value);
      if (val != null && !isNaN(val)) {
        lender.mortgageConfig.ltvOverrides[prop] = val / 100; // 78 → 0.78
      } else {
        delete lender.mortgageConfig.ltvOverrides[prop];
      }
      saveLendersToStorage();
    });
  });

  // mortgage notes
  const notesEl = detail.querySelector(".js-mortgage-notes");
  if (notesEl) {
    notesEl.addEventListener("input", () => {
      if (!lender.mortgageConfig) lender.mortgageConfig = {};
      lender.mortgageConfig.notes = notesEl.value || "";
      saveLendersToStorage();
    });
  }

  // income
  detail.querySelectorAll(".js-income").forEach((chk) => {
    chk.addEventListener("change", () => {
      const key = chk.getAttribute("data-key");
      if (!key) return;
      if (!lender.conditions) lender.conditions = {};
      if (!lender.conditions.income) lender.conditions.income = {};
      lender.conditions.income[key] = !!chk.checked;
      saveLendersToStorage();
    });
  });

  // credit
  const creditMinEl = detail.querySelector(".js-credit-min");
  const creditBelowEl = detail.querySelector(".js-credit-below600");
  if (creditMinEl) {
    creditMinEl.addEventListener("input", () => {
      if (!lender.conditions) lender.conditions = {};
      if (!lender.conditions.credit) lender.conditions.credit = {};
      lender.conditions.credit.minScore =
        creditMinEl.value === "" ? null : Number(creditMinEl.value);
      saveLendersToStorage();
    });
  }
  if (creditBelowEl) {
    creditBelowEl.addEventListener("change", () => {
      if (!lender.conditions) lender.conditions = {};
      if (!lender.conditions.credit) lender.conditions.credit = {};
      lender.conditions.credit.allowBelow600 = !!creditBelowEl.checked;
      saveLendersToStorage();
    });
  }

  // term
  detail.querySelectorAll(".js-term").forEach((chk) => {
    chk.addEventListener("change", () => {
      const key = chk.getAttribute("data-key");
      if (!key) return;
      if (!lender.conditions) lender.conditions = {};
      if (!lender.conditions.term) lender.conditions.term = {};
      lender.conditions.term[key] = !!chk.checked;
      saveLendersToStorage();
    });
  });

  // timing
  detail.querySelectorAll(".js-timing").forEach((chk) => {
    chk.addEventListener("change", () => {
      const key = chk.getAttribute("data-key");
      if (!key) return;
      if (!lender.conditions) lender.conditions = {};
      if (!lender.conditions.timing) lender.conditions.timing = {};
      lender.conditions.timing[key] = !!chk.checked;
      saveLendersToStorage();
    });
  });

  // riskFlags
  detail.querySelectorAll(".js-risk").forEach((chk) => {
    chk.addEventListener("change", () => {
      const key = chk.getAttribute("data-key");
      if (!key) return;
      if (!lender.conditions) lender.conditions = {};
      if (!lender.conditions.riskFlags) lender.conditions.riskFlags = {};
      lender.conditions.riskFlags[key] = !!chk.checked;
      saveLendersToStorage();
    });
  });

  // contacts
  const phoneEl = detail.querySelector(".js-phone");
  const kakaoEl = detail.querySelector(".js-kakao");
  if (phoneEl) {
    phoneEl.addEventListener("input", () => {
      if (!lender.contacts) lender.contacts = {};
      lender.contacts.phone = phoneEl.value || "";
      saveLendersToStorage();
    });
  }
  if (kakaoEl) {
    kakaoEl.addEventListener("input", () => {
      if (!lender.contacts) lender.contacts = {};
      lender.contacts.kakaoUrl = kakaoEl.value || "";
      saveLendersToStorage();
    });
  }

  // admin note
  const noteEl = detail.querySelector(".js-admin-note");
  if (noteEl) {
    noteEl.addEventListener("input", () => {
      if (!lender.meta) lender.meta = {};
      lender.meta.adminNote = noteEl.value || "";
      saveLendersToStorage();
    });
  }
}

// 새 온투업체 추가
function setupAddLenderButton() {
  const btn = document.getElementById("addLenderBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const l = createEmptyLender();
    // 임시 ID/이름
    const baseId = "lender";
    let idx = lendersConfig.lenders.length + 1;
    let newId = `${baseId}${idx}`;
    while (lendersConfig.lenders.some((x) => x.id === newId)) {
      idx += 1;
      newId = `${baseId}${idx}`;
    }
    l.id = newId;
    l.nameKo = `온투업체${idx}`;

    lendersConfig.lenders.push(l);
    saveLendersToStorage();
    renderLendersList();
  });
}

// 온투업체 설정 저장 버튼 (서버로 전송)
function setupLendersSaveButton() {
  const btn = document.getElementById("saveLendersBtn");
  const statusEl = document.getElementById("lendersSaveStatus");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      lendersConfig.updatedAt = new Date().toISOString();

      // 1) localStorage 저장
      saveLendersToStorage();

      // 2) 서버로 전송 (API 엔드포인트는 필요 시 조정)
      const res = await fetch("https://huchudb-github-io.vercel.app/api/lenders-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lendersConfig)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`API 실패: HTTP ${res.status} ${errText}`);
      }

      const json = await res.json().catch(() => null);
      console.log("lenders-config saved:", json);

      if (statusEl) {
        statusEl.textContent = "온투업체 설정이 서버에 저장되었습니다.";
        setTimeout(() => {
          if (statusEl.textContent.includes("저장되었습니다")) {
            statusEl.textContent = "";
          }
        }, 3000);
      }

      alert("온투업체 설정이 저장되었습니다.\n(서버 + localStorage)");
    } catch (e) {
      console.error("saveLendersBtn error:", e);
      alert("온투업체 설정 저장 중 오류가 발생했습니다.\nAPI 준비 전이라면 localStorage만 사용됩니다.");
    }
  });
}

// ------------------------------------------------------
// 3. 탭 전환 (온투업 통계 / 온투업체 정보등록)
// ------------------------------------------------------
function setupAdminTabs() {
  const tabButtons = document.querySelectorAll("[data-admin-tab-target]");
  const tabPanels  = document.querySelectorAll("[data-admin-tab-panel]");

  if (!tabButtons.length || !tabPanels.length) return;

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-admin-tab-target");
      if (!target) return;

      tabButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      tabPanels.forEach((panel) => {
        const name = panel.getAttribute("data-admin-tab-panel");
        if (name === target) {
          panel.classList.remove("hide");
        } else {
          panel.classList.add("hide");
        }
      });
    });
  });
}

// ------------------------------------------------------
// 초기화
// ------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setupBetaMenu();

  // 1) 온투업 통계
  loadStatsFromStorage();
  setupStatsInteractions();
  setupMoneyInputs();

  // 2) 온투업체 정보 등록
  loadLendersFromStorage();
  renderLendersList();
  setupAddLenderButton();
  setupLendersSaveButton();
  setupAdminTabs();
});
