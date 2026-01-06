// /assets/beta-shell.js
// HUCHU beta common shell: MENU dropdown + footer notice (no per-page duplication)
//
// Goals
// - MENU works consistently across pages even if page scripts add their own handlers
// - MENU panel is positioned relative to the button (fixed), immune to layout differences
// - Footer notice can be managed in ONE place and auto-applies to all pages that have .beta-footer
//
// NOTE: Keep this file as the single source of truth for beta shell behavior.

(() => {
  const GLOBAL_FLAG = "__HUCHU_BETA_SHELL_INIT__v2";
  if (window[GLOBAL_FLAG]) return;
  window[GLOBAL_FLAG] = true;

  // ----------------------------
  // Config (edit these only)
  // ----------------------------
  const FOOTER_NOTICE_TITLE = "고지";
  const FOOTER_NOTICE_ITEMS = [
    "본 페이지의 정보는 참고용이며, 정확한 조건은 해당 온투업체 안내 및 심사 결과에 따라 달라질 수 있습니다.",
    "금리·한도·플랫폼 수수료·중도상환 조건 등은 수시로 변동될 수 있습니다.",
    "최종 조건은 해당 온투업체/계약서 기준으로 확인해 주세요."
  ];

  // ----------------------------
  // Helpers
  // ----------------------------
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function ensureStyleTag() {
    if (document.getElementById("beta-shell-style")) return;

    const css = `
/* beta-shell injected styles */
.beta-footer__bottom{
  display:flex !important;
  flex-direction:row !important;
  align-items:flex-start !important;
  gap:22px !important;
}
.beta-footer__info{ flex:1 1 auto; min-width:340px; }
.beta-footer__notice{
  margin-left:auto;
  max-width:360px;
  padding-left:16px;
  border-left:1px solid rgba(255,255,255,0.10);
  color:#cbd5e1;
}
.beta-footer__notice-title{
  font-weight:700;
  color:#e5e7eb;
  font-size:12px;
  margin-bottom:6px;
}
.beta-footer__notice-list{
  margin:0;
  padding-left:16px;
  font-size:11px;
  line-height:1.6;
}
.beta-footer__notice-list li{ margin:0 0 6px 0; }
.beta-footer__notice-list li:last-child{ margin-bottom:0; }

@media (max-width: 760px){
  .beta-footer__bottom{
    flex-direction:column !important;
    gap:10px !important;
  }
  .beta-footer__info{ min-width:0; }
  .beta-footer__notice{
    margin-left:0;
    max-width:none;
    padding-left:0;
    border-left:0;
    padding-top:10px;
    border-top:1px solid rgba(255,255,255,0.10);
  }
}
`;

    const style = document.createElement("style");
    style.id = "beta-shell-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ----------------------------
  // MENU
  // ----------------------------
  function setupMenu() {
    const btn = document.getElementById("betaMenuToggle");
    const panel = document.getElementById("betaMenuPanel");
    if (!btn || !panel) return;

    // Mark as bound to avoid duplicate listeners (including other page scripts)
    if (btn.dataset.huchuShellMenu === "1") return;
    btn.dataset.huchuShellMenu = "1";

    // Ensure initial state
    btn.setAttribute("aria-expanded", panel.classList.contains("hide") ? "false" : "true");

    const open = () => {
      positionPanel();
      panel.classList.remove("hide");
      btn.setAttribute("aria-expanded", "true");
    };
    const close = () => {
      panel.classList.add("hide");
      btn.setAttribute("aria-expanded", "false");
      // cleanup inline positioning to avoid odd states across page nav caches
      panel.style.left = "";
      panel.style.top = "";
      panel.style.right = "";
      panel.style.position = "";
      panel.style.zIndex = "";
    };
    const toggle = () => {
      const hidden = panel.classList.contains("hide");
      if (hidden) open();
      else close();
    };

    function positionPanel() {
      // Make panel immune to layout (always relative to viewport based on button rect)
      const r = btn.getBoundingClientRect();
      const margin = 8;
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);

      panel.style.position = "fixed";
      panel.style.zIndex = "9999";

      // Temporarily show off-screen to measure width/height (if hidden)
      const wasHidden = panel.classList.contains("hide");
      if (wasHidden) {
        panel.classList.remove("hide");
        panel.style.visibility = "hidden";
      }

      const pw = panel.offsetWidth || 260;
      const ph = panel.offsetHeight || 220;

      // Desired: right-aligned with button, just below
      let left = r.right - pw;
      let top = r.bottom + 10;

      // Clamp into viewport
      left = clamp(left, margin, vw - pw - margin);
      const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      top = clamp(top, margin, vh - ph - margin);

      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;

      if (wasHidden) {
        panel.classList.add("hide");
        panel.style.visibility = "";
      }
    }

    // IMPORTANT:
    // - Capture-phase listener to prevent other scripts from toggling twice.
    // - stopImmediatePropagation to block any later listeners on the same element.
    btn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        toggle();
      },
      true // capture
    );

    // Keep panel clicks inside from bubbling (so outside-click close doesn't trigger)
    panel.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      },
      true
    );

    // Outside click closes
    document.addEventListener(
      "click",
      (e) => {
        if (panel.classList.contains("hide")) return;
        const t = e.target;
        if (t === btn || panel.contains(t)) return;
        close();
      },
      true
    );

    // ESC closes
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") close();
      },
      true
    );

    // Re-position on resize/scroll if open
    window.addEventListener(
      "resize",
      () => {
        if (!panel.classList.contains("hide")) positionPanel();
      },
      { passive: true }
    );
    window.addEventListener(
      "scroll",
      () => {
        if (!panel.classList.contains("hide")) positionPanel();
      },
      { passive: true }
    );
  }

  // ----------------------------
  // Footer notice (right side)
  // ----------------------------
  function setupFooterNotice() {
    const footer = document.querySelector(".beta-footer");
    if (!footer) return;

    const bottom = footer.querySelector(".beta-footer__bottom");
    if (!bottom) return;

    if (bottom.querySelector(".beta-footer__notice")) return;

    ensureStyleTag();

    const notice = document.createElement("div");
    notice.className = "beta-footer__notice";

    const title = document.createElement("div");
    title.className = "beta-footer__notice-title";
    title.textContent = FOOTER_NOTICE_TITLE;

    const ul = document.createElement("ul");
    ul.className = "beta-footer__notice-list";

    (FOOTER_NOTICE_ITEMS || []).forEach((txt) => {
      const t = String(txt || "").trim();
      if (!t) return;
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });

    notice.appendChild(title);
    notice.appendChild(ul);
    bottom.appendChild(notice);
  }

  function init() {
    setupMenu();
    setupFooterNotice();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
