// /assets/beta-shell.js
// HUCHU beta common shell: MENU dropdown + Footer notice (single source of truth)
//
// - MENU works consistently across pages (blocks duplicate handlers in page scripts)
// - MENU panel is positioned relative to the button (fixed), immune to layout differences
// - Footer notice is injected into .beta-footer (right side on desktop, ordered on mobile)

(() => {
  const GLOBAL_FLAG = "__HUCHU_BETA_SHELL_INIT__v3";
  if (window[GLOBAL_FLAG]) return;
  window[GLOBAL_FLAG] = true;

  // ----------------------------
  // Config (edit only these)
  // ----------------------------
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
/* beta-shell injected styles (footer notice + ordering) */

/* Desktop: bottom row = brand + info + (right) notice */
.beta-footer__bottom{
  display:flex !important;
  flex-direction:row !important;
  align-items:flex-start !important;
  justify-content:space-between !important;
  gap:18px !important;
  flex-wrap:wrap !important; /* if width is tight, wrap instead of squishing to ugly line-breaks */
}

/* Keep brand on the left */
.beta-footer__brand{
  flex:0 0 auto !important;
}

/* Let business info take remaining space */
.beta-footer__info{
  flex:1 1 360px !important;
  min-width:260px !important;
}

/* Notice on the right, wider to avoid 2-line wraps */
.beta-footer__notice{
  margin-left:auto !important;
  width:min(560px, 46vw) !important;
  max-width:560px !important;
  flex:0 1 min(560px, 46vw) !important;
  padding-left:16px !important;
  border-left:1px solid rgba(255,255,255,0.10) !important;
  color:#cbd5e1 !important;
  word-break:keep-all !important; /* Korean readability */
}

.beta-footer__notice-list{
  margin:0 !important;
  padding-left:16px !important;
  font-size:11px !important;
  line-height:1.65 !important;
}

.beta-footer__notice-list li{ margin:0 0 6px 0 !important; }
.beta-footer__notice-list li:last-child{ margin-bottom:0 !important; }

/* Mobile order:
   1) footer top links (already above)
   2) notice
   3) brand (logo)
   4) business info
*/
@media (max-width: 760px){
  .beta-footer__bottom{
    flex-direction:column !important;
    gap:10px !important;
  }

  .beta-footer__notice{
    order:1 !important;
    margin-left:0 !important;
    width:auto !important;
    max-width:none !important;
    flex:0 0 auto !important;
    padding-left:0 !important;
    border-left:0 !important;
    padding-top:10px !important;
    border-top:1px solid rgba(255,255,255,0.10) !important;
  }

  .beta-footer__brand{ order:2 !important; }
  .beta-footer__info{ order:3 !important; min-width:0 !important; }
}
`;

    const style = document.createElement("style");
    style.id = "beta-shell-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ----------------------------
  // MENU (fixed-position dropdown, blocks duplicate handlers)
  // ----------------------------
  function setupMenu() {
    const btn = document.getElementById("betaMenuToggle");
    const panel = document.getElementById("betaMenuPanel");
    if (!btn || !panel) return;

    // Avoid rebinding
    if (btn.dataset.huchuShellMenu === "1") return;
    btn.dataset.huchuShellMenu = "1";

    btn.setAttribute("aria-expanded", panel.classList.contains("hide") ? "false" : "true");

    const open = () => {
      positionPanel();
      panel.classList.remove("hide");
      btn.setAttribute("aria-expanded", "true");
    };
    const close = () => {
      panel.classList.add("hide");
      btn.setAttribute("aria-expanded", "false");
      panel.style.left = "";
      panel.style.top = "";
      panel.style.right = "";
      panel.style.position = "";
      panel.style.zIndex = "";
    };
    const toggle = () => (panel.classList.contains("hide") ? open() : close());

    function positionPanel() {
      const r = btn.getBoundingClientRect();
      const margin = 8;
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

      panel.style.position = "fixed";
      panel.style.zIndex = "9999";

      const wasHidden = panel.classList.contains("hide");
      if (wasHidden) {
        panel.classList.remove("hide");
        panel.style.visibility = "hidden";
      }

      const pw = panel.offsetWidth || 260;
      const ph = panel.offsetHeight || 220;

      let left = r.right - pw;
      let top = r.bottom + 10;

      left = clamp(left, margin, vw - pw - margin);
      top = clamp(top, margin, vh - ph - margin);

      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;

      if (wasHidden) {
        panel.classList.add("hide");
        panel.style.visibility = "";
      }
    }

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

    panel.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      },
      true
    );

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

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") close();
      },
      true
    );

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

    const ul = document.createElement("ul");
    ul.className = "beta-footer__notice-list";

    (FOOTER_NOTICE_ITEMS || []).forEach((txt) => {
      const t = String(txt || "").trim();
      if (!t) return;
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });

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
