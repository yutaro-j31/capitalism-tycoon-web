// UI v3 cash-crisis response sheet — docs/ui-v3/README.md 10.2 (UI3-9b-1). The shell's crisis notice (every screen) and the first
// "今週やること" slot of the home open this sheet, so the v3 home stays during a crisis (CURRENT_UI_RULES.home is lifted once this
// module registers). The numbers and the conditions are the current panel's (js/player-crisis-ui.js, js/player-turnaround-plan-ui.js),
// read through the same engine functions; the labels are the current module's own tables.
//
// Doing it follows the current panel: its buttons call the engine's public functions directly, not js/app.js's action(), so v3 calls
// exactly the functions listed below with the same arguments (README 10.2, the one exception to 6.3). Every action goes through a
// confirmation sheet (the browser's window.confirm is not used); the founder's capital injection is the amount sheet. v3 never writes
// `g`, and its buttons do not carry `data-player-crisis-action` (the current handler would run the action twice).
//
//   injectFounderCapital(amount)         requestEmergencyBridgeLoan()        requestSponsorInjection()      acceptTurnaroundFund()
//   executeCrisisDisposition(type, id)   executeCrisisCostReduction(type, id)   startTurnaroundPlan()        cancelTurnaroundPlan()
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerCrisisSheet||!modules.ui3.confirmSheet)throw new Error('js/ui3-shell.js must be loaded before ui3-crisis.js.');
if(!modules.playerCrisisUI?.__installed)throw new Error('js/player-crisis-ui.js must be loaded before ui3-crisis.js.');
const ui3=modules.ui3,esc=ui3.esc;
const labels=modules.playerCrisisUI;
const money=value=>modules.engine.compactYen(value);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
const engine=()=>modules.playerEngineBridge?.getEngine?.();
const RECOVERY_CONFIRMATION_WEEKS=2;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></button>`;
const info=(title,note)=>`<div class="u-row" role="listitem"><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span></div>`;
const stat=(label,value,sub)=>`<div class="u-stat"><span>${esc(label)}</span><b class="u-money">${esc(value)}</b>${sub?`<span>${esc(sub)}</span>`:''}</div>`;

// the current panel's own default for the founder's injection (js/player-crisis-ui.js defaultFounderAmount)
function defaultFounderAmount(options,gap){
  const available=Math.max(0,finite(options.founderAvailable));
  if(available<=0)return 0;
  const target=Math.max(500000,gap);
  return Math.max(10000,Math.floor(Math.min(available,target)/10000)*10000);
}
function reasonText(snapshot){
  const codes=Array.isArray(snapshot.reasonCodes)?snapshot.reasonCodes:[];
  const mapped=codes.map(code=>labels.REASON_LABELS[code]||code).filter(Boolean);
  return mapped.length?mapped.join('・'):String(snapshot.reason||'資金繰り指標を監視中');
}
// the current turnaround-plan panel's eligibility and preview (js/player-turnaround-plan-ui.js)
function planEligible(g){
  const plan=modules.playerTurnaroundPlan;
  const status=String(g?.playerCrisis?.status||'stable');
  return Boolean(plan?.ELIGIBLE_STATUSES?.includes(status))&&g?.playerTurnaroundPlan?.status!=='active'&&!g.gameOver&&!g.isCompanySold;
}
function planPreview(g){
  const reserve=Math.max(0,finite(modules.playerCrisis.reserveThreshold(g))),debt=Math.max(0,finite(g.companyDebt));
  return {targetCash:reserve,targetDebt:debt*0.9};
}

function build(){
  const instance=engine(),g=instance.g;
  const snapshot=modules.playerCrisis.snapshot(g);   // only read while the status is not "stable" (it initialises g.playerCrisis)
  const options=instance.crisisLiquidityOptions();
  const cash=finite(snapshot.lastCash,g.companyCash),reserve=Math.max(0,finite(snapshot.reserveThreshold)),gap=Math.max(0,reserve-cash);
  const founderAmount=defaultFounderAmount(options,gap);
  const grace=snapshot.status==='distressed'||snapshot.status==='turnaround'?`${integer(snapshot.graceWeeksRemaining)}週`:snapshot.status==='insolvent'?'終了':'—';
  const progress=snapshot.status==='recovered'?`${integer(snapshot.recoveryWeeks)}/${RECOVERY_CONFIRMATION_WEEKS}週`:'—';
  const bridgeSub=options.bridgeCooldownWeeksRemaining>0?`再申請まで${integer(options.bridgeCooldownWeeksRemaining)}週`:`利用可能枠 ${money(options.availableCredit)}`;
  const sponsorSub=options.sponsorCooldownWeeksRemaining>0?`再申請まで${integer(options.sponsorCooldownWeeksRemaining)}週`:`想定持分 ${(finite(options.sponsorEquity)*100).toFixed(1)}%`;
  return {instance,g,snapshot,options,cash,reserve,gap,founderAmount,grace,progress,bridgeSub,sponsorSub};
}

function sheetBody(){
  const c=build(),{instance,g,snapshot,options}=c;
  const status=labels.STATUS_LABELS[snapshot.status]||snapshot.status;
  let html=`<span hidden data-ui3-crisis-sheet></span>`
    +`<div class="u-stats two">${stat('会社現金',money(c.cash),`必要準備 ${money(c.reserve)}`)}${stat('不足額',money(c.gap),reasonText(snapshot))}</div>`
    +`<div class="u-stats two">${stat('猶予期間',c.grace,`現金マイナス ${integer(snapshot.negativeCashWeeks)}週`)}${stat('回復確認',c.progress,`負債 ${money(g.companyDebt)}`)}</div>`;
  const rows=[];
  rows.push(row(` data-ui3-cr="founder"${options.canInjectFounder&&c.founderAmount>0?'':' disabled'}`,'創業者資金を注入','個人資金を会社の資本へ振り替えます（利益や負債は発生しません）',`個人資金 ${money(options.founderAvailable)}`));
  rows.push(row(` data-ui3-cr="bridge"${options.canRequestBridge?'':' disabled'}`,'緊急融資を申請',`予定額 ${money(options.bridgeAmount)} · ${c.bridgeSub}`));
  rows.push(row(` data-ui3-cr="sponsor"${options.canRequestSponsor?'':' disabled'}`,'スポンサー出資を申請',`予定額 ${money(options.sponsorAmount)} · ${c.sponsorSub}。創業者持分が大きく希薄化します`));
  html+=`<h2 class="u-h2">資金を確保する</h2><div class="u-list" data-ui3-crisis-list="liquidity">${rows.join('')}</div>`;
  // turnaround fund
  if(typeof instance.turnaroundFundOptions==='function'){
    const fund=instance.turnaroundFundOptions();
    if(fund.status==='active')html+=`<h2 class="u-h2">事業再生ファンド</h2><div class="u-list" role="list">${info(`${fund.fundName}の再建期間中`,`出資 ${money(fund.investedAmount)} を受け入れ済みです。再建目標を期限内に達成できないと、追加で持分${(finite(fund.ratchetEquity)*100).toFixed(0)}%を譲渡します。`)}</div>`;
    else if(fund.canAccept)html+=`<h2 class="u-h2">事業再生ファンド</h2><div class="u-list">${row(' data-ui3-cr="fund"',`${fund.fundName}の出資を受け入れる`,`出資額 ${money(fund.amount)} · 譲渡持分 ${(finite(fund.equity)*100).toFixed(1)}% · 再建期限 ${integer(fund.termWeeks)}週`)}</div>`;
  }
  // cost reductions and disposals: the current panel's own candidate lists (three at most)
  if(typeof instance.crisisCostReductionOptions==='function'){
    const cost=instance.crisisCostReductionOptions(),list=Array.isArray(cost?.recommended)?cost.recommended.slice(0,3):[];
    if(cost?.eligible&&list.length)html+=`<h2 class="u-h2">固定費を減らす</h2><div class="u-list" data-ui3-crisis-list="cost">${list.map(r=>{
      const oneTime=Math.max(0,finite(r.oneTimeCost));
      return row(` data-ui3-cr="cost" data-type="${esc(r.type)}" data-id="${esc(r.id)}"`,r.name,`${labels.COST_ACTION_LABELS[r.type]||r.type} · 週次削減 ${money(r.weeklySavings)}${r.type==='reduceDepartmentHeadcount'?` · 稼働率 ${(Math.max(0,finite(r.utilization))*100).toFixed(0)}%`:''}`,oneTime>0?`一時費用 ${money(oneTime)}`:'一時費用なし');
    }).join('')}</div>`;
  }
  if(typeof instance.crisisRestructuringOptions==='function'){
    const dis=instance.crisisRestructuringOptions(),list=Array.isArray(dis?.recommended)?dis.recommended.slice(0,3):[];
    if(dis?.eligible&&list.length)html+=`<h2 class="u-h2">事業を整理する（資金不足 ${esc(money(dis.liquidityGap))}）</h2><div class="u-list" data-ui3-crisis-list="disposal">${list.map(r=>{
      const weekly=finite(r.weeklyProfit);
      return row(` data-ui3-cr="dispose" data-type="${esc(r.type)}" data-id="${esc(r.id)}"`,r.name,`${labels.DISPOSITION_LABELS[r.type]||r.type} · ${weekly<0?`週次損失 ${money(Math.abs(weekly))}`:`週次利益 ${money(weekly)}`}`,`想定回収 ${money(r.expectedCash)}`);
    }).join('')}</div>`;
  }
  // turnaround plan
  if(typeof instance.turnaroundPlanSnapshot==='function'){
    const plan=g.playerTurnaroundPlan||{},snap=instance.turnaroundPlanSnapshot();
    if(snap.status==='active'){
      const m=modules.playerTurnaroundPlan.metrics(g,plan);
      html+=`<h2 class="u-h2">再建計画（残り${integer(m.weeksRemaining)}週・総合${Math.round(Math.max(0,Math.min(1,finite(m.progress)))*100)}%）</h2><div class="u-list" data-ui3-crisis-list="plan">`
        +info('現金目標',`現在 ${money(finite(g.companyCash))} · 目標 ${money(plan.targetCash)}`)+info('負債目標',`現在 ${money(Math.max(0,finite(g.companyDebt)))} · 目標 ${money(plan.targetDebt)}`)
        +row(' data-ui3-cr="plan-cancel"','再建計画を中止する','進捗は中止の履歴として保存され、資金や負債は変わりません')+`</div>`;
    }else{
      const eligible=planEligible(g),preview=planPreview(g);
      html+=`<h2 class="u-h2">再建計画</h2><div class="u-list" data-ui3-crisis-list="plan">${row(` data-ui3-cr="plan-start"${eligible?'':' disabled'}`,'8週間の再建計画を開始',eligible?`現金目標 ${money(preview.targetCash)} · 負債目標 ${money(preview.targetDebt)}`:'現在の会社状態では新しい再建計画を開始できません')}</div>`;
    }
  }
  const history=(g.playerCrisisActions?.history||[]).slice(-3).reverse().map(r=>info(`第${integer(r.week)}週 · ${r.type==='founderCapital'?'創業者資本注入':r.type==='sponsorInjection'?'スポンサー出資':'緊急融資'}`,money(r.amount)));
  if(history.length)html+=`<h2 class="u-h2">直近の危機対応</h2><div class="u-list" role="list">${history.join('')}</div>`;
  return {status,html};
}

function open(){
  const root=modalRoot();
  if(!root||!engine()||ui3.crisisStatus(engine().g)==='stable')return false;
  const {status,html}=sheetBody();
  root.innerHTML=ui3.sheet({eyebrow:'資金繰り',title:'資金繰り危機対応',subtitle:status,body:html,actions:'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'});
  return true;
}

function confirmCost(spec){
  const root=modalRoot();
  if(root)root.innerHTML=ui3.confirmSheet(spec);
}
function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target)return;
  const opener=target.closest('[data-ui3-crisis-open]');
  if(opener){open();return;}
  const run=target.closest('[data-ui3-crisis-run]');
  if(run&&!run.disabled){execute(run);return;}
  const control=target.closest('[data-ui3-cr]');
  if(!control||control.disabled||!engine())return;
  ask(control.dataset.ui3Cr,control.dataset.type,control.dataset.id);
}

function ask(kind,type,id){
  const instance=engine(),g=instance.g,c=build(),{options}=c;
  const personal=finite(g.personalCash),company=finite(g.companyCash);
  if(kind==='founder'){
    ui3.setAmountContext({unit:'円',wallet:'personal',direction:'spend',max:Math.max(0,Math.floor(finite(options.founderAvailable))),note:'個人資金を会社の資本へ振り替えます。',
      preview:value=>[{label:'注入後の会社現金',value:money(company+value)},{label:'注入後の個人現金',value:money(personal-value),tone:personal-value<0?'down':undefined}]});
    ui3.amountSheet({title:'創業者資金を注入',initial:c.founderAmount,submit:value=>{instance.injectFounderCapital(Number(value));}});
  }else if(kind==='bridge'){
    confirmCost({title:'緊急融資を申請',subtitle:'既存の与信枠の範囲で、必要準備額までの短期資金を借ります。',
      facts:[{label:'予定額',value:money(options.bridgeAmount),tone:'up'},{label:'利用可能枠',value:money(options.availableCredit)}],note:c.bridgeSub,
      confirm:{label:'申請する',attributes:{'data-ui3-crisis-run':'bridge'}}});
  }else if(kind==='sponsor'){
    confirmCost({title:'スポンサー出資を申請',subtitle:'実行後は取り消せません。',
      facts:[{label:'出資額',value:money(options.sponsorAmount),tone:'up'},{label:'割り当てる持分',value:`${(finite(options.sponsorEquity)*100).toFixed(1)}%`}],
      note:`スポンサーから${money(options.sponsorAmount)}の出資を受け入れ、新株を発行して持分${(finite(options.sponsorEquity)*100).toFixed(1)}%を割り当てます。創業者持分が大きく希薄化します。実行後は取り消せません。`,
      confirm:{label:'申請する',attributes:{'data-ui3-crisis-run':'sponsor'}}});
  }else if(kind==='fund'){
    const f=instance.turnaroundFundOptions();
    confirmCost({title:`${f.fundName}の出資を受け入れる`,subtitle:'他の手段では足りない場合の最終手段です。実行後は取り消せません。',
      facts:[{label:'出資額',value:money(f.amount),tone:'up'},{label:'譲渡する持分',value:`${(finite(f.equity)*100).toFixed(1)}%`},{label:'再建期限',value:`${integer(f.termWeeks)}週`},{label:'未達のとき追加で譲渡',value:`${(finite(f.ratchetEquity)*100).toFixed(0)}%`}],
      note:`${integer(f.termWeeks)}週以内に再建目標を達成できない場合、追加で持分${(finite(f.ratchetEquity)*100).toFixed(0)}%を無償で譲渡します。`,
      confirm:{label:'受け入れる',attributes:{'data-ui3-crisis-run':'fund'}}});
  }else if(kind==='dispose'){
    const r=instance.crisisRestructuringOptions?.()?.[({store:'stores',property:'properties',product:'products'})[type]]?.find?.(x=>String(x.id)===String(id));
    if(!r)return;
    confirmCost({title:`${r.name}を${labels.DISPOSITION_LABELS[type]||type}`,subtitle:'実行後は元に戻せません。',
      facts:[{label:'想定回収額',value:money(r.expectedCash),tone:'up'},{label:'実行後の会社現金（概算）',value:money(company+finite(r.expectedCash))}],
      confirm:{label:'整理する',attributes:{'data-ui3-crisis-run':'dispose','data-type':type,'data-id':id}}});
  }else if(kind==='cost'){
    const list=instance.crisisCostReductionOptions?.();
    const r=({pauseProject:list?.projects,reduceDepartmentHeadcount:list?.headcount})[type]?.find?.(x=>String(x.id)===String(id));
    if(!r)return;
    const oneTime=Math.max(0,finite(r.oneTimeCost));
    confirmCost({title:`${r.name}：${labels.COST_ACTION_LABELS[type]||type}`,subtitle:'固定費を減らします。',
      facts:[{label:'週次の削減額',value:money(r.weeklySavings),tone:'up'},{label:'一時費用',value:money(oneTime)},{label:'実行後の会社現金',value:money(company-oneTime),tone:company-oneTime<0?'down':undefined}],
      note:type==='pauseProject'?'プロジェクトは後で再開できます。':'人員削減は元に戻せず、部門能力と士気が低下する可能性があります。',
      confirm:{label:'実行する',attributes:{'data-ui3-crisis-run':'cost','data-type':type,'data-id':id}}});
  }else if(kind==='plan-start'){
    if(!planEligible(g))return;
    const p=planPreview(g);
    confirmCost({title:'8週間の再建計画を開始',subtitle:'計画は自動で資産売却や借入を実行しません。',
      facts:[{label:'現金目標',value:money(p.targetCash)},{label:'負債目標',value:money(p.targetDebt)}],
      confirm:{label:'開始する',attributes:{'data-ui3-crisis-run':'plan-start'}}});
  }else if(kind==='plan-cancel'){
    if(g.playerTurnaroundPlan?.status!=='active')return;
    confirmCost({title:'再建計画を中止する',subtitle:'進捗は中止の履歴として保存され、資金や負債は変更されません。',facts:[],
      confirm:{label:'中止する',attributes:{'data-ui3-crisis-run':'plan-cancel'}}});
  }
}

// One press, one call of the engine's function (the current handler's own calls; README 10.2).
function execute(button){
  const instance=engine();
  if(!instance)return;
  const kind=button.dataset.ui3CrisisRun,type=button.dataset.type,id=button.dataset.id;
  if(kind==='bridge')instance.requestEmergencyBridgeLoan();
  else if(kind==='sponsor')instance.requestSponsorInjection();
  else if(kind==='fund')instance.acceptTurnaroundFund();
  else if(kind==='dispose')instance.executeCrisisDisposition(type,id);
  else if(kind==='cost')instance.executeCrisisCostReduction(type,id);
  else if(kind==='plan-start')instance.startTurnaroundPlan();
  else if(kind==='plan-cancel')instance.cancelTurnaroundPlan();
}
globalThis.document?.addEventListener('click',onClick,true);

ui3.registerCrisisSheet({open});
})();
