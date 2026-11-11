// UI v3 venture screen — docs/ui-v3/README.md 5 (UI3-6), hub type.
//
// Card: the number of startups the company or the founder holds, and the market value of each side's stakes.
// List: held startups, candidates (alive, not held) and VC-born subsidiaries. A row opens the startup sheet:
// valuation, growth, risk, stakes, runway, due-diligence result and the funding round. Money operations follow the
// UI3-6 policy (README 5.7): an operation that needs a number (invest, follow-on) goes through the existing action,
// whose askMoney becomes the amount sheet; an operation with a fixed amount (due diligence, secondary sale) goes
// through the confirmation sheet; a subsidiary conversion through the confirmation sheet as well. The subsidiary IPO is a staged
// preparation (audit, underwriter, review, offer terms) that lives in the current screen. Everything else (new-business analysis, capital allocation, the expansion panel) stays reachable through
// "ほかの詳細（現行の画面）". Nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen||!modules.ui3.confirmSheet)throw new Error('js/ui3-shell.js must be loaded before ui3-venture.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
let context=null;

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const percent=ratio=>`${(Math.round(finite(ratio)*1000)/10).toFixed(1)}%`;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></button>`;
const walletName=owner=>owner==='company'?'会社':'個人';
const cashOf=(g,owner)=>finite(owner==='company'?g.companyCash:g.personalCash);
const heldBy=(s,owner)=>finite(owner==='company'?s.ownedCompany:s.ownedPersonal);
const isHeld=s=>finite(s.ownedCompany)+finite(s.ownedPersonal)>0;

// The current screen's own conditions (js/app.js renderVenture): an open funding round or a hold blocks trades.
function roundOf(engine,s){
  const plan=engine?.getStartupFundingRoundPlan?.(s.id)||null;
  const hold=engine?.getStartupFundingRoundHold?.(s.id)||null;
  return {plan,hold,blocked:Boolean(plan||hold)};
}

function render(ctx){
  context=ctx;
  const {g,money}=ctx;
  const startups=g.startups||[];
  const held=startups.filter(isHeld),candidates=startups.filter(s=>!isHeld(s)&&s.alive);
  const company=startups.reduce((sum,s)=>sum+finite(s.valuation)*finite(s.ownedCompany),0);
  const personal=startups.reduce((sum,s)=>sum+finite(s.valuation)*finite(s.ownedPersonal),0);
  const card=`<section class="u-card" aria-label="ベンチャー投資の状況" data-ui3-venture="summary"><div class="u-stats">`
    +`<div class="u-stat"><span>投資先</span><b class="u-money">${held.length}社</b></div>`
    +`<div class="u-stat"><span>会社の持分評価</span><b class="u-money">${esc(money(company))}</b></div>`
    +`<div class="u-stat"><span>個人の持分評価</span><b class="u-money">${esc(money(personal))}</b></div>`
    +`</div></section>`;
  const startupRow=s=>row(` data-ui3-vc="startup" data-id="${esc(s.id)}"`,s.name,`${s.stage} · ${s.domain}${s.alive?'':' · 終了'}`,money(finite(s.valuation)));
  const heldList=held.length?`<div class="u-list" data-ui3-venture="held">${held.map(startupRow).join('')}</div>`
    :`<div class="u-h2" data-ui3-venture="none-held">投資先はまだありません。候補から選びます。</div>`;
  const candidateList=candidates.length?`<div class="u-list" data-ui3-venture="candidates">${candidates.map(startupRow).join('')}</div>`
    :`<div class="u-h2" data-ui3-venture="none-candidates">いまの投資候補はありません。</div>`;
  const subs=(g.subsidiaries||[]);
  const subList=subs.length?`<h2 class="u-h2">VC由来の子会社</h2><div class="u-list" data-ui3-venture="subsidiaries">${subs.map(s=>row(` data-ui3-vc="subsidiary" data-id="${esc(s.id)}"`,s.name,`${s.domain} · 持分${percent(s.ownership)}${s.publicCompany?` · ${s.ticker} 上場済み`:''}`,money(finite(s.valuation)))).join('')}</div>`:'';
  const more=row(' data-ui3-current="venture"','ほかの詳細（現行の画面）','新規事業の分析・資本配分の実行・ベンチャー拡張の欄');
  return card+'<h2 class="u-h2">投資先</h2>'+heldList+'<h2 class="u-h2">投資候補</h2>'+candidateList+subList+`<h2 class="u-h2">そのほか</h2><div class="u-list">${more}</div>`;
}

// ---- sheets ------------------------------------------------------------------------------------
function show(html){const root=modalRoot();if(root)root.innerHTML=html;}

function startupSheet(id){
  const {g,money,engine}=context;
  const s=(g.startups||[]).find(item=>item.id===id);
  if(!s)return;
  const {plan,hold,blocked}=roundOf(engine,s);
  const dd=s.dueDiligence?.done?s.dueDiligence:null;
  const ddCost=Math.round(finite(s.minTicket)*.05);
  const ddReady=!dd&&s.alive&&finite(s.minTicket)>0;
  const tradeOff=!s.alive||blocked;
  const roundNote=hold?`<div class="u-h2" data-ui3-venture="round-hold">払込・持分の証拠を確認できないため、このラウンドは保留中です（${esc(hold.code)}）。</div>`
    :plan?`<div class="u-h2" data-ui3-venture="round">${esc(plan.round)} 追加資金調達：調達額 ${esc(money(finite(plan.targetRaise)))}・あと${finite(plan.weeksRemaining)}週</div>`:'';
  const stakeRows=side=>{
    const info=plan?.[side];
    if(!info||!(finite(info.ownershipBefore)>0))return '';
    return row(` data-action="follow-on-startup-${side}" data-ui3-vc-follow data-id="${esc(id)}" data-owner="${side}"${hold||finite(info.remaining)<=0?' disabled':''}`,`${walletName(side)}で追加出資`,`持分維持に必要 ${money(finite(info.proRataRequired))} · 残り ${money(finite(info.remaining))}`);
  };
  const body=`<span hidden data-ui3-venture-sheet></span><div class="u-stats">`
    +`<div class="u-stat"><span>評価額</span><b class="u-money">${esc(money(finite(s.valuation)))}</b></div>`
    +`<div class="u-stat"><span>成長率</span><b class="u-money">${esc(percent(s.growth))}</b></div>`
    +`<div class="u-stat"><span>リスク</span><b class="u-money">${esc(percent(s.risk))}</b></div></div>`
    +`<div class="u-stats"><div class="u-stat"><span>会社の持分</span><b class="u-money">${esc(percent(s.ownedCompany))}</b></div>`
    +`<div class="u-stat"><span>個人の持分</span><b class="u-money">${esc(percent(s.ownedPersonal))}</b></div>`
    +`<div class="u-stat"><span>資金の残り</span><b class="u-money">${finite(s.runwayWeeks)}週</b></div></div>`
    +roundNote
    +(dd?`<div class="u-h2" data-ui3-venture="dd">詳細DDの結果：${esc(dd.verdict)}${finite(dd.discount)>0?`（交渉で評価額${esc(percent(dd.discount))}割引）`:''}${(dd.flags||[]).length?`・${(dd.flags||[]).map(esc).join('、')}`:''}</div>`:'')
    +`<div class="u-list">`
    +(ddReady?row(` data-ui3-vc="dd" data-id="${esc(id)}"`,'詳細DDを実施',`個人の現金から ${money(ddCost)}`):'')
    +stakeRows('company')+stakeRows('personal')
    +(finite(s.ownedCompany)>=.5&&!s.subsidiary&&!blocked?row(` data-ui3-vc="subsidiary-make" data-id="${esc(id)}"`,'子会社化','会社の持分50%以上'):'')
    +(finite(s.ownedCompany)>0&&!tradeOff&&!s.subsidiary?row(` data-ui3-vc="secondary" data-id="${esc(id)}" data-owner="company"`,'会社の持分をセカンダリー売却',`持分 ${percent(s.ownedCompany)}`):'')
    +(finite(s.ownedPersonal)>0&&!tradeOff&&!s.subsidiary?row(` data-ui3-vc="secondary" data-id="${esc(id)}" data-owner="personal"`,'個人の持分をセカンダリー売却',`持分 ${percent(s.ownedPersonal)}`):'')
    +`</div>`;
  show(modules.ui3.sheet({eyebrow:`${s.stage} · ${s.domain}`,title:s.name,subtitle:s.alive?'運営中':'終了',body,
    actions:`<button type="button" class="u-btn" data-ui3-vc-invest data-action="invest-startup-personal" data-id="${esc(id)}" data-owner="personal"${tradeOff?' disabled':''}>個人で投資</button>`
      +`<button type="button" class="u-btn primary" data-ui3-vc-invest data-action="invest-startup-company" data-id="${esc(id)}" data-owner="company"${tradeOff?' disabled':''}>会社で投資</button>`}));
}

function subsidiarySheet(id){
  const {g,money,engine}=context;
  const s=(g.subsidiaries||[]).find(item=>item.id===id);
  if(!s)return;
  const prep=engine?.subsidiaryIPOPreparationSnapshot?.(id)||null;
  const stage=s.publicCompany?`${s.ticker} として上場済み`:s.ipoPreparation?(prep?.ready?'IPOの準備が完了しています':'IPOの準備を進めています'):finite(s.valuation)>=250000000&&finite(s.ownership)>=.5?'IPOの準備を始められます':'IPOには、評価額2.5億円以上・持分50%以上が必要です';
  const body=`<span hidden data-ui3-venture-sheet></span><div class="u-stats">`
    +`<div class="u-stat"><span>評価額</span><b class="u-money">${esc(money(finite(s.valuation)))}</b></div>`
    +`<div class="u-stat"><span>持分</span><b class="u-money">${esc(percent(s.ownership))}</b></div>`
    +`<div class="u-stat"><span>週次利益</span><b class="u-money">${esc(money(finite(s.weeklyProfit)))}</b></div></div>`
    +`<div class="u-h2" data-ui3-venture="ipo-status">${esc(stage)}</div>`
    +(s.publicCompany?'':`<div class="u-list">${row(' data-ui3-current="venture"','IPOの準備と実行（現行の画面）','監査・主幹事・上場審査・公開条件の選択、上場の実行')}</div>`);
  show(modules.ui3.sheet({eyebrow:s.domain,title:s.name,subtitle:s.status,body,actions:'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'}));
}

// ---- confirmations -----------------------------------------------------------------------------
function confirmDD(id){
  const {g,money}=context;
  const s=(g.startups||[]).find(item=>item.id===id);
  if(!s)return;
  const cost=Math.round(finite(s.minTicket)*.05),cash=finite(g.personalCash);
  show(modules.ui3.confirmSheet({title:`${s.name}の詳細DD`,subtitle:'個人の現金から費用を払います。取り消せません。',
    facts:[{label:'費用',value:money(cost)},{label:'実行後の個人現金',value:money(cash-cost),tone:cash-cost<0?'down':undefined}],
    note:'結果（優良・普通・要注意・危険）と、評価額の割引の有無が分かります。',
    confirm:{label:'実施する',attributes:{'data-action':'conduct-startup-dd','data-id':id}}}));
}
function confirmSubsidiary(id){
  const {g,money}=context;
  const s=(g.startups||[]).find(item=>item.id===id);
  if(!s)return;
  show(modules.ui3.confirmSheet({title:`${s.name}を子会社化`,subtitle:'連結子会社になります。取り消せません。',
    facts:[{label:'会社の持分',value:percent(s.ownedCompany)},{label:'評価額',value:money(finite(s.valuation))}],
    confirm:{label:'子会社化する',attributes:{'data-action':'make-subsidiary','data-id':id}}}));
}
function confirmSecondary(id,owner){
  const {g,money,engine}=context;
  const s=(g.startups||[]).find(item=>item.id===id);
  const preview=engine?.previewStartupSecondarySale?.(id,owner);
  if(!s||!preview)return;
  const cash=cashOf(g,owner);
  show(modules.ui3.confirmSheet({title:`${s.name}の${walletName(owner)}持分を売却`,subtitle:'セカンダリー市場で売ります。取り消せません。',
    facts:[{label:'売却額',value:money(Math.round(preview.proceeds)),tone:'up'},{label:`実行後の${walletName(owner)}現金`,value:money(cash+Math.round(preview.proceeds))}],
    note:`流動性ディスカウント ${Math.round(preview.discount*100)}% を含みます。`,
    confirm:{label:'売却する',attributes:{'data-action':'sell-startup-secondary','data-id':id,'data-kind':owner}}}));
}
// ---- events ------------------------------------------------------------------------------------
function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!context)return;
  const invest=target.closest('[data-ui3-vc-invest]');
  if(invest&&!invest.disabled){
    // tell the amount sheet what the number means (README 5.7): yen out of this wallet
    const owner=invest.dataset.owner,s=(context.g.startups||[]).find(item=>item.id===invest.dataset.id);
    if(s)modules.ui3.setAmountContext({unit:'円',wallet:owner,direction:'spend',max:Math.max(0,Math.floor(cashOf(context.g,owner)))});
    return;
  }
  const followOn=target.closest('[data-ui3-vc-follow]');
  if(followOn&&!followOn.disabled){
    const {g,engine}=context,id=followOn.dataset.id,owner=followOn.dataset.owner;
    const remaining=finite(engine?.getStartupFundingRoundPlan?.(id)?.[owner]?.remaining);
    modules.ui3.setAmountContext({unit:'円',wallet:owner,direction:'spend',max:Math.max(0,Math.floor(Math.min(cashOf(g,owner),remaining)))});
    return;
  }
  const control=target.closest('[data-ui3-vc]');
  if(!control||control.disabled)return;
  const kind=control.dataset.ui3Vc,id=control.dataset.id;
  if(kind==='startup')startupSheet(id);
  else if(kind==='subsidiary')subsidiarySheet(id);
  else if(kind==='dd')confirmDD(id);
  else if(kind==='subsidiary-make')confirmSubsidiary(id);
  else if(kind==='secondary')confirmSecondary(id,control.dataset.owner);
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('venture',{render});
})();
