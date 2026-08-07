// Phase 8B-9: voluntary debt prepayment and treasury action panel.
(function(){'use strict';
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

if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before treasury-prepayment.js.');
if(!modules.playerDebtService?.__installed)throw new Error('player-debt-service.js must load before treasury-prepayment.js.');
if(modules.treasuryPrepayment)throw new Error('treasury prepayment is already registered.');
const EngineClass=modules.engine.TycoonEngine,finance=modules.finance;
const MIN_CASH=5_000_000,HISTORY_LIMIT=52;
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,finite(v,min)));
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const compactYen=modules.engine.compactYen||((v)=>`${Math.round(finite(v)).toLocaleString('ja-JP')}円`);
function renderKey(value){let hash=2166136261;const text=String(value||'');for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);}
function stateFor(instance){const state=instance?.g||instance||{},book=state.finance&&typeof state.finance==='object'?state.finance:(state.finance={}),rows=Array.isArray(book.voluntaryDebtPrepayments)?book.voluntaryDebtPrepayments:[];book.voluntaryDebtPrepayments=rows.filter(Boolean).slice(-HISTORY_LIMIT);return book.voluntaryDebtPrepayments;}
function capacity(instance){const state=instance?.g||instance||{},debt=Math.max(0,finite(state.companyDebt)),cash=Math.max(0,finite(state.companyCash)),maxAmount=Math.max(0,Math.min(debt,cash-MIN_CASH));return{debt,cash,minCash:MIN_CASH,maxAmount};}
function reduceLoans(state,amount){const book=finance.ensureFinance(state),loans=book.loans.filter(x=>x.status==='active'&&finite(x.outstandingPrincipal)>0).sort((a,b)=>finite(b.interestRate)-finite(a.interestRate));let remaining=Math.max(0,finite(amount));for(const loan of loans){if(remaining<=0)break;const paid=Math.min(remaining,Math.max(0,finite(loan.outstandingPrincipal)));loan.outstandingPrincipal=Math.max(0,finite(loan.outstandingPrincipal)-paid);if(loan.outstandingPrincipal<=.1)loan.status='paid';remaining-=paid;}return Math.max(0,finite(amount)-remaining);}
function prepay(instance,requested){const amount=Math.floor(Math.max(0,finite(requested)));const limits=capacity(instance);if(limits.debt<=0)return instance.fail?.('返済対象の会社借入がありません。')??false;if(amount<=0)return instance.fail?.('返済額を指定してください。')??false;if(amount>limits.maxAmount)return instance.fail?.(`最低運転資金${compactYen(MIN_CASH)}を残す必要があります。返済可能額は${compactYen(limits.maxAmount)}です。`)??false;return instance.runTransaction(()=>{const state=instance.g,week=Math.max(1,Math.floor(finite(state.week,1))),debtBefore=Math.max(0,finite(state.companyDebt)),cashBefore=Math.max(0,finite(state.companyCash)),paid=Math.min(amount,debtBefore);state.companyCash=cashBefore-paid;state.companyDebt=debtBefore-paid;reduceLoans(state,paid);finance.event(state,'debtRepayment',paid,{cashEffect:-paid,liabilityEffect:-paid,sourceType:'voluntaryDebtPrepayment',sourceID:`voluntary-${week}-${stateFor(instance).length+1}`,idempotencyKey:`voluntary-debt-prepayment-${week}-${stateFor(instance).length+1}`,description:'任意の借入繰上返済'});finance.rebuildSnapshotForWeek(state,week);const rows=stateFor(instance);rows.push({week,amount:paid,debtBefore,debtAfter:state.companyDebt,cashAfter:state.companyCash});state.finance.voluntaryDebtPrepayments=rows.slice(-HISTORY_LIMIT);const reserve=modules.playerDebtMaturityReserve?.normalize?.(instance);if(reserve)reserve.lastCheckedWeek=-1;const concentration=modules.playerFundingConcentration?.normalize?.(instance);if(concentration)concentration.lastCheckedWeek=-1;modules.playerDebtMaturityReserve?.evaluate?.(instance);modules.playerFundingConcentration?.evaluate?.(instance);instance.notify?.(`${compactYen(paid)}を繰上返済しました。`,'success');return true;});}
EngineClass.prototype.voluntaryDebtPrepaymentCapacity=function(){return capacity(this);};
EngineClass.prototype.prepayCompanyDebtVoluntarily=function(amount){return prepay(this,amount);};
Object.defineProperty(EngineClass.prototype,'__treasuryPrepaymentInstalled',{value:true});
function render(instance=modules.playerEngineBridge?.getEngine?.()){if(!instance?.g?.configured||instance.g.selectedTab!=='bank')return'';const c=capacity(instance),reserve=modules.playerDebtMaturityReserve?.normalize?.(instance),coverage=reserve?Math.round(clamp(reserve.coverageRatio,0,1)*100):100,key=renderKey(`${c.debt}|${c.cash}|${c.maxAmount}|${reserve?.status||''}|${coverage}`);return `<section class="card" data-treasury-prepayment-ui="1" data-treasury-prepayment-render-key="${key}"><div class="card-head"><div><h2>財務戦略・繰上返済</h2><p>最低運転資金500万円を残し、借入元本を前倒しで削減します。高金利の借入から優先して返済します。</p></div><span class="badge good">Phase 8B-9</span></div><div class="card-body"><div class="kpi-grid mini"><div class="stat"><span>返済可能額</span><strong>${esc(compactYen(c.maxAmount))}</strong></div><div class="stat"><span>返済後最低現金</span><strong>${esc(compactYen(MIN_CASH))}</strong></div><div class="stat"><span>満期カバレッジ</span><strong>${coverage}%</strong></div></div><div class="button-row"><button class="btn secondary small" data-treasury-prepayment="5000000" ${c.maxAmount<5_000_000?'disabled':''}>500万円返済</button><button class="btn secondary small" data-treasury-prepayment="10000000" ${c.maxAmount<10_000_000?'disabled':''}>1,000万円返済</button><button class="btn primary small" data-treasury-prepayment="max" ${c.maxAmount<=0?'disabled':''}>返済可能額を全額</button></div></div></section>`;}
let bound=false;
function enhance(){if(typeof document==='undefined')return false;const engine=modules.playerEngineBridge?.getEngine?.(),screen=document.getElementById('screen');if(!screen)return false;const old=screen.querySelector?.('[data-treasury-prepayment-ui]'),html=render(engine);if(!html){old?.remove?.();return false;}const desiredKey=(html.match(/data-treasury-prepayment-render-key="([^"]+)"/)||[])[1]||'',currentKey=String(old?.getAttribute?.('data-treasury-prepayment-render-key')||old?.dataset?.treasuryPrepaymentRenderKey||'');if(old&&currentKey===desiredKey)return false;if(old){old.outerHTML=html;return true;}screen.insertAdjacentHTML?.('beforeend',html);return true;}
function schedule(){return runEnhancers();}
function click(event){const button=event?.target?.closest?.('[data-treasury-prepayment]'),engine=modules.playerEngineBridge?.getEngine?.();if(!button||button.disabled||!engine)return;event.preventDefault?.();const c=capacity(engine),raw=button.dataset.treasuryPrepayment,amount=raw==='max'?c.maxAmount:Number(raw);if(amount>0&&engine.prepayCompanyDebtVoluntarily(amount))schedule();}
function installUI(){if(typeof document==='undefined')return;const root=document.getElementById('app');if(root&&!bound){root.addEventListener('click',click);bound=true;}schedule();}
modules.treasuryPrepayment=Object.freeze({MIN_CASH,HISTORY_LIMIT,stateFor,capacity,reduceLoans,prepay,renderKey,render,enhance,installUI,__installed:true});
installUI();
registerEnhancer({id:'treasury-prepayment',enhance:()=>enhance()});
})();
