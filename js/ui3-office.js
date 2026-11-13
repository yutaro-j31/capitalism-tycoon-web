// UI v3 office screen — docs/ui-v3/README.md 5.5 (UI3-4), hub type.
//
// Card: the head office, the headcount, the weekly head-office cost. List: every department (set up: headcount and weekly
// cost; not set up: set-up cost) and the CXOs in post. A department row opens a sheet: set up / hire one person / close,
// each through a confirmation sheet with the cost the engine charges (UI3-9b-3, README 10.4). Operations carried here:
// welfare investment, remote work on/off, cancelling the head office. The other tabs of the current office screen
// (organisation dashboard, 2D campus, CXO appointment, key people, board and IPO, directives and the internal VC) are not ported
// yet: the last row opens the current screen for this tab (README 6.5: data-ui3-current; migration-ledger.md, 残件).
//
// Presentation only. Every control dispatches an existing `data-action`; nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen)throw new Error('js/ui3-shell.js must be loaded before ui3-office.js.');
const esc=modules.ui3.esc;

let context=null;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
const HIRE_COST=300000;// engine.hireDepartmentStaff: count * 300000
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end" aria-hidden="true">${esc(end)}</span></button>`;
const plain=(title,note,end='')=>`<div class="u-row"><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></div>`;

function render({g,engine,money}){
  const snapshot=engine.officeFloorSnapshot();
  context={g,engine,money};
  const all=modules.data?.MASTER?.departments||[];
  const executives=Object.values(g.executives||{});
  const card=`<section class="u-card" aria-label="本社の状況" data-ui3-office="summary"><div class="u-stats">`
    +`<div class="u-stat"><span>本社</span><b>${esc(g.hasHeadOffice?g.officeName:'未契約')}</b></div>`
    +`<div class="u-stat"><span>社員数</span><b class="u-money">${esc(`${finite(snapshot.employees)}名`)}</b></div>`
    +`<div class="u-stat"><span>週の固定費</span><b class="u-money">${esc(money(finite(g.officeWeeklyCost)))}</b></div>`
    +`</div></section>`;
  const departmentRows=`<div class="u-list" data-ui3-office="departments">${all.map(department=>{
    const active=Boolean(g.departments?.[department.id]);
    const plan=active?engine.departmentClosurePlan(department.id):null;
    return row(` data-ui3-dept="open" data-id="${esc(department.id)}"`,department.name,active?`人員 ${finite(plan?.headcount)}名 · 週の費用 ${money(finite(plan?.weeklyCost))}`:`設置費 ${money(finite(department.setupCost))}`,active?'設置済み':'未設置');
  }).join('')}</div>`;
  const executiveRows=executives.length?`<div class="u-list" data-ui3-office="executives">${executives.map(item=>plain(`${item.role} ${item.name}`,item.trait||'',item.rank||'')).join('')}</div>`
    :'<div class="u-h2">CXOはまだいません。</div>';
  const operations=[
    row(' data-action="workforce-invest"','福利厚生投資','金額を入力して投資する'),
    row(' data-action="toggle-remote"','リモートワーク',g.remoteWorkEnabled?'いまは ON（押すと OFF）':'いまは OFF（押すと ON）',g.remoteWorkEnabled?'ON':'OFF'),
    g.hasHeadOffice?row(' data-action="cancel-office"','本社契約の解除','部門やCXOがいる場合は解除できません'):'',
    row(' data-ui3-current="office"','ほかの詳細（現行の画面）','CXO・取締役会とIPO・社内VC・キャンパスなど')
  ].join('');
  return card
    +'<h2 class="u-h2">部門</h2>'+departmentRows
    +'<h2 class="u-h2">CXO</h2>'+executiveRows
    +`<h2 class="u-h2">操作</h2><div class="u-list" data-ui3-office="operations">${operations}</div>`;
}


// --- department rules: the engine's own conditions (js/engine.js establishDepartment / hireDepartmentStaff / closeDepartment) ---
function establishReason(g,department){
  const unlock=modules.data?.DEPARTMENT_UNLOCKS?.[department.id];const minStores=finite(unlock?.minStores);
  if(!g.hasHeadOffice)return '本社オフィスが必要です';
  const zeroStores=(g.stores||[]).length===0,hasFormalDigital=(g.productVentures||[]).some(p=>p&&p.origin!=='founderHome');
  const investmentRoute=(department.id==='investment'||department.id==='accounting')&&zeroStores;
  const digitalRoute=zeroStores&&(department.id==='product'||(hasFormalDigital&&['hr','marketing','dx'].includes(department.id)));
  if((g.stores||[]).length<minStores&&!investmentRoute&&!digitalRoute)return `店舗数${minStores}以上が必要です`;
  if(finite(g.companyCash)<finite(department.setupCost))return '会社の現金が足りません';
  const used=Object.keys(g.departments||{}).length*8+Object.keys(g.executives||{}).length;
  if(used+8>finite(g.officeCapacity))return 'オフィス定員が足りません';
  return '';
}
function hireReason(g){
  if(finite(g.companyCash)<HIRE_COST)return '会社の現金が足りません';
  const used=Object.values(g.departmentStaff||{}).reduce((a,n)=>a+finite(n),0)+Object.keys(g.executives||{}).length;
  if(used+1>finite(g.officeCapacity))return 'オフィス定員が足りません';
  return '';
}
function closeReason(g,plan){return finite(plan?.severance)>0&&finite(g.companyCash)<finite(plan.severance)?'退職金を払う現金が足りません':'';}
const show=html=>{const root=modalRoot();if(root)root.innerHTML=html;};
const disabledNote=reason=>reason?`<div class="u-h2" data-ui3-dept="reason">${esc(reason)}</div>`:'';

function departmentSheet(id){
  if(!context)return;
  const {g,engine,money}=context;
  const department=(modules.data?.MASTER?.departments||[]).find(x=>x.id===id);
  if(!department)return;
  const active=Boolean(g.departments?.[id]);
  const stat=(label,value)=>`<div class="u-stat"><span>${esc(label)}</span><b class="u-money">${esc(value)}</b></div>`;
  let body=`<span hidden data-ui3-dept-sheet></span><p>${esc(department.desc||'')}</p>`,actions;
  if(active){
    const plan=engine.departmentClosurePlan(id);
    const hire=hireReason(g),close=closeReason(g,plan);
    body+=`<div class="u-stats">${stat('人員',`${finite(plan?.headcount)}名`)}${stat('機能率',`${(finite(engine.departmentEffect(id))*100).toFixed(0)}%`)}${stat('週の費用',money(finite(plan?.weeklyCost)))}</div>`+disabledNote(hire||close);
    actions=`<button type="button" class="u-btn" data-action="close-modal">閉じる</button>`
      +`<button type="button" class="u-btn" data-ui3-dept="close" data-id="${esc(id)}"${close?' disabled':''}>閉鎖する</button>`
      +`<button type="button" class="u-btn primary" data-ui3-dept="hire" data-id="${esc(id)}"${hire?' disabled':''}>1人採用する</button>`;
  }else{
    const reason=establishReason(g,department);
    body+=`<div class="u-stats">${stat('設置費',money(finite(department.setupCost)))}${stat('週の費用',money(finite(department.weeklyCost)))}</div>`+disabledNote(reason);
    actions=`<button type="button" class="u-btn" data-action="close-modal">閉じる</button><button type="button" class="u-btn primary" data-ui3-dept="establish" data-id="${esc(id)}"${reason?' disabled':''}>設置する</button>`;
  }
  show(modules.ui3.sheet({eyebrow:'部門',title:department.name,body,actions}));
}
function confirmDepartment(kind,id){
  if(!context)return;
  const {g,engine,money}=context;
  const department=(modules.data?.MASTER?.departments||[]).find(x=>x.id===id);
  if(!department)return;
  const cash=finite(g.companyCash);
  if(kind==='establish'){
    if(establishReason(g,department))return;
    const cost=finite(department.setupCost);
    show(modules.ui3.confirmSheet({title:`${department.name}を設置`,subtitle:'会社の現金から払います。取り消せません。',
      facts:[{label:'設置費',value:money(cost)},{label:'週の費用',value:money(finite(department.weeklyCost))},{label:'実行後の会社現金',value:money(cash-cost)}],
      note:'設置すると1名が配属されます。',confirm:{label:'設置する',attributes:{'data-action':'establish-department','data-id':id}}}));
  }else if(kind==='hire'){
    if(hireReason(g))return;
    show(modules.ui3.confirmSheet({title:`${department.name}で1人採用`,subtitle:'会社の現金から払います。取り消せません。',
      facts:[{label:'採用費',value:money(HIRE_COST)},{label:'実行後の会社現金',value:money(cash-HIRE_COST)}],
      confirm:{label:'採用する',attributes:{'data-action':'hire-staff','data-id':id}}}));
  }else if(kind==='close'){
    const plan=engine.departmentClosurePlan(id);
    if(!plan||closeReason(g,plan))return;
    const severance=finite(plan.severance);
    show(modules.ui3.confirmSheet({title:`${department.name}を閉鎖`,subtitle:severance>0?'退職金を会社の現金から払います。取り消せません。':'取り消せません。',
      facts:[{label:'在籍人員',value:`${finite(plan.headcount)}名`},{label:'退職金',value:money(severance)},{label:'週の費用の削減',value:money(finite(plan.weeklyCost))},{label:'実行後の会社現金',value:money(cash-severance)}],
      note:(finite(plan.activeCampaignCount)>0?`進行中の施策${finite(plan.activeCampaignCount)}件は中止され、使った予算は戻りません。`:'')+'この部門が解放していた機能は使えなくなります。再設置には設置費がかかります。',
      confirm:{label:'閉鎖する',attributes:{'data-action':'close-department-confirmed','data-id':id}}}));
  }
}
globalThis.document?.addEventListener('click',event=>{
  const control=event.target instanceof Element?event.target.closest('[data-ui3-dept]'):null;
  if(!control||control.disabled)return;
  const kind=control.dataset.ui3Dept;
  if(kind==='open')departmentSheet(control.dataset.id);
  else if(kind==='establish'||kind==='hire'||kind==='close')confirmDepartment(kind,control.dataset.id);
},true);

// welfare investment spends company money: say what the number is (README 5.7)
globalThis.document?.addEventListener('click',event=>{
  const control=event.target instanceof Element?event.target.closest('[data-action="workforce-invest"]'):null;
  if(!control||control.disabled)return;
  const money=value=>modules.engine.compactYen(value);
  modules.ui3.setAmountContext({unit:'円',wallet:'company',direction:'spend',
    // the cost is paid at once and cannot be taken back, so the number is confirmed once more (README 6.6)
    confirm:value=>{
      const g=modules.playerEngineBridge.getEngine().g,after=Number(g.companyCash)-value;
      // the engine's own effect (js/app.js 'workforce-invest'): satisfaction + log10(1+v/100000)*2 (up to 100), benefit level + v/10,000,000
      const satisfaction=Math.max(0,Math.min(100,Number(g.employeeSatisfaction)+Math.log10(1+value/100000)*2)-Number(g.employeeSatisfaction));
      return {title:'福利厚生に投資',subtitle:'会社の現金から払います。取り消せません。',
        facts:[{label:'投資額',value:money(value)},{label:'実行後の会社現金',value:money(after),tone:after<0?'down':undefined},{label:'従業員満足度（見込み）',value:`+${satisfaction.toFixed(1)}`,tone:'up'}],
        note:[after<0?'会社の現金が足りません。エンジンが実行を断ります。':'',modules.ui3.reserveNote(after)].filter(Boolean).join(' ')};
    }});
},true);

modules.ui3.registerScreen('office',{render});
})();
