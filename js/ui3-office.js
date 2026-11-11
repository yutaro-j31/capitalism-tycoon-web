// UI v3 office screen — docs/ui-v3/README.md 5.5 (UI3-4), hub type.
//
// Card: the head office, the headcount, the weekly head-office cost. List: the departments that are set up
// and the CXOs in post. Operations carried here: welfare investment, remote work on/off, cancelling the head
// office. The other tabs of the current office screen (organisation dashboard, 2D campus, setting up
// departments, CXO appointment, key people, board and IPO, directives and the internal VC) are not ported
// yet: the last row opens the current screen for this tab (README 6.5; migration-ledger.md, 残件).
//
// Presentation only. Every control dispatches an existing `data-action`; nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen)throw new Error('js/ui3-shell.js must be loaded before ui3-office.js.');
const esc=modules.ui3.esc;
let showCurrent=false,escaping=false;

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end" aria-hidden="true">${esc(end)}</span></button>`;
const plain=(title,note,end='')=>`<div class="u-row"><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></div>`;

function render({g,engine,money}){
  const snapshot=engine.officeFloorSnapshot();
  const departments=(modules.data?.MASTER?.departments||[]).filter(department=>g.departments?.[department.id]);
  const executives=Object.values(g.executives||{});
  const card=`<section class="u-card" aria-label="本社の状況" data-ui3-office="summary"><div class="u-stats">`
    +`<div class="u-stat"><span>本社</span><b>${esc(g.hasHeadOffice?g.officeName:'未契約')}</b></div>`
    +`<div class="u-stat"><span>社員数</span><b class="u-money">${esc(`${finite(snapshot.employees)}名`)}</b></div>`
    +`<div class="u-stat"><span>週の固定費</span><b class="u-money">${esc(money(finite(g.officeWeeklyCost)))}</b></div>`
    +`</div></section>`;
  const departmentRows=departments.length?`<div class="u-list" data-ui3-office="departments">${departments.map(department=>plain(department.name,'設置済み')).join('')}</div>`
    :'<div class="u-h2">部門はまだありません。</div>';
  const executiveRows=executives.length?`<div class="u-list" data-ui3-office="executives">${executives.map(item=>plain(`${item.role} ${item.name}`,item.trait||'',item.rank||'')).join('')}</div>`
    :'<div class="u-h2">CXOはまだいません。</div>';
  const operations=[
    row(' data-action="workforce-invest"','福利厚生投資','金額を入力して投資する'),
    row(' data-action="toggle-remote"','リモートワーク',g.remoteWorkEnabled?'いまは ON（押すと OFF）':'いまは OFF（押すと ON）',g.remoteWorkEnabled?'ON':'OFF'),
    g.hasHeadOffice?row(' data-action="cancel-office"','本社契約の解除','部門やCXOがいる場合は解除できません'):'',
    row(' data-ui3-office-current','ほかの詳細（現行の画面）','部門の設置・CXO・取締役会とIPO・社内VC・キャンパスなど')
  ].join('');
  return card
    +'<h2 class="u-h2">部門</h2>'+departmentRows
    +'<h2 class="u-h2">CXO</h2>'+executiveRows
    +`<h2 class="u-h2">操作</h2><div class="u-list" data-ui3-office="operations">${operations}</div>`;
}

function openCurrent(){
  showCurrent=true;
  escaping=true;
  try{globalThis.document.querySelector('[data-ui3-all-screens] [data-action="tab"][data-tab="office"]')?.click();}finally{escaping=false;}
}
globalThis.document?.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target:null;
  if(!target)return;
  if(!escaping&&showCurrent&&target.closest('[data-action="tab"]'))showCurrent=false;
  if(target.closest('[data-ui3-office-current]'))openCurrent();
},true);

modules.ui3.registerScreen('office',{useCurrentUI:()=>showCurrent,render});
})();
