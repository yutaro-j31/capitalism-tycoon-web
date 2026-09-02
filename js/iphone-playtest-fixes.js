// iPhone physical-playtest remediation. UI-only compatibility layer; does not alter save schema or weekly simulation.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.playerEngineBridge?.getEngine)return;
if(modules.iphonePlaytestFixes)return;
const state={selectedStoreID:null,storeTab:'overview',mapZoom:1,mapFilters:{store:true,tenant:true,office:true,competitor:true,property:true},mapPanel:null,scheduled:false};
const esc=value=>String(value??'').replace(/[&<>\'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const engine=()=>modules.playerEngineBridge.getEngine?.()||null;
const game=()=>engine()?.g||null;
const money=value=>modules.engine?.compactYen?modules.engine.compactYen(finite(value)):`${Math.round(finite(value)).toLocaleString('ja-JP')}円`;
const pct=value=>`${(finite(value)*100).toFixed(1)}%`;
const activeTab=()=>game()?.selectedTab||document.querySelector('.tabs .active')?.dataset?.tab||'home';
function toast(message,severity='info'){
 const root=document.getElementById('toast-root');if(!root)return;
 const node=document.createElement('div');node.className=`toast ${severity}`;node.textContent=message;root.appendChild(node);
 requestAnimationFrame(()=>node.classList.add('show'));setTimeout(()=>{node.classList.remove('show');setTimeout(()=>node.remove(),250)},3200);
}
function schedule(){const registry=modules.uiEnhancerRegistry;if(registry?.runUIEnhancers)return registry.runUIEnhancers();enhance();return true;}
function parseAmount(value){const digits=String(value??'').replace(/[^0-9]/g,'');return digits?Number(digits):0;}
function moneyContext(action,id,kind){
 const e=engine(),g=e?.g;if(!e||!g)return null;
 if(action==='business-invest')return {title:'事業投資',defaultValue:1_000_000,max:Math.max(0,g.companyCash),availableLabel:'会社現金',available:g.companyCash,submitLabel:'投資を実行',execute:value=>e.investBusiness(id,kind,value),previewLabel:'投資後会社現金',preview:value=>g.companyCash-value};
 if(action==='borrow-company'){const limit=Math.max(0,finite(e.companyCreditLimit?.())),available=Math.max(0,limit-finite(g.companyDebt));return {title:'会社借入',defaultValue:Math.min(1_000_000,available)||available,max:available,availableLabel:'利用可能枠',available,submitLabel:'借入を実行',execute:value=>e.borrow(value,'company'),previewLabel:'借入後残高',preview:value=>g.companyDebt+value,extra:`適用金利 ${pct(e.companyBorrowRate?.())}・借入限度額 ${money(limit)}`};}
 if(action==='repay-company')return {title:'会社返済',defaultValue:Math.min(g.companyDebt,g.companyCash,1_000_000),max:Math.max(0,Math.min(g.companyDebt,g.companyCash)),availableLabel:'返済可能額',available:Math.max(0,Math.min(g.companyDebt,g.companyCash)),submitLabel:'返済を実行',execute:value=>e.repay(value,'company'),previewLabel:'返済後残高',preview:value=>g.companyDebt-value};
 if(action==='borrow-personal'){const limit=Math.max(0,finite(e.personalCreditLimit?.())),available=Math.max(0,limit-finite(g.personalDebt));return {title:'個人借入',defaultValue:Math.min(500_000,available)||available,max:available,availableLabel:'利用可能枠',available,submitLabel:'借入を実行',execute:value=>e.borrow(value,'personal'),previewLabel:'借入後残高',preview:value=>g.personalDebt+value,extra:`適用金利 ${pct(e.personalBorrowRate?.())}`};}
 if(action==='repay-personal')return {title:'個人返済',defaultValue:Math.min(g.personalDebt,g.personalCash,500_000),max:Math.max(0,Math.min(g.personalDebt,g.personalCash)),availableLabel:'返済可能額',available:Math.max(0,Math.min(g.personalDebt,g.personalCash)),submitLabel:'返済を実行',execute:value=>e.repay(value,'personal'),previewLabel:'返済後残高',preview:value=>g.personalDebt-value};
 return null;
}
function openMoneyModal(context){
 const root=document.getElementById('modal-root');if(!root||!context)return false;
 const initial=Math.max(0,Math.floor(finite(context.defaultValue)));
 root.innerHTML=`<div class="modal-backdrop iphone-money-backdrop"><form class="modal iphone-money-modal" id="iphone-money-form" role="dialog" aria-modal="true" aria-labelledby="iphone-money-title"><h2 id="iphone-money-title">${esc(context.title)}</h2><p class="iphone-money-summary"><span>${esc(context.availableLabel)}</span><strong>${esc(money(context.available))}</strong></p>${context.extra?`<p class="muted">${esc(context.extra)}</p>`:''}<label class="field"><span>金額（円）</span><input id="iphone-money-input" type="text" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" autocomplete="off" value="${initial}" aria-describedby="iphone-money-error iphone-money-preview"></label><div class="iphone-quick-amounts" aria-label="金額のクイック入力"><button type="button" data-iphone-quick="1000000">100万円</button><button type="button" data-iphone-quick="5000000">500万円</button><button type="button" data-iphone-quick="half">半分</button><button type="button" data-iphone-quick="max">全額</button></div><p id="iphone-money-preview" class="iphone-money-preview" aria-live="polite"></p><p id="iphone-money-error" class="danger" aria-live="assertive"></p><div class="modal-actions"><button class="btn ghost" type="button" data-iphone-money-cancel>キャンセル</button><button class="btn primary" type="submit">${esc(context.submitLabel||'実行')}</button></div></form></div>`;
 const input=root.querySelector('#iphone-money-input'),form=root.querySelector('#iphone-money-form'),error=root.querySelector('#iphone-money-error'),preview=root.querySelector('#iphone-money-preview');
 const refresh=()=>{const value=parseAmount(input.value);preview.textContent=`${context.previewLabel}: ${money(context.preview(value))}`;error.textContent=value<=0?'1円以上を入力してください。':value>context.max?`上限は${money(context.max)}です。`:'';};
 root.querySelector('[data-iphone-money-cancel]').addEventListener('click',()=>{root.innerHTML='';});
 root.querySelectorAll('[data-iphone-quick]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.iphoneQuick;const value=key==='max'?context.max:key==='half'?Math.floor(context.max/2):Number(key);input.value=String(Math.max(0,Math.floor(value)));input.focus({preventScroll:true});input.select?.();refresh();}));
 input.addEventListener('input',()=>{const digits=input.value.replace(/[^0-9]/g,'');if(input.value!==digits)input.value=digits;refresh();});
 form.addEventListener('submit',event=>{event.preventDefault();const value=parseAmount(input.value);if(value<=0||value>context.max){refresh();input.focus({preventScroll:true});return;}try{const result=context.execute(value);if(result===false)throw new Error('操作を実行できませんでした。');root.innerHTML='';schedule();}catch(err){error.textContent=err?.message||String(err);input.focus({preventScroll:true});}});
 refresh();input.focus({preventScroll:true});input.select?.();return true;
}
function interceptMoney(event){const target=event.target?.closest?.('[data-action]');if(!target)return false;const action=target.dataset.action;if(!['business-invest','borrow-company','repay-company','borrow-personal','repay-personal'].includes(action))return false;const context=moneyContext(action,target.dataset.id,target.dataset.kind);if(!context)return false;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();openMoneyModal(context);return true;}
function stableHash(text){let value=2166136261;for(const char of String(text)){value^=char.codePointAt(0);value=Math.imul(value,16777619);}return value>>>0;}
function markerPosition(key,index){const hash=stableHash(key);return {x:10+((hash+index*17)%80),y:16+(((hash>>>8)+index*23)%68)};}
function positionsCollide(a,b){return Math.abs(a.x-b.x)<12&&Math.abs(a.y-b.y)<14;}
function readMarkerPercent(el,prop){const value=parseFloat(el.style.getPropertyValue(prop));return Number.isFinite(value)?value:null;}
// Grid spacing (13 on x, 15 on y) is deliberately wider than positionsCollide's own
// threshold (12,14) so no two grid cells can collide with each other -- only with
// markers already on the map. Candidates are tried nearest-to-the-preferred-spot
// first so a nudge stays visually close to where the deterministic hash wanted it.
const MARKER_GRID_X=[14,27,40,53,66,79];
const MARKER_GRID_Y=[20,35,50,65,80];
function findClearMarkerPosition(key,baseIndex,occupied){
 const preferred=markerPosition(key,baseIndex);
 if(!occupied.some(spot=>positionsCollide(preferred,spot)))return preferred;
 const candidates=[];
 for(const x of MARKER_GRID_X)for(const y of MARKER_GRID_Y)candidates.push({x,y});
 candidates.sort((a,b)=>((a.x-preferred.x)**2+(a.y-preferred.y)**2)-((b.x-preferred.x)**2+(b.y-preferred.y)**2));
 for(const candidate of candidates){
  if(!occupied.some(spot=>positionsCollide(candidate,spot)))return candidate;
 }
 return preferred;
}
function ensureMapChrome(){
 if(activeTab()!=='map')return;const g=game(),screen=document.getElementById('screen'),stage=screen?.querySelector('.d-map-stage');if(!g||!screen||!stage)return;
 const original=screen.querySelector('.d-map-directory select[data-bind="selectedPref"]');const current=original?.value||g.selectedPref||g.founderHomePrefID;
 const mapKey=[current,state.mapZoom,state.mapPanel,Object.entries(state.mapFilters).map(row=>row.join(':')).join(','),g.week,(g.stores||[]).length,(g.properties||[]).length,(g.competitorStates||[]).length].join('|');
 if(stage.dataset.iphoneMapKey===mapKey)return;
 screen.classList.add('iphone-map-enhanced');
 let bar=stage.querySelector('.iphone-map-nav');if(!bar){bar=document.createElement('div');bar.className='iphone-map-nav';stage.appendChild(bar);}
 bar.innerHTML=`<label><span>都道府県</span><select data-iphone-pref>${(g.prefs||[]).map(pref=>`<option value="${esc(pref.id)}" ${String(pref.id)===String(current)?'selected':''}>${esc(pref.name)}</option>`).join('')}</select></label><button type="button" data-iphone-map-action="view">${state.mapPanel==='list'?'都市ビュー':'一覧ビュー'}</button>`;
 bar.querySelector('[data-iphone-pref]').addEventListener('change',event=>{const source=screen.querySelector('.d-map-directory select[data-bind="selectedPref"]');if(!source){toast('都道府県選択を読み込めませんでした。','error');return;}source.value=event.target.value;source.dispatchEvent(new Event('change',{bubbles:true}));});
 const oldTools=stage.querySelector('.d-map-tools');if(oldTools)oldTools.hidden=true;
 let tools=stage.querySelector('.iphone-map-tools');if(!tools){tools=document.createElement('div');tools.className='iphone-map-tools';stage.appendChild(tools);}
 tools.innerHTML=`<button type="button" data-iphone-map-action="filter" aria-expanded="${state.mapPanel==='filter'}">☷<small>フィルター</small></button><button type="button" data-iphone-map-action="legend" aria-expanded="${state.mapPanel==='legend'}">⌕<small>凡例</small></button><button type="button" data-iphone-map-action="zoom-out" aria-label="地図を縮小">−</button><button type="button" data-iphone-map-action="zoom-reset" aria-label="倍率をリセット">${Math.round(state.mapZoom*100)}%</button><button type="button" data-iphone-map-action="zoom-in" aria-label="地図を拡大">＋</button>`;
 let panel=stage.querySelector('.iphone-map-popover');if(!panel){panel=document.createElement('div');panel.className='iphone-map-popover';stage.appendChild(panel);}
 panel.hidden=!['filter','legend'].includes(state.mapPanel);
 if(state.mapPanel==='filter')panel.innerHTML=`<strong>表示する拠点</strong>${[['store','自社店舗'],['tenant','空きテナント'],['office','オフィス'],['competitor','競合店舗'],['property','不動産']].map(([id,label])=>`<label><input type="checkbox" data-iphone-filter="${id}" ${state.mapFilters[id]?'checked':''}>${label}</label>`).join('')}`;
 if(state.mapPanel==='legend')panel.innerHTML='<strong>凡例</strong><p><i class="legend store"></i>自社店舗</p><p><i class="legend tenant"></i>空きテナント</p><p><i class="legend office"></i>オフィス</p><p><i class="legend competitor"></i>競合</p><p><i class="legend property"></i>不動産</p>';
 panel.querySelectorAll('[data-iphone-filter]').forEach(box=>box.addEventListener('change',()=>{state.mapFilters[box.dataset.iphoneFilter]=box.checked;applyMapFilters(stage);}));
 stage.style.setProperty('--iphone-map-zoom',String(state.mapZoom));
 ensureSyntheticMapEntities(stage,g,current);applyMapFilters(stage);ensureCityDetail(stage,g,current);stage.dataset.iphoneMapKey=mapKey;
}
function ensureCityDetail(stage,g,prefID){
 let layer=stage.querySelector('.iphone-city-detail');if(!layer){layer=document.createElement('div');layer.className='iphone-city-detail';stage.appendChild(layer);}
 const pref=(g.prefs||[]).find(item=>String(item.id)===String(prefID));
 layer.innerHTML=`<span class="district commerce">商業地区</span><span class="district office">オフィス街</span><span class="district residential">住宅地区</span><span class="district park">中央公園</span><span class="city-label">${esc(pref?.name||'選択地域')}中央</span>${Array.from({length:18},(_,index)=>{const pos=markerPosition(`building:${prefID}:${index}`,index);const height=24+(stableHash(`${prefID}:${index}`)%58);return `<i style="--bx:${pos.x}%;--by:${pos.y}%;--bh:${height}px"></i>`;}).join('')}`;
}
function ensureSyntheticMapEntities(stage,g,prefID){
 stage.querySelectorAll('.iphone-synthetic-marker').forEach(node=>node.remove());
 // Properties are NOT synthesised here: js/d-ui-shell.js's own mapEntities() already
 // renders every unowned property in this prefecture as a canonical .d-map-marker.realestate
 // button (see realEstateButtons there). Adding a second, independently-positioned
 // .iphone-synthetic-marker.property for the same property id duplicated every listing and,
 // since the two systems use different position formulas, could land the duplicate directly
 // on top of the real marker -- silently blocking clicks on it (and on any other .d-map-marker
 // it happened to cover). Competitors have no such canonical marker elsewhere, so they still
 // get a synthetic one, now placed clear of every existing .d-map-marker.
 const occupied=Array.from(stage.querySelectorAll('.d-map-marker')).map(marker=>({x:readMarkerPercent(marker,'--x'),y:readMarkerPercent(marker,'--y')})).filter(spot=>spot.x!==null&&spot.y!==null);
 const competitors=(g.competitorStates||[]).flatMap(comp=>(comp.marketPresence||[]).filter(p=>p.active&&(!p.prefID||p.prefID===prefID)).slice(0,1).map(p=>({comp,p}))).slice(0,3);
 competitors.forEach(({comp},index)=>{const pos=findClearMarkerPosition(`competitor:${comp.id}`,index+30,occupied);occupied.push(pos);stage.insertAdjacentHTML('beforeend',`<button type="button" class="iphone-synthetic-marker competitor" style="--x:${pos.x}%;--y:${pos.y}%" data-iphone-map-entity="competitor" data-id="${esc(comp.id)}" aria-label="${esc(comp.name)}"><span>◆</span></button>`);});
 stage.querySelectorAll('.d-map-marker').forEach(marker=>{marker.dataset.iphoneKind=marker.classList.contains('tenant')?'tenant':marker.classList.contains('office')?'office':'store';});
}
function applyMapFilters(stage){
 stage.querySelectorAll('[data-iphone-kind]').forEach(marker=>{marker.hidden=!state.mapFilters[marker.dataset.iphoneKind];});
 stage.querySelectorAll('[data-iphone-map-entity]').forEach(marker=>{marker.hidden=!state.mapFilters[marker.dataset.iphoneMapEntity];});
}
function handleMapAction(event){const button=event.target?.closest?.('[data-iphone-map-action]');if(!button)return false;event.preventDefault();const action=button.dataset.iphoneMapAction;const screen=document.getElementById('screen'),stage=screen?.querySelector('.d-map-stage');if(!stage)return true;
 if(action==='view'){const directory=screen.querySelector('.d-map-directory');state.mapPanel=state.mapPanel==='list'?null:'list';if(directory){directory.open=state.mapPanel==='list';if(directory.open)directory.scrollIntoView({block:'start',behavior:'smooth'});}schedule();return true;}
 if(action==='filter'||action==='legend'){state.mapPanel=state.mapPanel===action?null:action;schedule();return true;}
 if(action==='zoom-in')state.mapZoom=clamp(Math.round((state.mapZoom+.1)*10)/10,.8,1.4);
 if(action==='zoom-out')state.mapZoom=clamp(Math.round((state.mapZoom-.1)*10)/10,.8,1.4);
 if(action==='zoom-reset')state.mapZoom=1;schedule();return true;
}
function handleSyntheticMarker(event){const marker=event.target?.closest?.('[data-iphone-map-entity]');if(!marker)return false;event.preventDefault();const g=game(),panel=document.querySelector('.d-context-panel');if(!g||!panel)return true;const type=marker.dataset.iphoneMapEntity,id=marker.dataset.id;
 if(type==='property'){const item=(g.properties||[]).find(row=>String(row.id)===String(id));panel.innerHTML=`<header><div><span>●</span><h2>${esc(item?.name||'不動産')}</h2></div></header><div class="iphone-entity-sheet"><strong>不動産候補</strong><p>${esc(item?.kind||'物件')}・評価額 ${money(item?.value||item?.price)}</p><p>想定賃料 ${money(item?.rentIncome)}/週</p><button class="btn primary wide" type="button" data-iphone-go-tab="assets">資産・不動産画面へ</button></div>`;}
 if(type==='competitor'){const comp=(g.competitorStates||[]).find(row=>String(row.id)===String(id));panel.innerHTML=`<header><div><span>●</span><h2>${esc(comp?.name||'競合企業')}</h2></div></header><div class="iphone-entity-sheet"><strong>${esc(comp?.status||'競合')}</strong><p>現金余力 ${money(comp?.cash)}・負債 ${money(comp?.debt)}</p><p>週次利益 ${money(comp?.weeklyProfit)}</p><button class="btn primary wide" type="button" data-iphone-go-tab="rivals">競合分析画面へ</button></div>`;}
 panel.scrollIntoView({block:'nearest'});return true;
}
function storeData(store){const g=game(),business=engine()?.business?.(store.businessID)||{},market=store.marketResult||g?.marketResultsByStoreID?.[store.id]||{},supply=g?.supplyResultsByStoreID?.[store.id]||{},tenant=(g?.tenants||[]).find(row=>row.id===store.tenantID)||{};const sales=finite(market.revenue,finite(store.lastSales));const profit=finite(store.lastProfit,finite(market.contributionMargin));const rent=finite(store.rent,finite(store.weeklyRent,finite(tenant.rent)));const payroll=finite(store.payroll,finite(store.weeklyPayroll));const variable=finite(market.variableCost,Math.max(0,sales-profit-rent-payroll));const reasons=Array.isArray(market.reasons)?market.reasons:[];return {g,business,market,supply,sales,profit,rent,payroll,variable,reasons,inventory:finite(store.inventory,finite(g?.inventoryByStoreID?.[store.id]?.quantity)),demand:finite(store.weeklyDemand,finite(market.demand)),lostDemand:finite(market.lostDemand),store};}
function causeRows(data){const rows=[],sales=Math.max(1,data.sales);const reasonMap=new Map(data.reasons.map(row=>[row.label,finite(row.value)]));
 if(data.inventory<Math.max(1,data.demand*.5)||finite(data.store.stockoutRisk)>0||finite(data.store.stockoutWeeks)>0)rows.push({score:100,label:'欠品・在庫不足',detail:`在庫 ${data.inventory.toLocaleString('ja-JP')} / 需要目安 ${data.demand.toLocaleString('ja-JP')}`,tab:'supply'});
 if(data.lostDemand>0)rows.push({score:90,label:'販売能力不足',detail:`機会損失 ${data.lostDemand.toLocaleString('ja-JP')}人分`,tab:'overview'});
 if(data.variable/sales>.58)rows.push({score:80,label:'原価率が高い',detail:`変動費率 ${(data.variable/sales*100).toFixed(1)}%`,tab:'supply'});
 if(data.rent/sales>.22)rows.push({score:70,label:'家賃負担が重い',detail:`売上比 ${(data.rent/sales*100).toFixed(1)}%`,tab:'finance'});
 if(data.payroll>0&&data.payroll/sales>.32)rows.push({score:65,label:'人件費負担が重い',detail:`売上比 ${(data.payroll/sales*100).toFixed(1)}%`,tab:'staff'});
 if(reasonMap.get('価格競争力')<-.05)rows.push({score:60,label:'価格競争力が低い',detail:'競合との価格差が需要を押し下げています。',tab:'product'});
 if(reasonMap.get('競合')<-.05)rows.push({score:55,label:'競合が強い',detail:'同一商圏の競合が需要を奪っています。',tab:'product'});
 if(reasonMap.get('品質')<-.05||reasonMap.get('ブランド・広告認知')<-.05)rows.push({score:50,label:'品質・認知が不足',detail:'商品品質またはブランド認知が需要を押し下げています。',tab:'product'});
 if(!rows.length&&data.profit<0)rows.push({score:40,label:'売上が固定費を吸収できていない',detail:`売上 ${money(data.sales)}に対し店舗利益 ${money(data.profit)}`,tab:'finance'});
 return rows.sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label,'ja')).slice(0,3);
}
function ensureStoreCockpit(){
 if(activeTab()!=='business')return;const e=engine(),g=e?.g,screen=document.getElementById('screen');if(!g||!screen)return;const stores=(g.stores||[]).filter(store=>store.status==='open');if(!stores.length)return;
 if(!state.selectedStoreID||!stores.some(store=>String(store.id)===String(state.selectedStoreID)))state.selectedStoreID=stores[0].id;
 const store=stores.find(row=>String(row.id)===String(state.selectedStoreID)),data=storeData(store),causes=causeRows(data);const cockpitKey=[store.id,state.storeTab,g.week,data.sales,data.profit,data.inventory,data.demand,data.lostDemand].join('|');
 let cockpit=screen.querySelector('#iphone-store-cockpit');if(!cockpit){cockpit=document.createElement('section');cockpit.id='iphone-store-cockpit';cockpit.className='card iphone-store-cockpit';screen.prepend(cockpit);}else if(cockpit.dataset.renderKey===cockpitKey)return;
 const tabs=[['overview','概要'],['finance','財務'],['product','商品・価格'],['supply','在庫・仕入'],['staff','人員・運営']];
 const breakEven=Math.max(0,data.sales-data.profit);let body='';
 if(state.storeTab==='finance')body=`<div class="iphone-store-kpis"><div><span>売上</span><strong>${money(data.sales)}</strong></div><div><span>変動費</span><strong>${money(data.variable)}</strong></div><div><span>人件費</span><strong>${data.payroll?money(data.payroll):'—'}</strong></div><div><span>家賃</span><strong>${data.rent?money(data.rent):'—'}</strong></div><div><span>店舗利益</span><strong class="${data.profit<0?'down':'up'}">${money(data.profit)}</strong></div><div><span>損益分岐売上</span><strong>${money(breakEven)}</strong></div></div><div class="iphone-causes"><h4>赤字・低収益の主因</h4>${causes.map(row=>`<article><div><strong>${esc(row.label)}</strong><small>${esc(row.detail)}</small></div><button type="button" data-iphone-store-tab="${row.tab}">対処を見る</button></article>`).join('')||'<p>重大な赤字要因は検出されていません。</p>'}</div>`;
 if(state.storeTab==='supply')body=`<div class="iphone-store-kpis"><div><span>現在庫</span><strong>${data.inventory.toLocaleString('ja-JP')}</strong></div><div><span>需要目安</span><strong>${data.demand.toLocaleString('ja-JP')}</strong></div><div><span>機会損失</span><strong>${data.lostDemand.toLocaleString('ja-JP')}</strong></div><div><span>供給状態</span><strong>${esc(data.supply.status||data.supply.result||'確認が必要')}</strong></div></div><p>在庫設定、仕入先、安全在庫、緊急調達は下の対象店舗カードで変更します。</p><button class="btn primary wide" type="button" data-iphone-scroll-supply>この店舗の在庫設定を開く</button>`;
 if(state.storeTab==='product')body=`<div class="iphone-store-kpis"><div><span>販売価格</span><strong>${money(store.price??data.business.price)}</strong></div><div><span>品質</span><strong>${finite(store.quality,data.business.quality).toFixed(0)}</strong></div><div><span>ブランド</span><strong>${finite(store.brand,data.business.brand).toFixed(0)}</strong></div><div><span>市場シェア</span><strong>${pct(data.market.marketShare)}</strong></div></div><div class="iphone-action-grid"><button class="btn primary" type="button" data-iphone-price>価格を変更</button><button class="btn secondary" type="button" data-iphone-invest>事業投資</button></div>`;
 if(state.storeTab==='staff')body=`<div class="iphone-store-kpis"><div><span>スタッフ</span><strong>${finite(store.staffCount,store.employees?.length).toFixed(0)}人</strong></div><div><span>運営効率</span><strong>${finite(store.efficiency,data.business.efficiency).toFixed(0)}</strong></div><div><span>サービス品質</span><strong>${finite(store.quality,data.business.quality).toFixed(0)}</strong></div><div><span>店長</span><strong>${esc(store.managerName||store.manager?.name||'未配置')}</strong></div></div><button class="btn primary wide" type="button" data-iphone-go-tab="founder">採用・人材管理を開く</button>`;
 if(state.storeTab==='overview')body=`<div class="iphone-store-kpis"><div><span>今週売上</span><strong>${money(data.sales)}</strong></div><div><span>今週利益</span><strong class="${data.profit<0?'down':'up'}">${money(data.profit)}</strong></div><div><span>来客・販売数</span><strong>${finite(data.market.unitsSold,store.lastCustomers).toLocaleString('ja-JP')}</strong></div><div><span>満足度</span><strong>${finite(data.market.customerSatisfaction,store.satisfaction).toFixed(1)}</strong></div></div>${data.profit<0?`<div class="iphone-causes"><h4>最初に確認すること</h4>${causes.map(row=>`<article><div><strong>${esc(row.label)}</strong><small>${esc(row.detail)}</small></div><button type="button" data-iphone-store-tab="${row.tab}">改善へ</button></article>`).join('')}</div>`:'<p class="up">この店舗は直近週で黒字です。</p>'}`;
 cockpit.innerHTML=`<div class="card-head"><div><p class="eyebrow">店舗経営コックピット</p><h2>${esc(store.name)}</h2><p>原因の確認から改善操作まで、この店舗を基準に表示します。</p></div><label><span>店舗</span><select data-iphone-store-select>${stores.map(row=>`<option value="${esc(row.id)}" ${String(row.id)===String(store.id)?'selected':''}>${esc(row.name)}</option>`).join('')}</select></label></div><div class="iphone-store-tabs" role="tablist">${tabs.map(([id,label])=>`<button type="button" role="tab" aria-selected="${id===state.storeTab}" data-iphone-store-tab="${id}">${label}</button>`).join('')}</div><div class="card-body">${body}</div>`;
 cockpit.dataset.storeId=String(store.id);cockpit.dataset.storeTab=state.storeTab;cockpit.dataset.renderKey=cockpitKey;
}
function handleStoreAction(event){
 const select=event.target?.closest?.('[data-iphone-store-select]');if(select){state.selectedStoreID=select.value;state.storeTab='overview';schedule();return true;}
 const tab=event.target?.closest?.('[data-iphone-store-tab]');if(tab){event.preventDefault();state.storeTab=tab.dataset.iphoneStoreTab;schedule();return true;}
 if(event.target?.closest?.('[data-iphone-price]')){event.preventDefault();const store=(game()?.stores||[]).find(row=>String(row.id)===String(state.selectedStoreID));const value=store?.price??engine()?.business?.(store?.businessID)?.price??1000;openMoneyModal({title:'価格変更',defaultValue:value,max:1_000_000,availableLabel:'現在価格',available:value,submitLabel:'価格を変更',execute:amount=>engine()?.adjustPrice(store.businessID,amount),previewLabel:'新しい価格',preview:amount=>amount});return true;}
 if(event.target?.closest?.('[data-iphone-invest]')){event.preventDefault();const store=(game()?.stores||[]).find(row=>String(row.id)===String(state.selectedStoreID));openMoneyModal(moneyContext('business-invest',store?.businessID,'quality'));return true;}
 if(event.target?.closest?.('[data-iphone-scroll-supply]')){event.preventDefault();const target=[...document.querySelectorAll('[data-supply-store-card],.supply-store-card,.item')].find(node=>node.textContent?.includes((game()?.stores||[]).find(row=>String(row.id)===String(state.selectedStoreID))?.name||'__none__'));if(target){target.scrollIntoView({block:'start',behavior:'smooth'});target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}else toast('対象店舗の在庫設定カードを表示できませんでした。','error');return true;}
 return false;
}
function selectStoreFromContext(event){const button=event.target?.closest?.('.d-context-panel [data-action="tab"][data-tab="business"],.d-context-panel [data-d-ui-tab="business"]');if(!button)return false;const marker=document.querySelector('.d-map-marker.selected[data-d-ui-marker^="store:"]');if(marker)state.selectedStoreID=marker.dataset.dUiMarker.slice(6);state.storeTab='overview';return false;}
function secretaryContext(event){const button=event.target?.closest?.('.secretary-item [data-action="secretary-jump"]');if(!button)return false;const title=button.closest('.secretary-item')?.querySelector('h3')?.textContent||'',g=game();if(!g)return false;if(title.includes('在庫切れ')){const store=(g.stores||[]).find(s=>finite(s.stockoutWeeks||s.stockoutRisk||s.inventoryShortage)>0||finite(s.inventory)<Math.max(1,finite(s.weeklyDemand))*.5);if(store){state.selectedStoreID=store.id;state.storeTab='supply';button.dataset.tab='business';button.dataset.focus='#iphone-store-cockpit';setTimeout(()=>document.getElementById('iphone-store-cockpit')?.scrollIntoView({block:'start'}),80);}}if(title.includes('赤字店舗')){const store=(g.stores||[]).filter(s=>finite(s.lastProfit)<0).sort((a,b)=>finite(a.lastProfit)-finite(b.lastProfit))[0];if(store){state.selectedStoreID=store.id;state.storeTab='finance';button.dataset.tab='business';button.dataset.focus='#iphone-store-cockpit';setTimeout(()=>document.getElementById('iphone-store-cockpit')?.scrollIntoView({block:'start'}),80);}}return false;}
function ensureDebtLedger(){if(activeTab()!=='bank')return;const g=game(),screen=document.getElementById('screen');if(!g||!screen||screen.querySelector('#iphone-debt-ledger'))return;const loans=(g.finance?.loans||[]).filter(loan=>loan.status!=='closed'&&finite(loan.outstandingPrincipal)>0);const label=loan=>{const id=String(loan.loanID||loan.id||'');if(id.includes('emergency')||id.includes('bridge'))return '緊急ブリッジローン';if(id==='legacy-company-debt')return '既存借入（移行データ）';if(id.includes('ma'))return 'M&A関連ローン';return 'ゲーム内メインバンク';};const rows=loans.length?loans.map(loan=>`<article class="iphone-loan"><header><div><span>借入先</span><strong>${esc(label(loan))}</strong></div><b>${money(loan.outstandingPrincipal)}</b></header><div><span>当初元本 <strong>${money(loan.principal)}</strong></span><span>金利 <strong>${pct(loan.interestRate)}</strong></span><span>返済方法 <strong>${esc(loan.repaymentMethod||'手動返済')}</strong></span><span>週次元本 <strong>${money(loan.weeklyPrincipalPayment)}</strong></span><span>次回返済 <strong>${loan.nextPaymentWeek?`第${loan.nextPaymentWeek}週`:'随時'}</strong></span><span>残存期間 <strong>${finite(loan.remainingWeeks)>0?`${finite(loan.remainingWeeks)}週`:'定めなし'}</strong></span></div></article>`).join(''):`<article class="iphone-loan"><header><div><span>借入先</span><strong>${g.companyDebt>0?'ゲーム内メインバンク':'会社借入なし'}</strong></div><b>${money(g.companyDebt)}</b></header><p>${g.companyDebt>0?'個別返済条件のない既存借入です。銀行画面から返済できます。':'現在の会社借入はありません。'}</p></article>`;const card=document.createElement('section');card.id='iphone-debt-ledger';card.className='card iphone-debt-ledger';card.innerHTML=`<div class="card-head"><div><h2>会社借入の内訳</h2><p>会社負債と個人負債を分け、借入先と返済条件を表示します。</p></div></div><div class="card-body">${rows}<article class="iphone-personal-debt"><span>個人負債</span><strong>${money(g.personalDebt)}</strong><small>会社借入とは別管理です。</small></article></div>`;screen.appendChild(card);}
function ensureCrisisPresentation(){const panel=document.getElementById('player-crisis-panel'),screen=document.getElementById('screen');if(!screen)return;if(activeTab()==='home'){panel?.removeAttribute('hidden');screen.querySelector('#iphone-crisis-compact')?.remove();return;}if(!panel)return;panel.hidden=true;let compact=screen.querySelector('#iphone-crisis-compact');if(!compact){compact=document.createElement('section');compact.id='iphone-crisis-compact';compact.className='iphone-crisis-compact';screen.prepend(compact);}const g=game(),cash=finite(g?.companyCash),reserve=Math.max(0,finite(g?.playerCrisis?.reserveThreshold,g?.crisis?.reserveThreshold));const compactKey=[cash,reserve,g?.playerCrisis?.status,g?.crisis?.status].join('|');if(compact.dataset.renderKey===compactKey)return;compact.innerHTML=`<div><strong>資金繰り注意</strong><span>会社現金 ${money(cash)}${reserve?`・必要準備 ${money(reserve)}`:''}</span></div><button type="button" data-iphone-go-tab="home">危機対応を開く</button>`;compact.dataset.renderKey=compactKey;}
function goTab(tab){const source=[...document.querySelectorAll('.d-source-tabs [data-action="tab"],#d-ui-sidebar [data-d-ui-tab],#d-ui-command-menu [data-d-ui-tab]')].find(node=>(node.dataset.tab||node.dataset.dUiTab)===tab);if(source){source.click();return true;}const g=game();if(g){g.selectedTab=tab;document.querySelector(`.tabs [data-tab="${tab}"]`)?.click();return true;}return false;}
function handleGoTab(event){const button=event.target?.closest?.('[data-iphone-go-tab]');if(!button)return false;event.preventDefault();if(!goTab(button.dataset.iphoneGoTab))toast('画面を開けませんでした。','error');return true;}
function enhanceBrowserMode(){const ios=/iP(hone|od|ad)/.test(navigator.userAgent);document.body.classList.toggle('iphone-browser-mode',ios&&!navigator.standalone);document.body.classList.toggle('standalone-mode',Boolean(navigator.standalone));}
function enhance(){enhanceBrowserMode();ensureCrisisPresentation();ensureMapChrome();ensureStoreCockpit();ensureDebtLedger();}
function handleClick(event){if(interceptMoney(event))return;secretaryContext(event);selectStoreFromContext(event);if(handleMapAction(event))return;if(handleSyntheticMarker(event))return;if(handleStoreAction(event))return;if(handleGoTab(event))return;const marker=event.target?.closest?.('.d-map-marker[data-d-ui-marker^="store:"]');if(marker)state.selectedStoreID=marker.dataset.dUiMarker.slice(6);}
function install(){document.addEventListener('click',handleClick,true);document.addEventListener('change',handleStoreAction,true);const registry=modules.uiEnhancerRegistry;if(registry?.registerUIEnhancer)registry.registerUIEnhancer({id:'iphone-playtest-fixes',enhance});else enhance();globalThis.visualViewport?.addEventListener?.('resize',schedule);return true;}
modules.iphonePlaytestFixes=Object.freeze({state,parseAmount,moneyContext,causeRows,markerPosition,enhance,install,__installed:true});install();
})();
