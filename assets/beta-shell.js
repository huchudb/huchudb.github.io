// /assets/beta-shell.js
// HUCHU beta common shell: MENU dropdown + Footer notice (single source of truth)
//
// - MENU works consistently across pages (blocks duplicate handlers in page scripts)
// - MENU panel is positioned relative to the button (fixed), immune to layout differences
// - Footer notice is injected into .beta-footer (right side on desktop, ordered on mobile)
// - Footer left layout normalized: logo(brand) + business info stacked together

(() => {
  const GLOBAL_FLAG = "__HUCHU_BETA_SHELL_INIT__v4";
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
/* beta-shell injected styles (footer notice + ordering + spacing) */

/* Make "top edge -> links" spacing == "links -> bottom row" spacing */
.beta-footer{
  padding-top:16px !important;
}
.beta-footer__top{
  margin:0 0 16px 0 !important;
  padding:0 !important;
}

/* Bottom row: left(brand+info) + right(notice) */
.beta-footer__bottom{
  display:flex !important;
  flex-direction:row !important;
  align-items:flex-start !important;
  justify-content:space-between !important;
  gap:18px !important;
  flex-wrap:wrap !important; /* if width is tight, wrap rather than squish */
}

/* Left column groups logo + business info */
.beta-footer__left{
  display:flex !important;
  flex-direction:column !important;
  align-items:flex-start !important;
  gap:8px !important;
  flex:1 1 420px !important;
  min-width:320px !important;
}
.beta-footer__brand{ flex:0 0 auto !important; }
.beta-footer__info{
  flex:0 0 auto !important;
  min-width:0 !important;
}

/* Notice on the right, wider to reduce wrapping */
.beta-footer__notice{
  margin-left:auto !important;
  width:min(620px, 48vw) !important;
  max-width:620px !important;
  flex:0 1 min(620px, 48vw) !important;
  padding-left:16px !important;
  border-left:1px solid rgba(255,255,255,0.10) !important;
  color:#cbd5e1 !important;
  word-break:keep-all !important;
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
   (brand+info are inside .beta-footer__left, so within it brand appears above info)
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

  .beta-footer__left{
    order:2 !important;
    min-width:0 !important;
    width:100% !important;
  }
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
  // Footer: normalize layout (brand + info group), inject notice
  // ----------------------------
  function normalizeFooterLeftColumn(footer) {
    const bottom = footer.querySelector(".beta-footer__bottom");
    if (!bottom) return;

    // If already normalized, skip
    if (bottom.querySelector(".beta-footer__left")) return;

    const brand = bottom.querySelector(".beta-footer__brand");
    const info = bottom.querySelector(".beta-footer__info");
    if (!brand || !info) return;

    const left = document.createElement("div");
    left.className = "beta-footer__left";

    // Insert left before the first of brand/info
    bottom.insertBefore(left, brand);

    left.appendChild(brand);
    left.appendChild(info);
  }

  function injectFooterNotice(footer) {
    const bottom = footer.querySelector(".beta-footer__bottom");
    if (!bottom) return;

    if (bottom.querySelector(".beta-footer__notice")) return;

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

  function setupFooter() {
    const footer = document.querySelector(".beta-footer");
    if (!footer) return;

    ensureStyleTag();
    normalizeFooterLeftColumn(footer);
    injectFooterNotice(footer);
  }

  function init() {
    setupMenu();
    setupFooter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
