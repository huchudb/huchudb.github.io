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
   ✅ fetch 304 무력화 유틸 (cache-bust + no-store)
   - CORS preflight 유발하던 Cache-Control/Pragma 헤더 주입 제거
========================================================= */
async function fetchJsonNoCache(url, options = {}) {
  const sep = url.includes("?") ? "&" : "?";
  const bustUrl = `${url}${sep}_ts=${Date.now()}`;

  const res = await fetch(bustUrl, {
    ...options,
    method: options.method || "GET",
    cache: "no-store",
    headers: {
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${txt}`);
  }

  return await res.json().catch(() => null);
}


const adminAuthState = {
  supabase: null,
  session: null,
  config: null,
  ready: false,
  pageInitialized: false
};

function setAdminAuthStatus(message, variant = "muted") {
  const el = document.getElementById("adminAuthStatus");
  if (!el) return;
  el.textContent = message || "";
  el.classList.remove("is-error", "is-success", "is-muted");
  if (variant === "error") el.classList.add("is-error");
  else if (variant === "success") el.classList.add("is-success");
  else el.classList.add("is-muted");
}

function setAdminProtectedVisible(visible) {
  const root = document.getElementById("adminProtectedRoot");
  if (root) root.hidden = !visible;
  document.body.classList.toggle("admin-auth-locked", !visible);
}

function updateAdminUserUi(session) {
  const form = document.getElementById("adminLoginForm");
  const userBox = document.getElementById("adminAuthUserBox");
  const userText = document.getElementById("adminAuthUserText");
  const email = session?.user?.email || "";

  if (form) form.hidden = !!session;
  if (userBox) userBox.hidden = !session;
  if (userText) userText.textContent = email ? `${email} 로그인됨` : "관리자 로그인됨";
}

async function loadAdminAuthConfig() {
  const json = await fetchJsonNoCache(`${API_BASE}/api/admin-auth-config`);
  if (!json || json.ok === false) throw new Error("관리자 인증 설정을 불러오지 못했습니다.");
  return json;
}

async function ensureSupabaseClient() {
  if (adminAuthState.supabase) return adminAuthState.supabase;

  const config = adminAuthState.config || await loadAdminAuthConfig();
  adminAuthState.config = config;

  if (!config.enabled || !config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Supabase 관리자 인증 환경변수가 설정되지 않았습니다.");
  }

  const factory = window?.supabase?.createClient;
  if (typeof factory !== "function") {
    throw new Error("Supabase 브라우저 클라이언트를 불러오지 못했습니다.");
  }

  adminAuthState.supabase = factory(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  return adminAuthState.supabase;
}

async function getAdminAccessToken() {
  const sb = await ensureSupabaseClient();
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  const session = data?.session || null;
  adminAuthState.session = session;
  return session?.access_token || "";
}

async function adminFetch(url, options = {}) {
  const token = await getAdminAccessToken();
  if (!token) throw new Error("관리자 로그인이 필요합니다.");

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };

  return fetch(url, {
    ...options,
    headers,
    cache: options.cache || "no-store"
  });
}


async function verifyAdminSession(session) {
  if (!session?.access_token) return false;

  const res = await fetch(`${API_BASE}/api/admin-auth-check?_ts=${Date.now()}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }

  return true;
}

async function initializeAdminPageOnce() {
  if (adminAuthState.pageInitialized) return;
  adminAuthState.pageInitialized = true;

  setupAdminTabs();
  setupMoneyInputs();

  loadStatsFromStorage();
  ensureByLenderSection();
  setupStatsInteractions();

  setupLoanConfigToolsUI();

  mergeLendersWithMaster();
  setupLendersControls();
  renderLendersList();
  updateLendersConfigPreview();
  setupLendersSaveButton();

  await loadLendersConfigFromServer();

  const m = getCurrentMonthKey();
  if (m) {
    ensureMonthNode(m);
    renderByLenderSection(m);
    applyByLenderModeUI(isByLenderMode(m));
    ensureProductTotalsRow();
    updateProductTotalsRow();
  }
}

async function applyAuthenticatedState(session) {
  adminAuthState.session = session || null;
  updateAdminUserUi(adminAuthState.session);

  if (adminAuthState.session) {
    try {
      await verifyAdminSession(adminAuthState.session);
      setAdminProtectedVisible(true);
      setAdminAuthStatus("관리자 인증이 확인되었습니다.", "success");
      await initializeAdminPageOnce();
      return;
    } catch (error) {
      console.error("admin role check error:", error);
      setAdminProtectedVisible(false);
      setAdminAuthStatus("이 계정은 관리자 권한이 없거나 아직 허용되지 않았습니다.", "error");
      return;
    }
  }

  setAdminProtectedVisible(false);
  setAdminAuthStatus("로그인 후 통계/업체 설정 저장 기능을 사용할 수 있습니다.", "muted");
}

async function setupAdminAuth() {
  setAdminProtectedVisible(false);
  setAdminAuthStatus("관리자 인증 상태를 확인중입니다.", "muted");

  const loginForm = document.getElementById("adminLoginForm");
  const loginBtn = document.getElementById("adminLoginBtn");
  const logoutBtn = document.getElementById("adminLogoutBtn");

  try {
    adminAuthState.config = await loadAdminAuthConfig();

    if (!adminAuthState.config.enabled) {
      setAdminAuthStatus("Supabase 관리자 인증 설정이 아직 배포되지 않았습니다. Vercel 환경변수를 먼저 설정해주세요.", "error");
      return;
    }

    const sb = await ensureSupabaseClient();

    sb.auth.onAuthStateChange(async (_event, session) => {
      await applyAuthenticatedState(session || null);
    });

    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    await applyAuthenticatedState(data?.session || null);

    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = String(document.getElementById("adminLoginEmail")?.value || "").trim();
        const password = String(document.getElementById("adminLoginPassword")?.value || "");
        if (!email || !password) {
          setAdminAuthStatus("이메일과 비밀번호를 입력해주세요.", "error");
          return;
        }

        try {
          if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = "로그인중...";
          }

          setAdminAuthStatus("로그인 중입니다.", "muted");
          const { error: signInError } = await sb.auth.signInWithPassword({ email, password });
          if (signInError) throw signInError;
        } catch (error) {
          console.error("admin login error:", error);
          setAdminAuthStatus("로그인에 실패했습니다. 관리자 계정 또는 권한 설정을 확인해주세요.", "error");
        } finally {
          if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = "로그인";
          }
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        try {
          await sb.auth.signOut();
          window.location.reload();
        } catch (error) {
          console.error("admin logout error:", error);
          setAdminAuthStatus("로그아웃 중 오류가 발생했습니다.", "error");
        }
      });
    }
  } catch (error) {
    console.error("setupAdminAuth error:", error);
    setAdminAuthStatus("관리자 인증 초기화 중 오류가 발생했습니다. 환경변수를 확인해주세요.", "error");
  }
}

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

function toNumberSafe(v) {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d.-]/g, "");
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatPercent8(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(8);
}

function parsePercentInput(v) {
  const s = String(v ?? "").replace(/[^0-9.\-]/g, "");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/* ✅ 상품유형별 표에 "합계" 행을 법인신용대출 아래에 생성 */
function ensureProductTotalsRow() {
  const tbody = document.getElementById("productRows");
  if (!tbody) return;

  if (tbody.querySelector('tr[data-key="__total__"]')) return;

  const rows = Array.from(tbody.querySelectorAll('tr[data-key]'));
  if (rows.length === 0) return;

  let anchor =
    rows.find(r => r.getAttribute("data-key") === "법인신용대출") ||
    rows.find(r => String(r.getAttribute("data-key") || "").includes("법인신용")) ||
    rows[rows.length - 1];

  const tr = document.createElement("tr");
  tr.setAttribute("data-key", "__total__");
  tr.className = "stats-total-row";

  const td0 = document.createElement("td");
  td0.textContent = "합계";

  const td1 = document.createElement("td");
  const ratio = document.createElement("input");
  ratio.type = "text";
  ratio.className = "js-ratio stats-total-ratio";
  ratio.readOnly = true;
  ratio.disabled = true;
  ratio.placeholder = "-";
  ratio.style.textAlign = "right";
  td1.appendChild(ratio);

  const td2 = document.createElement("td");
  const amt = document.createElement("input");
  amt.type = "text";
  amt.className = "js-amount stats-total-amount";
  amt.setAttribute("data-type", "money");
  amt.readOnly = true;
  amt.disabled = true;
  amt.placeholder = "-";
  amt.style.textAlign = "right";
  td2.appendChild(amt);

  tr.appendChild(td0);
  tr.appendChild(td1);
  tr.appendChild(td2);

  tbody.insertBefore(tr, anchor.nextSibling);

  // 금액 콤마 바인딩 (disabled여도 값 포맷만)
  setupMoneyInputs(tbody);
}

/* ✅ 현재 상품유형별 표의 %/금액 합계를 합계 행에 표시 */
function updateProductTotalsRow() {
  const tbody = document.getElementById("productRows");
  if (!tbody) return;

  ensureProductTotalsRow();

  const totalRow = tbody.querySelector('tr[data-key="__total__"]');
  if (!totalRow) return;

  let ratioSum = 0;
  let amountSum = 0;

  tbody.querySelectorAll('tr[data-key]').forEach((row) => {
    const key = row.getAttribute("data-key");
    if (!key || key === "__total__") return;

    const ratioEl = row.querySelector(".js-ratio");
    const amountEl = row.querySelector(".js-amount");

    ratioSum += ratioEl ? parsePercentInput(ratioEl.value) : 0;
    amountSum += getMoneyValue(amountEl);
  });

  const ratioTotalEl = totalRow.querySelector(".stats-total-ratio");
  const amtTotalEl = totalRow.querySelector(".stats-total-amount");

  if (ratioTotalEl) ratioTotalEl.value = formatPercent8(ratioSum);
  if (amtTotalEl) amtTotalEl.value = amountSum ? formatWithCommas(String(amountSum)) : "";
}

/* ✅ 중복 바인딩 방지 */
function setupMoneyInputs(root) {
  const scope = root || document;
  const moneyInputs = scope.querySelectorAll('input[data-type="money"]');
  moneyInputs.forEach((input) => {
    if (input.dataset.moneyBound === "true") {
      if (input.value) input.value = formatWithCommas(input.value);
      return;
    }
    input.dataset.moneyBound = "true";
    input.addEventListener("input", (e) => {
      e.target.value = formatWithCommas(e.target.value);
    });
    if (input.value) input.value = formatWithCommas(input.value);
  });
}

/* =========================================================
   ✅ (추가) 금융조건 수치 입력: 스타일 주입 + 유틸
========================================================= */
function ensureFinanceInputsStylesInjected() {
  if (document.getElementById("financeInputsStyles")) return;

  const style = document.createElement("style");
  style.id = "financeInputsStyles";
  style.textContent = `
    .finance-inputs-wrap { margin-top: 10px; }
    .finance-products { display: flex; flex-direction: column; gap: 10px; }
    .finance-product-title {
      font-weight: 900;
      font-size: 12px;
      color: #111827;
      margin: 2px 0 0;
    }
    .finance-metrics {
      border: 2px solid #111;
      border-radius: 12px;
      padding: 14px 14px 12px;
      background: #fff;
    }
    .finance-metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      align-items: start;
    }
    .finance-metric {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .finance-metric-title {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.6px;
      color: #111;
      line-height: 1.1;
      text-align: center;
      white-space: nowrap;
    }
    .finance-metric-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
      justify-content: center;
    }
    .finance-metric-row .lab {
      font-size: 18px;
      font-weight: 900;
      color: #111;
      white-space: nowrap;
    }
    .finance-metric-row input {
      width: 120px;
      max-width: 100%;
      height: 40px;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 0 12px;
      font-size: 16px;
      font-weight: 800;
      outline: none;
      text-align: center;
      background: #fff;
    }
    .finance-metric-row input:focus {
      border-color: #111;
      box-shadow: 0 0 0 3px rgba(17,17,17,0.08);
    }
    .finance-metric-row .unit {
      font-size: 18px;
      font-weight: 900;
      color: #111;
      white-space: nowrap;
    }

    /* ✅ min/max/avg 3줄 레이아웃 */
    .finance-metric-row--minmax { justify-content: center; }
    .finance-metric-row--minmax input { width: 120px; }

    @media (max-width: 520px) {
      .finance-metric-title { font-size: 22px; }
      .finance-metric-row .lab, .finance-metric-row .unit { font-size: 16px; }
      .finance-metric-row input { width: 96px; height: 38px; font-size: 15px; }
      .finance-metrics-grid { gap: 10px; }
      .finance-metrics { padding: 12px; }
    }

    /* ✅ (추가) 온투 통계 - byLender 입력 UI */
    .stats-byLender-box { margin-top: 12px; }
    .stats-byLender-head { display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
    .stats-byLender-title { font-weight: 900; font-size: 13px; color:#111827; }
    .stats-byLender-help { margin:6px 0 0; font-size:12px; color:#4b5563; line-height:1.4; }
    .stats-byLender-tools { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .stats-byLender-tools input[type="text"]{
      height: 34px; border:1px solid #d1d5db; border-radius:10px; padding:0 10px;
      font-size: 13px; font-weight: 700;
    }
    .stats-byLender-tools label{ display:flex; gap:6px; align-items:center; font-size:12px; font-weight:800; color:#111; }
    .stats-byLender-tableWrap{
      margin-top:10px; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; background:#fff;
    }
    .stats-byLender-tableWrap .scroll{
      max-height: 360px; overflow:auto;
    }
    .stats-byLender-table{
      width:100%; border-collapse:separate; border-spacing:0;
      min-width: 980px;
    }
    .stats-byLender-table th, .stats-byLender-table td{
      border-bottom:1px solid #f3f4f6;
      padding: 8px 10px;
      font-size: 12px;
      vertical-align: middle;
      white-space: nowrap;
    }
    .stats-byLender-table th{
      position: sticky; top:0; z-index:2;
      background:#f9fafb;
      font-weight: 900;
      color:#111827;
    }
    .stats-byLender-table td:first-child, .stats-byLender-table th:first-child{
      position: sticky; left:0; z-index:3;
      background: #fff;
      border-right:1px solid #f3f4f6;
      min-width: 160px;
      max-width: 220px;
      overflow:hidden; text-overflow:ellipsis;
    }
    .stats-byLender-table th:first-child{
      background:#f9fafb;
      z-index:4;
    }
    .stats-byLender-money{
      width: 132px; height: 34px; border:1px solid #d1d5db; border-radius:10px; padding:0 10px;
      font-size: 12px; font-weight: 800; text-align:right;
    }
    .stats-byLender-disabledNote{
      margin-top:8px; font-size:12px; color:#6b7280;
    }

    /* ✅ (추가) 상품유형별 잔액 합계 행 */
    #productRows tr.stats-total-row td {
      background: #f3f4f6;
      font-weight: 900;
    }
    #productRows tr.stats-total-row input {
      background: #f3f4f6;
      font-weight: 900;
    }

    /* ✅ (추가) LTV Up UI (세부지역) */
    .admin-ltv-wrap { display:flex; gap:10px; align-items:flex-start; flex-wrap:wrap; }
    .admin-ltv-base { display:flex; gap:6px; align-items:center; }
    .admin-ltvup {
      display:flex; align-items:center; gap:8px;
      border-left: 2px solid #111;
      padding-left: 10px;
      margin-left: 2px;
      flex-wrap:wrap;
    }
    .admin-ltvup__label {
      font-weight: 900; font-size: 12px; color:#111;
      white-space: nowrap;
    }
    .admin-ltvup__chiprow { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .admin-ltvup__chip {
      display:flex; gap:6px; align-items:center;
      border:1px solid #e5e7eb; border-radius:999px;
      padding: 6px 10px;
      background:#fff;
    }
    .admin-ltvup__chip b { font-size: 12px; font-weight: 900; color:#111; }
    .admin-ltvup__chip input{
      width: 64px; height: 30px;
      border:1px solid #d1d5db; border-radius:10px;
      padding:0 8px;
      font-size: 12px; font-weight: 900;
      text-align:center;
    }
    .admin-ltvup__chip span{ font-size: 12px; font-weight: 900; color:#111; }
    .admin-ltvup.is-disabled { opacity: 0.55; }
  `;
  document.head.appendChild(style);
}

function sanitizePercentString(v) {
  let s = String(v || "").replace(/[^0-9.]/g, "");
  const parts = s.split(".");
  if (parts.length > 2) {
    s = parts[0] + "." + parts.slice(1).join("");
  }
  return s;
}

function normalizePercentBlur(v) {
  const s = sanitizePercentString(v);
  if (!s) return "";
  const n = Number(s);
  if (!Number.isFinite(n)) return "";
  const fixed = Math.round(n * 100) / 100;
  return String(fixed);
}

/* =========================================================
   1) 온투 통계
========================================================= */
const STATS_LOCAL_KEY = "huchu_ontu_stats_beta_v2";
let statsRoot = { byMonth: {} };

function ensureMonthNode(monthKey) {
  if (!statsRoot.byMonth) statsRoot.byMonth = {};
  if (!statsRoot.byMonth[monthKey]) {
    statsRoot.byMonth[monthKey] = {
      summary: {},
      products: {},
      byType: null,
      byLender: {},
      ui: { useByLender: false }
    };
  } else {
    if (!statsRoot.byMonth[monthKey].byLender) statsRoot.byMonth[monthKey].byLender = {};
    if (!statsRoot.byMonth[monthKey].ui) statsRoot.byMonth[monthKey].ui = { useByLender: false };
  }
  return statsRoot.byMonth[monthKey];
}

function isByLenderMode(monthKey) {
  if (!monthKey) monthKey = getCurrentMonthKey();
  if (!monthKey) return false;
  return !!(statsRoot.byMonth?.[monthKey]?.ui?.useByLender);
}

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

function getProductRowKeys() {
  const tbody = document.getElementById("productRows");
  if (!tbody) return [];
  return Array.from(tbody.querySelectorAll("tr[data-key]"))
    .map((r) => r.getAttribute("data-key"))
    .filter((k) => k && k !== "__total__");
}

function clearStatsForm() {
  ["statsRegisteredFirms","statsDataFirms","statsTotalLoan","statsTotalRepaid","statsBalance"]
    .forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });

  document.querySelectorAll("#productRows .js-ratio").forEach((el) => (el.value = ""));
  document.querySelectorAll("#productRows .js-amount").forEach((el) => (el.value = ""));

  // byLender UI도 비움
  const box = document.getElementById("statsByLenderBox");
  if (box) {
    const scroll = box.querySelector(".stats-byLender-tableWrap .scroll");
    if (scroll) scroll.innerHTML = "";
  }

  ensureProductTotalsRow();
  updateProductTotalsRow();
}

/* ✅ products/byType/byLender → productRows에 반영 */
function applyProductsToProductRows(products) {
  const tbody = document.getElementById("productRows");
  if (!tbody) return;

  ensureProductTotalsRow();

  tbody.querySelectorAll("tr[data-key]").forEach((row) => {
    const key = row.getAttribute("data-key");
    if (key === "__total__") return;

    const cfg = products[key] || {};

    const ratioEl = row.querySelector(".js-ratio");
    const amountEl = row.querySelector(".js-amount");

    const ratioPercent =
      (cfg.ratioPercent != null) ? cfg.ratioPercent
      : (cfg.ratio != null) ? _ratioToPercent(cfg.ratio)
      : "";

    if (ratioEl) ratioEl.value = (ratioPercent !== "" ? formatPercent8(ratioPercent) : "");
    if (amountEl) amountEl.value = (cfg.amount != null) ? formatWithCommas(String(cfg.amount)) : "";
  });

  updateProductTotalsRow();
}

/* ✅ 서버/로컬 데이터 → 폼 채우기 */
function fillStatsForm(stat, monthKey) {
  if (!stat) { clearStatsForm(); return; }
  if (!monthKey) monthKey = getCurrentMonthKey();

  const node = monthKey ? ensureMonthNode(monthKey) : null;

  const s = (stat.summary && typeof stat.summary === "object") ? stat.summary : {};
  const regEl = document.getElementById("statsRegisteredFirms");
  const dataEl = document.getElementById("statsDataFirms");
  const tlEl = document.getElementById("statsTotalLoan");
  const trEl = document.getElementById("statsTotalRepaid");
  const balEl = document.getElementById("statsBalance");

  if (regEl) regEl.value = (s.registeredFirms ?? "");
  if (dataEl) dataEl.value = (s.dataFirms ?? "");
  if (tlEl) tlEl.value = (s.totalLoan != null) ? formatWithCommas(String(s.totalLoan)) : "";
  if (trEl) trEl.value = (s.totalRepaid != null) ? formatWithCommas(String(s.totalRepaid)) : "";
  if (balEl) balEl.value = (s.balance != null) ? formatWithCommas(String(s.balance)) : "";

  const rowKeys = getProductRowKeys();

  // ✅ products 우선, 없으면 byType → products 변환
  let products = (stat.products && typeof stat.products === "object") ? stat.products : null;
  if (!products && stat.byType && typeof stat.byType === "object") {
    products = _byTypeToProducts(stat.byType, rowKeys);
  }
  if (!products) products = {};

  applyProductsToProductRows(products);

  // ✅ byLender 로드/반영
  const byLender = (stat.byLender && typeof stat.byLender === "object") ? stat.byLender : {};
  const hasByLender = Object.keys(byLender).length > 0;

  if (node) {
    node.summary = { ...(node.summary || {}), ...(stat.summary || {}) };
    node.products = products;
    node.byType = stat.byType || null;
    node.byLender = byLender || {};
    if (!node.ui) node.ui = { useByLender: false };
    // 서버/로컬에 byLender가 있으면 기본 ON
    if (hasByLender) node.ui.useByLender = true;
  }

  ensureByLenderSection();
  renderByLenderSection(monthKey);

  // byLender 모드면 합산값으로 productRows/ratio 동기화 (✅ statsBalance는 수동 입력값을 분모로만 사용)
  if (monthKey && isByLenderMode(monthKey)) {
    recalcFromByLender(monthKey, { silent: true });
    applyByLenderModeUI(true);
  } else {
    applyByLenderModeUI(false);
  }

  ensureProductTotalsRow();
  updateProductTotalsRow();
}

function collectStatsFormData() {
  const monthKey = getCurrentMonthKey();
  if (!monthKey) return null;

  ensureMonthNode(monthKey);

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
    balance: getMoneyValue(balEl) // ✅ 항상 수동 입력값
  };

  const products = {};
  document.querySelectorAll("#productRows tr[data-key]").forEach((row) => {
    const key = row.getAttribute("data-key");
    if (!key || key === "__total__") return;

    const ratioEl = row.querySelector(".js-ratio");
    const amountEl = row.querySelector(".js-amount");

    const ratioPercent = ratioEl && ratioEl.value !== "" ? Number(ratioEl.value) : 0;
    const amount = getMoneyValue(amountEl);

    if (ratioPercent === 0 && amount === 0) return;
    products[key] = { ratioPercent, amount };
  });

  const node = ensureMonthNode(monthKey);
  const byLender = (node.byLender && typeof node.byLender === "object") ? node.byLender : {};
  const ui = node.ui || { useByLender: false };

  return { monthKey, summary, products, byLender, ui };
}

/* ===== 기존 ratio% → amount 자동계산 (byLender 모드면 중단) ===== */
function recalcProductAmounts() {
  const monthKey = getCurrentMonthKey();
  if (monthKey && isByLenderMode(monthKey)) return;

  const balEl = document.getElementById("statsBalance");
  if (!balEl) return;
  const balance = getMoneyValue(balEl);

  document.querySelectorAll("#productRows tr[data-key]").forEach((row) => {
    const key = row.getAttribute("data-key");
    if (!key || key === "__total__") return;

    const ratioEl = row.querySelector(".js-ratio");
    const amountEl = row.querySelector(".js-amount");
    if (!ratioEl || !amountEl) return;

    const ratio = ratioEl.value !== "" ? parseFloat(ratioEl.value) : NaN;
    if (!balance || isNaN(ratio)) { amountEl.value = ""; return; }

    const amt = Math.round(balance * (ratio / 100));
    amountEl.value = formatWithCommas(String(amt));
  });

  updateProductTotalsRow();
}

function _ratioToPercent(v) {
  const n = Number(v);
  if (!isFinite(n)) return "";
  return (n <= 1) ? (n * 100) : n;
}
function _percentToRatio(v) {
  const n = Number(v);
  if (!isFinite(n)) return 0;
  return (n > 1) ? (n / 100) : n;
}

function _normTypeKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[_-]/g, "")
    .replace(/[()]/g, "")
    .replace(/대출|유동화/g, "");
}
function _findBestRowKey(typeKey, rowKeys) {
  const t = _normTypeKey(typeKey);
  if (!t) return null;

  let best = null;
  let bestScore = 0;

  for (const rk of rowKeys) {
    const r = _normTypeKey(rk);
    if (!r) continue;

    let score = 0;
    if (r === t) score = 3;
    else if (r.includes(t) || t.includes(r)) score = 2;

    if (score > bestScore) {
      bestScore = score;
      best = rk;
    }
  }
  return best || null;
}

function _byTypeToProducts(byType, rowKeys) {
  const out = {};
  if (!byType || typeof byType !== "object") return out;

  Object.entries(byType).forEach(([k, v]) => {
    if (!v || typeof v !== "object") return;
    const matchKey = _findBestRowKey(k, rowKeys) || k;
    out[matchKey] = {
      ratioPercent: _ratioToPercent(v.ratio),
      amount: v.amount != null ? Number(v.amount) : 0
    };
  });

  return out;
}

function _productsToByType(products) {
  const out = {};
  if (!products || typeof products !== "object") return out;

  Object.entries(products).forEach(([k, v]) => {
    if (!v || typeof v !== "object") return;

    const ratioPercent = Number(v.ratioPercent || 0);
    const amount = Number(v.amount || 0);

    out[k] = { ratio: _percentToRatio(ratioPercent), amount };

    const shortKey = String(k).replace(/대출|유동화/g, "");
    if (shortKey && shortKey !== k) {
      out[shortKey] = { ratio: _percentToRatio(ratioPercent), amount };
    }
  });

  return out;
}
/* ✅ 서버 응답 형태가 어떤 것이든 monthKey 기준으로 {summary, products, byType, byLender}로 정규화 */
function normalizeOntuStatsResponseToMonth(json, monthKey) {
  if (!json || !monthKey) return null;

  // Case A) { byMonth: { "YYYY-MM": {...} } }
  if (json.byMonth && typeof json.byMonth === "object") {
    const byMonth = json.byMonth;
    const item = byMonth[monthKey];
    if (item && typeof item === "object") {
      return {
        monthKey,
        summary: item.summary || null,
        products: item.products || null,
        byType: item.byType || null,
        byLender: item.byLender || null,
        ui: item.ui || null
      };
    }
    return null;
  }

  // Case B) 단일 월 페이로드는 반드시 "month/monthKey"가 요청 monthKey와 일치해야만 수용
  const respKey =
    (json.monthKey || json.month || (json.summary && (json.summary.monthKey || json.summary.month)) || null);

  if (respKey && String(respKey) === String(monthKey)) {
    return {
      monthKey,
      summary: json.summary || null,
      products: json.products || null,
      byType: json.byType || null,
      byLender: json.byLender || null,
      ui: json.ui || null
    };
  }

  // Case C) { data: {...} } 래퍼
  if (json.data && typeof json.data === "object") {
    return normalizeOntuStatsResponseToMonth(json.data, monthKey);
  }

  // ✅ monthKey 정보가 없거나 불일치면 "잘못된 월 데이터"로 간주하고 버린다.
  return null;
}

/* ✅ 서버 로드: stats 페이지와 동일하게 ?month= 우선 시도 */
async function loadOntuStatsFromServer(monthKey) {
  if (!monthKey) return null;

  // 1) ?month=
  try {
    const url = `${API_BASE}/api/ontu-stats?month=${encodeURIComponent(monthKey)}`;
    const json = await fetchJsonNoCache(url);
    const normalized = normalizeOntuStatsResponseToMonth(json, monthKey);
    if (normalized) return normalized;
  } catch (e) {
    console.warn("ontu-stats server load (month) error:", e);
  }

  // 2) ?monthKey=
  try {
    const url = `${API_BASE}/api/ontu-stats?monthKey=${encodeURIComponent(monthKey)}`;
    const json = await fetchJsonNoCache(url);
    const normalized = normalizeOntuStatsResponseToMonth(json, monthKey);
    if (normalized) return normalized;
  } catch (e) {
    console.warn("ontu-stats server load (monthKey) error:", e);
  }

  // 3) latest/all GET 후 monthKey 매칭
  try {
    const urlAll = `${API_BASE}/api/ontu-stats`;
    const jsonAll = await fetchJsonNoCache(urlAll);
    const normalized = normalizeOntuStatsResponseToMonth(jsonAll, monthKey);
    return normalized || null;
  } catch (e) {
    console.warn("ontu-stats server load (all) error:", e);
    return null;
  }
}

/* =========================================================
   ✅ (신규) byLender 입력 UI + 합산 로직
========================================================= */
function ensureByLenderSection() {
  if (document.getElementById("statsByLenderBox")) return;

  const tryAttach = () => {
    const productTbody = document.getElementById("productRows");
    if (!productTbody) return false;

    const anchor =
      productTbody.closest(".admin-subbox") ||
      productTbody.closest(".admin-card") ||
      productTbody.closest("section") ||
      productTbody.parentElement;

    if (!anchor || !anchor.parentNode) return false;

    const box = document.createElement("div");
    box.id = "statsByLenderBox";
    box.className = "admin-subbox stats-byLender-box";

    const head = document.createElement("div");
    head.className = "stats-byLender-head";

    const title = document.createElement("div");
    title.className = "stats-byLender-title";
    title.textContent = "업체별 상품유형 잔액 입력 (byLender)";

    const tools = document.createElement("div");
    tools.className = "stats-byLender-tools";

    const useLabel = document.createElement("label");
    const useCb = document.createElement("input");
    useCb.type = "checkbox";
    useCb.id = "statsUseByLenderToggle";
    useLabel.appendChild(useCb);
    useLabel.appendChild(document.createTextNode("업체별 입력 사용"));
    tools.appendChild(useLabel);

    const onlyActiveLabel = document.createElement("label");
    const onlyActiveCb = document.createElement("input");
    onlyActiveCb.type = "checkbox";
    onlyActiveCb.id = "statsByLenderOnlyActive";
    onlyActiveCb.checked = true;
    onlyActiveLabel.appendChild(onlyActiveCb);
    onlyActiveLabel.appendChild(document.createTextNode("활성 업체만"));
    tools.appendChild(onlyActiveLabel);

    const q = document.createElement("input");
    q.type = "text";
    q.id = "statsByLenderSearch";
    q.placeholder = "업체 검색 (이름/ID)";
    tools.appendChild(q);

    head.appendChild(title);
    head.appendChild(tools);

    const help = document.createElement("p");
    help.className = "stats-byLender-help";
    help.innerHTML =
      '기관 제공 <b>점유율(%)</b>이 100%를 넘는 문제가 있어, 여기서는 <b>업체별 잔액(원)</b>을 입력합니다.<br/>' +
      '입력된 업체별 금액을 시스템이 <b>상품유형별 잔액(합계)</b>으로 자동 계산하여 위 표에 채워주고,<br/>' +
      '<b>상품유형별 비율(%)</b>은 <b>대출잔액(수동 입력)</b>을 분모로 자동 계산합니다.';

    const tableWrap = document.createElement("div");
    tableWrap.className = "stats-byLender-tableWrap";
    const scroll = document.createElement("div");
    scroll.className = "scroll";
    tableWrap.appendChild(scroll);

    const note = document.createElement("div");
    note.className = "stats-byLender-disabledNote";
    note.id = "statsByLenderDisabledNote";
    note.textContent = "※ 업체별 입력 사용 ON 시, 상품유형별 금액/비율(%)은 자동 계산됩니다. (대출잔액은 수동 입력 유지)";

    box.appendChild(head);
    box.appendChild(help);
    box.appendChild(tableWrap);
    box.appendChild(note);

    // ✅ anchor 바로 다음에 삽입
    anchor.parentNode.insertBefore(box, anchor.nextSibling);

    // 이벤트 바인딩
    useCb.addEventListener("change", () => {
      const monthKey = getCurrentMonthKey();
      if (!monthKey) return;

      const node = ensureMonthNode(monthKey);
      node.ui.useByLender = !!useCb.checked;
      saveStatsToStorage();

      applyByLenderModeUI(node.ui.useByLender);
      renderByLenderSection(monthKey);

      if (node.ui.useByLender) {
        recalcFromByLender(monthKey);
      } else {
        recalcProductAmounts();
      }
    });

    onlyActiveCb.addEventListener("change", () => renderByLenderSection(getCurrentMonthKey()));
    q.addEventListener("input", () => renderByLenderSection(getCurrentMonthKey()));

    return true;
  };

  if (tryAttach()) return;

  // ✅ DOM이 늦게 생기는 케이스 대비 재시도
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (tryAttach() || tries >= 30) clearInterval(timer);
  }, 150);
}

/* =========================================================
   ✅ (FIX) byLender 렌더/모드UI/합산 함수
========================================================= */
function applyByLenderModeUI(enabled) {
  const ratioInputs = document.querySelectorAll("#productRows .js-ratio");
  const amountInputs = document.querySelectorAll("#productRows .js-amount");
  const balEl = document.getElementById("statsBalance");

  // ✅ ratio 입력은 byLender 모드에서 계산값이므로 잠금
  ratioInputs.forEach((el) => {
    el.disabled = !!enabled;
  });

  // ✅ amount는 항상 표시용(읽기전용)
  amountInputs.forEach((el) => {
    el.readOnly = true;
    el.disabled = false;
  });

  // ✅ statsBalance는 절대 잠그지 않는다(수동 입력 유지)
  if (balEl) {
    balEl.readOnly = false;
    balEl.disabled = false;
  }

  const note = document.getElementById("statsByLenderDisabledNote");
  if (note) note.style.opacity = enabled ? "1" : "0.65";
}

function renderByLenderSection(monthKey) {
  const box = document.getElementById("statsByLenderBox");
  if (!box) return;

  const scroll = box.querySelector(".stats-byLender-tableWrap .scroll");
  if (!scroll) return;

  if (!monthKey) monthKey = getCurrentMonthKey();
  if (!monthKey) {
    scroll.innerHTML = `<div style="padding:10px;font-size:12px;color:#6b7280;">조회년월을 먼저 선택해주세요.</div>`;
    return;
  }

  const node = ensureMonthNode(monthKey);

  // 토글 UI 상태 반영
  const useCb = document.getElementById("statsUseByLenderToggle");
  if (useCb) useCb.checked = !!node.ui?.useByLender;

  const onlyActive = document.getElementById("statsByLenderOnlyActive");
  const onlyActiveOn = onlyActive ? !!onlyActive.checked : true;

  const qEl = document.getElementById("statsByLenderSearch");
  const q = (qEl ? (qEl.value || "") : "").trim().toLowerCase();

  const rowKeys = getProductRowKeys();

  // lenders 목록 구성
  const cfg = (lendersConfig && lendersConfig.lenders && typeof lendersConfig.lenders === "object")
    ? lendersConfig.lenders
    : {};

  // ✅ LENDERS_MASTER 순서 유지
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
    const l = cfg[id];
    if (!l) return false;
    if (onlyActiveOn && !l.isActive) return false;
    if (!q) return true;
    const hay = `${l.name || ""} ${l.id || id || ""}`.toLowerCase();
    return hay.includes(q);
  });

  if (visibleIds.length === 0) {
    scroll.innerHTML = `<div style="padding:10px;font-size:12px;color:#6b7280;">표시할 업체가 없습니다. (활성 업체만 체크/검색어를 확인)</div>`;
    return;
  }

  const table = document.createElement("table");
  table.className = "stats-byLender-table";

  // 헤더
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");

  const th0 = document.createElement("th");
  th0.textContent = "업체";
  trh.appendChild(th0);

  rowKeys.forEach((k) => {
    const th = document.createElement("th");
    th.textContent = k;
    trh.appendChild(th);
  });

  thead.appendChild(trh);
  table.appendChild(thead);

  // 바디
  const tbody = document.createElement("tbody");

  const byLender = (node.byLender && typeof node.byLender === "object") ? node.byLender : {};
  node.byLender = byLender;

  visibleIds.forEach((id) => {
    const l = cfg[id];
    if (!l) return;

    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = l.name || l.id || id || "-";
    tr.appendChild(tdName);

    const lenderId = id;

    if (!byLender[lenderId] || typeof byLender[lenderId] !== "object") {
      byLender[lenderId] = {};
    }

    rowKeys.forEach((ptype) => {
      const td = document.createElement("td");

      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "stats-byLender-money";
      inp.placeholder = "-";
      inp.value = byLender[lenderId][ptype] ? formatWithCommas(String(byLender[lenderId][ptype])) : "";

      inp.addEventListener("input", () => {
        inp.value = formatWithCommas(inp.value);
        const n = getMoneyValue(inp);
        byLender[lenderId][ptype] = n;
        saveStatsToStorage();

        if (node.ui?.useByLender) {
          recalcFromByLender(monthKey, { silent: true });
          applyByLenderModeUI(true);
        }
      });

      inp.addEventListener("blur", () => {
        const n = getMoneyValue(inp);
        inp.value = n ? formatWithCommas(String(n)) : "";
      });

      td.appendChild(inp);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  scroll.innerHTML = "";
  scroll.appendChild(table);
}

function recalcFromByLender(monthKey, opts = {}) {
  if (!monthKey) monthKey = getCurrentMonthKey();
  if (!monthKey) return;

  const node = ensureMonthNode(monthKey);
  const rowKeys = getProductRowKeys();

  const byLender = (node.byLender && typeof node.byLender === "object") ? node.byLender : {};
  node.byLender = byLender;

  // ✅ 분모: statsBalance는 "수동 입력" (자동 덮어쓰기 금지)
  const balEl = document.getElementById("statsBalance");
  const manualBalance = getMoneyValue(balEl);

  // 상품유형별 합계
  const sums = {};
  rowKeys.forEach((k) => (sums[k] = 0));

  Object.values(byLender).forEach((per) => {
    if (!per || typeof per !== "object") return;
    rowKeys.forEach((k) => {
      const v = toNumberSafe(per[k]);
      if (v > 0) sums[k] += v;
    });
  });

  // products 생성
  const products = {};
  rowKeys.forEach((k) => {
    const amount = Math.round(sums[k] || 0);
    if (!amount) return;

    const ratioPercent =
      (manualBalance > 0)
        ? Number(((amount / manualBalance) * 100).toFixed(8))
        : "";

    products[k] = { ratioPercent, amount };
  });

  node.products = products;
  node.byType = _productsToByType(products);

  applyProductsToProductRows(products);

  if (!opts.silent) saveStatsToStorage();
}

/* =========================================================
   Stats interactions
========================================================= */
function setupStatsInteractions() {
  const monthInput = document.getElementById("statsMonth");
  if (monthInput) {
    monthInput.addEventListener("change", async () => {
      const m = getCurrentMonthKey();
      if (!m) { clearStatsForm(); return; }

      ensureByLenderSection();

      const serverStat = await loadOntuStatsFromServer(m);
      if (serverStat) {
        fillStatsForm(serverStat, m);
        statsRoot.byMonth[m] = {
          ...(statsRoot.byMonth[m] || {}),
          ...serverStat,
          ui: {
            ...(statsRoot.byMonth[m]?.ui || {}),
            useByLender: (serverStat.byLender && Object.keys(serverStat.byLender).length > 0)
              ? true
              : (statsRoot.byMonth[m]?.ui?.useByLender || false)
          }
        };
        saveStatsToStorage();
      } else {
        fillStatsForm(statsRoot.byMonth[m] || null, m);
      }

      setupMoneyInputs();

      if (!isByLenderMode(m)) {
        recalcProductAmounts();
      } else {
        recalcFromByLender(m, { silent: true });
      }

      ensureProductTotalsRow();
      updateProductTotalsRow();
    });
  }

  const balEl = document.getElementById("statsBalance");
  if (balEl) {
    balEl.addEventListener("input", () => {
      const m = getCurrentMonthKey();
      balEl.value = formatWithCommas(balEl.value);
      if (!m) return;

      if (isByLenderMode(m)) {
        recalcFromByLender(m, { silent: true });
        updateProductTotalsRow();
        return;
      }

      recalcProductAmounts();
    });
  }

  document.querySelectorAll("#productRows .js-ratio")
    .forEach((el) => el.addEventListener("input", () => {
      const m = getCurrentMonthKey();
      if (m && isByLenderMode(m)) return;
      recalcProductAmounts();
    }));

  const saveBtn = document.getElementById("saveOntuStatsBtn");
  const statusEl = document.getElementById("statsSaveStatus");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const payload = collectStatsFormData();
      if (!payload) { alert("먼저 조회년월을 선택해주세요."); return; }

      let { monthKey, summary, products, byLender, ui } = payload;

      if (ui?.useByLender) {
        recalcFromByLender(monthKey, { silent: true });
        const node = ensureMonthNode(monthKey);
        products = (node.products && typeof node.products === "object") ? node.products : {};
        byLender = (node.byLender && typeof node.byLender === "object") ? node.byLender : (byLender || {});
      }

      try {
        const res = await adminFetch(`${API_BASE}/api/ontu-stats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monthKey,
            month: monthKey,
            summary,
            products,
            byLender
          })
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`API 실패: HTTP ${res.status} ${errText}`);
        }

        const serverStat = await loadOntuStatsFromServer(monthKey);
        const node = ensureMonthNode(monthKey);

        const applied = serverStat || {
          summary,
          products,
          byType: _productsToByType(products),
          byLender
        };

        statsRoot.byMonth[monthKey] = {
          ...(statsRoot.byMonth[monthKey] || {}),
          ...applied,
          ui: { ...(node.ui || {}), useByLender: !!ui?.useByLender }
        };

        saveStatsToStorage();
        fillStatsForm(statsRoot.byMonth[monthKey], monthKey);

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
  { key: "스탁론(상장)", label: "스탁론(상장)" },
  { key: "스탁론(비상장)", label: "스탁론(비상장)" },
  { key: "법인신용대출", label: "법인신용대출" },
  { key: "매출채권유동화", label: "매출채권유동화" },
  { key: "의료사업자대출", label: "의료사업자대출" },
  { key: "온라인선정산", label: "선정산" },
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

/* ✅ (신규) 세부지역 LTV Up 정의 */
const SUBREGION_LTV_UP = {
  seoul: [
    { key: "gangnam", label: "강남" },
    { key: "seocho", label: "서초" },
    { key: "songpa", label: "송파" }
  ],
  gyeonggi: [
    { key: "bundang", label: "분당" },
    { key: "hanam", label: "하남" },
    { key: "ilsan", label: "일산" }
  ],
  incheon: [
    { key: "songdo", label: "송도" },
  ]
};
/* =========================================================
   ✅ 추가조건(선택) — 정의서(단일 소스)
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

// ------------------------------------------------------
// ✅ Navi 렌더를 위한 meta (admin을 SoT로 사용)
// - navi는 이 meta를 그대로 받아서 Step1~Step4 선택지를 렌더한다.
// - SUBREGION_LTV_UP(서울/경기/인천)도 meta로 함께 저장한다.
// ------------------------------------------------------
function buildNaviMeta() {
  return {
    version: "v1",
    productGroups: PRODUCT_GROUPS,
    regions: REGIONS,
    propertyTypes: PROPERTY_TYPES,
    loanTypes: {
      base: LOAN_TYPES_BASE,
      aptv: LOAN_TYPES_APTVILLA,
    },
    SUBREGION_LTV_UP: SUBREGION_LTV_UP,
    extraConditions: EXTRA_CONDITIONS,
  };
}



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

/* ✅ 마스터 */
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

/* ✅ 기존 저장 데이터 호환: "스탁론" → "스탁론(상장)" 자동 변환 */
function migrateProducts(products) {
  let arr = uniq(Array.isArray(products) ? products : []);
  if (arr.includes("스탁론")) {
    arr = arr.filter((x) => x !== "스탁론");
    if (!arr.includes("스탁론(상장)")) arr.push("스탁론(상장)");
  }
  return arr;
}

function ensureLender(id) {
  if (!lendersConfig.lenders) lendersConfig.lenders = {};
  if (!lendersConfig.lenders[id]) {
    lendersConfig.lenders[id] = {
      id,
      name: id,
      homepage: "",
      licenseNo: "",
      logoDataUrl: "",
      isActive: false,
      isPartner: false,
      partnerOrder: 0,
      realEstateMinLoanAmount: "",
      realEstateMaxLoanAmount: "", // ✅ (추가)
      extraConditions: [],
      financialInputs: {},
      products: [],
      phoneNumber: "",
      kakaoUrl: "",
      regions: {}
    };
  }
  return lendersConfig.lenders[id];
}

/* =========================================================
   ✅ lender deep default/호환
========================================================= */
function ensureLenderDeepDefaults(lender) {
  if (!lender) return;

  if (typeof lender.name !== "string") lender.name = String(lender.name || lender.id || "");
  if (typeof lender.homepage !== "string") lender.homepage = String(lender.homepage || lender.homepageUrl || "");
  if (typeof lender.licenseNo !== "string") lender.licenseNo = String(lender.licenseNo || lender.registrationNo || lender.ontuLicenseNo || "");
  if (typeof lender.logoDataUrl !== "string") lender.logoDataUrl = String(lender.logoDataUrl || lender.logo || "");

  if (typeof lender.partnerOrder !== "number") lender.partnerOrder = 0;
  if (lender.partnerOrder < 0 || lender.partnerOrder > 10) lender.partnerOrder = 0;

  if (typeof lender.realEstateMinLoanAmount !== "string" && typeof lender.realEstateMinLoanAmount !== "number") {
    lender.realEstateMinLoanAmount = "";
  }
  if (typeof lender.realEstateMaxLoanAmount !== "string" && typeof lender.realEstateMaxLoanAmount !== "number") {
    lender.realEstateMaxLoanAmount = "";
  }

  if (!Array.isArray(lender.products)) lender.products = [];
  lender.products = migrateProducts(lender.products);

  const hasRealEstate = lender.products.includes("부동산담보대출");
  if (!hasRealEstate) {
    lender.realEstateMinLoanAmount = "";
    lender.realEstateMaxLoanAmount = "";
  }

  if (!Array.isArray(lender.extraConditions)) {
    const legacy = lender.extraConditionsKeys || lender.extraConditionKeys || [];
    lender.extraConditions = Array.isArray(legacy) ? legacy.slice() : [];
  }
  lender.extraConditions = uniq(lender.extraConditions)
    .filter((k) => typeof k === "string" && !!EXTRA_CONDITION_INDEX[k]);
  if (!hasRealEstate) lender.extraConditions = [];

  if (!lender.financialInputs || typeof lender.financialInputs !== "object") lender.financialInputs = {};
  Object.keys(lender.financialInputs).forEach((k) => {
    if (!lender.financialInputs[k] || typeof lender.financialInputs[k] !== "object") lender.financialInputs[k] = {};
  });

  const productsArr = Array.isArray(lender.products) ? lender.products : [];
  productsArr.forEach((pgKey) => {
    if (!lender.financialInputs[pgKey] || typeof lender.financialInputs[pgKey] !== "object") {
      lender.financialInputs[pgKey] = {};
    }
    const obj = lender.financialInputs[pgKey];

    // ✅ 기존 avg-only 3종은 유지 + 문자열화
    ["interestAvg", "platformFeeAvg", "prepayFeeAvg"].forEach((field) => {
      if (obj[field] == null) obj[field] = "";
      else obj[field] = String(obj[field]);
    });

    // ✅ (추가) 플랫폼수수료 / 중도상환수수료: min/max 지원 + 평균 자동(호환 저장)
    const ensureMinMax = (minKey, maxKey, avgKey) => {
      if (obj[minKey] == null) obj[minKey] = "";
      else obj[minKey] = String(obj[minKey]);

      if (obj[maxKey] == null) obj[maxKey] = "";
      else obj[maxKey] = String(obj[maxKey]);

      const hasMinMax =
        (String(obj[minKey] || "").trim() !== "") ||
        (String(obj[maxKey] || "").trim() !== "");
      const hasAvg = String(obj[avgKey] || "").trim() !== "";

      // 과거 데이터(avg만 존재) → min/max로 씨딩
      if (!hasMinMax && hasAvg) {
        obj[minKey] = String(obj[avgKey]);
        obj[maxKey] = String(obj[avgKey]);
      }
    };

    ensureMinMax("platformFeeMin", "platformFeeMax", "platformFeeAvg");
    ensureMinMax("prepayFeeMin", "prepayFeeMax", "prepayFeeAvg");

    // ✅ 부동산담보대출: 금리 최소/최대 입력 지원 + 평균 자동(호환 저장)
    if (pgKey === "부동산담보대출") {
      if (obj.interestMin == null) obj.interestMin = "";
      else obj.interestMin = String(obj.interestMin);

      if (obj.interestMax == null) obj.interestMax = "";
      else obj.interestMax = String(obj.interestMax);

      const hasMinMax =
        (String(obj.interestMin || "").trim() !== "") ||
        (String(obj.interestMax || "").trim() !== "");
      const hasAvg = String(obj.interestAvg || "").trim() !== "";

      if (!hasMinMax && hasAvg) {
        obj.interestMin = String(obj.interestAvg);
        obj.interestMax = String(obj.interestAvg);
      }
    }
  });

  if (!lender.regions || typeof lender.regions !== "object") lender.regions = {};

  REGIONS.forEach((r) => {
    if (!lender.regions[r.key] || typeof lender.regions[r.key] !== "object") lender.regions[r.key] = {};

    PROPERTY_TYPES.forEach((pt) => {
      const prev = lender.regions[r.key][pt.key] || {};

      // loanTypes 정리
      let loanTypes = Array.isArray(prev.loanTypes) ? uniq(prev.loanTypes) : [];
      if (pt.key === "land") {
        loanTypes = loanTypes.filter((x) => x !== "임대보증금반환대출");
      }

      // ✅ (추가) LTV Up 기본값 (서울/경기만)
      const subList = SUBREGION_LTV_UP[r.key] || null;
      let ltvUp = {};
      if (subList) {
        const prevUp = (prev.ltvUp && typeof prev.ltvUp === "object") ? prev.ltvUp : {};
        subList.forEach((s) => {
          const raw = prevUp[s.key];
          ltvUp[s.key] = (raw == null) ? "" : String(raw);
        });
      } else {
        ltvUp = (prev.ltvUp && typeof prev.ltvUp === "object") ? prev.ltvUp : {};
      }

      lender.regions[r.key][pt.key] = {
        enabled: !!prev.enabled,
        ltvMax: prev.ltvMax ?? "",
        ltvMin: prev.ltvMin ?? "",
        ltvUp, // ✅ (추가)
        loanTypes
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
    scheduleLoanConfigBackupSave();
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

  const merged = { ...current };

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
      realEstateMaxLoanAmount: (existing.realEstateMaxLoanAmount ?? ""), // ✅ (추가)
      extraConditions: Array.isArray(existing.extraConditions) ? uniq(existing.extraConditions) : [],
      financialInputs: (existing.financialInputs && typeof existing.financialInputs === "object") ? existing.financialInputs : {},
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
   ✅ loan-config 로컬 자동백업/복구 + 다운로드/업로드
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
  }, 450);
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

let __loanCfgUiBound = false;
function setupLoanConfigToolsUI() {
  if (__loanCfgUiBound) return;
  __loanCfgUiBound = true;

  const btnDownload = document.getElementById("downloadLoanConfigBtn");
  const btnUpload = document.getElementById("uploadLoanConfigBtn");
  const fileInput = document.getElementById("loanConfigFileInput");
  const statusEl = document.getElementById("lendersBackupStatus");

  const setStatus = (msg) => {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
  };

  if (btnDownload) {
    btnDownload.addEventListener("click", () => {
      downloadJson("huchu-loan-config.json", { lenders: lendersConfig.lenders || {} });
      setStatus("백업 파일을 다운로드했습니다.");
      setTimeout(() => { if (statusEl && statusEl.textContent.includes("다운로드")) statusEl.textContent = ""; }, 2500);
    });
  }

  if (btnUpload && fileInput) {
    btnUpload.addEventListener("click", () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
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
        const mk = getCurrentMonthKey();
        if (mk) renderByLenderSection(mk);

        setStatus("업로드한 백업을 적용했고, 로컬 백업에도 저장했습니다.");
        setTimeout(() => { if (statusEl && statusEl.textContent.includes("업로드")) statusEl.textContent = ""; }, 3000);
        alert("업로드한 설정을 적용했고 로컬에도 백업했습니다.");
      } catch (e) {
        console.error(e);
        setStatus("업로드 처리 중 오류가 발생했습니다. (JSON 형식 확인)");
        alert("업로드 파일 처리 중 오류가 발생했습니다.\n(형식이 맞는 JSON인지 확인해주세요.)");
      } finally {
        fileInput.value = "";
      }
    });
  }
}

async function loadLendersConfigFromServer() {
  const localBackup = loadLoanConfigBackupFromStorage();

  try {
    const json = await fetchJsonNoCache(`${API_BASE}/api/loan-config`);
    const serverCfg = (json && typeof json === "object" && json.lenders && typeof json.lenders === "object")
      ? json
      : { lenders: {} };

    const serverCount = Object.keys(serverCfg.lenders || {}).length;

    if (serverCount === 0 && localBackup && Object.keys(localBackup.lenders || {}).length > 0) {
      console.warn("loan-config 서버가 비어있어 로컬 백업을 우선 복구합니다.");
      lendersConfig = { lenders: localBackup.lenders || {} };
    } else {
      lendersConfig = serverCfg;
    }
  } catch (e) {
    console.warn("loan-config fetch error:", e);
    if (localBackup) lendersConfig = { lenders: localBackup.lenders || {} };
    else lendersConfig = { lenders: {} };
  }

  mergeLendersWithMaster();
  renderLendersList();
  updateLendersConfigPreview();
  saveLoanConfigBackupToStorageNow();
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
  const payload = { ...lendersConfig, meta: buildNaviMeta() };

  const res = await adminFetch(`${API_BASE}/api/loan-config`, {
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
  saveLoanConfigBackupToStorageNow();

  return successText || "저장되었습니다.";
}

/* =========================================================
   ✅ (추가) 금융조건 수치 입력 UI 렌더 (min/max + avg 자동)
========================================================= */
function renderFinanceInputsBox(lender) {
  const box = document.createElement("div");
  box.className = "admin-subbox finance-inputs-wrap";

  const title = document.createElement("h3");
  title.className = "admin-subbox-title";
  title.textContent = "금융조건 수치 입력";

  const help = document.createElement("p");
  help.className = "admin-subbox-help";
  help.innerHTML = "네비 결과 화면에 노출될 <b>금리/플랫폼수수료/중도상환수수료(%)</b>를 입력하세요. <b>최소/최대</b> 입력 시 <b>평균은 자동 계산</b>됩니다.";

  box.appendChild(title);
  box.appendChild(help);

  const selected = Array.isArray(lender.products) ? lender.products.slice() : [];
  if (selected.length === 0) {
    const empty = document.createElement("div");
    empty.className = "admin-empty";
    empty.textContent = "먼저 ‘취급 상품군 설정’에서 상품군을 선택해주세요.";
    box.appendChild(empty);
    return box;
  }

  const orderMap = new Map(PRODUCT_GROUPS.map((p, idx) => [p.key, idx]));
  selected.sort((a, b) => (orderMap.get(a) ?? 999) - (orderMap.get(b) ?? 999));

  const wrap = document.createElement("div");
  wrap.className = "finance-products";

  const labelByKey = (k) => (PRODUCT_GROUPS.find((p) => p.key === k)?.label) || k;

  const toFinitePercentVal = (s) => {
    const t2 = sanitizePercentString(s);
    if (!t2) return null;
    const n = Number(t2);
    return Number.isFinite(n) ? n : null;
  };

  const computeAvgStr2 = (minStr, maxStr) => {
    const a = toFinitePercentVal(minStr);
    const b = toFinitePercentVal(maxStr);
    if (a == null || b == null) return "";
    const avg = (a + b) / 2;
    return normalizePercentBlur(String(avg));
  };

  const patchFinancialInputs = (lenderId, pgKey2, patchOne) => {
    const cur2 = ensureLender(lenderId);
    const nextAll = { ...(cur2.financialInputs || {}) };
    const nextOne = { ...(nextAll[pgKey2] || {}) };
    Object.assign(nextOne, patchOne);
    nextAll[pgKey2] = nextOne;
    updateLenderState(lenderId, { financialInputs: nextAll });
  };

  const makeMinMaxAvgMetric = (pgKey, lenderId, finObj, metricTitle, keys, enableMinMax) => {
    const col = document.createElement("div");
    col.className = "finance-metric";

    const h = document.createElement("div");
    h.className = "finance-metric-title";
    h.textContent = metricTitle;
    col.appendChild(h);

    // ✅ avg-only (기존 방식)도 유지할 수 있게 분기
    if (!enableMinMax) {
      const row = document.createElement("div");
      row.className = "finance-metric-row";

      const lab = document.createElement("span");
      lab.className = "lab";
      lab.textContent = "평균";

      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "decimal";
      input.placeholder = "숫자입력";
      input.value = (finObj && finObj[keys.avg] != null) ? String(finObj[keys.avg]) : "";

      input.addEventListener("input", () => {
        const sanitized = sanitizePercentString(input.value);
        if (input.value !== sanitized) input.value = sanitized;
        patchFinancialInputs(lenderId, pgKey, { [keys.avg]: input.value });
      });

      input.addEventListener("blur", () => {
        const normalized = normalizePercentBlur(input.value);
        input.value = normalized;
        patchFinancialInputs(lenderId, pgKey, { [keys.avg]: normalized });
      });

      const unit = document.createElement("span");
      unit.className = "unit";
      unit.textContent = "%";

      row.appendChild(lab);
      row.appendChild(input);
      row.appendChild(unit);

      col.appendChild(row);
      return col;
    }

    const minInit = (finObj && finObj[keys.min] != null) ? String(finObj[keys.min]) : "";
    const maxInit = (finObj && finObj[keys.max] != null) ? String(finObj[keys.max]) : "";

    const rowMin = document.createElement("div");
    rowMin.className = "finance-metric-row finance-metric-row--minmax";

    const labMin = document.createElement("span");
    labMin.className = "lab";
    labMin.textContent = "최소";

    const inputMin = document.createElement("input");
    inputMin.type = "text";
    inputMin.inputMode = "decimal";
    inputMin.placeholder = "숫자입력";
    inputMin.value = minInit;

    const unitMin = document.createElement("span");
    unitMin.className = "unit";
    unitMin.textContent = "%";

    rowMin.appendChild(labMin);
    rowMin.appendChild(inputMin);
    rowMin.appendChild(unitMin);

    const rowMax = document.createElement("div");
    rowMax.className = "finance-metric-row finance-metric-row--minmax";

    const labMax = document.createElement("span");
    labMax.className = "lab";
    labMax.textContent = "최대";

    const inputMax = document.createElement("input");
    inputMax.type = "text";
    inputMax.inputMode = "decimal";
    inputMax.placeholder = "숫자입력";
    inputMax.value = maxInit;

    const unitMax = document.createElement("span");
    unitMax.className = "unit";
    unitMax.textContent = "%";

    rowMax.appendChild(labMax);
    rowMax.appendChild(inputMax);
    rowMax.appendChild(unitMax);

    const rowAvg = document.createElement("div");
    rowAvg.className = "finance-metric-row finance-metric-row--minmax";

    const labAvg = document.createElement("span");
    labAvg.className = "lab";
    labAvg.textContent = "평균";

    const inputAvg = document.createElement("input");
    inputAvg.type = "text";
    inputAvg.inputMode = "decimal";
    inputAvg.placeholder = "-";
    inputAvg.value = computeAvgStr2(inputMin.value, inputMax.value);
    inputAvg.readOnly = true;
    inputAvg.disabled = true;

    const unitAvg = document.createElement("span");
    unitAvg.className = "unit";
    unitAvg.textContent = "%";

    rowAvg.appendChild(labAvg);
    rowAvg.appendChild(inputAvg);
    rowAvg.appendChild(unitAvg);

    const syncAndSave = (mode /* "input" | "blur" */) => {
      if (mode === "input") {
        const sMin = sanitizePercentString(inputMin.value);
        if (inputMin.value !== sMin) inputMin.value = sMin;

        const sMax = sanitizePercentString(inputMax.value);
        if (inputMax.value !== sMax) inputMax.value = sMax;
      } else {
        inputMin.value = normalizePercentBlur(inputMin.value);
        inputMax.value = normalizePercentBlur(inputMax.value);
      }

      const avgStr = computeAvgStr2(inputMin.value, inputMax.value);
      inputAvg.value = avgStr;

      // ✅ 저장: min/max + avg(자동)까지 같이 저장
      patchFinancialInputs(lenderId, pgKey, {
        [keys.min]: inputMin.value,
        [keys.max]: inputMax.value,
        [keys.avg]: avgStr
      });
    };

    inputMin.addEventListener("input", () => syncAndSave("input"));
    inputMax.addEventListener("input", () => syncAndSave("input"));
    inputMin.addEventListener("blur", () => syncAndSave("blur"));
    inputMax.addEventListener("blur", () => syncAndSave("blur"));

    col.appendChild(rowMin);
    col.appendChild(rowMax);
    col.appendChild(rowAvg);

    return col;
  };

  selected.forEach((pgKey) => {
    const cur = ensureLender(lender.id);
    const fin = (cur.financialInputs && cur.financialInputs[pgKey]) ? cur.financialInputs[pgKey] : {};

    const t = document.createElement("div");
    t.className = "finance-product-title";
    t.textContent = `• ${labelByKey(pgKey)}`;
    wrap.appendChild(t);

    const metrics = document.createElement("div");
    metrics.className = "finance-metrics";

    const grid = document.createElement("div");
    grid.className = "finance-metrics-grid";

    // 금리: 부동산담보대출만 min/max + avg 자동, 그 외는 avg-only 유지
    const interestMinMax = (pgKey === "부동산담보대출");
    grid.appendChild(makeMinMaxAvgMetric(pgKey, lender.id, fin, "금리", {
      min: "interestMin", max: "interestMax", avg: "interestAvg"
    }, interestMinMax));

    // ✅ 요청사항(1): 플랫폼수수료 / 중도상환수수료도 금리처럼 min/max + avg 자동
    grid.appendChild(makeMinMaxAvgMetric(pgKey, lender.id, fin, "플랫폼수수료", {
      min: "platformFeeMin", max: "platformFeeMax", avg: "platformFeeAvg"
    }, true));

    grid.appendChild(makeMinMaxAvgMetric(pgKey, lender.id, fin, "중도상환수수료", {
      min: "prepayFeeMin", max: "prepayFeeMax", avg: "prepayFeeAvg"
    }, true));

    metrics.appendChild(grid);
    wrap.appendChild(metrics);
  });

  box.appendChild(wrap);
  return box;
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
/* =========================================================
   ✅ 로고 업로드(저장용 DataURL) — 2026-02-19
   - 서버에 별도 파일 업로드가 없어서, 클라이언트에서 256px로 리사이즈 후 dataURL로 저장합니다.
   - 파일 용량이 너무 크면 저장 데이터가 커질 수 있으니 원본도 가볍게 준비하세요.
========================================================= */

async function resizeImageFileToDataUrl(file, maxSize = 256) {
  if (!file) return "";
  if (!/^image\//i.test(file.type || "")) throw new Error("이미지 파일만 업로드할 수 있습니다.");

  // 너무 큰 파일은 경고 (2MB)
  const MAX_BYTES = 2 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(`이미지 용량이 너무 큽니다. (${mb}MB)\n2MB 이하로 줄여서 업로드해주세요.`);
  }

  const url = URL.createObjectURL(file);

  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      i.src = url;
    });

    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (!w || !h) throw new Error("이미지 크기를 확인할 수 없습니다.");

    const scale = Math.min(1, maxSize / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스 초기화 실패");
    ctx.clearRect(0, 0, tw, th);
    ctx.drawImage(img, 0, 0, tw, th);

    // webp 우선, 미지원이면 png
    let dataUrl = "";
    try {
      dataUrl = canvas.toDataURL("image/webp", 0.86);
      if (!/^data:image\/webp/i.test(dataUrl)) throw new Error("webp 미지원");
    } catch {
      dataUrl = canvas.toDataURL("image/png");
    }

    return dataUrl || "";
  } finally {
    URL.revokeObjectURL(url);
  }
}

function renderBrandBox(lender) {
  const box = document.createElement("div");
  box.className = "admin-subbox";
  box.addEventListener("click", (e) => e.stopPropagation());

  const title = document.createElement("h3");
  title.className = "admin-subbox-title";
  title.textContent = "브랜드(로고/등록번호)";

  const help = document.createElement("p");
  help.className = "admin-subbox-help";
  help.innerHTML = [
    "로고는 네비게이션 결과 카드에 표시됩니다. 업로드 시 256px로 자동 리사이즈되어 저장됩니다.",
    "권장: 정사각형 PNG/WebP (예: 512×512) / 로고가 원 안에서 너무 작아지지 않도록 여백을 최소화하세요."
  ].join("<br />");

  const row = document.createElement("div");
  row.className = "admin-logo-row";

  const preview = document.createElement("div");
  preview.className = "admin-logo-preview";

  const img = document.createElement("img");
  img.alt = "";
  img.decoding = "async";
  img.loading = "lazy";
  img.src = (lender.logoDataUrl || "").trim();
  img.style.display = img.src ? "block" : "none";

  const initials = document.createElement("div");
  initials.className = "admin-logo-initials";
  initials.textContent = String(lender.name || "").trim().slice(0, 2) || "?";
  initials.style.display = img.src ? "none" : "flex";

  preview.appendChild(initials);
  preview.appendChild(img);

  const actions = document.createElement("div");
  actions.className = "admin-logo-actions";

  const uploadBtn = document.createElement("button");
  uploadBtn.type = "button";
  uploadBtn.className = "admin-logo-btn";
  uploadBtn.textContent = "로고 업로드";

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "admin-logo-btn admin-logo-btn--ghost";
  delBtn.textContent = "삭제";
  delBtn.disabled = !(lender.logoDataUrl || "").trim();

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";

  uploadBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    try {
      uploadBtn.disabled = true;
      uploadBtn.textContent = "처리중...";

      const dataUrl = await resizeImageFileToDataUrl(f, 256);
      updateLenderState(lender.id, { logoDataUrl: dataUrl });
      lenderUiState.openIds.add(lender.id);
      renderLendersList();
    } catch (err) {
      console.error("logo upload error:", err);
      alert(String(err && err.message ? err.message : err));
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "로고 업로드";
      fileInput.value = "";
    }
  });

  delBtn.addEventListener("click", () => {
    updateLenderState(lender.id, { logoDataUrl: "" });
    lenderUiState.openIds.add(lender.id);
    renderLendersList();
  });

  actions.appendChild(uploadBtn);
  actions.appendChild(delBtn);
  actions.appendChild(fileInput);

  row.appendChild(preview);
  row.appendChild(actions);

  // 등록번호(옵션)
  const licenseWrap = document.createElement("div");
  licenseWrap.className = "admin-field";
  const licenseLabel = document.createElement("label");
  licenseLabel.textContent = "온투업 등록번호(표시용)";
  const licenseInput = document.createElement("input");
  licenseInput.type = "text";
  licenseInput.className = "admin-input";
  licenseInput.placeholder = "예) 제2021-37호";
  licenseInput.value = lender.licenseNo || "";
  licenseInput.addEventListener("input", () => updateLenderState(lender.id, { licenseNo: licenseInput.value }));
  licenseInput.addEventListener("blur", () => updateLenderState(lender.id, { licenseNo: licenseInput.value.trim() }));
  licenseWrap.appendChild(licenseLabel);
  licenseWrap.appendChild(licenseInput);

  box.appendChild(title);
  box.appendChild(help);
  box.appendChild(row);
  box.appendChild(licenseWrap);

  return box;
}

function renderLendersList() {
  const container = document.getElementById("lendersList");
  if (!container) return;
  container.innerHTML = "";

  const cfg = lendersConfig.lenders || {};

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

    const panel = document.createElement("div");
    panel.className = "lender-panel";
    panel.classList.toggle("hide", !isOpen);

    const inner = document.createElement("div");
    inner.className = "lender-panel__inner";

    // ✅ 브랜드(로고/등록번호)
    inner.appendChild(renderBrandBox(lender));

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

    const hasRealEstate = Array.isArray(lender.products) && lender.products.includes("부동산담보대출");

    if (hasRealEstate) {
      // ✅ 금융조건
      inner.appendChild(renderFinanceInputsBox(lender));

      // ✅ (요청 3) 위치 교체: 매트릭스 먼저, 추가조건은 아래로
      const matrixBox = document.createElement("div");
      matrixBox.className = "admin-subbox";

      const mTitle = document.createElement("h3");
      mTitle.className = "admin-subbox-title";
      mTitle.textContent = "지역/유형별 취급여부 + LTV(최대) + 취급 대출 종류";

      const helpRow = document.createElement("div");
      helpRow.className = "admin-subbox-headrow";

      const mHelp = document.createElement("p");
      mHelp.className = "admin-subbox-help";
      mHelp.textContent = "지역 탭을 선택한 뒤, 부동산 유형별로 취급여부(칩) / LTV 최대(%) / (서울·경기) LTV Up / 취급 대출 종류를 설정하세요.";

      // ✅ (요청 2) 최저/최대 대출금액
      const loanLimits = document.createElement("div");
      loanLimits.className = "admin-minloan";
      loanLimits.addEventListener("click", (e) => e.stopPropagation());

      const makeLimit = (labelText, valueInit, onInput) => {
        const wrap = document.createElement("div");
        wrap.style.display = "flex";
        wrap.style.gap = "8px";
        wrap.style.alignItems = "center";

        const lab = document.createElement("span");
        lab.className = "admin-minloan__label";
        lab.textContent = labelText;

        const inp = document.createElement("input");
        inp.type = "number";
        inp.className = "admin-mini-input admin-minloan__input";
        inp.min = "0";
        inp.step = "1";
        inp.placeholder = labelText.includes("최저") ? "예) 500" : "예) 10000";
        inp.value = (valueInit ?? "");

        inp.addEventListener("input", () => onInput(inp.value));

        const unit = document.createElement("span");
        unit.className = "admin-minloan__unit";
        unit.textContent = "만원";

        wrap.appendChild(lab);
        wrap.appendChild(inp);
        wrap.appendChild(unit);
        return wrap;
      };

      const minLimit = makeLimit("최저대출금액", lender.realEstateMinLoanAmount, (v) => {
        updateLenderState(lender.id, { realEstateMinLoanAmount: v });
      });
      const maxLimit = makeLimit("최대대출금액", lender.realEstateMaxLoanAmount, (v) => {
        updateLenderState(lender.id, { realEstateMaxLoanAmount: v });
      });

      loanLimits.style.display = "flex";
      loanLimits.style.gap = "14px";
      loanLimits.style.flexWrap = "wrap";
      loanLimits.appendChild(minLimit);
      loanLimits.appendChild(maxLimit);

      helpRow.appendChild(mHelp);
      helpRow.appendChild(loanLimits);

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
      const __hasLtvUp = !!SUBREGION_LTV_UP[activeRegion];

      thead.innerHTML = `
        <tr>
          <th style="width:160px;">부동산 유형</th>
          <th class="cell-center" style="width:110px;">취급</th>
          <th style="width:420px;">
            <div class="ltv-th">
              <span class="ltv-th__title">LTV 최대(%)</span>
              ${__hasLtvUp ? '<span class="ltv-th__up">LTV Up</span>' : ''}
            </div>
          </th>
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

        // ✅ LTV + LTV Up
        const tdLtv = document.createElement("td");
        const ltvWrap = document.createElement("div");
        ltvWrap.className = "admin-ltv-wrap";

        const base = document.createElement("div");
        base.className = "admin-ltv-base";

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

        base.appendChild(max);
        base.appendChild(pct);

        ltvWrap.appendChild(base);

        // ✅ (요청 4) 서울/경기만 세부지역 LTV Up 표시
        const subList = SUBREGION_LTV_UP[activeRegion] || null;
        if (subList) {
          const upWrap = document.createElement("div");
          upWrap.className = "admin-ltvup";
          upWrap.classList.toggle("is-disabled", !cell.enabled);

          ltvWrap.classList.add("has-ltvup");

          const chipRow = document.createElement("div");
          chipRow.className = "admin-ltvup__chiprow";

          const curUp = (cell.ltvUp && typeof cell.ltvUp === "object") ? cell.ltvUp : {};
          subList.forEach((sr) => {
            const chip = document.createElement("div");
            chip.className = "admin-ltvup__chip";

            const b = document.createElement("b");
            b.textContent = sr.label;

            const inp = document.createElement("input");
            inp.type = "number";
            inp.min = "0";
            inp.step = "0.1";
            inp.placeholder = "+x";
            inp.value = (curUp[sr.key] ?? "");
            inp.disabled = !cell.enabled;

            inp.addEventListener("input", () => {
              const cur = ensureLender(lender.id);
              const target = cur.regions[activeRegion][pt.key];
              if (!target.ltvUp || typeof target.ltvUp !== "object") target.ltvUp = {};
              target.ltvUp[sr.key] = inp.value;
              schedulePreviewUpdate();
            });

            const pct2 = document.createElement("span");
            pct2.textContent = "%";

            chip.appendChild(b);
            chip.appendChild(inp);
            chip.appendChild(pct2);
            chipRow.appendChild(chip);
          });

          upWrap.appendChild(chipRow);
          ltvWrap.appendChild(upWrap);
        }

        tdLtv.appendChild(ltvWrap);

        // 대출종류
        const tdLoans = document.createElement("td");
        const loanRow = document.createElement("div");
        loanRow.className = "admin-chip-row admin-chip-row--tight";

        let loanTypes = (pt.loanSet === "aptv") ? LOAN_TYPES_APTVILLA : LOAN_TYPES_BASE;

        // 토지(land)에서는 임대보증금반환대출 제외
        if (pt.key === "land") {
          loanTypes = loanTypes.filter(x => x.key !== "임대보증금반환대출");
        }

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

      // ✅ (요청 3) 추가조건을 매트릭스 아래로 이동
      inner.appendChild(renderExtraConditionsBox(lender));
    } else {
      // (원본 동작 유지) 부동산담보대출이 아니면 금융조건만
      inner.appendChild(renderFinanceInputsBox(lender));
    }

    // 상담 채널
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

    // 저장 버튼
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
document.addEventListener("DOMContentLoaded", async () => {
  ensureFinanceInputsStylesInjected();
  setupBetaMenu();
  await setupAdminAuth();
});
