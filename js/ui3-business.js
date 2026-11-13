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

// ---- stock and sourcing (UI3-10c, README 10.10) ---------------------------------------------------------------
// The store sheet's "在庫と仕入れ" section, for the stores the supply module covers (supply.isTargetBusinessID, open stores only, as the
// current supply tab lists them). Read: the stock state (last week's lost demand,
// g.supplyResultsByStoreID[storeID].stockoutLostDemand), the stock value and the supplier. Operations: the existing actions, with the current screen's
// data-id and values -- supply-policy (button value), supply-safety (button value 0-6), supply-emergency (a hidden checkbox, read as el.checked)
// and supply-select-supplier (button value; a confirmation sheet first, because a change always costs the new contract fee and may cost the
// current contract's termination fee -- engine selectSupplier). Nothing here writes engine state.
const nf=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const supplyModule=()=>modules.supply;
const supplyTarget=store=>Boolean(store&&store.status==='open'&&supplyModule()?.isTargetBusinessID?.(store.businessID));
const POLICY_LABELS=['lean','balanced','stable'];
const activeContract=(g,storeID)=>(g.supplierContracts||[]).find(contract=>contract.storeID===storeID&&contract.active&&contract.status==='active')||null;
function supplySection(store){
  const {g,money}=context;
  const supply=supplyModule();
  const settings=g.supplySettingsByStoreID?.[store.id];
  const id=esc(store.id);
  // the state comes from one function, supply.storeStockStatus (UI3-10d; the secretary uses it too): last week's lost demand
  // (g.supplyResultsByStoreID[storeID].stockoutLostDemand), else too much stock on hand, else no stock-out; no result yet (the week has not closed) says so
  const status=supply.storeStockStatus?.(g,store.id)||{hasResult:false,stockout:false,overstock:false,lostDemand:0,coverWeeks:0};
  const state=!status.hasResult?['まだ結果がありません','']:status.stockout?[`先週、欠品で${Math.round(status.lostDemand).toLocaleString('ja-JP')}食の機会損失`,' u-down']:status.overstock?[`在庫が多め（先週の販売の${status.coverWeeks.toFixed(1)}週分）`,'']:['先週の欠品なし',''];
  if(!settings){
    return `<h2 class="u-h2">在庫と仕入れ</h2><section class="u-card" data-ui3-supply-card data-id="${id}"><div class="u-stats"><div class="u-stat"><span>在庫の状態</span><b class="${state[1].trim()}">${esc(state[0])}</b></div></div><div class="u-h2">仕入れの設定は、最初の週が進むと使えます。</div></section>`;
  }
  const supplier=(supply.SUPPLIERS||[]).find(item=>item.id===settings.preferredSupplierID)||(supply.SUPPLIERS||[])[0]||{};
  const inventory=g.inventoryByStoreID?.[store.id];
  const value=Object.values(inventory?.materials||{}).reduce((sum,item)=>sum+(item.lots||[]).reduce((inner,lot)=>inner+nf(lot.quantity)*nf(lot.unitCost),0),0);
  const policy=settings.autoPolicy||'balanced';
  const weeks=nf(settings.safetyStockWeeks,1.2);
  const policies=Object.values(supply.POLICIES||{});
  const stats=`<div class="u-stats"><div class="u-stat"><span>在庫の状態</span><b class="${state[1].trim()}">${esc(state[0])}</b></div>`
    +`<div class="u-stat"><span>仕入先</span><b>${esc(supplier.name||'—')}</b></div>`
    +`<div class="u-stat"><span>在庫総額</span><b class="u-money">${esc(money(value))}</b></div></div>`;
  const policyButtons=policies.map(item=>`<button type="button" data-action="supply-policy" data-id="${id}" value="${esc(item.id)}" aria-pressed="${item.id===policy}">${esc(item.name)}</button>`).join('');
  const safetyChips=[0,1,2,3,4,5,6].map(number=>`<button type="button" class="u-chip" data-action="supply-safety" data-id="${id}" value="${number}" aria-pressed="${number===weeks}">${number}週</button>`).join('');
  const emergencyOn=settings.emergencyProcurementEnabled!==false;
  return `<h2 class="u-h2">在庫と仕入れ</h2><section class="u-card" data-ui3-supply-card data-id="${id}">${stats}`
    +`<div class="u-h2">自動発注の方針</div><div class="u-seg" role="group" aria-label="自動発注の方針" data-ui3-supply-group="policy">${policyButtons}</div>`
    +`<div class="u-h2">安全在庫の週数（いま${esc(weeks.toFixed(1))}週）</div><nav class="u-chips" aria-label="安全在庫の週数" data-ui3-supply-group="safety">${safetyChips}</nav>`
    +`<div class="u-list">`
    +row(` data-ui3-supply="emergency" data-id="${id}"`,'緊急仕入れ',emergencyOn?'いまは ON（押すと OFF）：欠品しそうなときに自動で緊急発注します':'いまは OFF（押すと ON）：欠品しても緊急発注しません',emergencyOn?'ON':'OFF')
    +row(` data-ui3-supply="suppliers" data-id="${id}"`,'仕入先を変える',`いまは ${supplier.name||'—'}（契約料がかかります）`)
    +`</div><input type="checkbox" hidden aria-hidden="true" tabindex="-1" data-action="supply-emergency" data-id="${id}"${emergencyOn?' checked':''}></section>`;
}
function supplierSheet(storeID){
  const {g,money}=context;
  const store=(g.stores||[]).find(item=>item.id===storeID);
  if(!store||!supplyTarget(store))return;
  const settings=g.supplySettingsByStoreID?.[storeID];
  const current=settings?.preferredSupplierID;
  const rows=(supplyModule().SUPPLIERS||[]).map(item=>row(` data-ui3-supply="supplier" data-id="${esc(storeID)}" data-supplier="${esc(item.id)}"${item.id===current?' disabled':''}`,item.name,`契約料 ${money(nf(item.contractFee))}・納期${nf(item.leadTimeWeeks)}週・品質${nf(item.quality)}・信頼性${Math.round(nf(item.reliability)*100)}%`,item.id===current?'現在':'›')).join('');
  show(modules.ui3.sheet({eyebrow:'仕入先',title:store.name,subtitle:'変えると、新しい契約料（と、いまの契約の解約金）がかかります',
    body:`<span hidden data-ui3-business-sheet></span><div class="u-list" data-ui3-supply="supplier-list">${rows}</div>`,
    actions:`<button type="button" class="u-btn primary" data-ui3-supply="back" data-id="${esc(storeID)}">戻る</button>`}));
}
function confirmSupplier(storeID,supplierID){
  const {g,money}=context;
  const store=(g.stores||[]).find(item=>item.id===storeID);
  const supplier=(supplyModule()?.SUPPLIERS||[]).find(item=>item.id===supplierID);
  if(!store||!supplier||!supplyTarget(store))return;
  const current=activeContract(g,storeID);
  if(current&&current.supplierID===supplierID)return runSupplier(storeID,supplierID);   // the engine only records the choice: no fee
  const fee=nf(supplier.contractFee),termination=current?nf(current.terminationFee):0,cash=nf(g.companyCash),after=cash-fee-termination;
  const facts=[{label:'契約料',value:money(fee)}];
  if(current)facts.push({label:'いまの契約の解約金',value:money(termination)});
  facts.push({label:'実行後の会社現金',value:money(after),tone:after<0?'down':undefined});
  show(modules.ui3.confirmSheet({title:`仕入先を${supplier.name}に変更`,subtitle:'会社の現金から払います。取り消せません。',facts,
    note:after<0?'会社の現金が足りないため、実行しても変更できません。':'',
    confirm:{label:'変更する',attributes:{'data-action':'supply-select-supplier','data-id':storeID,value:supplierID}}}));
}
// the existing action reads `el.value`: run it from a button that carries the value (the modal root's own delegated handler)
function runSupplier(storeID,supplierID){
  const root=modalRoot();
  if(!root)return;
  const probe=globalThis.document.createElement('button');
  probe.type='button';probe.hidden=true;probe.dataset.action='supply-select-supplier';probe.dataset.id=storeID;probe.value=supplierID;
  root.append(probe);
  try{probe.click();}finally{probe.remove();}
  scheduleStoreSheet(storeID);
}
let sheetTimer=0;
function scheduleStoreSheet(storeID){
  globalThis.clearTimeout(sheetTimer);
  sheetTimer=globalThis.setTimeout(()=>{if(context&&(context.g.stores||[]).some(item=>item.id===storeID))storeSheet(storeID);},40);
}

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
    +(rows.length?`<div class="u-list" data-ui3-business="store-actions">${rows.join('')}</div>`:'')
    +(supplyTarget(store)?supplySection(store):'');
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

const PRICE_FAR_RATIO=3;   // a store price 3 times the current one (or a third of it) is confirmed with a warning
function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target)return;
  // amount dialogs that spend company money: say what the number is (README 5.7)
  const spend=target.closest('[data-action="business-invest"]');
  if(spend&&!spend.disabled){
    const {compactYen}=modules.engine,business=modules.playerEngineBridge.getEngine().business(spend.dataset.id);
    modules.ui3.setAmountContext({unit:'円',wallet:'company',direction:'spend',
      confirm:value=>{
        const cash=Number(modules.playerEngineBridge.getEngine().g.companyCash),after=cash-value;
        return {title:`${business?.name||'事業'}に${compactYen(value)}を投資`,subtitle:'会社の現金から払います。取り消せません。',
          facts:[{label:'投資額',value:compactYen(value)},{label:'実行後の会社現金',value:compactYen(after),tone:after<0?'down':undefined}],
          note:[after<0?'会社の現金が足りません。エンジンが実行を断ります。':'',modules.ui3.reserveNote(after)].filter(Boolean).join(' '),confirmLabel:'投資する'};
      }});
  }
  const businessPrice=target.closest('[data-action="business-price"]');
  if(businessPrice&&!businessPrice.disabled)modules.ui3.setAmountContext({unit:'円',integer:true,note:'円未満は四捨五入して保存します。'});
  // a store's price is saved as whole yen (the sheet rounds and shows the rounded number); a price far from the current one is confirmed with a warning
  const storePrice=target.closest('[data-action="store-price"]');
  if(storePrice&&!storePrice.disabled){
    const instance=modules.playerEngineBridge.getEngine(),plan=instance.getStorePricingPlan?.(storePrice.dataset.id),compact=modules.engine.compactYen;
    const current=Number(plan?.effectivePrice)||0;
    modules.ui3.setAmountContext({unit:'円',integer:true,note:current>0?`いまの販売価格 ${compact(current)}（円未満は四捨五入して保存します）`:'円未満は四捨五入して保存します。',
      confirm:current>0?value=>{
        const ratio=value/current,far=ratio>=PRICE_FAR_RATIO||ratio<=1/PRICE_FAR_RATIO;
        return far?{title:'店舗価格を大きく変える',subtitle:`${compact(current)} → ${compact(value)}（${ratio>=1?`${ratio.toFixed(1)}倍`:`${(1/ratio).toFixed(1)}分の1`}）`,
          facts:[{label:'いまの価格',value:compact(current)},{label:'新しい価格',value:compact(value),tone:'down'},{label:'全社価格',value:compact(Number(plan.businessPrice)||0)}],
          note:'いまの価格の3倍以上、または3分の1以下です。客数が大きく変わる場合があります。取り消すには、もう一度価格を変えます。',confirmLabel:'この価格にする'}:null;
      }:undefined});
  }
  const recruit=target.closest('[data-action="recruit-franchise"]');
  if(recruit&&!recruit.disabled)modules.ui3.setAmountContext({unit:'店',unitPrice:1000000,wallet:'company',direction:'spend'});   // engine.recruitFranchise: 100万円 per store
  const supply=target.closest('[data-ui3-supply]');
  if(supply&&!supply.disabled&&context){
    const storeID=supply.dataset.id;
    switch(supply.dataset.ui3Supply){
      case 'suppliers':supplierSheet(storeID);break;
      case 'supplier':confirmSupplier(storeID,supply.dataset.supplier);break;
      case 'back':storeSheet(storeID);break;
      case 'emergency':{const box=modalRoot()?.querySelector(`input[data-action="supply-emergency"][data-id="${storeID}"]`);if(box){box.click();scheduleStoreSheet(storeID);}break;}
      default:break;
    }
    return;
  }
  // a policy / safety-stock button runs its existing action (the modal root's delegated handler); the sheet is drawn again afterwards
  const setting=target.closest('#modal-root [data-action="supply-policy"],#modal-root [data-action="supply-safety"]');
  if(setting)scheduleStoreSheet(setting.dataset.id);
  if(target.closest('#modal-root [data-ui3-confirm][data-action="supply-select-supplier"]'))scheduleStoreSheet(target.closest('[data-action]').dataset.id);
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
