// /assets/beta-shell.js
// HUCHU beta common shell: MENU dropdown + Footer notice
// v7 - Syntax-safe (no template literals / no multi-line array commas), DOM-ready init, stable positioning

(function(){
  'use strict';
  var GLOBAL_FLAG = '__HUCHU_BETA_SHELL_INIT__v7';
  if (window[GLOBAL_FLAG]) return;
  window[GLOBAL_FLAG] = true;

  // ----------------------------
  // Config
  // ----------------------------
  var FOOTER_NOTICE_LINES = [
    '본 페이지의 정보는 단순 참고용이며, 대출 관련 문의는 해당 온투업체에 직접 문의해 주세요.',
    '당사는 대출의 판매·대리·중개·모집, 심사·승인·계약 체결에 일체 관여하지 않습니다.',
    '과도한 빚은 당신에게 큰 불행을 안겨줄 수 있습니다. 반드시 상환 계획을 함께 준비하세요.',
  ];
  var FOOTER_NOTICE_TEXT = FOOTER_NOTICE_LINES.join('\n');

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function ensureStyleTag(){
    if (document.getElementById('beta-shell-style')) return;
    var css = [
      '/* beta-shell injected styles */',
      '',
      '/* MENU: tighter card + more vertical breathing room */',
      '.beta-menu-panel{',
      '  width:170px !important;',
      '  max-width:170px !important;',
      '  min-width:160px !important;',
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

  function setupMenu(){
    var toggle = document.getElementById('betaMenuToggle') || document.querySelector('.beta-menu-toggle');
    var panel = document.getElementById('betaMenuPanel') || document.querySelector('.beta-menu-panel');
    if (!toggle || !panel) return false;
    if (toggle.dataset.shellBound === '1') return true;
    toggle.dataset.shellBound = '1';

    function close(){
      panel.classList.add('hide');
      toggle.setAttribute('aria-expanded','false');
    }
    function open(){
      positionMenuPanel(toggle, panel);
      panel.classList.remove('hide');
      toggle.setAttribute('aria-expanded','true');
    }
    function toggleMenu(){
      if (panel.classList.contains('hide')) open(); else close();
    }

    // Use a document-level CAPTURE handler so page-specific scripts can't "fight" the MENU toggle.
    // (Prevents: open-then-immediate-close / no-op click when multiple listeners exist.)
    if (!window.__betaShellMenuCaptureBound){
      window.__betaShellMenuCaptureBound = true;

      document.addEventListener('click', function(e){
        var t = e.target;

        var tg = document.getElementById('betaMenuToggle') || document.querySelector('.beta-menu-toggle');
        var pn = document.getElementById('betaMenuPanel') || document.querySelector('.beta-menu-panel');
        if (!tg || !pn) return;

        // Toggle button click: intercept before other handlers
        if (t === tg || (tg.contains && tg.contains(t))){
          e.preventDefault();
          e.stopImmediatePropagation();

          // Re-sync local refs if needed
          toggle = tg;
          panel = pn;

          // Toggle
          if (panel.classList.contains('hide')) open(); else close();
          return;
        }

        // Outside click closes (no interference)
        if (!pn.classList.contains('hide')){
          if (!(pn.contains && pn.contains(t)) && !(tg.contains && tg.contains(t))){
            close();
          }
        }
      }, true);
    }

    window.addEventListener('resize', function(){
      if (!panel.classList.contains('hide')) positionMenuPanel(toggle, panel);
    });
    window.addEventListener('scroll', function(){
      if (!panel.classList.contains('hide')) positionMenuPanel(toggle, panel);
    }, {passive:true});

    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') close();
    });
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
