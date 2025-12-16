// /assets/admin-beta.js
console.log("✅ admin-beta.js loaded");

/* =========================================================
   ✅ API_BASE 해석
========================================================= */
function resolveApiBase() {
  try {
    const w = (typeof window !== "undefined") ? window : null;
    let base = (w && w.API_BASE) ? String(w.API_BASE) : "";

    if (!base) {
      const host = (typeof location !== "undefined" && location.hostname) ? location.hostname : "";
      const isLocal =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith(".local");

      if (isLocal) base = "";
      else base = "https://huchudb-github-io.vercel.app";
    }

    base = base.replace(/\/+$/, "");
    return base;
  } catch {
    return "https://huchudb-github-io.vercel.app";
  }
}
const API_BASE = resolveApiBase();
console.log("🔌 API_BASE =", API_BASE || "(relative /api)");

/* =========================================================
   공통/유틸
========================================================= */
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

/* =========================================================
   1) 온투 통계
========================================================= */
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

/* =========================================================
   2) 온투업체 설정
========================================================= */
const PRODUCT_GROUPS = [
  { key: "부동산담보대출", label: "부동산 담보대출" },
  { key: "개인신용대출", label: "개인신용대출" },
  { key: "스탁론", label: "스탁론" },
  { key: "법인신용대출", label: "법인신용대출" },
  { key: "매출채권유동화", label: "매출채권유동화" },
  { key: "의료사업자대출", label: "의료사업자대출" },
  { key: "온라인선정산", label: "선정산" }, // 저장 키 호환 유지
  { key: "전자어음", label: "전자어음" },
  { key: "경매배당금담보대출", label: "경매배당금 담보대출" },
  { key: "미술품담보대출", label: "미술품 담보대출" }
];

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
  { key: "villa", label: "다세대/연립", loanSet: "aptv" },
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

/* =========================================================
   ✅ 추가조건(선택) — 정의서(단일 소스)
   - 저장은 lender.extraConditions: string[] (옵션 key 배열)
========================================================= */
const EXTRA_CONDITIONS = {
  version: "v1",
  groups: [
    {
      key: "borrower",
      label: "추가조건-차주관련",
      appliesTo: "realEstateAll",
      sections: [
        {
          key: "age",
          label: "나이",
          options: [
            { key: "borrower_age_20_69", label: "20~70세 미만" },
            { key: "borrower_age_70_plus", label: "70세 이상" }
          ]
        },
        {
          key: "income_type",
          label: "소득유형",
          options: [
            { key: "borrower_income_wage", label: "근로소득" },
            { key: "borrower_income_nonwage", label: "근로외 소득" },
            { key: "borrower_income_none", label: "증빙소득 없음" },
            { key: "borrower_income_none_but_pay", label: "증빙소득 없으나 이자 납입가능" }
          ]
        },
        {
          key: "credit_bucket",
          label: "신용점수 구간",
          options: [
            { key: "borrower_credit_nice_lt_600", label: "NICE 600점 미만" },
            { key: "borrower_credit_nice_gte_600", label: "NICE 600점 이상" },
            { key: "borrower_credit_kcb_lt_454", label: "KCB 454점 미만" },
            { key: "borrower_credit_kcb_gte_454", label: "KCB 454점 이상" }
          ]
        },
        {
          key: "repay_plan",
          label: "상환계획(예정)",
          options: [
            { key: "borrower_repay_within_3m", label: "3개월 내" },
            { key: "borrower_repay_3m_to_1y", label: "3개월 초과~1년 미만" },
            { key: "borrower_repay_gte_1y", label: "1년 이상" }
          ]
        },
        {
          key: "need_timing",
          label: "대출금 필요시기",
          options: [
            { key: "borrower_need_today", label: "당일" },
            { key: "borrower_need_within_1w", label: "1주일 내" },
            { key: "borrower_need_within_1m", label: "한달 이내" }
          ]
        },
        {
          key: "other_flags",
          label: "기타사항",
          options: [
            { key: "borrower_flag_tax_arrears", label: "세금체납중" },
            { key: "borrower_flag_interest_overdue", label: "대출이자연체중" },
            { key: "borrower_flag_card_overdue", label: "카드연체중" },
            { key: "borrower_flag_seizure", label: "압류·가압류중" },
            { key: "borrower_flag_rehab", label: "개인회생이력" },
            { key: "borrower_flag_bankruptcy", label: "파산이력" },
            { key: "borrower_flag_credit_recovery", label: "신용회복이력" }
          ]
        }
      ]
    },

    {
      key: "property_common",
      label: "추가조건-부동산 전체 유형",
      appliesTo: "realEstateAll",
      sections: [
        {
          key: "property_flags",
          label: "부동산 공통 조건",
          options: [
            { key: "property_foreigner_owned", label: "외국인소유" },
            { key: "property_corporate_owned", label: "법인소유" },
            { key: "property_trust_property", label: "신탁물건" },
            { key: "property_tenant_no_consent", label: "임차인 동의불가" },
            { key: "property_free_occupant_no_consent", label: "무상거주인 동의불가" },
            { key: "property_gift_inherit_lt_10y", label: "증여·상속된지 10년 미만" },
            { key: "property_title_transfer_lt_3m", label: "소유권이전 3개월 미만" }
          ]
        }
      ]
    },

    {
      key: "apt_only",
      label: "추가조건-아파트관련",
      appliesTo: "aptOnly",
      sections: [
        {
          key: "apt_flags",
          label: "아파트 조건",
          options: [
            { key: "apt_lt_100_units", label: "100세대 미만" },
            { key: "apt_single_complex", label: "나홀로아파트" },
            { key: "apt_kb_not_listed", label: "KB시세 미등재" },
            { key: "apt_private_rental", label: "민간임대주택" }
          ]
        }
      ]
    }
  ]
};

function buildExtraConditionIndex(def) {
  const map = {};
  (def?.groups || []).forEach((g) => {
    (g.sections || []).forEach((s) => {
      (s.options || []).forEach((o) => {
        map[o.key] = {
          key: o.key,
          label: o.label,
          groupKey: g.key,
          groupLabel: g.label,
          sectionKey: s.key,
          sectionLabel: s.label,
          appliesTo: g.appliesTo
        };
      });
    });
  });
  return map;
}
const EXTRA_CONDITION_INDEX = buildExtraConditionIndex(EXTRA_CONDITIONS);

/* ✅ 마스터: 네가 준 순서 그대로 + 홈페이지 URL(homepage) */
const LENDERS_MASTER = [
  { id: "hifunding", name: "하이펀딩", homepage: "https://hifunding.co.kr/" },
  { id: "cple", name: "피에프씨테크놀로지스", homepage: "https://www.cple.co.kr/" },
  { id: "8percent", name: "에잇퍼센트", homepage: "https://8percent.kr/" },
  { id: "crossfinancekorea", name: "크로스파이낸스코리아", homepage: "https://www.fss.or.kr/" },
  { id: "niceabc", name: "NICE비즈니스플랫폼", homepage: "https://www.niceabc.co.kr/" },
  { id: "profit", name: "프로핏", homepage: "https://www.pro-fit.co.kr/" },
  { id: "honestfund", name: "어니스트에이아이", homepage: "https://www.honestfund.kr/" },
  { id: "leadingplus", name: "리딩플러스", homepage: "https://www.leadingplusfunding.com/index" },
  { id: "cocktailfunding", name: "트리거파트너스", homepage: "https://v2.cocktailfunding.com/" },
  { id: "loanpoint", name: "론포인트", homepage: "https://www.loanpoint.co.kr/" },
  { id: "funding119", name: "펀딩119", homepage: "https://funding119.com/" },
  { id: "dailyfunding", name: "데일리펀딩", homepage: "https://new.daily-funding.com/" },
  { id: "namofunding", name: "나모펀딩", homepage: "https://namofunding.co.kr/" },
  { id: "yfund", name: "와이펀드", homepage: "https://www.yfund.co.kr/" },
  { id: "funfunding", name: "베네핏소셜", homepage: "https://www.funfunding.co.kr/" },
  { id: "presdaq", name: "프리스닥", homepage: "https://presdaqfunding.co.kr/index" },
  { id: "solarbridge", name: "솔라브리지", homepage: "https://solarbridge.kr/" },
  { id: "zoomfund", name: "줌펀드", homepage: "https://www.zoomfund.co.kr/" },
  { id: "fmfunding", name: "에프엠펀딩", homepage: "https://fmfunding.co.kr/" },
  { id: "together", name: "투게더앱스", homepage: "https://www.together.co.kr/" },
  { id: "moneymove", name: "머니무브", homepage: "https://moneymove.ai/" },
  { id: "rootenergy", name: "루트인프라금융", homepage: "https://www.rootenergy.co.kr/" },
  { id: "wefunding", name: "위펀딩", homepage: "https://www.wefunding.com/" },
  { id: "oasisfund", name: "오아시스펀드", homepage: "https://oasisfund.kr/" },
  { id: "titaninvest", name: "타이탄인베스트", homepage: "https://www.titaninvest.co.kr/index" },
  { id: "mouda", name: "모우다", homepage: "https://mouda.kr/" },
  { id: "cocofunding", name: "코코펀딩", homepage: "" },
  { id: "theassetfund", name: "디에셋핀테크", homepage: "https://www.theassetfund/" },
  { id: "vfunding", name: "브이핀테크", homepage: "https://www.vfunding.co.kr/" },
  { id: "benefitplus", name: "비플러스", homepage: "https://benefitplus.kr/" },
  { id: "acefunding", name: "에이스펀딩", homepage: "https://acefunding.co.kr/" },
  { id: "herbfund", name: "허브펀드", homepage: "" },
  { id: "nurifunding", name: "누리펀딩", homepage: "https://www.nurifunding.co.kr/" },
  { id: "miraclefunding", name: "미라클핀테크", homepage: "https://www.miraclefunding.co.kr/" },
  { id: "funda", name: "펀다", homepage: "https://www.funda.kr/" },
  { id: "graphfunding", name: "그래프펀딩", homepage: "https://www.graphfunding.com/" },
  { id: "daonfunding", name: "다온핀테크", homepage: "https://www.daonfunding.com/" },
  { id: "winkstone", name: "윙크스톤", homepage: "https://loanone.winkstone.com/" },
  { id: "hellofunding", name: "헬로핀테크", homepage: "https://www.hellofunding.co.kr/" },
  { id: "trustfund", name: "앱솔브트러스트", homepage: "https://trustfund.co.kr/" },
  { id: "firstonline", name: "퍼스트온라인투자금융", homepage: "https://www.firstonline.kr/" },
  { id: "jhplus", name: "제이에이치플러스", homepage: "" },
  { id: "apfunding", name: "에이피펀딩", homepage: "https://www.apfunding.co.kr/" },
  { id: "campusfund", name: "레드로켓", homepage: "https://campusfund.net/" },
  { id: "oceanfunding", name: "오션펀딩", homepage: "https://www.oceanfunding.co.kr/" },
  { id: "sugarfunding", name: "슈가펀딩주식회사", homepage: "" },
  { id: "grayzip", name: "브릭베이스", homepage: "https://grayzip.com/" },
  { id: "ontwo", name: "온투인", homepage: "https://www.ontwo.co.kr/" },
  { id: "tgsfinance", name: "티지에스파이낸스", homepage: "" },
  { id: "hnr", name: "에이치엔알", homepage: "" },
  { id: "lendit", name: "렌딧", homepage: "https://www.lendit.co.kr/" },
  { id: "modufintech", name: "모두의핀테크", homepage: "" },
  { id: "bidfunding", name: "비드펀딩", homepage: "" }
];

let lendersConfig = { lenders: {} };

let lenderUiState = {
  q: "",
  openIds: new Set(),
  activeRegionById: {}
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
      homepage: "",
      isActive: false,
      isPartner: false,
      partnerOrder: 0,
      // ✅ 부동산담보대출 최소금액(만원)
      realEstateMinLoanAmount: "",
      // ✅ 추가조건(선택) - 옵션 key 배열
      extraConditions: [],
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

  if (typeof lender.name !== "string") lender.name = String(lender.name || lender.id || "");
  if (typeof lender.homepage !== "string") lender.homepage = String(lender.homepage || lender.homepageUrl || "");

  if (typeof lender.partnerOrder !== "number") lender.partnerOrder = 0;
  if (lender.partnerOrder < 0 || lender.partnerOrder > 10) lender.partnerOrder = 0;

  if (typeof lender.realEstateMinLoanAmount !== "string" && typeof lender.realEstateMinLoanAmount !== "number") {
    lender.realEstateMinLoanAmount = "";
  }

  if (!Array.isArray(lender.products)) lender.products = [];
  lender.products = uniq(lender.products);

  // ✅ 부동산 담보대출에만 적용: 체크 해제 시 값 제거
  const hasRealEstate = lender.products.includes("부동산담보대출");
  if (!hasRealEstate) lender.realEstateMinLoanAmount = "";

  // ✅ 추가조건(선택) 기본/정리
  if (!Array.isArray(lender.extraConditions)) {
    const legacy = lender.extraConditionsKeys || lender.extraConditionKeys || [];
    lender.extraConditions = Array.isArray(legacy) ? legacy.slice() : [];
  }
  lender.extraConditions = uniq(lender.extraConditions)
    .filter((k) => typeof k === "string" && !!EXTRA_CONDITION_INDEX[k]);
  if (!hasRealEstate) lender.extraConditions = []; // 부동산담보대출 아니면 의미 없으니 비움

  if (!lender.regions || typeof lender.regions !== "object") lender.regions = {};

  REGIONS.forEach((r) => {
    if (!lender.regions[r.key] || typeof lender.regions[r.key] !== "object") lender.regions[r.key] = {};
    PROPERTY_TYPES.forEach((pt) => {
      const prev = lender.regions[r.key][pt.key] || {};
      lender.regions[r.key][pt.key] = {
        enabled: !!prev.enabled,
        ltvMax: prev.ltvMax ?? "",
        // 하위호환: 남아 있어도 UI/판정에 사용 안함
        ltvMin: prev.ltvMin ?? "",
        loanTypes: Array.isArray(prev.loanTypes) ? uniq(prev.loanTypes) : []
      };
    });
  });
}

let _previewRAF = 0;
function schedulePreviewUpdate() {
  if (_previewRAF) return;
  _previewRAF = requestAnimationFrame(() => {
    _previewRAF = 0;
    updateLendersConfigPreview();
    scheduleLoanConfigBackupSave(); // ✅ A안: 변경 시 디바운스 로컬 백업
  });
}

function updateLenderState(id, patch) {
  const lender = ensureLender(id);
  Object.assign(lender, patch);
  ensureLenderDeepDefaults(lender);
  schedulePreviewUpdate();
}

function mergeLendersWithMaster() {
  const current = (lendersConfig && lendersConfig.lenders && typeof lendersConfig.lenders === "object")
    ? lendersConfig.lenders
    : {};

  const merged = { ...current }; // ✅ 기존 key 그대로 보존

  LENDERS_MASTER.forEach((m) => {
    const existing = current[m.id] || {};
    merged[m.id] = {
      id: m.id,
      name: (typeof existing.name === "string" && existing.name.trim()) ? existing.name : m.name,
      homepage: (existing.homepage || existing.homepageUrl || m.homepage || ""),
      isActive: typeof existing.isActive === "boolean" ? existing.isActive : false,
      isPartner: typeof existing.isPartner === "boolean" ? existing.isPartner : false,
      partnerOrder: typeof existing.partnerOrder === "number" ? existing.partnerOrder : 0,
      realEstateMinLoanAmount: (existing.realEstateMinLoanAmount ?? ""),
      extraConditions: Array.isArray(existing.extraConditions) ? uniq(existing.extraConditions) : [], // ✅ 추가조건 보존
      products: Array.isArray(existing.products) ? uniq(existing.products) : [],
      phoneNumber: existing.phoneNumber || "",
      kakaoUrl: existing.kakaoUrl || "",
      regions: (existing.regions && typeof existing.regions === "object") ? existing.regions : {}
    };
  });

  lendersConfig.lenders = merged;
  Object.values(lendersConfig.lenders).forEach(ensureLenderDeepDefaults);
}

/* =========================================================
   ✅ A안: loan-config 로컬 자동백업/복구 + 다운로드/업로드 + 서버 빈 lenders 시 로컬 우선
========================================================= */
const LOANCFG_LOCAL_KEY = "huchu_loan_config_backup_v1";
let _loanBackupTimer = 0;

function safeJsonParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function loadLoanConfigBackupFromStorage() {
  try {
    const raw = localStorage.getItem(LOANCFG_LOCAL_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.lenders || typeof parsed.lenders !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLoanConfigBackupToStorageNow() {
  try {
    const payload = (lendersConfig && typeof lendersConfig === "object" && lendersConfig.lenders)
      ? { lenders: lendersConfig.lenders }
      : { lenders: {} };
    localStorage.setItem(LOANCFG_LOCAL_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("loan-config backup save error:", e);
  }
}

function scheduleLoanConfigBackupSave() {
  if (_loanBackupTimer) clearTimeout(_loanBackupTimer);
  _loanBackupTimer = setTimeout(() => {
    _loanBackupTimer = 0;
    saveLoanConfigBackupToStorageNow();
  }, 450); // 디바운스
}

function downloadJson(filename, obj) {
  try {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("다운로드 생성 중 오류가 발생했습니다.");
    console.warn(e);
  }
}

async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(fr.error || new Error("File read error"));
    fr.readAsText(file);
  });
}

function normalizeLoanConfigShape(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (obj.lenders && typeof obj.lenders === "object") return { lenders: obj.lenders };
  if (obj.data && obj.data.lenders && typeof obj.data.lenders === "object") return { lenders: obj.data.lenders };
  return null;
}

// (선택) UI가 HTML에 없을 수 있으니, 있으면 연결 / 없으면 생성
function setupLoanConfigToolsUI() {
  const lendersPanel = document.getElementById("admin-tab-lenders");
  if (!lendersPanel) return;

  let host = document.getElementById("loanConfigTools");
  if (!host) {
    // 자동 생성 (레이아웃 영향 최소)
    host = document.createElement("div");
    host.id = "loanConfigTools";
    host.className = "admin-subbox";
    host.style.marginTop = "14px";

    const title = document.createElement("h3");
    title.className = "admin-subbox-title";
    title.textContent = "설정 백업/복구 (로컬)";

    const help = document.createElement("p");
    help.className = "admin-subbox-help";
    help.textContent = "서버 저장과 별개로, 브라우저에 자동 백업됩니다. 필요 시 다운로드/업로드로 옮길 수 있어요.";

    const row = document.createElement("div");
    row.className = "admin-chip-row";

    const btnDownload = document.createElement("button");
    btnDownload.type = "button";
    btnDownload.className = "admin-save-btn";
    btnDownload.style.padding = "10px 14px";
    btnDownload.style.boxShadow = "none";
    btnDownload.textContent = "다운로드(JSON)";

    const btnRestore = document.createElement("button");
    btnRestore.type = "button";
    btnRestore.className = "admin-save-btn";
    btnRestore.style.padding = "10px 14px";
    btnRestore.style.boxShadow = "none";
    btnRestore.textContent = "로컬백업 복구";

    const uploadLabel = document.createElement("label");
    uploadLabel.className = "admin-save-btn";
    uploadLabel.style.padding = "10px 14px";
    uploadLabel.style.boxShadow = "none";
    uploadLabel.style.cursor = "pointer";
    uploadLabel.textContent = "업로드(JSON)";

    const uploadInput = document.createElement("input");
    uploadInput.type = "file";
    uploadInput.accept = "application/json";
    uploadInput.style.display = "none";
    uploadLabel.appendChild(uploadInput);

    row.appendChild(btnDownload);
    row.appendChild(btnRestore);
    row.appendChild(uploadLabel);

    host.appendChild(title);
    host.appendChild(help);
    host.appendChild(row);

    // 탭 내부 적절한 위치(리스트 위쪽)에 삽입
    const list = document.getElementById("lendersList");
    if (list && list.parentElement) list.parentElement.insertBefore(host, list);
    else lendersPanel.appendChild(host);

    // 이벤트 연결
    btnDownload.addEventListener("click", () => {
      downloadJson("huchu-loan-config.json", { lenders: lendersConfig.lenders || {} });
    });

    btnRestore.addEventListener("click", () => {
      const backup = loadLoanConfigBackupFromStorage();
      if (!backup) { alert("로컬 백업이 없습니다."); return; }
      lendersConfig = { lenders: backup.lenders || {} };
      mergeLendersWithMaster();
      renderLendersList();
      updateLendersConfigPreview();
      alert("로컬 백업으로 복구했습니다.");
    });

    uploadInput.addEventListener("change", async () => {
      const file = uploadInput.files && uploadInput.files[0];
      if (!file) return;
      try {
        const txt = await readFileAsText(file);
        const parsed = safeJsonParse(txt);
        const normalized = normalizeLoanConfigShape(parsed);
        if (!normalized) throw new Error("형식 오류: lenders가 없습니다.");
        lendersConfig = { lenders: normalized.lenders || {} };
        mergeLendersWithMaster();
        renderLendersList();
        updateLendersConfigPreview();
        saveLoanConfigBackupToStorageNow();
        alert("업로드한 설정을 적용했고 로컬에도 백업했습니다.");
      } catch (e) {
        console.error(e);
        alert("업로드 파일 처리 중 오류가 발생했습니다.\n(형식이 맞는 JSON인지 확인해주세요.)");
      } finally {
        uploadInput.value = "";
      }
    });

    return;
  }

  // HTML에 이미 도구 UI가 있다면(선택), 아래는 필요한 ID가 있을 때만 연결
  const btnDownload = document.getElementById("loanConfigDownloadBtn");
  const btnRestore = document.getElementById("loanConfigRestoreBtn");
  const uploadInput = document.getElementById("loanConfigUploadInput");

  if (btnDownload) {
    btnDownload.addEventListener("click", () => {
      downloadJson("huchu-loan-config.json", { lenders: lendersConfig.lenders || {} });
    });
  }
  if (btnRestore) {
    btnRestore.addEventListener("click", () => {
      const backup = loadLoanConfigBackupFromStorage();
      if (!backup) { alert("로컬 백업이 없습니다."); return; }
      lendersConfig = { lenders: backup.lenders || {} };
      mergeLendersWithMaster();
      renderLendersList();
      updateLendersConfigPreview();
      alert("로컬 백업으로 복구했습니다.");
    });
  }
  if (uploadInput) {
    uploadInput.addEventListener("change", async () => {
      const file = uploadInput.files && uploadInput.files[0];
      if (!file) return;
      try {
        const txt = await readFileAsText(file);
        const parsed = safeJsonParse(txt);
        const normalized = normalizeLoanConfigShape(parsed);
        if (!normalized) throw new Error("형식 오류: lenders가 없습니다.");
        lendersConfig = { lenders: normalized.lenders || {} };
        mergeLendersWithMaster();
        renderLendersList();
        updateLendersConfigPreview();
        saveLoanConfigBackupToStorageNow();
        alert("업로드한 설정을 적용했고 로컬에도 백업했습니다.");
      } catch (e) {
        console.error(e);
        alert("업로드 파일 처리 중 오류가 발생했습니다.\n(형식이 맞는 JSON인지 확인해주세요.)");
      } finally {
        uploadInput.value = "";
      }
    });
  }
}

async function loadLendersConfigFromServer() {
  // ✅ 로컬 백업 준비
  const localBackup = loadLoanConfigBackupFromStorage();

  try {
    const res = await fetch(`${API_BASE}/api/loan-config`, { method: "GET" });
    if (!res.ok) {
      console.warn("loan-config GET 실패:", res.status);
      // 서버 실패 시 로컬 우선
      if (localBackup) {
        lendersConfig = { lenders: localBackup.lenders || {} };
      } else {
        lendersConfig = { lenders: {} };
      }
    } else {
      const json = await res.json().catch(() => null);
      const serverCfg = (json && typeof json === "object" && json.lenders && typeof json.lenders === "object")
        ? json
        : { lenders: {} };

      const serverCount = Object.keys(serverCfg.lenders || {}).length;

      // ✅ 서버 lenders가 "비어있으면" 로컬 백업 우선
      if (serverCount === 0 && localBackup && Object.keys(localBackup.lenders || {}).length > 0) {
        console.warn("loan-config 서버가 비어있어 로컬 백업을 우선 복구합니다.");
        lendersConfig = { lenders: localBackup.lenders || {} };
      } else {
        lendersConfig = serverCfg;
      }
    }
  } catch (e) {
    console.warn("loan-config fetch error:", e);
    // 네트워크 오류면 로컬 우선
    if (localBackup) lendersConfig = { lenders: localBackup.lenders || {} };
    else lendersConfig = { lenders: {} };
  }

  mergeLendersWithMaster();
  renderLendersList();
  updateLendersConfigPreview();
  saveLoanConfigBackupToStorageNow(); // 현재 상태를 로컬에도 반영
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

  saveLoanConfigBackupToStorageNow(); // ✅ 저장 성공 시 로컬 백업도 확정

  return successText || "저장되었습니다.";
}

/* =========================================================
   ✅ 추가조건(선택) UI 렌더
========================================================= */
function renderExtraConditionsBox(lender) {
  const box = document.createElement("div");
  box.className = "admin-subbox";

  const title = document.createElement("h3");
  title.className = "admin-subbox-title";
  title.textContent = "추가조건(선택)";

  const help = document.createElement("p");
  help.className = "admin-subbox-help";
  help.textContent = "사용자가 네비게이션에서 선택할 수 있는 추가조건입니다. 업체가 수용 가능한 조건만 체크하세요. (필수 아님)";

  box.appendChild(title);
  box.appendChild(help);

  const selected = new Set(Array.isArray(lender.extraConditions) ? lender.extraConditions : []);

  EXTRA_CONDITIONS.groups.forEach((g) => {
    const gTitle = document.createElement("div");
    gTitle.style.marginTop = "10px";
    gTitle.style.fontWeight = "900";
    gTitle.style.fontSize = "13px";
    gTitle.style.color = "#111827";
    gTitle.textContent = g.label;
    box.appendChild(gTitle);

    (g.sections || []).forEach((s) => {
      const sTitle = document.createElement("div");
      sTitle.style.marginTop = "8px";
      sTitle.style.fontWeight = "900";
      sTitle.style.fontSize = "12px";
      sTitle.style.color = "#374151";
      sTitle.textContent = `- ${s.label}`;
      box.appendChild(sTitle);

      const row = document.createElement("div");
      row.className = "admin-chip-row admin-chip-row--tight";

      (s.options || []).forEach((opt) => {
        const label = document.createElement("label");
        label.className = "admin-chip-check admin-chip-check--tiny";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = selected.has(opt.key);

        cb.addEventListener("change", () => {
          const cur = ensureLender(lender.id);
          const set = new Set(Array.isArray(cur.extraConditions) ? cur.extraConditions : []);
          if (cb.checked) set.add(opt.key);
          else set.delete(opt.key);

          updateLenderState(lender.id, { extraConditions: Array.from(set) });
          lenderUiState.openIds.add(lender.id);
          renderLendersList();
        });

        const span = document.createElement("span");
        span.textContent = opt.label;

        label.appendChild(cb);
        label.appendChild(span);
        row.appendChild(label);
      });

      box.appendChild(row);
    });
  });

  return box;
}

/* =========================================================
   ✅ 렌더: 업체 카드
========================================================= */
function renderLendersList() {
  const container = document.getElementById("lendersList");
  if (!container) return;
  container.innerHTML = "";

  const cfg = lendersConfig.lenders || {};

  // 표시 순서 구성
  const orderedIds = [];
  const seen = new Set();

  LENDERS_MASTER.forEach((m) => {
    if (cfg[m.id] && !seen.has(m.id)) {
      orderedIds.push(m.id);
      seen.add(m.id);
    }
  });

  Object.keys(cfg).forEach((id) => {
    if (!seen.has(id)) {
      orderedIds.push(id);
      seen.add(id);
    }
  });

  const visibleIds = orderedIds.filter((id) => {
    const lender = cfg[id];
    return lender && passesSearch(lender);
  });

  if (visibleIds.length === 0) {
    const empty = document.createElement("div");
    empty.className = "admin-empty";
    empty.textContent = "검색 조건에 맞는 온투업체가 없습니다.";
    container.appendChild(empty);
    return;
  }

  visibleIds.forEach((id) => {
    const lender = cfg[id];
    if (!lender) return;

    const isOpen = lenderUiState.openIds.has(lender.id);

    const card = document.createElement("div");
    card.className = "lender-card";

    // Header
    const head = document.createElement("div");
    head.className = "lender-head";
    head.setAttribute("role", "button");
    head.setAttribute("tabindex", "0");
    head.setAttribute("aria-expanded", isOpen ? "true" : "false");

    head.addEventListener("click", () => {
      if (lenderUiState.openIds.has(lender.id)) lenderUiState.openIds.delete(lender.id);
      else lenderUiState.openIds.add(lender.id);
      renderLendersList();
    });

    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (lenderUiState.openIds.has(lender.id)) lenderUiState.openIds.delete(lender.id);
        else lenderUiState.openIds.add(lender.id);
        renderLendersList();
      }
    });

    // 업체명(홈페이지 링크)
    let nameEl;
    const homepage = (lender.homepage || "").trim();
    if (homepage) {
      const a = document.createElement("a");
      a.className = "lender-name lender-name-link";
      a.href = homepage;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = lender.name;
      a.addEventListener("click", (e) => e.stopPropagation());
      nameEl = a;
    } else {
      const span = document.createElement("span");
      span.className = "lender-name";
      span.textContent = lender.name;
      nameEl = span;
    }

    const badges = document.createElement("span");
    badges.className = "lender-badges";

    const partnerBadge = document.createElement("span");
    partnerBadge.className = "lender-badge lender-badge--partner";
    partnerBadge.classList.toggle("is-off", !lender.isPartner);
    partnerBadge.textContent = "제휴";

    const activeBadge = document.createElement("span");
    activeBadge.className = "lender-badge lender-badge--active";
    activeBadge.classList.toggle("is-off", !lender.isActive);
    activeBadge.textContent = "신규";

    badges.appendChild(partnerBadge);
    badges.appendChild(activeBadge);

    const switches = document.createElement("div");
    switches.className = "lender-switches";

    // 신규
    const swActive = document.createElement("div");
    swActive.className = "lender-switch-item";
    const swActiveLabel = document.createElement("span");
    swActiveLabel.textContent = "신규";
    const swActiveWrap = document.createElement("label");
    swActiveWrap.className = "admin-switch";
    const activeInput = document.createElement("input");
    activeInput.type = "checkbox";
    activeInput.checked = !!lender.isActive;

    activeInput.addEventListener("click", (e) => e.stopPropagation());
    swActiveWrap.addEventListener("click", (e) => e.stopPropagation());
    swActive.addEventListener("click", (e) => e.stopPropagation());

    activeInput.addEventListener("change", () => {
      const next = !!activeInput.checked;
      activeBadge.classList.toggle("is-off", !next);
      updateLenderState(lender.id, { isActive: next });
    });

    swActiveWrap.appendChild(activeInput);
    swActive.appendChild(swActiveLabel);
    swActive.appendChild(swActiveWrap);

    // 제휴
    const swPartner = document.createElement("div");
    swPartner.className = "lender-switch-item";
    const swPartnerLabel = document.createElement("span");
    swPartnerLabel.textContent = "제휴";
    const swPartnerWrap = document.createElement("label");
    swPartnerWrap.className = "admin-switch";
    const partnerInput = document.createElement("input");
    partnerInput.type = "checkbox";
    partnerInput.checked = !!lender.isPartner;

    partnerInput.addEventListener("click", (e) => e.stopPropagation());
    swPartnerWrap.addEventListener("click", (e) => e.stopPropagation());
    swPartner.addEventListener("click", (e) => e.stopPropagation());

    partnerInput.addEventListener("change", () => {
      const next = !!partnerInput.checked;
      partnerBadge.classList.toggle("is-off", !next);

      const patch = { isPartner: next };
      if (!next) patch.partnerOrder = 0;

      updateLenderState(lender.id, patch);
      lenderUiState.openIds.add(lender.id);
      renderLendersList();
    });

    swPartnerWrap.appendChild(partnerInput);
    swPartner.appendChild(swPartnerLabel);
    swPartner.appendChild(swPartnerWrap);

    switches.appendChild(swActive);
    switches.appendChild(swPartner);

    // 제휴 표시순서 (제휴 ON일 때만) — 1~10
    const order = document.createElement("div");
    order.className = "lender-order";
    order.style.display = lender.isPartner ? "flex" : "none";
    order.addEventListener("click", (e) => e.stopPropagation());

    const orderTitle = document.createElement("span");
    orderTitle.className = "lender-order__title";
    orderTitle.textContent = "순서";

    const orderChips = document.createElement("div");
    orderChips.className = "admin-order-chips";

    for (let i = 1; i <= 10; i++) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "admin-order-chip";
      chip.textContent = String(i);
      chip.classList.toggle("is-active", lender.partnerOrder === i);

      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        setPartnerOrderUnique(lender.id, i);
        lenderUiState.openIds.add(lender.id);
        renderLendersList();
      });

      orderChips.appendChild(chip);
    }

    order.appendChild(orderTitle);
    order.appendChild(orderChips);

    head.appendChild(nameEl);
    head.appendChild(badges);
    head.appendChild(switches);
    head.appendChild(order);

    // Panel
    const panel = document.createElement("div");
    panel.className = "lender-panel";
    panel.classList.toggle("hide", !isOpen);

    const inner = document.createElement("div");
    inner.className = "lender-panel__inner";

    // 1) 상품군
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
        lenderUiState.openIds.add(lender.id);
        renderLendersList();
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

    // ✅ 부동산 담보대출 선택 시에만 노출
    const hasRealEstate = Array.isArray(lender.products) && lender.products.includes("부동산담보대출");

    if (hasRealEstate) {
      // ✅ 추가조건(선택)
      inner.appendChild(renderExtraConditionsBox(lender));

      // 기존 matrixBox
      const matrixBox = document.createElement("div");
      matrixBox.className = "admin-subbox";

      const mTitle = document.createElement("h3");
      mTitle.className = "admin-subbox-title";
      mTitle.textContent = "지역/유형별 취급여부 + LTV(최대) + 취급 대출 종류";

      // 안내문 + 우측 최저대출금액(만원)
      const helpRow = document.createElement("div");
      helpRow.className = "admin-subbox-headrow";

      const mHelp = document.createElement("p");
      mHelp.className = "admin-subbox-help";
      mHelp.textContent = "지역 탭을 선택한 뒤, 부동산 유형별로 취급여부(칩) / LTV 최대(%) / 취급 대출 종류를 설정하세요.";

      const minLoan = document.createElement("div");
      minLoan.className = "admin-minloan";
      minLoan.addEventListener("click", (e) => e.stopPropagation());

      const minLabel = document.createElement("span");
      minLabel.className = "admin-minloan__label";
      minLabel.textContent = "최저대출금액";

      const minInput = document.createElement("input");
      minInput.type = "number";
      minInput.className = "admin-mini-input admin-minloan__input";
      minInput.min = "0";
      minInput.step = "1";
      minInput.placeholder = "예) 500";
      minInput.value = (lender.realEstateMinLoanAmount ?? "");

      minInput.addEventListener("input", () => {
        updateLenderState(lender.id, { realEstateMinLoanAmount: minInput.value });
      });

      const minUnit = document.createElement("span");
      minUnit.className = "admin-minloan__unit";
      minUnit.textContent = "만원";

      minLoan.appendChild(minLabel);
      minLoan.appendChild(minInput);
      minLoan.appendChild(minUnit);

      helpRow.appendChild(mHelp);
      helpRow.appendChild(minLoan);

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
          lenderUiState.openIds.add(lender.id);
          renderLendersList();
        });

        regionTabs.appendChild(btn);
      });

      const table = document.createElement("table");
      table.className = "admin-matrix";

      const thead = document.createElement("thead");
      thead.innerHTML = `
        <tr>
          <th style="width:160px;">부동산 유형</th>
          <th class="cell-center" style="width:110px;">취급</th>
          <th style="width:190px;">LTV 최대(%)</th>
          <th>취급 대출 종류</th>
        </tr>
      `;
      table.appendChild(thead);

      const tbody = document.createElement("tbody");

      PROPERTY_TYPES.forEach((pt) => {
        const tr = document.createElement("tr");
        const cell = lender.regions[activeRegion][pt.key];

        const tdType = document.createElement("td");
        tdType.textContent = pt.label;

        // 취급 칩
        const tdEnable = document.createElement("td");
        tdEnable.className = "cell-center";

        const enableChip = document.createElement("button");
        enableChip.type = "button";
        enableChip.className = "admin-chip-toggle";
        enableChip.classList.toggle("is-on", !!cell.enabled);
        enableChip.textContent = cell.enabled ? "취급" : "미취급";

        enableChip.addEventListener("click", () => {
          const cur = ensureLender(lender.id);
          const next = !cur.regions[activeRegion][pt.key].enabled;
          cur.regions[activeRegion][pt.key].enabled = next;
          schedulePreviewUpdate();

          lenderUiState.openIds.add(lender.id);
          renderLendersList();
        });

        tdEnable.appendChild(enableChip);

        // LTV 최대
        const tdLtv = document.createElement("td");
        const ltvWrap = document.createElement("div");
        ltvWrap.className = "admin-ltv-wrap";

        const max = document.createElement("input");
        max.type = "number";
        max.className = "admin-mini-input";
        max.placeholder = "최대";
        max.value = cell.ltvMax ?? "";
        max.disabled = !cell.enabled;

        max.addEventListener("input", () => {
          const cur = ensureLender(lender.id);
          cur.regions[activeRegion][pt.key].ltvMax = max.value;
          schedulePreviewUpdate();
        });

        const pct = document.createElement("span");
        pct.className = "admin-ltv-pct";
        pct.textContent = "%";

        ltvWrap.appendChild(max);
        ltvWrap.appendChild(pct);
        tdLtv.appendChild(ltvWrap);

        // 대출종류
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
          cb.disabled = !cell.enabled;

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

        if (!cell.enabled) loanRow.classList.add("is-disabled");

        tdLoans.appendChild(loanRow);

        tr.appendChild(tdType);
        tr.appendChild(tdEnable);
        tr.appendChild(tdLtv);
        tr.appendChild(tdLoans);

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);

      matrixBox.appendChild(mTitle);
      matrixBox.appendChild(helpRow);
      matrixBox.appendChild(regionTabs);
      matrixBox.appendChild(table);

      inner.appendChild(matrixBox);
    }

    // 3) 상담채널
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

    // 카드별 저장
    const saveRow = document.createElement("div");
    saveRow.className = "lender-save-row";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "lender-save-btn";
    saveBtn.textContent = "저장";

    saveBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = "저장중...";
        await postLendersConfigToServer("저장되었습니다.");
        alert(`${lender.name} 설정이 저장되었습니다.`);
      } catch (err) {
        console.error("per-card save error:", err);
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

  // ✅ loan-config 도구 UI (있으면 연결, 없으면 생성)
  setupLoanConfigToolsUI();

  // 초기 랜더(비어 있어도 OK)
  mergeLendersWithMaster();
  setupLendersControls();
  renderLendersList();
  updateLendersConfigPreview();
  setupLendersSaveButton();

  // 서버 로드 후 재렌더 (서버 empty면 로컬백업 우선 복구)
  loadLendersConfigFromServer();
});
