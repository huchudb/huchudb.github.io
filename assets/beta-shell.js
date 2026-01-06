// /assets/beta-shell.js
// 공통 상단 헤더(MENU) 동작 전담 스크립트
// 목표: 페이지별 JS의 메뉴 토글 구현(중복/충돌)과 무관하게 항상 동작하도록 보강
// - 버튼 클릭 핸들러를 "capture phase"로 등록해 다른 bubble 핸들러보다 먼저 실행
// - stopImmediatePropagation으로 중복 토글(열렸다 닫힘) 방지
// - 드롭다운 패널을 버튼 기준으로 fixed 배치(부모 position/레이아웃 영향 제거)
// - 요소가 없으면 조용히 종료

const __HUCHU_BETA_SHELL_MENU_INIT__ = "__HUCHU_BETA_SHELL_MENU_INIT__v2";

function setupBetaMenu() {
  const btn = document.getElementById("betaMenuToggle");
  const panel = document.getElementById("betaMenuPanel");
  if (!btn || !panel) return;

  // 중복 바인딩 방지
  if (btn.dataset.huchuMenuBound === "1") return;
  btn.dataset.huchuMenuBound = "1";

  const isOpen = () => !panel.classList.contains("hide");

  const placePanel = () => {
    if (!isOpen()) return;
    const r = btn.getBoundingClientRect();

    // 버튼 우측 정렬: viewport 오른쪽에서부터 btn.right까지의 거리
    const right = Math.max(8, Math.round(window.innerWidth - r.right));
    const top = Math.round(r.bottom + 10);

    panel.style.position = "fixed";
    panel.style.top = `${top}px`;
    panel.style.right = `${right}px`;
    panel.style.left = "auto";
    panel.style.bottom = "auto";
    panel.style.zIndex = "9999";

    // 혹시 max-height를 제한해야 할 때를 대비해(모바일)
    const maxH = Math.max(180, Math.round(window.innerHeight - top - 16));
    panel.style.maxHeight = `${maxH}px`;
    panel.style.overflowY = "auto";
  };

  const open = () => {
    panel.classList.remove("hide");
    btn.setAttribute("aria-expanded", "true");
    placePanel();
  };

  const close = () => {
    panel.classList.add("hide");
    btn.setAttribute("aria-expanded", "false");
  };

  const toggle = () => {
    if (isOpen()) close();
    else open();
  };

  // ✅ 핵심: capture phase로 먼저 가로채서 다른 토글 핸들러(버블)와 충돌 방지
  btn.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      toggle();
    },
    true
  );

  // 패널 내부 클릭은 닫힘 방지
  panel.addEventListener(
    "click",
    (e) => {
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    },
    true
  );

  // 바깥 클릭 시 닫기 (capture로 먼저 받아 안정화)
  document.addEventListener(
    "click",
    (e) => {
      if (!isOpen()) return;
      const t = e.target;
      if (t === btn || panel.contains(t)) return;
      close();
    },
    true
  );

  // ESC 닫기
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  // 스크롤/리사이즈 시 위치 재계산
  window.addEventListener("resize", placePanel, { passive: true });
  window.addEventListener("scroll", placePanel, { passive: true });
}

if (!window[__HUCHU_BETA_SHELL_MENU_INIT__]) {
  window[__HUCHU_BETA_SHELL_MENU_INIT__] = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupBetaMenu);
  } else {
    setupBetaMenu();
  }
}
