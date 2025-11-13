/* ==== 저장 어댑터 (메인과 동일 키 사용) ==== */
const Storage = {
  getNotices(){ try{ return JSON.parse(localStorage.getItem('huchu.notices')||'[]') }catch(_){ return [] } },
  setNotices(arr){ localStorage.setItem('huchu.notices', JSON.stringify(arr||[])) },
  getStatsMap(){ try{ return JSON.parse(localStorage.getItem('huchu.statsMap')||'{}') }catch(_){ return {} } },
  setStatsMap(obj){ localStorage.setItem('huchu.statsMap', JSON.stringify(obj||{})) }
};

const onlyDigits = s => (s||"").replace(/[^0-9]/g,"");
const toNumber = s => Number(onlyDigits(s))||0;

/* ===== 입력 헬퍼: 콤마 포맷 & 퍼센트 처리 ===== */
// 숫자 3자리 콤마
function formatComma(val){
  const n = toNumber(val);
  return n ? n.toLocaleString('ko-KR') : '';
}
// 퍼센트인지 판별
function isPercent(val){
  return /%/.test(String(val||''));
}
// "12%" → 0.12
function parsePercent(val){
  const m = String(val||'').match(/([\d.]+)\s*%/);
  if(!m) return null;
  const p = parseFloat(m[1]);
  if(!isFinite(p) || p<0) return null;
  return p/100;
}
// 상품별 입력칸에 입력 이벤트 바인딩(콤마 자동)
function attachCommaInput(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('input', ()=>{
    // 퍼센트가 포함되면 그대로(예: "12%") 유지
    if(isPercent(el.value)) return;
    el.value = formatComma(el.value);
  });
  el.addEventListener('blur', ()=>{
    // blur에서 최종 콤마 보정
    if(isPercent(el.value)) return;
    el.value = formatComma(el.value);
  });
}
// 퍼센트 → 잔액×퍼센트로 즉시 환산
function attachPercentToAmount(id, getBalance){
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('blur', ()=>{
    if(!isPercent(el.value)) return;
    const pct = parsePercent(el.value);
    const bal = toNumber(getBalance());
    if(pct!=null){
      const computed = Math.round(bal * pct);
      el.value = computed.toLocaleString('ko-KR');
    }
  });
}

/* ==== 공지 관리 ==== */
let editingId = null;

function renderNoticeTable(){
  const tb = document.querySelector('#nTable tbody'); if(!tb) return;
  const arr = Storage.getNotices().sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
  tb.innerHTML = arr.map((n,idx)=>`
    <tr>
      <td>${idx+1}</td>
      <td>${n.title||''}</td>
      <td>${n.publishedAt||''}</td>
      <td>${n.active?'활성':'비활성'}</td>
      <td>
        <button class="btn btn-secondary btn-sm" data-act="edit" data-id="${n.id}">수정</button>
        <button class="btn btn-secondary btn-sm" data-act="del" data-id="${n.id}">삭제</button>
      </td>
    </tr>
  `).join('');
  tb.querySelectorAll('button').forEach(b=>{
    const id=b.dataset.id, act=b.dataset.act;
    b.addEventListener('click', ()=>{
      if(act==='edit'){ loadNoticeToForm(id); }
      else if(act==='del'){ if(confirm('삭제할까요?')){ const list=Storage.getNotices().filter(x=>x.id!==id); Storage.setNotices(list); renderNoticeTable(); } }
    });
  });
}
function loadNoticeToForm(id){
  const n = Storage.getNotices().find(x=>x.id===id); if(!n) return;
  editingId = id;
  document.getElementById('nTitle').value = n.title||'';
  document.getElementById('nImg').value   = n.imageUrl||'';
  document.getElementById('nLink').value  = n.linkUrl||'';
  document.getElementById('nDate').value  = n.publishedAt||'';
  document.getElementById('nActive').value = String(!!n.active);
}
function resetNoticeForm(){
  editingId=null;
  ['nTitle','nImg','nLink','nDate'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('nActive').value='true';
}
function saveNotice(){
  const title = document.getElementById('nTitle').value.trim();
  const imageUrl = document.getElementById('nImg').value.trim();
  const linkUrl = document.getElementById('nLink').value.trim();
  const publishedAt = document.getElementById('nDate').value;
  const active = document.getElementById('nActive').value==='true';
  if(!title || !imageUrl || !publishedAt){ alert('제목, 이미지URL, 게시일은 필수입니다.'); return; }
  const list = Storage.getNotices();
  if(editingId){
    const i = list.findIndex(x=>x.id===editingId);
    if(i>-1) list[i] = { ...list[i], title, imageUrl, linkUrl, publishedAt, active };
  }else{
    list.push({ id:crypto.randomUUID(), title, imageUrl, linkUrl, publishedAt, active });
  }
  Storage.setNotices(list);
  resetNoticeForm();
  renderNoticeTable();
  alert('저장되었습니다.');
}

/* ==== 통계 관리 ==== */
function renderStatsTable(){
  const tb = document.querySelector('#sTable tbody'); if(!tb) return;
  const map = Storage.getStatsMap();
  const keys = Object.keys(map).sort().reverse();
  tb.innerHTML = keys.map(k=>{
    const it = map[k]?.kpi2||{};
    return `<tr>
      <td>${k}</td>
      <td>${(it.cumulative_loan_krw||0).toLocaleString('ko-KR')}</td>
      <td>${(it.cumulative_repayment_krw||0).toLocaleString('ko-KR')}</td>
      <td>${(it.balance_krw||0).toLocaleString('ko-KR')}</td>
      <td>
        <button class="btn btn-secondary btn-sm" data-k="${k}" data-act="load">불러오기</button>
        <button class="btn btn-secondary btn-sm" data-k="${k}" data-act="del">삭제</button>
      </td>
    </tr>`;
  }).join('');
  tb.querySelectorAll('button').forEach(b=>{
    const k=b.dataset.k, act=b.dataset.act;
    b.addEventListener('click', ()=>{
      const map=Storage.getStatsMap();
      if(act==='load'){
        document.getElementById('sMonth').value = k;
        const it = map[k];
        if(it){
          document.getElementById('sLoan').value  = (it.kpi2?.cumulative_loan_krw||'').toLocaleString('ko-KR');
          document.getElementById('sRepay').value = (it.kpi2?.cumulative_repayment_krw||'').toLocaleString('ko-KR');
          document.getElementById('sBal').value   = (it.kpi2?.balance_krw||'').toLocaleString('ko-KR');
          const rowMap = {};
          (it.kpi1_rows||[]).forEach(r=> rowMap[r.product_type_name_kr]=r.balance_krw );
          document.getElementById('pPF').value       = (rowMap['부동산PF']||'').toLocaleString('ko-KR');
          document.getElementById('pSecured').value  = (rowMap['부동산담보']||'').toLocaleString('ko-KR');
          document.getElementById('pNote').value     = (rowMap['어음·매출채권담보']||'').toLocaleString('ko-KR');
          document.getElementById('pOther').value    = (rowMap['기타담보']||'').toLocaleString('ko-KR');
          document.getElementById('pPersonal').value = (rowMap['개인신용']||'').toLocaleString('ko-KR');
          document.getElementById('pCorp').value     = (rowMap['법인신용']||'').toLocaleString('ko-KR');
        }
      }else if(act==='del'){
        if(confirm(`${k} 데이터를 삭제할까요?`)){
          delete map[k]; Storage.setStatsMap(map); renderStatsTable();
        }
      }
    });
  });
}

// 퍼센트 입력 처리 포함하여 값 읽기
function readProductAmount(inputId, balance){
  const val = document.getElementById(inputId).value;
  if(isPercent(val)){
    const pct = parsePercent(val);
    if(pct!=null){
      return Math.round(balance * pct);
    }
  }
  return toNumber(val);
}

function saveStats(){
  const m = document.getElementById('sMonth').value || '2025-11';
  const loan  = toNumber(document.getElementById('sLoan').value);
  const repay = toNumber(document.getElementById('sRepay').value);
  const bal   = toNumber(document.getElementById('sBal').value);
  if(!(Number.isFinite(loan) && Number.isFinite(repay) && Number.isFinite(bal))){
    alert('누적대출/누적상환/잔액은 정확한 숫자로 입력해 주세요.'); return;
  }

  // 상품 금액 읽기(퍼센트 허용: bal × %)
  const pf       = readProductAmount('pPF', bal);
  const secured  = readProductAmount('pSecured', bal);
  const note     = readProductAmount('pNote', bal);
  const other    = readProductAmount('pOther', bal);
  const personal = readProductAmount('pPersonal', bal);
  const corp     = readProductAmount('pCorp', bal);

  const mode = document.getElementById('sPrevAuto').value;
  let prevKpi2, prevRows;
  if(mode==='auto'){
    const factor = 0.97; // -3% 가정
    prevKpi2 = {
      cumulative_loan_krw: Math.round(loan*factor),
      cumulative_repayment_krw: Math.round(repay*factor),
      balance_krw: Math.round(bal*factor)
    };
    prevRows = [
      {product_type_name_kr:'부동산PF', balance_krw:Math.round(pf*factor)},
      {product_type_name_kr:'부동산담보', balance_krw:Math.round(secured*factor)},
      {product_type_name_kr:'어음·매출채권담보', balance_krw:Math.round(note*factor)},
      {product_type_name_kr:'기타담보', balance_krw:Math.round(other*factor)},
      {product_type_name_kr:'개인신용', balance_krw:Math.round(personal*factor)},
      {product_type_name_kr:'법인신용', balance_krw:Math.round(corp*factor)}
    ];
  }else{
    prevKpi2 = { cumulative_loan_krw:loan, cumulative_repayment_krw:repay, balance_krw:bal };
    prevRows = [
      {product_type_name_kr:'부동산PF', balance_krw:pf},
      {product_type_name_kr:'부동산담보', balance_krw:secured},
      {product_type_name_kr:'어음·매출채권담보', balance_krw:note},
      {product_type_name_kr:'기타담보', balance_krw:other},
      {product_type_name_kr:'개인신용', balance_krw:personal},
      {product_type_name_kr:'법인신용', balance_krw:corp}
    ];
  }

  const map = Storage.getStatsMap();
  map[m] = {
    kpi2:{ cumulative_loan_krw:loan, cumulative_repayment_krw:repay, balance_krw:bal },
    kpi2_prev: prevKpi2,
    kpi1_rows:[
      {product_type_name_kr:'부동산PF', balance_krw:pf},
      {product_type_name_kr:'부동산담보', balance_krw:secured},
      {product_type_name_kr:'어음·매출채권담보', balance_krw:note},
      {product_type_name_kr:'기타담보', balance_krw:other},
      {product_type_name_kr:'개인신용', balance_krw:personal},
      {product_type_name_kr:'법인신용', balance_krw:corp}
    ],
    kpi1_prev: prevRows
  };
  Storage.setStatsMap(map);

  // 저장 후 폼에 콤마 보정 반영
  document.getElementById('sLoan').value  = loan.toLocaleString('ko-KR');
  document.getElementById('sRepay').value = repay.toLocaleString('ko-KR');
  document.getElementById('sBal').value   = bal.toLocaleString('ko-KR');
  document.getElementById('pPF').value       = pf.toLocaleString('ko-KR');
  document.getElementById('pSecured').value  = secured.toLocaleString('ko-KR');
  document.getElementById('pNote').value     = note.toLocaleString('ko-KR');
  document.getElementById('pOther').value    = other.toLocaleString('ko-KR');
  document.getElementById('pPersonal').value = personal.toLocaleString('ko-KR');
  document.getElementById('pCorp').value     = corp.toLocaleString('ko-KR');

  renderStatsTable();
  alert('저장되었습니다. 메인 페이지에서 기준월을 선택해 확인하세요.');
}

function loadStatsToForm(){
  const m = document.getElementById('sMonth').value || '2025-11';
  const map = Storage.getStatsMap(); const it = map[m];
  if(!it){ alert('해당 월 데이터가 없습니다.'); return; }
  document.getElementById('sLoan').value  = (it.kpi2?.cumulative_loan_krw||'').toLocaleString('ko-KR');
  document.getElementById('sRepay').value = (it.kpi2?.cumulative_repayment_krw||'').toLocaleString('ko-KR');
  document.getElementById('sBal').value   = (it.kpi2?.balance_krw||'').toLocaleString('ko-KR');
  const rowMap={}; (it.kpi1_rows||[]).forEach(r=> rowMap[r.product_type_name_kr]=r.balance_krw );
  document.getElementById('pPF').value       = (rowMap['부동산PF']||'').toLocaleString('ko-KR');
  document.getElementById('pSecured').value  = (rowMap['부동산담보']||'').toLocaleString('ko-KR');
  document.getElementById('pNote').value     = (rowMap['어음·매출채권담보']||'').toLocaleString('ko-KR');
  document.getElementById('pOther').value    = (rowMap['기타담보']||'').toLocaleString('ko-KR');
  document.getElementById('pPersonal').value = (rowMap['개인신용']||'').toLocaleString('ko-KR');
  document.getElementById('pCorp').value     = (rowMap['법인신용']||'').toLocaleString('ko-KR');
}

/* ==== 초기화 ==== */
document.addEventListener('DOMContentLoaded', ()=>{
  // 공지
  renderNoticeTable();
  document.getElementById('nSave').addEventListener('click', saveNotice);
  document.getElementById('nReset').addEventListener('click', resetNoticeForm);

  // 통계
  renderStatsTable();
  document.getElementById('sSave').addEventListener('click', saveStats);
  document.getElementById('sLoad').addEventListener('click', loadStatsToForm);

  // 콤마 자동 포맷: 대출 KPI 3종
  ['sLoan','sRepay','sBal'].forEach(attachCommaInput);

  // 상품별 콤마 & 퍼센트 → 금액 변환(blur 시)
  const getBalance = ()=> document.getElementById('sBal').value;
  ['pPF','pSecured','pNote','pOther','pPersonal','pCorp'].forEach(id=>{
    attachCommaInput(id);
    attachPercentToAmount(id, getBalance);
  });
});
