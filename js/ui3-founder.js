// UI v3 founder screen — docs/ui-v3/README.md 5 (UI3-8), hub type.
//
// Card: the founder's personal net worth, the sum of the four skills and the successor's readiness. List: the home actions
// (free, repeated: store hunt, local event, study x3, network — each is the existing `founder-action`), the home
// upgrade and the two self-investments (cost fixed: confirmation sheet with the cost and the personal cash afterwards),
// and the stores found around home. Personal real estate (corporation, purchases, rental mode, redevelopment), the
// PE / angel entries and the action log stay reachable through "ほかの詳細（現行の画面）" (README 6.5).
// Nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen||!modules.ui3.confirmSheet)throw new Error('js/ui3-shell.js must be loaded before ui3-founder.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
let context=null;

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></button>`;
// A copy of js/expansion.js upgradeFounderHome's cost table (the cost of going from level n to n+1); tests/ui3-founder-webkit-test.js
// checks it against the engine's text and the personal cash it takes.
const HOME_UPGRADE_COSTS=Object.freeze([0,800000,2500000,8000000,25000000,80000000,250000000,800000000]);
// The two self-investments the current screen offers (js/expansion.js investFounder specs: [cost, effect]).
const INVEST={successor:{label:'後継者育成',cost:700000,effect:'後継者の準備度が上がります'},foundation:{label:'財団への寄付',cost:5000000,effect:'財団の評価が上がります'}};
const ACTIONS=[['storeHunt','街へ出て店舗探索','有望なテナントを探す・地元信用が上がる'],['localEvent','地元イベント','地元に顔を出す'],['studyBusiness','経営を学ぶ','経営スキルが上がる'],
  ['studyTech','技術を学ぶ','技術スキルが上がる'],['studyFinance','金融を学ぶ','金融スキルが上がる'],['network','人脈を作る','人脈と交渉スキルが上がる']];

const homeLevel=g=>Math.min(8,Math.max(1,Math.floor(finite(g.founderHomeLevel)||1)));
const readinessOf=g=>finite(g.successorCandidate?.readiness??g.successorReadiness);

function render(ctx){
  context=ctx;
  const {g,money,engine}=ctx;
  const skills=finite(g.founderSkillBusiness)+finite(g.founderSkillTech)+finite(g.founderSkillFinance)+finite(g.founderSkillNegotiation);
  const card=`<section class="u-card" aria-label="創業者の状況" data-ui3-founder="summary"><div class="u-stats">`
    +`<div class="u-stat"><span>個人の純資産</span><b class="u-money">${esc(money(finite(engine.personalNetWorth())))}</b></div>`
    +`<div class="u-stat"><span>4スキルの合計</span><b class="u-money">${skills.toFixed(2)}</b></div>`
    +`<div class="u-stat"><span>後継者の準備度</span><b class="u-money">${readinessOf(g).toFixed(1)}</b></div></div></section>`;
  const actions=ACTIONS.map(([kind,title,note])=>row(` data-action="founder-action" data-kind="${kind}"`,title,note,'実行')).join('');
  const level=homeLevel(g),cost=HOME_UPGRADE_COSTS[level];
  const upgrade=level>=8?row(' data-ui3-founder="home-max" disabled','自宅アップグレード','自宅は最高ランクです','最高')
    :row(' data-ui3-founder="home"','自宅アップグレード',`ランク${level} → ${level+1} · 個人の現金から`,money(cost));
  const invest=Object.entries(INVEST).map(([kind,spec])=>row(` data-ui3-founder="invest" data-kind="${kind}"`,spec.label,spec.effect,money(spec.cost))).join('');
  const found=(g.tenants||[]).filter(t=>(g.recommendedTenantIDsFromHomeSearch||[]).includes(t.id));
  const foundRows=found.length?`<h2 class="u-h2">地元で見つけた候補</h2><div class="u-list" data-ui3-founder="found">${found.map(t=>row(' data-action="tab" data-tab="map"',t.name,`交通量${finite(t.traffic).toFixed(2)} · 家賃${money(finite(t.rent))}/週`,'マップへ')).join('')}</div>`:'';
  const more=row(' data-ui3-current="founder"','ほかの詳細（現行の画面）','個人不動産・PE・エンジェル投資・行動履歴');
  return card+'<h2 class="u-h2">自宅での行動</h2><div class="u-list" data-ui3-founder="actions">'+actions+'</div>'
    +'<h2 class="u-h2">自分への投資</h2><div class="u-list" data-ui3-founder="invest-list">'+upgrade+invest+'</div>'
    +foundRows+`<h2 class="u-h2">そのほか</h2><div class="u-list">${more}</div>`;
}

function show(html){const root=modalRoot();if(root)root.innerHTML=html;}

function confirmHome(){
  const {g,money}=context;
  const level=homeLevel(g);
  if(level>=8)return;
  const cost=HOME_UPGRADE_COSTS[level],cash=finite(g.personalCash);
  show(modules.ui3.confirmSheet({title:'自宅をアップグレード',subtitle:`ランク${level} → ${level+1}。個人の現金から払います。取り消せません。`,
    facts:[{label:'費用',value:money(cost)},{label:'実行後の個人現金',value:money(cash-cost),tone:cash-cost<0?'down':undefined}],
    note:'自宅の維持費（月）も増えます。',confirm:{label:'アップグレードする',attributes:{'data-action':'upgrade-home'}}}));
}
function confirmInvest(kind){
  const {g,money}=context;
  const spec=INVEST[kind];
  if(!spec)return;
  const cash=finite(g.personalCash);
  show(modules.ui3.confirmSheet({title:spec.label,subtitle:'個人の現金から払います。取り消せません。',
    facts:[{label:'費用',value:money(spec.cost)},{label:'実行後の個人現金',value:money(cash-spec.cost),tone:cash-spec.cost<0?'down':undefined}],
    note:spec.effect+'。',confirm:{label:'実行する',attributes:{'data-action':'founder-invest','data-kind':kind}}}));
}

function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!context)return;
  const control=target.closest('[data-ui3-founder]');
  if(!control||control.disabled)return;
  const kind=control.dataset.ui3Founder;
  if(kind==='home')confirmHome();
  else if(kind==='invest')confirmInvest(control.dataset.kind);
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('founder',{render});
})();
