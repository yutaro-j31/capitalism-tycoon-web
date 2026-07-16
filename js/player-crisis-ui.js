// Phase 6A-2B: mobile-safe player crisis response panel and action wiring.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before player-crisis-ui.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-crisis-ui.js.');
if(modules.playerCrisisUI)throw new Error('player crisis UI is already registered.');

const EngineClass=modules.engine.TycoonEngine;
const compactYen=modules.engine.compactYen||((value)=>`${Math.round(Number(value)||0).toLocaleString('ja-JP')}円`);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const PANEL_START='<!--player-crisis-ui:start-->';
const PANEL_END='<!--player-crisis-ui:end-->';
const PANEL_PATTERN=/<!--player-crisis-ui:start-->[\s\S]*?<!--player-crisis-ui:end-->/g;
const STATUS_LABELS=Object.freeze({stable:'安定',watch:'資金繰り注意',distressed:'資金繰り危機',turnaround:'再建中',recovered:'回復確認中',insolvent:'支払不能'});
const REASON_LABELS=Object.freeze({negativeCash:'現金残高がマイナス',lowReserve:'必要運転資金を下回る',losses:'赤字が継続',highLeverage:'負債負担が高い',missedPayments:'支払遅延',recovery:'流動性が改善',insolvency:'猶予期間終了'});
const RECOVERY_CONFIRMATION_WEEKS=2;

let activeEngine=null;
let observer=null;
let clickBound=false;
let scheduled=false;

function stripPanel(html){return String(html||'').replace(PANEL_PATTERN,'');}
function ready(){return Boolean(modules.playerCrisis?.__installed&&modules.playerCrisisActions?.__installed);}
function statusKind(status){return status==='recovered'?'good':status==='watch'?'':'warn';}
function badge(label,kind=''){return `<span class="badge ${kind}">${esc(label)}</span>`;}
function stat(label,value,sub=''){return `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>`;}
function button(label,action,{kind='primary',disabled=false}={}){return `<button class="btn ${kind}" data-player-crisis-action="${esc(action)}" ${disabled?'disabled':''}>${esc(label)}</button>`;}
function defaultFounderAmount(options,gap){
 const available=Math.max(0,finite(options.founderAvailable));
 if(available<=0)return 0;
 const target=Math.max(500000,gap);
 return Math.max(10000,Math.floor(Math.min(available,target)/10000)*10000);
}
function reasonText(snapshot){
 const codes=Array.isArray(snapshot.reasonCodes)?snapshot.reasonCodes:[];
 const mapped=codes.map(value=>REASON_LABELS[value]||value).filter(Boolean);
 if(mapped.length)return mapped.join('・');
 return String(snapshot.reason||'資金繰り指標を監視中');
}
function render(state,instance=activeEngine){
 if(!ready()||!state||!instance||typeof instance.crisisLiquidityOptions!=='function')return '';
 const snapshot=modules.playerCrisis.snapshot(state);
 if(snapshot.status==='stable')return '';
 const options=instance.crisisLiquidityOptions();
 const cash=finite(snapshot.lastCash,state.companyCash);
 const reserve=Math.max(0,finite(snapshot.reserveThreshold));
 const gap=Math.max(0,reserve-cash);
 const founderAmount=defaultFounderAmount(options,gap);
 const status=STATUS_LABELS[snapshot.status]||snapshot.status;
 const grace=snapshot.status==='distressed'||snapshot.status==='turnaround'
  ?`${integer(snapshot.graceWeeksRemaining)}週`
  :snapshot.status==='insolvent'?'終了':'—';
 const progress=snapshot.status==='recovered'?`${integer(snapshot.recoveryWeeks)}/${RECOVERY_CONFIRMATION_WEEKS}週`:'—';
 const bridgeSub=options.bridgeCooldownWeeksRemaining>0
  ?`再申請まで${integer(options.bridgeCooldownWeeksRemaining)}週`
  :`利用可能枠 ${compactYen(options.availableCredit)}`;
 const history=(state.playerCrisisActions?.history||[]).slice(-3).reverse().map(row=>`<div class="news-line">第${integer(row.week)}週 · ${row.type==='founderCapital'?'創業者資本注入':'緊急融資'} ${compactYen(row.amount)}</div>`).join('');
 return `${PANEL_START}<section class="card player-crisis-panel" id="player-crisis-panel" aria-live="polite">
  <div class="card-head"><div><h2>資金繰り危機対応</h2><p>会社の流動性、猶予期間、利用可能な回復策を表示します。</p></div>${badge(status,statusKind(snapshot.status))}</div>
  <div class="card-body">
   <div class="kpi-grid mini">
    ${stat('会社現金',compactYen(cash),`必要準備 ${compactYen(reserve)}`)}
    ${stat('不足額',compactYen(gap),reasonText(snapshot))}
    ${stat('猶予期間',grace,`現金マイナス ${integer(snapshot.negativeCashWeeks)}週`)}
    ${stat('回復確認',progress,`負債 ${compactYen(state.companyDebt)}`)}
   </div>
   <div class="grid two">
    <article class="item"><div><h3>創業者資金を注入</h3><p>個人資金を会社の資本へ振り替えます。利益や負債は発生しません。</p><label class="field"><span>注入額</span><input id="player-crisis-founder-amount" type="number" inputmode="numeric" min="10000" step="10000" value="${founderAmount}" ${options.canInjectFounder?'':'disabled'}></label></div><div class="item-metrics"><span>個人資金 ${compactYen(options.founderAvailable)}</span></div>${button('資本注入を実行','founder-capital',{disabled:!options.canInjectFounder||founderAmount<=0})}</article>
    <article class="item"><div><h3>緊急ブリッジローン</h3><p>既存与信枠の範囲で、必要準備額までの短期資金を調達します。</p></div><div class="item-metrics"><span>予定額 ${compactYen(options.bridgeAmount)}</span><span>${esc(bridgeSub)}</span></div>${button('緊急融資を申請','emergency-bridge',{kind:'secondary',disabled:!options.canRequestBridge})}</article>
   </div>
   ${history?`<details class="learning-card"><summary>直近の危機対応履歴</summary>${history}</details>`:''}
  </div>
 </section>${PANEL_END}`;
}
function enhance(){
 if(!activeEngine||typeof document==='undefined')return false;
 const screen=document.getElementById('screen');
 if(!screen)return false;
 const base=stripPanel(screen.innerHTML);
 const panel=render(activeEngine.g,activeEngine);
 const next=panel+base;
 if(next===screen.innerHTML)return false;
 screen.innerHTML=next;
 screen.dataset.playerCrisisUi=panel?'1':'0';
 return true;
}
function scheduleEnhance(){
 if(scheduled)return;
 scheduled=true;
 const run=()=>{scheduled=false;enhance();};
 if(typeof queueMicrotask==='function')queueMicrotask(run);else setTimeout(run,0);
}
function bindEngine(instance){activeEngine=instance;scheduleEnhance();setTimeout(scheduleEnhance,0);return instance;}
function handleClick(event){
 const target=event?.target?.closest?.('[data-player-crisis-action]');
 if(!target||!activeEngine)return false;
 event.preventDefault?.();event.stopPropagation?.();
 const action=target.dataset.playerCrisisAction;
 let result=false;
 if(action==='founder-capital'){
  const input=document.getElementById('player-crisis-founder-amount');
  result=activeEngine.injectFounderCapital(Number(input?.value));
 }else if(action==='emergency-bridge')result=activeEngine.requestEmergencyBridgeLoan();
 if(result)scheduleEnhance();
 return Boolean(result);
}
function install(){
 if(typeof document==='undefined')return;
 const root=document.getElementById('app');
 if(root&&!clickBound){root.addEventListener('click',handleClick);clickBound=true;}
 if(!observer&&typeof MutationObserver==='function'&&root){observer=new MutationObserver(scheduleEnhance);observer.observe(root,{childList:true,subtree:true});}
}
const baseLoad=EngineClass.load.bind(EngineClass);
EngineClass.load=function(...args){const instance=bindEngine(baseLoad(...args));install();return instance;};
install();
modules.playerCrisisUI=Object.freeze({render,enhance,bindEngine,handleClick,install,stripPanel,STATUS_LABELS,REASON_LABELS,__installed:true});
})();
