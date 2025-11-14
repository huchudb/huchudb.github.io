/* admin.js — 관리자 전용. Vercel Functions + Supabase 연동 */

const API_BASE = ''; // 같은 도메인 배포 기준. 프록시/서브도메인 쓰면 채워넣기.
const ENDPOINTS = {
  adminLogin:   '/api/admin/login',
  presign:      '/api/admin/presign',
  noticesList:  '/api/admin/notices/list',
  noticesUpsert:'/api/admin/notices/upsert',
  noticesDelete:'/api/admin/notices/delete',
  kpiGet:       '/api/admin/kpi/get',
  kpiUpsert:    '/api/admin/kpi/upsert',
};

function qs(sel, p=document){ return p.querySelector(sel); }
function qsa(sel, p=document){ return [...p.querySelectorAll(sel)]; }
function byId(id){ return document.getElementById(id); }

const Admin = {
  tokenKey: 'huchu.admin.token',
  get token(){ return localStorage.getItem(this.tokenKey) || ''; },
  set token(v){ localStorage.setItem(this.tokenKey, v||''); }
};

async function fetchJSON(url, opt={}){
  const r = await fetch(API_BASE + url, {
    ...opt,
    headers: {
      'Accept':'application/json',
      ...(opt.body ? {'Content-Type':'application/json'} : {}),
      ...(Admin.token ? {'Authorization':'Bearer ' + Admin.token} : {}),
      ...(opt.headers || {})
    }
  });
  if (!r.ok){
    const t = await r.text().catch(()=> '');
    throw new Error(`HTTP ${r.status}: ${t}`);
  }
  return r.json();
}

/* ========== 로그인 영역 ========== */
function bindLogin(){
  const tokenInput = byId('adminToken');
  const btnLogin  = byId('btnLogin');
  const loginBox  = byId('loginBox');
  const appBox    = byId('appBox');

  if (!btnLogin) return;

  const showApp = ()=>{ if (loginBox) loginBox.classList.add('hide'); if (appBox) appBox.classList.remove('hide'); };
  const showLogin = ()=>{ if (loginBox) loginBox.classList.remove('hide'); if (appBox) appBox.classList.add('hide'); };

  async function doCheck(){
    try {
      await fetchJSON(ENDPOINTS.adminLogin, { method: 'GET' });
      showApp();
    } catch (_) {
      showLogin();
    }
  }

  btnLogin.addEventListener('click', async ()=>{
    const t = (tokenInput?.value || '').trim();
    if (!t) { alert('관리자 토큰을 입력하세요.'); return; }
    Admin.token = t;
    try {
      await fetchJSON(ENDPOINTS.adminLogin, { method: 'GET' });
      showApp();
    } catch (e) {
      alert('토큰이 올바르지 않습니다.');
      Admin.token = '';
      showLogin();
    }
  });

  // 새로고침 시에도 자동 확인
  doCheck();
}

/* ========== 공지 관리 ========== */
function bindNoticeForm(){
  const form = byId('noticeForm');
  const fileInput = byId('noticeImage');
  const listBox = byId('noticeList');

  async function loadNotices(){
    const j = await fetchJSON(ENDPOINTS.noticesList, { method: 'GET' });
    const items = j.items || [];
    renderNoticeList(items);
  }

  function renderNoticeList(items){
    if (!listBox) return;
    listBox.innerHTML = items.map(n=>`
      <div class="row" data-id="${n.id}">
        <div class="left">
          <img src="${n.image_url||''}" alt="" style="width:64px;height:64px;object-fit:cover;border:1px solid #e2e8f0;border-radius:8px"/>
          <div class="meta">
            <div class="title">${n.title||''}</div>
            <div class="sub">${n.published_at||''} · ${n.active ? '활성' : '비활성'}</div>
            <div class="link">${n.link_url||''}</div>
          </div>
        </div>
        <div class="right">
          <button class="btn-edit">수정</button>
          <button class="btn-del">삭제</button>
        </div>
      </div>
    `).join('');

    qsa('.row .btn-del', listBox).forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const row = btn.closest('.row'); const id = row?.dataset.id;
        if (!id) return;
        if (!confirm('삭제하시겠습니까?')) return;
        await fetchJSON(ENDPOINTS.noticesDelete, {
          method:'DELETE',
          body: JSON.stringify({ id })
        });
        await loadNotices();
      });
    });

    qsa('.row .btn-edit', listBox).forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const row = btn.closest('.row');
        const id = row?.dataset.id;
        if (!id) return;
        // 리스트 DOM에서 값 읽어오기 (간단 UI)
        const title = row.querySelector('.title')?.textContent || '';
        const link = row.querySelector('.link')?.textContent || '';
        byId('noticeId').value = id;
        byId('noticeTitle').value = title;
        byId('noticeLink').value = link;
        byId('noticeActive').checked = (row.querySelector('.sub')?.textContent || '').includes('활성');
        byId('noticePublishedAt').value = ''; // 필요하면 편집시 값 표기 로직 보완
        alert('상단 폼에서 수정 후 저장을 누르세요.');
      });
    });
  }

  async function uploadImageIfNeeded(){
    const f = fileInput?.files?.[0];
    if (!f) return { image_url: '' };
    // presign
    const pres = await fetchJSON(ENDPOINTS.presign, {
      method:'POST',
      body: JSON.stringify({ fileName: f.name, contentType: f.type || 'application/octet-stream' })
    });
    // PUT 업로드
    await fetch(pres.uploadUrl, { method:'PUT', headers: { 'Content-Type': pres.contentType }, body: f });
    return { image_url: pres.publicUrl };
  }

  if (form){
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      try {
        const id = byId('noticeId').value.trim() || undefined;
        const title = byId('noticeTitle').value.trim();
        const link_url = byId('noticeLink').value.trim();
        const active = byId('noticeActive').checked;
        const published_at = byId('noticePublishedAt').value ? new Date(byId('noticePublishedAt').value).toISOString() : null;

        if (!title) { alert('제목을 입력하세요'); return; }

        const img = await uploadImageIfNeeded();

        const payload = { id, title, link_url, active, published_at, ...(img.image_url ? { image_url: img.image_url } : {}) };

        await fetchJSON(ENDPOINTS.noticesUpsert, {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(payload)
        });

        // 폼 리셋
        form.reset();
        byId('noticeId').value = '';

        await loadNotices();
        alert('저장되었습니다.');
      } catch (e) {
        console.error(e);
        alert('오류: ' + e.message);
      }
    });
  }

  // 초기 목록 로드
  loadNotices().catch(console.error);
}

/* ========== KPI 관리 ========== */
function bindKpiForm(){
  const form = byId('kpiForm');
  const ymInput = byId('kpiYM');
  const loadBtn = byId('btnKpiLoad');

  async function loadOne(ym){
    const u = new URL(ENDPOINTS.kpiGet, location.origin);
    u.searchParams.set('ym', ym);
    const j = await fetchJSON(u.pathname + u.search, { method: 'GET' });
    const item = j.item || null;
    byId('kpi2').value      = JSON.stringify(item?.kpi2 || {}, null, 2);
    byId('kpi2_prev').value = JSON.stringify(item?.kpi2_prev || {}, null, 2);
    byId('kpi1_rows').value = JSON.stringify(item?.kpi1_rows || [], null, 2);
    byId('kpi1_prev').value = JSON.stringify(item?.kpi1_prev || [], null, 2);
  }

  loadBtn?.addEventListener('click', async ()=>{
    const ym = (ymInput?.value || '').trim();
    if (!ym) { alert('기준월(YYYY-MM)을 입력하세요'); return; }
    try { await loadOne(ym); } catch(e){ alert('불러오기 실패: ' + e.message); }
  });

  form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    try {
      const ym = (ymInput?.value || '').trim();
      if (!ym) { alert('기준월(YYYY-MM)을 입력하세요'); return; }

      const payload = {
        ym,
        kpi2:      JSON.parse(byId('kpi2').value || '{}'),
        kpi2_prev: JSON.parse(byId('kpi2_prev').value || '{}'),
        kpi1_rows: JSON.parse(byId('kpi1_rows').value || '[]'),
        kpi1_prev: JSON.parse(byId('kpi1_prev').value || '[]'),
      };

      await fetchJSON(ENDPOINTS.kpiUpsert, {
        method:'PUT',
        body: JSON.stringify(payload)
      });

      alert('KPI 저장 완료');
    } catch (e) {
      console.error(e);
      alert('KPI 저장 실패: ' + e.message);
    }
  });
}

/* ========== 시작 ========== */
document.addEventListener('DOMContentLoaded', ()=>{
  bindLogin();
  bindNoticeForm();
  bindKpiForm();
});
