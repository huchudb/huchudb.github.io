// /assets/admin-beta.js

// =============== 공통 상수 ===============
const API_BASE         = "https://huchudb-github-io.vercel.app";
const LOAN_CONFIG_API  = `${API_BASE}/api/loan-config`;
const ONTU_STATS_API   = `${API_BASE}/api/ontu-stats`;

const PROPERTY_TYPES = [
  "아파트",
  "다세대/연립",
  "단독/다가구",
  "토지/임야",
];

const PRODUCT_TYPES = [
  "부동산담보",
  "부동산PF",
  "어음·매출채권담보",
  "기타담보(주식 등)",
  "개인신용",
  "법인신용",
];

// 소수점 한 자리까지 표시 → .0이면 제거
function formatPct(num) {
  if (num == null || isNaN(num)) return "";
  const s = Number(num).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

function parseNumber(value) {
  if (value == null) return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

// 작은 상태 메시지 출력
function setStatus(el, message, kind = "info") {
  if (!el) return;
  el.textContent = message || "";
  el.style.color =
    kind === "error" ? "#b91c1c" :
    kind === "success" ? "#166534" :
    "#6b7280";
}

// =============== 1. 담보대출 LTV / 금리 설정 ===============

async function loadLoanConfig() {
  const statusEl = document.getElementById("loanConfigStatus");
  try {
    setStatus(statusEl, "불러오는 중...", "info");

    const res = await fetch(`${LOAN_CONFIG_API}?t=${Date.now()}`, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // API 응답 형태 유연하게 처리: {config:{byPropertyType:...}} 또는 {byPropertyType:...}
    const root  = json.config || json;
    const table = (root && (root.byPropertyType || root.items || root)) || {};

    const tbody = document.getElementById("loanConfigBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    PROPERTY_TYPES.forEach((label, idx) => {
      const conf = table[label] || {};
      const maxLtvPct   = conf.maxLtv != null ? formatPct(conf.maxLtv * 100) : "";
      const rateMinPct  = conf.rateMin != null ? formatPct(conf.rateMin * 100) : "";
      const rateMaxPct  = conf.rateMax != null ? formatPct(conf.rateMax * 100) : "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding:6px 4px;color:#111827;">${label}</td>
        <td style="padding:6px 4px;text-align:right;">
          <input type="number"
                 id="lc-${idx}-ltv"
                 min="0" max="100" step="0.1"
                 value="${maxLtvPct}"
                 style="width:80px;padding:4px 6px;font-size:12px;text-align:right;">
        </td>
        <td style="padding:6px 4px;text-align:right;">
          <input type="number"
                 id="lc-${idx}-minRate"
                 min="0" max="100" step="0.1"
                 value="${rateMinPct}"
                 style="width:80px;padding:4px 6px;font-size:12px;text-align:right;">
        </td>
        <td style="padding:6px 4px;text-align:right;">
          <input type="number"
                 id="lc-${idx}-maxRate"
                 min="0" max="100" step="0.1"
                 value="${rateMaxPct}"
                 style="width:80px;padding:4px 6px;font-size:12px;text-align:right;">
        </td>
      `;
      tr.dataset.type = label;
      tbody.appendChild(tr);
    });

    setStatus(statusEl, "불러오기 완료", "success");
  } catch (e) {
    console.error("[admin-beta] loadLoanConfig 에러:", e);
    setStatus(statusEl, "설정을 불러오지 못했습니다.", "error");
  }
}

async function saveLoanConfig() {
  const statusEl = document.getElementById("loanConfigStatus");
  try {
    setStatus(statusEl, "저장 중...", "info");

    const tbody = document.getElementById("loanConfigBody");
    if (!tbody) throw new Error("loanConfigBody 없음");

    const rows = Array.from(tbody.querySelectorAll("tr"));
    const byPropertyType = {};

    rows.forEach((tr, idx) => {
      const typeLabel = tr.dataset.type || PROPERTY_TYPES[idx];

      const ltvInput   = document.getElementById(`lc-${idx}-ltv`);
      const minInput   = document.getElementById(`lc-${idx}-minRate`);
      const maxInput   = document.getElementById(`lc-${idx}-maxRate`);

      const ltvPct     = parseNumber(ltvInput?.value);
      const minRatePct = parseNumber(minInput?.value);
      const maxRatePct = parseNumber(maxInput?.value);

      const conf = {};

      if (ltvPct != null && ltvPct > 0) {
        conf.maxLtv = ltvPct / 100;          // 70 → 0.70
      }
      if (minRatePct != null && minRatePct > 0) {
        conf.rateMin = minRatePct / 100;     // 6.8 → 0.068
      }
      if (maxRatePct != null && maxRatePct > 0) {
        conf.rateMax = maxRatePct / 100;     // 14.8 → 0.148
      }

      byPropertyType[typeLabel] = conf;
    });

    const payload = {
      config: {
        byPropertyType,
        updatedAt: new Date().toISOString(),
        version: 1,
      },
    };

    const res = await fetch(LOAN_CONFIG_API, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${txt}`);
    }

    setStatus(statusEl, "저장 완료! (베타 계산기에서 새 LTV/금리 적용 가능)", "success");
  } catch (e) {
    console.error("[admin-beta] saveLoanConfig 에러:", e);
    setStatus(statusEl, "저장 중 오류가 발생했습니다.", "error");
  }
}

// =============== 2. 온투업 통계 (ontu-stats) ===============

async function loadOntuStatsForMonth(month) {
  const statusEl = document.getElementById("statsStatus");
  try {
    if (!month) throw new Error("month 없음");
    setStatus(statusEl, "불러오는 중...", "info");

    const url = `${ONTU_STATS_API}?month=${encodeURIComponent(month)}&t=${Date.now()}`;
    const res = await fetch(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // home-beta.js가 기대하는 형태: {month, summary, byType}
    const monthVal = data.month || month;
    const summary  = data.summary || {};
    const byType   = data.byType  || {};

    // 기준월 input
    const monthInput = document.getElementById("statsMonth");
    if (monthInput) monthInput.value = monthVal;

    // Summary 채우기
    const f = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v != null ? v : "";
    };

    f("sum-registeredFirms", summary.registeredFirms);
    f("sum-dataFirms",       summary.dataFirms);
    f("sum-totalLoan",       summary.totalLoan);
    f("sum-totalRepaid",     summary.totalRepaid);
    f("sum-balance",         summary.balance);

    // 상품유형별 테이블
    const tbody = document.getElementById("productStatsBody");
    if (tbody) {
      tbody.innerHTML = "";
      PRODUCT_TYPES.forEach((name, idx) => {
        const cfg = byType[name] || {};
        const ratioPct = cfg.ratio != null ? formatPct(cfg.ratio * 100) : "";
        const amount   = cfg.amount != null ? cfg.amount : "";

        const tr = document.createElement("tr");
        tr.dataset.name = name;
        tr.innerHTML = `
          <td style="padding:6px 4px;color:#111827;">${name}</td>
          <td style="padding:6px 4px;text-align:right;">
            <input type="number"
                   class="pt-ratio"
                   min="0" max="100" step="0.1"
                   value="${ratioPct}"
                   style="width:72px;padding:4px 6px;font-size:12px;text-align:right;">
          </td>
          <td style="padding:6px 4px;text-align:right;">
            <input type="number"
                   class="pt-amount"
                   min="0" step="1000000"
                   value="${amount}"
                   style="width:140px;padding:4px 6px;font-size:12px;text-align:right;">
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    setStatus(statusEl, "불러오기 완료", "success");
  } catch (e) {
    console.error("[admin-beta] loadOntuStatsForMonth 에러:", e);
    setStatus(statusEl, "통계를 불러오지 못했습니다.", "error");
  }
}

async function saveOntuStats() {
  const statusEl = document.getElementById("statsStatus");
  try {
    setStatus(statusEl, "저장 중...", "info");

    const monthInput = document.getElementById("statsMonth");
    const monthVal   = monthInput?.value || "";
    if (!monthVal) throw new Error("조회년월을 먼저 선택해주세요.");

    const summary = {
      registeredFirms: parseNumber(document.getElementById("sum-registeredFirms")?.value) ?? 0,
      dataFirms:       parseNumber(document.getElementById("sum-dataFirms")?.value) ?? 0,
      totalLoan:       parseNumber(document.getElementById("sum-totalLoan")?.value) ?? 0,
      totalRepaid:     parseNumber(document.getElementById("sum-totalRepaid")?.value) ?? 0,
      balance:         parseNumber(document.getElementById("sum-balance")?.value) ?? 0,
    };

    const tbody = document.getElementById("productStatsBody");
    if (!tbody) throw new Error("productStatsBody 없음");

    const byType = {};
    tbody.querySelectorAll("tr").forEach((tr) => {
      const name = tr.dataset.name;
      if (!name) return;
      const ratioInput  = tr.querySelector(".pt-ratio");
      const amountInput = tr.querySelector(".pt-amount");

      const ratioPct = parseNumber(ratioInput?.value);
      const amount   = parseNumber(amountInput?.value);

      const cfg = {};
      if (ratioPct != null && ratioPct > 0) {
        cfg.ratio = ratioPct / 100;   // 43 → 0.43
      } else {
        cfg.ratio = 0;
      }
      if (amount != null && amount > 0) {
        cfg.amount = amount;
      } else {
        cfg.amount = 0;
      }
      byType[name] = cfg;
    });

    const payload = {
      month: monthVal,
      summary,
      byType,
    };

    const res = await fetch(ONTU_STATS_API, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${txt}`);
    }

    setStatus(
      statusEl,
      "저장 완료! /beta 페이지의 대출현황·상품유형별 대출잔액에 즉시 반영됩니다.",
      "success"
    );
  } catch (e) {
    console.error("[admin-beta] saveOntuStats 에러:", e);
    setStatus(statusEl, e.message || "저장 중 오류가 발생했습니다.", "error");
  }
}

// =============== 상단 MENU 드롭다운 (베타용) ===============
function setupBetaMenu() {
  const btn   = document.getElementById("betaMenuToggle");
  const panel = document.getElementById("betaMenuPanel");
  if (!btn || !panel) return;

  const close = () => {
    panel.classList.add("hide");
    btn.setAttribute("aria-expanded", "false");
  };
  const open = () => {
    panel.classList.remove("hide");
    btn.setAttribute("aria-expanded", "true");
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const expanded = btn.getAttribute("aria-expanded") === "true";
    if (expanded) close();
    else open();
  });

  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      close();
    }
  });
}

// =============== 초기화 ===============
document.addEventListener("DOMContentLoaded", () => {
  setupBetaMenu();

  // 1. LTV / 금리 설정 불러오기
  loadLoanConfig();
  const saveLcBtn = document.getElementById("loanConfigSaveBtn");
  if (saveLcBtn) {
    saveLcBtn.addEventListener("click", () => {
      saveLoanConfig();
    });
  }

  // 2. 온투 통계: 기본값은 현재월로 세팅 후 로드
  const monthInput = document.getElementById("statsMonth");
  if (monthInput && !monthInput.value) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm   = String(now.getMonth() + 1).padStart(2, "0");
    monthInput.value = `${yyyy}-${mm}`;
  }

  const loadStatsBtn = document.getElementById("statsLoadBtn");
  if (loadStatsBtn) {
    loadStatsBtn.addEventListener("click", () => {
      const m = document.getElementById("statsMonth")?.value;
      if (m) loadOntuStatsForMonth(m);
    });
  }

  const saveStatsBtn = document.getElementById("statsSaveBtn");
  if (saveStatsBtn) {
    saveStatsBtn.addEventListener("click", () => {
      saveOntuStats();
    });
  }

  // 페이지 처음 들어왔을 때 현재월 기준으로 한번 불러오기
  if (monthInput && monthInput.value) {
    loadOntuStatsForMonth(monthInput.value);
  }
});
