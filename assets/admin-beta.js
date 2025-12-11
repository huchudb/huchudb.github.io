// /assets/admin-beta.js  (후추 베타 관리자 전용 스크립트)
// ------------------------------------------------------
// 0. 공통 상수 / 유틸
// ------------------------------------------------------

console.log("✅ admin-beta.js loaded");

const API_BASE = "https://huchudb-github-io.vercel.app";
const ONTU_STATS_API = `${API_BASE}/api/ontu-stats`;
const LOAN_CONFIG_API = `${API_BASE}/api/loan-config`;

// localStorage 키
const STATS_LOCAL_KEY = "huchu_ontu_stats_beta_v2";
const LENDERS_LOCAL_KEY = "huchu_lenders_config_beta_v1";

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

// money input(텍스트)에 3자리 쉼표 자동
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

// 간단 escape
function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ------------------------------------------------------
// 1. 상단 MENU 드롭다운 (공통)
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
// 2. 탭 – [온투업 통계 저장] / [온투업체 정보 등록]
// ------------------------------------------------------
function setupAdminTabs() {
  const tabButtons = document.querySelectorAll(".admin-tab-btn");
  const tabPanels = document.querySelectorAll(".admin-tab-panel");
  if (!tabButtons.length || !tabPanels.length) return;

  function activateTab(targetId) {
    tabButtons.forEach((btn) => {
      const t = btn.getAttribute("data-tab-target");
      const isActive = t === targetId;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    tabPanels.forEach((panel) => {
      panel.classList.toggle(
        "hide",
        panel.id !== targetId
      );
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab-target");
      if (!targetId) return;
      activateTab(targetId);
    });
  });

  // 기본 첫 탭 활성화
  const first = tabButtons[0];
  if (first) {
    const targetId = first.getAttribute("data-tab-target");
    if (targetId) activateTab(targetId);
  }
}

// ------------------------------------------------------
// 3. 온투업 통계 저장 (기존 ontu-stats 관리자)
// ------------------------------------------------------

let statsRoot = {
  // byMonth: { "YYYY-MM": { summary:{...}, products:{...} } }
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
  const ids = [
    "statsRegisteredFirms",
    "statsDataFirms",
    "statsTotalLoan",
    "statsTotalRepaid",
    "statsBalance",
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
    if (amountEl)
      amountEl.value =
        cfg.amount != null ? formatWithCommas(String(cfg.amount)) : "";
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
        // 1) 서버로 저장
        const res = await fetch(ONTU_STATS_API, {
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

        // 2) localStorage에도 같이 저장
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
// 4. 온투업체 정보 등록 – lendersConfig
// ------------------------------------------------------

// 앞으로 실제 온투업체명으로 교체하면 됨
const LENDERS_MASTER = [
  { id: "fmfunding", name: "FM펀딩" },
  { id: "eightpercent", name: "8퍼센트" },
  { id: "together", name: "투게더펀딩" },
  { id: "peoplefund", name: "피플펀드" },
  { id: "lufax", name: "루팍스(예시)" },
  { id: "etc01", name: "기타온투업체(예시)" },
  // TODO: 나머지 온투업체는 동일한 형식으로 49개까지 추가
];

const REGIONS = ["서울", "경기", "인천", "충청", "전라", "경상", "강원", "제주"];

const REAL_ESTATE_PROPERTY_TYPES = [
  "아파트",
  "오피스텔",
  "빌라·연립",
  "단독·다가구",
  "토지·임야",
  "근린생활시설",
];

const LOAN_TYPES_REAL_ESTATE = [
  "일반담보대출",
  "임대보증금반환대출",
  "지분대출",
  "경락잔금대출",
  "대환대출",
];

const PRODUCT_GROUPS = [
  "부동산 담보대출",
  "개인신용대출",
  "스탁론",
  "법인신용대출",
  "매출채권유동화",
  "의료사업자대출",
  "온라인선정산",
  "전자어음",
];

const EXTRA_INCOME_TYPES = [
  "근로소득",
  "근로외 증빙소득",
  "증빙소득 없음",
  "증빙소득 없으나 이자 납입가능",
];
const EXTRA_CREDIT_BUCKETS = ["600점 미만", "600점 이상"];
const EXTRA_REPAY_PLANS = ["3개월내", "3개월 이상~1년 미만", "1년 이상"];
const EXTRA_NEED_TIMING = ["당일", "1주일내", "한달이내"];
const EXTRA_SPECIAL_FLAGS = ["세금체납", "연체기록", "압류·가압류", "개인회생"];

let lendersConfig = {}; // { lenderId: { ... } }

// 서버에서 loan-config 불러오기
async function loadLendersConfigFromServer() {
  try {
    const res = await fetch(LOAN_CONFIG_API, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    console.info("ℹ️ loan-config from server:", json);

    if (json && typeof json === "object") {
      if (json.lenders && typeof json.lenders === "object") {
        lendersConfig = json.lenders;
      } else {
        lendersConfig = {};
      }
    }

    // localStorage 백업
    try {
      localStorage.setItem(
        LENDERS_LOCAL_KEY,
        JSON.stringify({ lenders: lendersConfig })
      );
    } catch (e) {
      console.warn("lenders localStorage backup failed:", e);
    }
  } catch (err) {
    console.warn(
      "⚠️ lenders-config API 불러오기 실패, localStorage로 대체:",
      err
    );
    try {
      const raw = localStorage.getItem(LENDERS_LOCAL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.lenders) {
          lendersConfig = parsed.lenders;
        } else {
          lendersConfig = {};
        }
      } else {
        lendersConfig = {};
      }
    } catch (e2) {
      console.warn("localStorage lendersConfig load error:", e2);
      lendersConfig = {};
    }
  }

  console.log("✅ lendersConfig in admin:", lendersConfig);
}

// 온투업체 카드 하나 렌더링
function createLenderCard(def) {
  const cfg = lendersConfig[def.id] || {};

  const card = document.createElement("div");
  card.className = "lender-card";
  card.dataset.lenderId = def.id;

  const isActive =
    cfg.isActiveNewLoan === undefined ? true : !!cfg.isActiveNewLoan;
  const isPartner = !!cfg.isPartner;

  const basicName = cfg.displayName || def.name;

  const productGroups = Array.isArray(cfg.productGroups)
    ? cfg.productGroups
    : [];
  const propertyTypes = Array.isArray(cfg.propertyTypes)
    ? cfg.propertyTypes
    : [];
  const allowedRegions = Array.isArray(cfg.allowedRegions)
    ? cfg.allowedRegions
    : [];

  const extra = cfg.extraConditions || {};
  const extraIncome = extra.incomeTypes || [];
  const extraCredit = extra.creditBuckets || [];
  const extraRepay = extra.repayPlans || [];
  const extraTiming = extra.needTiming || [];
  const extraFlags = extra.specialFlags || [];

  const contact = cfg.contact || {};

  function isChecked(list, val) {
    return list && list.indexOf(val) !== -1;
  }

  // 체크박스 생성 helper
  const makeCheckboxGroup = (items, name, selectedList) => {
    return items
      .map((item) => {
        const id = `${def.id}_${name}_${item}`;
        const checked = isChecked(selectedList, item) ? "checked" : "";
        return `
          <label class="admin-chip-check" for="${id}">
            <input type="checkbox" id="${id}" data-group="${name}" value="${escapeHtml(
          item
        )}" ${checked} />
            <span>${escapeHtml(item)}</span>
          </label>
        `;
      })
      .join("");
  };

  card.innerHTML = `
    <button type="button" class="lender-toggle" aria-expanded="false">
      <span class="lender-toggle__name">${escapeHtml(basicName)}</span>
      <span class="lender-toggle__badges">
        <span class="lender-badge lender-badge--partner ${
          isPartner ? "" : "is-off"
        }">제휴</span>
        <span class="lender-badge lender-badge--active ${
          isActive ? "" : "is-off"
        }">신규</span>
      </span>
    </button>

    <div class="lender-panel hide">
      <div class="admin-card lender-panel__inner">

        <div class="admin-field-group">
          <h3 class="admin-field-title">1. 기본 정보</h3>
          <div class="admin-field-grid">
            <label class="admin-field">
              온투업체 ID
              <input type="text" class="admin-input" value="${escapeHtml(
                def.id
              )}" readonly />
            </label>
            <label class="admin-field">
              표시명(네비게이션에 노출)
              <input type="text" class="admin-input js-lender-displayName" value="${escapeHtml(
                basicName
              )}" />
            </label>
          </div>

          <div class="admin-field-grid">
            <div class="admin-switch-field">
              <span class="admin-switch-label">신규대출 취급 여부</span>
              <label class="admin-switch">
                <input type="checkbox" class="js-lender-active" ${
                  isActive ? "checked" : ""
                } />
                <span>ON/OFF</span>
              </label>
            </div>
            <div class="admin-switch-field">
              <span class="admin-switch-label">제휴업체 여부</span>
              <label class="admin-switch">
                <input type="checkbox" class="js-lender-partner" ${
                  isPartner ? "checked" : ""
                } />
                <span>제휴</span>
              </label>
            </div>
          </div>

          <div class="admin-field">
            <span class="admin-label">취급 상품군 (네비 첫화면 대출종류 매핑)</span>
            <div class="admin-chip-row">
              ${makeCheckboxGroup(
                PRODUCT_GROUPS,
                "productGroups",
                productGroups
              )}
            </div>
          </div>
        </div>

        <div class="admin-field-group">
          <h3 class="admin-field-title">2. 부동산 담보대출 설정</h3>

          <div class="admin-field">
            <span class="admin-label">취급 부동산 유형</span>
            <div class="admin-chip-row">
              ${makeCheckboxGroup(
                REAL_ESTATE_PROPERTY_TYPES,
                "propertyTypes",
                propertyTypes
              )}
            </div>
          </div>

          <div class="admin-field">
            <span class="admin-label">취급 지역 (부동산 담보대출에만 적용)</span>
            <div class="admin-chip-row">
              ${makeCheckboxGroup(REGIONS, "regions", allowedRegions)}
            </div>
          </div>

          <div class="admin-subbox">
            <p class="admin-subbox-title">최소 대출금액 (부동산 담보대출 기준)</p>
            <p class="admin-subbox-help">
              · 아파트·오피스텔 : 최소 1,000만원 이상<br/>
              · 그 외(빌라·연립, 단독·다가구, 토지·임야, 근린생활시설) : 최소 3,000만원 이상<br/>
              ※ 온투업체별로 다를 경우 이 값으로 네비게이션에서 필터링합니다.
            </p>
            <div class="admin-field-grid">
              ${REAL_ESTATE_PROPERTY_TYPES.map((pt) => {
                const minMap = (cfg.minAmountByPropertyType || {});
                const val = minMap[pt] != null ? formatWithCommas(String(minMap[pt])) : "";
                return `
                  <label class="admin-field">
                    ${escapeHtml(pt)} 최소 대출금액 (원)
                    <input type="text" class="admin-input js-min-amount" data-prop="${escapeHtml(
                      pt
                    )}" data-type="money" value="${val}" placeholder="${
                  pt === "아파트" || pt === "오피스텔"
                    ? "예) 10000000"
                    : "예) 30000000"
                }" />
                  </label>
                `;
              }).join("")}
            </div>
          </div>

          <div class="admin-subbox">
            <p class="admin-subbox-title">대표 LTV/금리 범위 (부동산 전체 공통 값)</p>
            <p class="admin-subbox-help">
              상품별로 조금씩 다르더라도 대표적으로 안내할 범위를 입력해주세요.
              (네비게이션 결과 카드에 참고용으로 노출됩니다.)
            </p>
            <div class="admin-loantype-grid">
              ${LOAN_TYPES_REAL_ESTATE.map((lt) => {
                const ltCfg =
                  (cfg.loanTypeSummary && cfg.loanTypeSummary[lt]) || {};
                const maxLtvPct =
                  typeof ltCfg.maxLtv === "number"
                    ? Math.round(ltCfg.maxLtv * 1000) / 10
                    : "";
                const rateMinPct =
                  typeof ltCfg.rateMin === "number"
                    ? Math.round(ltCfg.rateMin * 1000) / 10
                    : "";
                const rateMaxPct =
                  typeof ltCfg.rateMax === "number"
                    ? Math.round(ltCfg.rateMax * 1000) / 10
                    : "";

                return `
                  <div class="admin-loantype-row" data-loan-type="${escapeHtml(
                    lt
                  )}">
                    <div class="admin-loantype-label">${escapeHtml(lt)}</div>
                    <div class="admin-loantype-fields">
                      <label>
                        최대 LTV(%)
                        <input type="number" step="0.1" min="0" max="100" class="admin-input js-lt-maxltv" value="${
                          maxLtvPct !== "" ? maxLtvPct : ""
                        }" />
                      </label>
                      <label>
                        최소 금리(연, %)
                        <input type="number" step="0.1" min="0" max="99" class="admin-input js-lt-ratemin" value="${
                          rateMinPct !== "" ? rateMinPct : ""
                        }" />
                      </label>
                      <label>
                        최대 금리(연, %)
                        <input type="number" step="0.1" min="0" max="99" class="admin-input js-lt-ratemax" value="${
                          rateMaxPct !== "" ? rateMaxPct : ""
                        }" />
                      </label>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        </div>

        <div class="admin-field-group">
          <h3 class="admin-field-title">3. 차주 추가조건 매칭 (6-1 화면 연동)</h3>
          <p class="admin-note">
            ※ 모두 입력하지 않아도 됩니다. 다만 조건을 자세히 설정할수록 보다 정확한 온투업체 매칭이 가능합니다.
          </p>

          <div class="admin-field">
            <span class="admin-label">소득유형 (가능한 경우만 체크)</span>
            <div class="admin-chip-row">
              ${makeCheckboxGroup(EXTRA_INCOME_TYPES, "extra-income", extraIncome)}
            </div>
          </div>

          <div class="admin-field">
            <span class="admin-label">신용점수 구간</span>
            <div class="admin-chip-row">
              ${makeCheckboxGroup(
                EXTRA_CREDIT_BUCKETS,
                "extra-credit",
                extraCredit
              )}
            </div>
          </div>

          <div class="admin-field">
            <span class="admin-label">상환계획</span>
            <div class="admin-chip-row">
              ${makeCheckboxGroup(
                EXTRA_REPAY_PLANS,
                "extra-repay",
                extraRepay
              )}
            </div>
          </div>

          <div class="admin-field">
            <span class="admin-label">대출금 필요 시기</span>
            <div class="admin-chip-row">
              ${makeCheckboxGroup(
                EXTRA_NEED_TIMING,
                "extra-timing",
                extraTiming
              )}
            </div>
          </div>

          <div class="admin-field">
            <span class="admin-label">기타사항 허용</span>
            <div class="admin-chip-row">
              ${makeCheckboxGroup(
                EXTRA_SPECIAL_FLAGS,
                "extra-flags",
                extraFlags
              )}
            </div>
          </div>

          <div class="admin-field">
            <p class="admin-note">
              ※ 온투업 전업종 취급 불가사항 (네비게이션 공통 안내용, 개별 온투업체 설정과는 별도로 안내칩으로 노출)<br/>
              · 임차인·무상거주자 동의 불가, 맹지, 법인소유자, 시세 1억 미만
            </p>
          </div>
        </div>

        <div class="admin-field-group">
          <h3 class="admin-field-title">4. 상담 채널</h3>
          <div class="admin-field-grid">
            <label class="admin-field">
              유선상담 전화번호
              <input type="text" class="admin-input js-contact-phone" placeholder="예) 02-000-0000" value="${escapeHtml(
                contact.phone || ""
              )}" />
            </label>
            <label class="admin-field">
              채팅상담(카카오톡) URL
              <input type="text" class="admin-input js-contact-kakao" placeholder="예) https://pf.kakao.com/..." value="${escapeHtml(
                contact.kakaoUrl || ""
              )}" />
            </label>
          </div>
        </div>

      </div>
    </div>
  `;

  // 토글 버튼 이벤트
  const toggleBtn = card.querySelector(".lender-toggle");
  const panel = card.querySelector(".lender-panel");
  if (toggleBtn && panel) {
    toggleBtn.addEventListener("click", () => {
      const isHidden = panel.classList.contains("hide");
      panel.classList.toggle("hide", !isHidden);
      toggleBtn.setAttribute("aria-expanded", isHidden ? "true" : "false");
    });
  }

  return card;
}

// 전체 리스트 렌더링
function renderLenderList() {
  const listEl = document.getElementById("lenderList");
  if (!listEl) return;

  listEl.innerHTML = "";

  LENDERS_MASTER.forEach((def) => {
    const card = createLenderCard(def);
    listEl.appendChild(card);
  });

  // 새로 추가된 money input 포맷팅
  setupMoneyInputs(listEl);
}

// 폼에서 lendersConfig 다시 수집
function collectLendersConfigFromForm() {
  const listEl = document.getElementById("lenderList");
  if (!listEl) return {};

  const cards = listEl.querySelectorAll(".lender-card");
  const result = {};

  cards.forEach((card) => {
    const lenderId = card.dataset.lenderId;
    if (!lenderId) return;

    const displayNameEl = card.querySelector(".js-lender-displayName");
    const activeEl = card.querySelector(".js-lender-active");
    const partnerEl = card.querySelector(".js-lender-partner");

    const displayName = displayNameEl ? displayNameEl.value.trim() : "";
    const isActiveNewLoan = activeEl ? !!activeEl.checked : true;
    const isPartner = partnerEl ? !!partnerEl.checked : false;

    // 공통 helper – 체크된 값 수집
    function collectChecked(name) {
      const inputs = card.querySelectorAll(`input[data-group="${name}"]`);
      const arr = [];
      inputs.forEach((inp) => {
        if (inp.checked) arr.push(inp.value);
      });
      return arr;
    }

    const productGroups = collectChecked("productGroups");
    const propertyTypes = collectChecked("propertyTypes");
    const allowedRegions = collectChecked("regions");

    // 최소 금액
    const minAmountByPropertyType = {};
    const minAmountInputs = card.querySelectorAll(".js-min-amount");
    minAmountInputs.forEach((inp) => {
      const prop = inp.getAttribute("data-prop");
      if (!prop) return;
      const val = getMoneyValue(inp);
      if (val > 0) {
        minAmountByPropertyType[prop] = val;
      }
    });

    // LTV/금리
    const loanTypeSummary = {};
    const ltRows = card.querySelectorAll(".admin-loantype-row");
    ltRows.forEach((row) => {
      const lt = row.getAttribute("data-loan-type");
      if (!lt) return;
      const maxLtvEl = row.querySelector(".js-lt-maxltv");
      const rateMinEl = row.querySelector(".js-lt-ratemin");
      const rateMaxEl = row.querySelector(".js-lt-ratemax");

      const maxLtvPct =
        maxLtvEl && maxLtvEl.value !== "" ? Number(maxLtvEl.value) : NaN;
      const rateMinPct =
        rateMinEl && rateMinEl.value !== "" ? Number(rateMinEl.value) : NaN;
      const rateMaxPct =
        rateMaxEl && rateMaxEl.value !== "" ? Number(rateMaxEl.value) : NaN;

      if (isNaN(maxLtvPct) && isNaN(rateMinPct) && isNaN(rateMaxPct)) {
        return;
      }

      const obj = {};
      if (!isNaN(maxLtvPct)) obj.maxLtv = maxLtvPct / 100;
      if (!isNaN(rateMinPct)) obj.rateMin = rateMinPct / 100;
      if (!isNaN(rateMaxPct)) obj.rateMax = rateMaxPct / 100;

      loanTypeSummary[lt] = obj;
    });

    // 6-1 추가 정보
    const extraConditions = {
      incomeTypes: collectChecked("extra-income"),
      creditBuckets: collectChecked("extra-credit"),
      repayPlans: collectChecked("extra-repay"),
      needTiming: collectChecked("extra-timing"),
      specialFlags: collectChecked("extra-flags"),
    };

    // 상담채널
    const phoneEl = card.querySelector(".js-contact-phone");
    const kakaoEl = card.querySelector(".js-contact-kakao");

    const contact = {
      phone: phoneEl ? phoneEl.value.trim() : "",
      kakaoUrl: kakaoEl ? kakaoEl.value.trim() : "",
    };

    result[lenderId] = {
      id: lenderId,
      displayName: displayName || undefined,
      isActiveNewLoan,
      isPartner,
      productGroups,
      propertyTypes,
      allowedRegions,
      minAmountByPropertyType,
      loanTypeSummary,
      extraConditions,
      contact,
    };
  });

  return result;
}

// 서버 저장
async function saveLendersConfigToServer() {
  const statusEl = document.getElementById("lenderConfigStatus");

  const newConfig = collectLendersConfigFromForm();
  lendersConfig = newConfig;

  try {
    const res = await fetch(LOAN_CONFIG_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // byType은 아직 사용 안하지만, API 스키마상 함께 보낼 수 있음
        byType: {},
        lenders: lendersConfig,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`loan-config 저장 실패: HTTP ${res.status} ${errText}`);
    }

    const json = await res.json();
    console.log("loan-config saved:", json);

    // localStorage 백업
    try {
      localStorage.setItem(
        LENDERS_LOCAL_KEY,
        JSON.stringify({ lenders: lendersConfig })
      );
    } catch (e) {
      console.warn("lenders local backup failed:", e);
    }

    if (statusEl) {
      statusEl.textContent = "온투업체 설정이 서버에 저장되었습니다.";
      setTimeout(() => {
        if (statusEl.textContent.includes("저장되었습니다")) {
          statusEl.textContent = "";
        }
      }, 3000);
    }

    alert("온투업체 설정이 서버에 저장되었습니다.");
  } catch (err) {
    console.error("saveNaviLoanConfigToServer error:", err);
    alert(
      "온투업체 설정 저장 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요."
    );
  }
}

function setupLendersAdmin() {
  const saveBtn = document.getElementById("saveLendersConfigBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      saveLendersConfigToServer();
    });
  }
}

// ------------------------------------------------------
// 5. 초기화
// ------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  setupBetaMenu();
  setupAdminTabs();
  setupMoneyInputs();

  // 3) 온투업 통계
  loadStatsFromStorage();
  setupStatsInteractions();

  // 4) 온투업체 설정
  await loadLendersConfigFromServer();
  renderLenderList();
  setupLendersAdmin();
});
