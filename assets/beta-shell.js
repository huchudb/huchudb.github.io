// /assets/beta-shell.js
// HUCHU beta common shell: MENU dropdown + Footer notice
// v7 - Syntax-safe (no template literals / no multi-line array commas), DOM-ready init, stable positioning

(function(){
  'use strict';
  var GLOBAL_FLAG = '__HUCHU_BETA_SHELL_INIT__v8';
  if (window[GLOBAL_FLAG]) return;
  window[GLOBAL_FLAG] = true;

  // ----------------------------
  // Config
  // ----------------------------
  var FOOTER_NOTICE_TEXT =
    '본 페이지의 정보는 참고용이며, 정확한 조건은 해당 온투업체 안내 및 심사 결과에 따라 달라질 수 있습니다.\n' +
    '금리·한도·플랫폼 수수료·중도상환 조건 등은 수시로 변동될 수 있습니다.\n' +
    '최종 조건은 해당 온투업체/계약서 기준으로 확인해 주세요.';

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function ensureStyleTag(){
    if (document.getElementById('beta-shell-style')) return;
    var css = [
      '/* beta-shell injected styles */',
      '',
      '/* MENU: tighter card + more vertical breathing room */',
      '.beta-menu-panel{',
      '  width:220px !important;',
      '  max-width:240px !important;',
      '  min-width:180px !important;',
      '  padding:12px 10px !important;',
      '  border-radius:16px !important;',
      '  box-shadow:0 16px 40px rgba(0,0,0,.18) !important;',
      '  z-index:9999 !important;',
      '}',
      '.beta-menu-link{ padding:10px 10px !important; }',
      '',
      '/* FOOTER: restore horizontal padding so top links never stick to the far-left */',
      '.beta-footer__top{',
      '  max-width:1200px !important;',
      '  margin:0 auto 16px !important;',
      '  padding:0 24px !important;',
      '  box-sizing:border-box !important;',
      '}',
      '',
      '/* Bottom row: left(brand+info stacked) + right(notice) */',
      '.beta-footer__bottom{',
      '  max-width:1200px !important;',
      '  margin:0 auto !important;',
      '  padding:0 24px 16px !important;',
      '  box-sizing:border-box !important;',
      '  display:grid !important;',
      '  grid-template-columns: 1fr 1fr !important;',
      '  column-gap:28px !important;',
      '  row-gap:8px !important;',
      '  align-items:start !important;',
      '}',
      '.beta-footer__left{',
      '  grid-column:1 !important;',
      '  display:flex !important;',
      '  flex-direction:column !important;',
      '  gap:8px !important;',
      '  min-width:320px !important;',
      '}',
      '.beta-footer__notice{',
      '  grid-column:2 !important;',
      '  min-width:320px !important;',
      '}',
      '.beta-footer__notice ul{',
      '  margin:0 !important;',
      '  padding:0 !important;',
      '  list-style:none !important;',
      '}',
      '.beta-footer__notice li{',
      '  position:relative !important;',
      '  padding-left:14px !important;',
      '  margin:0 0 10px 0 !important;',
      '  line-height:1.45 !important;',
      '}',
      '.beta-footer__notice li:before{',
      '  content:"•";',
      '  position:absolute;',
      '  left:0;',
      '  top:0;',
      '}',
      '.beta-footer__notice li:last-child{ margin-bottom:0 !important; }',
      '',
      '/* Mobile order: links -> notice -> logo -> business info (stacked) */',
      '@media (max-width: 768px){',
      '  .beta-footer__bottom{',
      '    display:flex !important;',
      '    flex-direction:column !important;',
      '    gap:16px !important;',
      '  }',
      '  .beta-footer__notice{ order:1 !important; }',
      '  .beta-footer__left{ order:2 !important; }',
      '}',
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'beta-shell-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function ensureFooterStructure(footer){
    var bottom = footer.querySelector('.beta-footer__bottom');
    if (!bottom) return;

    // Build left wrapper if missing
    var left = bottom.querySelector('.beta-footer__left');
    if (!left){
      var brand = bottom.querySelector('.beta-footer__brand');
      var info = bottom.querySelector('.beta-footer__info');
      if (brand && info){
        left = document.createElement('div');
        left.className = 'beta-footer__left';
        bottom.insertBefore(left, brand);
        left.appendChild(brand);
        left.appendChild(info);
      }
    }

    // Inject notice if missing
    var notice = bottom.querySelector('.beta-footer__notice');
    if (!notice){
      notice = document.createElement('div');
      notice.className = 'beta-footer__notice';
      var ul = document.createElement('ul');
      var items = FOOTER_NOTICE_TEXT.split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
      for (var i=0;i<items.length;i++){
        var li = document.createElement('li');
        li.textContent = items[i];
        ul.appendChild(li);
      }
      notice.appendChild(ul);
      // put notice BEFORE left on mobile order? we handle with CSS order, but DOM insertion after left is fine
      bottom.appendChild(notice);
    }
  }

  function positionMenuPanel(toggle, panel){
    // Ensure panel is in body so it never gets clipped/shifted
    if (panel.parentElement !== document.body){
      document.body.appendChild(panel);
    }
    panel.style.position = 'fixed';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';

    // Measure width
    var wasHidden = panel.classList.contains('hide');
    if (wasHidden) panel.classList.remove('hide');
    panel.style.visibility = 'hidden';
    panel.style.display = 'block';
    var panelW = panel.offsetWidth || 220;
    panel.style.display = '';
    panel.style.visibility = '';
    if (wasHidden) panel.classList.add('hide');

    var r = toggle.getBoundingClientRect();
    var margin = 12;
    var top = r.bottom + 10;
    var left = r.right - panelW;
    left = clamp(left, margin, (window.innerWidth || 0) - panelW - margin);
    // If button is too close to bottom on small screens, open upward
    var vh = window.innerHeight || 0;
    if (vh && top > vh - 240){
      top = r.top - 10;
      panel.style.transform = 'translateY(-100%)';
    } else {
      panel.style.transform = '';
    }
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }

  function setupMenu() {
  // Delegate menu handling at document level (capture) to avoid per-page script conflicts.
  if (window.__HUCHU_BETA_SHELL_MENU_BOUND__) return true;
  window.__HUCHU_BETA_SHELL_MENU_BOUND__ = true;

  function getToggle(t) {
    if (!t || !t.closest) return null;
    return t.closest('#betaMenuToggle, .beta-menu-toggle');
  }
  function getPanel() {
    return document.getElementById('betaMenuPanel') || document.querySelector('.beta-menu-panel');
  }
  function isOpen(panel) {
    return !!(panel && !panel.classList.contains('hide'));
  }
  function setAria(toggle, open) {
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function closeAll() {
    const panel = getPanel();
    if (panel) panel.classList.add('hide');
    const toggle = document.getElementById('betaMenuToggle') || document.querySelector('.beta-menu-toggle');
    setAria(toggle, false);
  }
  function openFrom(toggle) {
    const panel = getPanel();
    if (!toggle || !panel) return;
    positionMenuPanel(toggle, panel);
    panel.classList.remove('hide');
    setAria(toggle, true);
  }

  // Normalize initial state (safe if elements are not present yet).
  (function normalizeInitial() {
    const toggle = document.getElementById('betaMenuToggle') || document.querySelector('.beta-menu-toggle');
    const panel = getPanel();
    if (toggle && !toggle.hasAttribute('aria-expanded')) setAria(toggle, false);
    if (panel && !panel.classList.contains('hide')) {
      // keep as-is
    } else if (panel) {
      panel.classList.add('hide');
    }
  })();

  document.addEventListener('click', function onDocClick(e) {
    const toggle = getToggle(e.target);
    const panel = getPanel();

    // Toggle click: we fully handle it and stop propagation so other scripts won't double-toggle.
    if (toggle) {
      e.preventDefault();
      // Block other handlers (including those bound on the button itself).
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      e.stopPropagation();

      if (!panel) return;
      if (isOpen(panel)) closeAll();
      else openFrom(toggle);
      return;
    }

    // Outside click closes
    if (panel && isOpen(panel)) {
      if (!panel.contains(e.target)) closeAll();
    }
  }, true);

  // ESC closes
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') closeAll();
  });

  // Reposition when open on resize/scroll
  function repositionIfOpen() {
    const panel = getPanel();
    if (!panel || !isOpen(panel)) return;
    const toggle = document.getElementById('betaMenuToggle') || document.querySelector('.beta-menu-toggle');
    if (toggle) positionMenuPanel(toggle, panel);
  }
  window.addEventListener('resize', repositionIfOpen, { passive: true });
  window.addEventListener('scroll', repositionIfOpen, { passive: true });

  return true;
}

  function setupFooter(){
    var footer = document.querySelector('.beta-footer');
    if (!footer) return false;
    ensureFooterStructure(footer);
    return true;
  }

  function init(){
    ensureStyleTag();
    setupMenu();
    setupFooter();
  }

  function initWithRetry(){
    var tries = 0;
    (function tick(){
      tries++;
      init();
      // if both menu + footer are ready, stop
      var okMenu = !!(document.getElementById('betaMenuToggle') || document.querySelector('.beta-menu-toggle'));
      var okFooter = !!document.querySelector('.beta-footer');
      if ((okMenu && okFooter) || tries >= 20) return;
      setTimeout(tick, 80);
    })();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initWithRetry);
  } else {
    initWithRetry();
  }
})();
