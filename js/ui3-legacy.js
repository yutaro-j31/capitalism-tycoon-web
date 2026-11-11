// UI v3 legacy screen — docs/ui-v3/README.md 5 (UI3-8), list type.
//
// Rows: the generation facts, retirement (a confirmation sheet; enabled only when the engine says the founder may retire),
// the successor (name, readiness; training costs 1,500,000 yen of personal cash: confirmation sheet), candidates to appoint
// (cost per candidate: confirmation sheet), executing the succession (needs readiness 70), the family trust (set-up
// costs 10,000,000 yen: confirmation sheet), saving the result card. Moving money into the trust (an amount) and founding a
// new company after a sale (a form) stay in the current screen through "ほかの詳細（現行の画面）" (README 6.5).
// Nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen||!modules.ui3.confirmSheet)throw new Error('js/ui3-shell.js must be loaded before ui3-legacy.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
let context=null;

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></button>`;
// Copies of the engine's fixed costs (js/expansion.js trainSuccessorExpanded / establishFamilyTrust); tests/ui3-founder-webkit-test.js
// checks them against the engine's text.
const TRAIN_COST=1500000,TRUST_COST=10000000,SUCCESSOR_READY=70;
const candidatesOf=()=>modules.expansion?.SUCCESSOR_CANDIDATES||[];

function render(ctx){
  context=ctx;
  const {g,money,engine}=ctx;
  const status=engine.retirementEligibility();
  const successor=g.successorCandidate;
  const facts=`<div class="u-list" data-ui3-legacy="facts">`
    +row(' disabled','世代',`第${g.founderGeneration}世代 · 創業会社 第${g.currentCompanySerial}社 · 創業者${g.founderAge}歳`,'')
    +row(' disabled','レガシースコア',`現世代 ${Math.round(finite(g.generationLegacyScore)).toLocaleString('ja-JP')}`,Math.round(finite(g.legacyScore)).toLocaleString('ja-JP'))+`</div>`;
  const retire=row(` data-ui3-legacy="retire"${status.eligible?'':' disabled'}`,'引退して承継する',status.eligible?`見込み評価：${status.tier.title}`:'条件を満たすと引退できます',status.eligible?'›':'条件未達');
  const successorRows=successor
    ?row(' disabled',successor.name,`${successor.type} · スキル${finite(successor.skill).toFixed(1)} · 準備度${finite(successor.readiness).toFixed(1)} · 忠誠${successor.loyalty}`,'')
      +row(' data-ui3-legacy="train"','育成プログラム','準備度が上がる · 個人の現金から',money(TRAIN_COST))
      +row(` data-action="execute-succession"${finite(successor.readiness)>=SUCCESSOR_READY?'':' disabled'}`,'経営承継を実行',finite(successor.readiness)>=SUCCESSOR_READY?'後継者に引き継ぐ':`準備度${SUCCESSOR_READY}以上が必要です`,'›')
    :candidatesOf().map(c=>row(` data-ui3-legacy="appoint" data-id="${esc(c.id)}"`,`${c.name}を指名`,`${c.type||''} · 個人の現金から`,money(finite(c.cost)))).join('');
  const trust=g.familyTrustEstablished
    ?row(' disabled','ファミリートラスト',`信託現金 ${money(finite(g.familyTrustCash))} · 信託株式 ${Math.round(finite(g.familyTrustShares)).toLocaleString('ja-JP')}`,'設立済み')
    :row(' data-ui3-legacy="trust"','ファミリートラストを設立','家族資産の長期管理と世代承継に使う',money(TRUST_COST));
  const card=row(' data-action="download-result-card"','結果カードを保存','エンディングと記録を画像で保存','保存');
  const more=row(' data-ui3-current="legacy"','ほかの詳細（現行の画面）','信託への移管・新会社の創業・エンディングと殿堂記録・歴代会社');
  return '<h2 class="u-h2">承継</h2>'+facts+`<div class="u-list" data-ui3-legacy="succession">${retire}${successorRows}</div>`
    +`<h2 class="u-h2">ファミリートラスト</h2><div class="u-list">${trust}</div>`
    +`<h2 class="u-h2">そのほか</h2><div class="u-list">${card}${more}</div>`;
}

function show(html){const root=modalRoot();if(root)root.innerHTML=html;}

function confirmRetire(){
  const {g,engine}=context;
  const status=engine.retirementEligibility();
  if(!status.eligible)return;
  show(modules.ui3.confirmSheet({title:'引退して承継する',subtitle:`${g.founderName}が引退し、後継者へ会社を託します。取り消せません。`,
    facts:[{label:'見込み評価',value:`${status.tier.icon} ${status.tier.title}`},{label:'現世代スコア',value:Math.round(finite(status.score)).toLocaleString('ja-JP')}],
    confirm:{label:'引退する',attributes:{'data-action':'confirm-retire-founder'}}}));
}
function confirmCost({title,subtitle,cost,note,label,attributes}){
  const {g,money}=context;
  const cash=finite(g.personalCash);
  show(modules.ui3.confirmSheet({title,subtitle,facts:[{label:'費用',value:money(cost)},{label:'実行後の個人現金',value:money(cash-cost),tone:cash-cost<0?'down':undefined}],note,confirm:{label,attributes}}));
}

function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!context)return;
  const control=target.closest('[data-ui3-legacy]');
  if(!control||control.disabled)return;
  const kind=control.dataset.ui3Legacy,id=control.dataset.id;
  if(kind==='retire')confirmRetire();
  else if(kind==='train')confirmCost({title:'育成プログラム',subtitle:'個人の現金から払います。取り消せません。',cost:TRAIN_COST,note:'後継者の準備度とスキルが上がります。',label:'実施する',attributes:{'data-action':'train-successor'}});
  else if(kind==='trust')confirmCost({title:'ファミリートラストを設立',subtitle:'個人の現金から設立費用を払います。取り消せません。',cost:TRUST_COST,note:'設立費用はそのまま信託の現金になります。',label:'設立する',attributes:{'data-action':'establish-trust'}});
  else if(kind==='appoint'){
    const c=candidatesOf().find(x=>x.id===id);
    if(c)confirmCost({title:`${c.name}を後継者に指名`,subtitle:'個人の現金から育成・契約費を払います。取り消せません。',cost:finite(c.cost),note:`${c.type||''}。指名すると準備度の育成が始まります。`,label:'指名する',attributes:{'data-action':'appoint-successor','data-id':id}});
  }
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('legacy',{render});
})();
