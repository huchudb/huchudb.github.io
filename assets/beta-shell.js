// /assets/beta-shell.js
// 베타 페이지 공통 UI (MENU 드롭다운 등)
// - 각 페이지에서 중복 구현하지 않도록 공통화
// - 요소가 없으면 조용히 종료

const __HUCHU_BETA_MENU_INIT__ = "__HUCHU_BETA_MENU_INIT__v1";

function setupBetaMenu() {
  const btn = document.getElementById("betaMenuToggle");
  const panel = document.getElementById("betaMenuPanel");
  if (!btn || !panel) return;

  // 중복 바인딩 방지
  if (btn.dataset.huchuMenuBound === "1") return;
  btn.dataset.huchuMenuBound = "1";

  const isOpen = () => !panel.classList.contains("hide");

  const close = () => {
    panel.classList.add("hide");
    btn.setAttribute("aria-expanded", "false");
  };

  const open = () => {
    panel.classList.remove("hide");
    btn.setAttribute("aria-expanded", "true");
  };

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOpen()) close();
    else open();
  });

  // 메뉴 안 링크 클릭 시 닫기
  panel.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) close();
  });

  // 바깥 클릭 / ESC 닫기
  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && !btn.contains(e.target)) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

if (!window[__HUCHU_BETA_MENU_INIT__]) {
  window[__HUCHU_BETA_MENU_INIT__] = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupBetaMenu);
  } else {
    setupBetaMenu();
  }
}
