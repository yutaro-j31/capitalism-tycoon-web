// Phase 5B-5B-2: read-only competitor dashboard renderer and app integration.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-dashboard-ui.js.');
const modules=globalThis.__capitalismTycoonModules;
function registerEnhancer(definition){
 const registry=modules.uiEnhancerRegistry;
 if(registry?.registerUIEnhancer)return registry.registerUIEnhancer(definition);
 const key='__capitalismTycoonPendingUIEnhancers';
 const pending=Array.isArray(globalThis[key])?globalThis[key]:(globalThis[key]=[]);
 pending.push(definition);
 return definition;
}
function runEnhancers(fallback){const registry=modules.uiEnhancerRegistry;if(registry?.runUIEnhancers)return registry.runUIEnhancers();return typeof fallback==='function'?fallback():false;}
const competitor=modules.competitor;
if(!competitor?.dashboard?.__marketStatusNormalized)throw new Error('competitor-dashboard-status.js must be loaded before competitor-dashboard-ui.js.');
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before competitor-dashboard-ui.js.');
if(competitor.dashboardUI)throw new Error('competitor dashboard UI is already registered.');

const compactYen=modules.engine.compactYen||((value)=>`¥${Math.round(Number(value)||0).toLocaleString('ja-JP')}`);
const pct=modules.engine.pct||((value)=>`${((Number(value)||0)*100).toFixed(1)}%`);
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const list=value=>Array.isArray(value)?value:[];
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const statusClass=severity=>severity==='good'?'good':severity==='warning'||severity==='danger'?'warn':'';
const badge=(label,kind='')=>`<span class="badge ${kind}">${esc(label)}</span>`;
const stat=(label,value,sub='')=>`<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
const card=(title,body,subtitle='')=>`<section class="card"><div class="card-head"><div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div></div><div class="card-body">${body}</div></section>`;

const ENTRY_LABELS=Object.freeze({active:'営業中',planned:'出店準備',opening:'開業準備',failed:'出店失敗',exited:'撤退済み',inactive:'停止'});
const PROJECT_LABELS=Object.freeze({brandInvestment:'広告投資',qualityInvestment:'品質投資',capacityExpansion:'能力増強',marketEntry:'市場参入',marketExit:'市場撤退',turnaround:'事業再建',borrow:'借入'});
const CREDIT_LABELS=Object.freeze({normal:'通常',watch:'注意',restricted:'制限',default:'延滞',bankrupt:'倒産'});

function lookup(items,id){return list(items).find(row=>String(row?.id)===String(id));}
function marketName(state,market){const pref=lookup(state?.prefs,market.prefID),area=lookup(state?.areas,market.areaID);return pref?.name||area?.name||market.prefID||market.areaID||'不明市場';}
function operationLabels(row){const values=[...row.operations.projectTypes,...row.operations.actionTypes].filter(Boolean);return [...new Set(values)].map(value=>PROJECT_LABELS[value]||value);}
function marketRow(state,market){
 const label=ENTRY_LABELS[market.entryStatus]||market.entryStatus||'不明';
 return `<div class="item"><div><h3>${esc(marketName(state,market))} ${badge(label,market.active?'good':market.entryStatus==='failed'?'warn':'')}</h3><p>価格 ${compactYen(market.price)} · ${market.storeCount}店舗 · 稼働率 ${pct(market.utilization)} · シェア ${pct(market.marketShare)}</p></div><div class="item-metrics"><span>売上 ${compactYen(market.revenue)}</span><span>限界利益 ${compactYen(market.contributionMargin)}</span><span>失注 ${Math.round(finite(market.lostDemand)).toLocaleString('ja-JP')}</span></div></div>`;
}
function companyCard(state,row){
 const history4=row.history['4']||{},history13=row.history['13']||{};
 const canAcquire=['distressed','turnaround'].includes(row.status)&&row.active&&!row.acquiredByPlayer;
 const operations=operationLabels(row);
 const markets=row.markets.length?row.markets.map(market=>marketRow(state,market)).join(''):'<div class="empty">市場プレゼンスなし</div>';
 const statusBadges=`${badge(row.statusLabel,statusClass(row.severity))}${row.acquiredByPlayer?badge('買収済み','good'):''}${row.riskScore>=60?badge(`リスク ${row.riskScore.toFixed(0)}`,'warn'):badge(`リスク ${row.riskScore.toFixed(0)}`)}`;
 return card(row.name,`
  <div class="item-metrics">${statusBadges}<span>${esc(row.strategyName)}</span><span>競争圧力 ${row.counter.pricePressure.toFixed(1)}</span><span>強さ ${row.counter.strength.toFixed(0)}</span></div>
  <div class="kpi-grid mini">
   ${stat('現金',compactYen(row.financial.cash),`余力 ${row.credit.cashRunwayWeeks.toFixed(1)}週`)}
   ${stat('負債',compactYen(row.financial.debt),`与信枠 ${compactYen(row.credit.limit)}`)}
   ${stat('週次利益',compactYen(row.financial.profit),`利益率 ${pct(row.financial.profitMargin)}`)}
   ${stat('市場シェア',pct(row.marketSummary.averageShare),`${row.marketSummary.active}市場・${row.marketSummary.stores}店舗`)}
  </div>
  <div class="item"><div><h3>信用・資金繰り</h3><p>信用 ${row.credit.score.toFixed(0)}/100 · ${esc(CREDIT_LABELS[row.credit.status]||row.credit.status)} · レバレッジ ${pct(row.credit.leverage)} · 延滞 ${row.credit.missedPayments}回${row.credit.nextRepaymentWeek==null?'':` · 次回返済 第${row.credit.nextRepaymentWeek}週`}</p></div></div>
  <div class="item"><div><h3>進行中案件</h3><p>${operations.length?esc(operations.join('・')):'進行中案件なし'}${row.operations.turnaroundStatus?` · 再建 ${esc(row.operations.turnaroundStatus)}${row.operations.turnaroundTargetWeek==null?'':`（第${row.operations.turnaroundTargetWeek}週まで）`}`:''}</p></div><div class="item-metrics"><span>Project ${row.operations.pendingProjects}</span><span>Action ${row.operations.pendingActions}</span></div></div>
  <h3>市場別状況</h3>${markets}
  <div class="item"><div><h3>業績トレンド</h3><p>4週：利益 ${compactYen(history4.profit||0)}・利益率 ${pct(history4.profitMargin||0)} ／ 13週：利益 ${compactYen(history13.profit||0)}・利益率 ${pct(history13.profitMargin||0)}</p>${row.latestEvent?`<p>最新：${esc(row.latestEvent)}</p>`:''}</div></div>
  <div class="button-row">
   <button class="btn secondary small" data-action="respond-rival" data-id="${esc(row.competitorID)}" data-kind="ads" ${!row.active?'disabled':''}>広告防衛</button>
   <button class="btn secondary small" data-action="respond-rival" data-id="${esc(row.competitorID)}" data-kind="quality" ${!row.active?'disabled':''}>品質防衛</button>
   <button class="btn primary small" data-action="respond-rival" data-id="${esc(row.competitorID)}" data-kind="acquire" ${canAcquire?'':'disabled'}>買収</button>
  </div>
 `,`${row.businessID||'事業'} · 第${state.week}週`);
}
function legacyCard(state){
 const linked=new Set(list(state?.competitorStates).map(row=>row?.legacyCompetitorID).filter(Boolean));
 const rows=list(state?.competitors).filter(row=>row&&!linked.has(row.id)&&finite(row.stores)>0&&!String(row.areaID||'').startsWith('__'));
 if(!rows.length)return '';
 return card('その他業種の既存ライバル',rows.map(row=>`<article class="item"><div><h3>${esc(row.name||row.id)}</h3><p>${esc(lookup(state.businesses,row.businessID)?.name||row.businessID)} · ${esc(lookup(state.areas,row.areaID)?.name||row.areaID||'全国')} · 戦略「${esc(row.strategy||'標準')}」</p></div><div class="item-metrics"><span>${Math.max(0,Math.floor(finite(row.stores)))}店舗</span><span>現金 ${compactYen(row.cash)}</span><span>品質 ${finite(row.quality).toFixed(0)}</span><span>ブランド ${finite(row.brand).toFixed(0)}</span></div></article>`).join(''),`${rows.length}社`);
}
function eventCard(state){
 const events=list(state?.competitorEventLog).slice(0,30);
 const fallback=list(state?.competitorEvents).slice(-30).reverse().map(event=>typeof event==='string'?event:competitor.eventText?.(event)||event?.text||event?.message||'競合イベント');
 const rows=(events.length?events:fallback).map(value=>`<div class="news-line">${esc(value)}</div>`).join('');
 return card('競合イベント',rows||'<div class="empty">イベントなし</div>','直近30件');
}
function render(state){
 const dashboard=competitor.dashboard.buildDashboard(state);
 const summary=card('競合ダッシュボード',`<div class="kpi-grid">${stat('監視企業',`${dashboard.total}社`)}${stat('高リスク',`${dashboard.highRisk}社`)}${stat('危機・再建',`${dashboard.distressed}社`)}${stat('稼働市場',`${dashboard.activeMarkets}市場`)}</div>`,'市場・財務・信用・案件・危機状態を統合表示');
 const companies=dashboard.rows.length?`<div class="grid two">${dashboard.rows.map(row=>companyCard(state,row)).join('')}</div>`:'<div class="empty">詳細競合データなし</div>';
 return `${summary}${companies}${legacyCard(state)}${eventCard(state)}`;
}

let activeEngine=null;
function enhance(){
 if(!activeEngine||activeEngine.g?.selectedTab!=='rivals')return false;
 const screen=typeof document==='undefined'?null:document.getElementById('screen');
 if(!screen||screen.dataset.competitorDashboardUi==='1')return false;
 screen.innerHTML=render(activeEngine.g);
 screen.dataset.competitorDashboardUi='1';
 return true;
}
function scheduleEnhance(){return runEnhancers();}
function installObserver(){return null;}
function bindEngine(instance){activeEngine=instance;scheduleEnhance();return instance;}
const EngineClass=modules.engine.TycoonEngine;
const baseLoad=EngineClass.load.bind(EngineClass);
EngineClass.load=function(...args){return bindEngine(baseLoad(...args));};

competitor.dashboardUI=Object.freeze({render,marketName,enhance,bindEngine,installObserver,ENTRY_LABELS,PROJECT_LABELS,CREDIT_LABELS});
registerEnhancer({id:'competitor-dashboard-ui',enhance:()=>enhance()});
})();
