// UI v3 business screen — docs/ui-v3/README.md 5.5 (UI3-4), hub type.
//
// Card: stores, this week's profit, the best store. List: the stores (a row opens the store sheet: concept,
// price, equipment, renovation, closing), the businesses (a row opens the business sheet: investment, price,
// franchise) and the businesses that are not started yet (a row goes to the map, as the current screen does).
// Money that moves for good (concept change, equipment, renovation, franchise head office) goes through the
// shared confirmation sheet, modules.ui3.confirmSheet. Everything the v3 screen does not carry yet (opening
// hours, menu composition, market analysis, recall crisis, product sections, ...) stays reachable: the last
// row opens the current screen for this tab (README 6.5: data-ui3-current; migration-ledger.md, 残件).
//
// Presentation only. Every control dispatches an existing `data-action`; nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen||!modules.ui3.confirmSheet)throw new Error('js/ui3-shell.js must be loaded before ui3-business.js.');

const FRANCHISE_HQ_COST=5000000;   // "FC本部整備費500万円" (engine.startFranchise); shown only, never applied here
const INVEST_KINDS=[['quality','品質投資'],['brand','広告'],['efficiency','効率化'],['dx','DX']];
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
function signed(value,money){
  const amount=finite(value);
  return amount>0?`+${money(amount)}`:amount<0?`−${money(-amount)}`:money(0);
}
const direction=value=>finite(value)>0?' u-up':finite(value)<0?' u-down':'';
let context=null;
const state=()=>context.engine.g;

function statusLabel(store,g){
  if(store.status==='preparing'){
    const weeks=Math.max(0,Math.ceil(finite(store.openingWeek)-finite(g.week)));
    return weeks>0?`開業準備中・あと${weeks}週`:'まもなく開業';
  }
  return store.status==='closed'?'閉店':'営業中';
}
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end" aria-hidden="true">${esc(end)}</span></button>`;

// ---- the screen --------------------------------------------------------------------------------
function render(ctx){
  context=ctx;
  const {g,engine,money}=ctx;
  const stores=(g.stores||[]).filter(store=>store&&store.status!=='closed');
  const open=stores.filter(store=>store.status==='open');
  const profit=open.reduce((sum,store)=>sum+finite(store.lastProfit),0);
  const best=open.slice().sort((a,b)=>finite(b.lastProfit)-finite(a.lastProfit))[0];
  const portfolio=engine.businessPortfolio();
  const card=`<section class="u-card" aria-label="事業の成績" data-ui3-business="summary"><div class="u-stats">`
    +`<div class="u-stat"><span>店舗</span><b class="u-money">${esc(`${stores.length}店`)}</b></div>`
    +`<div class="u-stat"><span>週の利益</span><b class="u-money${direction(profit)}">${esc(signed(profit,money))}</b></div>`
    +`<div class="u-stat"><span>最も稼ぐ店</span><b>${esc(best?best.name:'—')}</b></div>`
    +`</div></section>`;
  const storeRows=stores.length
    ?`<div class="u-list" data-ui3-business="stores">${stores.map(store=>row(` data-ui3-biz="store" data-id="${esc(store.id)}"`,store.name,
      `${engine.business(store.businessID)?.name||store.businessID} · ${statusLabel(store,g)}`,signed(store.lastProfit,money))).join('')}</div>`
    :'<div class="u-h2">まだ出店していません。下の業種から選び、地図でテナントを決めます。</div>';
  const operating=portfolio.operating.map(item=>row(` data-ui3-biz="business" data-id="${esc(item.businessID)}"`,item.name,
    `${item.storeCount}店 · 週の利益 ${signed(item.weeklyProfit,money)}`)).join('');
  const idle=portfolio.idle.map(item=>row(` data-action="tab" data-tab="map" data-business-idle="${esc(item.businessID)}"`,item.name,
    item.affordable?`最低 ${money(item.minimumUpfront)}`:`資金不足 あと${money(item.shortfall)}`)).join('');
  const digital=row(' data-ui3-biz="digital"','IT・デジタル事業','プロダクトの開発・創業');
  const more=row(' data-ui3-current="business"','ほかの詳細（現行の画面）','営業時間・メニュー・市場分析・フランチャイズの一覧など');
  return card
    +'<h2 class="u-h2">店舗</h2>'+storeRows
    +(operating?`<h2 class="u-h2">運営中の事業</h2><div class="u-list" data-ui3-business="businesses">${operating}</div>`:'')
    +(idle?`<h2 class="u-h2">未出店の業種</h2><div class="u-list" data-ui3-business="idle">${idle}</div>`:'')
    +`<h2 class="u-h2">そのほか</h2><div class="u-list">${digital}${more}</div>`;
}

// ---- sheets ------------------------------------------------------------------------------------
function show(html){const root=modalRoot();if(root)root.innerHTML=html;}
function showConfirm(parts){show(modules.ui3.confirmSheet(parts));}

function storeSheet(id){
  const {g,engine,money}=context;
  const store=(g.stores||[]).find(item=>item.id===id);
  if(!store)return;
  const business=engine.business(store.businessID);
  const concept=engine.getStoreConceptPlan?.(id),equipment=engine.storeEquipmentPlan?.(id),renovation=engine.storeRenovationPlan?.(id);
  const pricing=engine.getStorePricingPlan?.(id),closure=engine.storeClosurePlan?.(id);
  const rows=[];
  if(concept)for(const option of concept.options.filter(item=>item.id!==concept.currentID)){
    const disabled=!concept.changeable||finite(g.companyCash)<concept.cost;
    rows.push(row(` data-ui3-biz="concept" data-id="${esc(id)}" data-kind="${esc(option.id)}"${disabled?' disabled':''}`,`${option.name}へ変更`,`費用 ${money(concept.cost)}・変更後2週間は移行ペナルティ`));
  }
  if(equipment&&!equipment.atMaxLevel)rows.push(row(` data-ui3-biz="equipment" data-id="${esc(id)}"${equipment.affordable?'':' disabled'}`,'設備強化',`Lv${equipment.nextLevel}へ・費用 ${money(equipment.cost)}`));
  if(renovation?.needed)rows.push(row(` data-ui3-biz="renovate" data-id="${esc(id)}"${renovation.affordable?'':' disabled'}`,'改装',`状態を${renovation.fullCondition}%へ回復・費用 ${money(renovation.cost)}`));
  if(pricing){
    rows.push(row(` data-action="store-price" data-id="${esc(id)}"${pricing.changeable?'':' disabled'}`,'店舗価格を変更',`${pricing.isOverridden?'店舗別価格':'全社価格を使用'}・販売価格 ${money(pricing.effectivePrice)}`));
    if(pricing.isOverridden)rows.push(row(` data-action="reset-store-price" data-id="${esc(id)}"${pricing.changeable?'':' disabled'}`,'全社価格に戻す',`全社価格 ${money(pricing.businessPrice)}`));
  }
  if(closure)rows.push(row(` data-action="close-store" data-id="${esc(id)}"`,'閉店',`設備を${money(closure.proceeds)}で売却・保証金は返還されません`));
  const body=`<span hidden data-ui3-business-sheet></span><div class="u-stats">`
    +`<div class="u-stat"><span>今週の売上</span><b class="u-money">${esc(money(finite(store.lastSales)))}</b></div>`
    +`<div class="u-stat"><span>今週の利益</span><b class="u-money${direction(store.lastProfit)}">${esc(signed(store.lastProfit,money))}</b></div>`
    +`<div class="u-stat"><span>設備</span><b>${esc(equipment?`Lv${equipment.currentLevel}/${equipment.maxLevel}`:'—')}</b></div></div>`
    +(rows.length?`<div class="u-list" data-ui3-business="store-actions">${rows.join('')}</div>`:'');
  show(modules.ui3.sheet({eyebrow:business?.name||'',title:store.name,subtitle:statusLabel(store,g),body,
    actions:'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'}));
}

function businessSheet(id){
  const {g,engine,money}=context;
  const business=engine.business(id);
  if(!business)return;
  const stores=(g.stores||[]).filter(store=>store.businessID===id&&store.status!=='closed');
  const profit=stores.filter(store=>store.status==='open').reduce((sum,store)=>sum+finite(store.lastProfit),0);
  const attributes=kind=>` data-action="business-invest" data-id="${esc(id)}" data-kind="${kind}"`;
  const rows=INVEST_KINDS.map(([kind,label])=>row(attributes(kind),label,'金額を入力して投資する')).join('')
    +row(` data-action="business-price" data-id="${esc(id)}"`,'価格変更',`現在 ${money(business.price)}`);
  const franchise=g.franchiseStoresByBusinessID?.[id];
  const openCount=stores.filter(store=>store.status==='open').length;
  const franchiseRow=franchise!==undefined
    ?row(` data-action="recruit-franchise" data-id="${esc(id)}"`,'加盟店を募集',`加盟店${franchise}店・金額を入力して募集する`)
    :row(` data-ui3-biz="franchise" data-id="${esc(id)}"${openCount>=3&&finite(g.companyCash)>=FRANCHISE_HQ_COST?'':' disabled'}`,'FC本部を設置',
      openCount>=3?`費用 ${money(FRANCHISE_HQ_COST)}`:'同一業態の直営店3店から');
  const body=`<span hidden data-ui3-business-sheet></span><div class="u-stats">`
    +`<div class="u-stat"><span>価格</span><b class="u-money">${esc(money(business.price))}</b></div>`
    +`<div class="u-stat"><span>店舗</span><b class="u-money">${esc(`${stores.length}店`)}</b></div>`
    +`<div class="u-stat"><span>週の利益</span><b class="u-money${direction(profit)}">${esc(signed(profit,money))}</b></div></div>`
    +`<div class="u-list" data-ui3-business="business-actions">${rows}${franchiseRow}</div>`;
  show(modules.ui3.sheet({eyebrow:'事業',title:business.name,body,actions:'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'}));
}

function digitalSheet(){
  const {g,engine,money}=context;
  const blueprints=modules.data?.PRODUCT_BLUEPRINTS||[];
  const hasDepartment=Boolean(g.departments?.product);
  const status=engine.digitalBusinessFoundingStatus();
  const rows=blueprints.map(blueprint=>{
    const enabled=hasDepartment?finite(g.companyCash)>=blueprint.cost:engine.digitalBusinessFoundingPlan(blueprint.id).eligible;
    return row(` data-action="${hasDepartment?'launch-product':'found-digital-business'}" data-id="${esc(blueprint.id)}"${enabled?'':' disabled'}`,blueprint.name,
      `${blueprint.category} · 開発${blueprint.weeks}週 · 初期開発費 ${money(blueprint.cost)}`);
  }).join('');
  const note=hasDepartment?'プロダクトを開発します（名前を入力します）。':status.available?'店舗を持たない創業企業は、この事業で創業できます（名前を入力します）。'
    :(status.reasons[0]||'本社オフィスと商品開発部門を設置すると開発できます。');
  show(modules.ui3.sheet({eyebrow:'事業',title:'IT・デジタル事業',subtitle:note,
    body:`<span hidden data-ui3-business-sheet></span><div class="u-list" data-ui3-business="digital-actions">${rows}</div>`,
    actions:'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'}));
}

function confirmConcept(id,kind){
  const {g,engine,money}=context;
  const plan=engine.getStoreConceptPlan?.(id),store=g.stores.find(item=>item.id===id),option=plan?.options.find(item=>item.id===kind);
  if(!plan||!option||!store)return;
  showConfirm({title:`${option.name}へ変更`,subtitle:store.name,
    facts:[{label:'費用',value:money(plan.cost)},{label:'実行後の会社現金',value:money(finite(g.companyCash)-plan.cost)}],
    note:'変更後2週間は移行ペナルティ（販売能力 −18%）があります。',
    confirm:{label:'変更する',attributes:{'data-action':'store-concept','data-id':id,'data-kind':kind}}});
}
function confirmEquipment(id){
  const {g,engine,money}=context;
  const plan=engine.storeEquipmentPlan?.(id),store=g.stores.find(item=>item.id===id);
  if(!plan||plan.atMaxLevel||!store)return;
  showConfirm({title:'設備強化',subtitle:store.name,
    facts:[{label:'費用',value:money(plan.cost)},{label:'実行後の会社現金',value:money(finite(g.companyCash)-plan.cost)}],
    note:`Lv${plan.nextLevel}になります。`,
    confirm:{label:'強化する',attributes:{'data-action':'upgrade-store-equipment','data-id':id}}});
}
function confirmRenovation(id){
  const {g,engine,money}=context;
  const plan=engine.storeRenovationPlan?.(id),store=g.stores.find(item=>item.id===id);
  if(!plan?.needed||!store)return;
  showConfirm({title:'改装',subtitle:store.name,
    facts:[{label:'費用',value:money(plan.cost)},{label:'実行後の会社現金',value:money(finite(g.companyCash)-plan.cost)}],
    note:`状態を${plan.fullCondition}%へ回復し、維持費 ${money(plan.weeklyUpkeepSaved)}/週を解消します。`,
    confirm:{label:'改装する',attributes:{'data-action':'renovate-store','data-id':id}}});
}
function confirmFranchise(id){
  const {g,engine,money}=context;
  const business=engine.business(id);
  if(!business)return;
  showConfirm({title:'FC本部を設置',subtitle:business.name,
    facts:[{label:'費用',value:money(FRANCHISE_HQ_COST)},{label:'実行後の会社現金',value:money(finite(g.companyCash)-FRANCHISE_HQ_COST)}],
    note:'同一業態の直営店3店が条件です。設置するとフランチャイズ展開ができます。',
    confirm:{label:'設置する',attributes:{'data-action':'start-franchise','data-id':id}}});
}

function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target)return;
  const control=target.closest('[data-ui3-biz]');
  if(!control||control.disabled||!context)return;
  const id=control.dataset.id,kind=control.dataset.kind;
  switch(control.dataset.ui3Biz){
    case 'store':storeSheet(id);break;
    case 'business':businessSheet(id);break;
    case 'digital':digitalSheet();break;
    case 'concept':confirmConcept(id,kind);break;
    case 'equipment':confirmEquipment(id);break;
    case 'renovate':confirmRenovation(id);break;
    case 'franchise':confirmFranchise(id);break;
    default:break;
  }
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('business',{render});
})();
