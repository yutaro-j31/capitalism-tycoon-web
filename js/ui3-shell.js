// UI v3 shell — docs/ui-v3/README.md (UI3-0).
//
// Presentation only. This module never writes engine state: every control it
// renders dispatches an existing `data-action` through js/app.js `action()`.
// It renders the shared frame (top bar, hub chips, advance dock, tab bar) around
// a screen registered with `registerScreen`. A screen that has not been
// registered is "not ported yet": js/app.js then renders the current D UI for it
// unchanged, so the redesign can land one screen per PR.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('runtime.js must be loaded before ui3-shell.js.');
if(modules.ui3)throw new Error('UI v3 shell is already registered.');

const PREFERENCE_KEY='capitalism_tycoon_ui';   // a device preference, never part of the save
const GROUPS=Object.freeze([
  Object.freeze({id:'home',icon:'⌂',label:'ホーム',screens:Object.freeze(['home','missions','news']),chips:false}),
  Object.freeze({id:'map',icon:'◉',label:'マップ',screens:Object.freeze(['map']),chips:false}),
  Object.freeze({id:'business',icon:'▣',label:'事業',screens:Object.freeze(['business','office','strategy','overseas','media','rivals']),chips:true}),
  Object.freeze({id:'invest',icon:'↗',label:'投資',screens:Object.freeze(['market','venture','ma','assets','pe-portfolio']),chips:true}),
  Object.freeze({id:'company',icon:'▥',label:'会社',screens:Object.freeze(['bank','report','founder','legacy','settings']),chips:true})
]);
const SCREEN_LABELS=Object.freeze({
  home:'ホーム',missions:'進行・目標',news:'ニュース',map:'マップ',
  business:'店舗・事業',office:'本社',strategy:'戦略',overseas:'海外',media:'メディア',rivals:'競合',
  market:'株式',venture:'ベンチャー',ma:'M&A',assets:'不動産','pe-portfolio':'PE',
  bank:'資金調達',report:'決算',founder:'創業者',legacy:'承継',settings:'設定'
});
const ALL_SCREENS=Object.freeze(GROUPS.flatMap(group=>group.screens));
const screens=new Map();
const lastScreenInGroup=new Map();
let nativeActive=false;

const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function readPreference(){
  try{
    const requested=new URLSearchParams(globalThis.location?.search||'').get('ui');
    const storage=globalThis.localStorage;
    if(requested==='3'){storage?.setItem(PREFERENCE_KEY,'3');return true;}
    if(requested==='2'){storage?.removeItem(PREFERENCE_KEY);return false;}
    return storage?.getItem(PREFERENCE_KEY)==='3';
  }catch(error){return false;}
}
const enabled=readPreference();

// The cash-crisis response sheet (README 10.2): registered once by js/ui3-crisis.js. Until it is registered the shell behaves as before
// (the notice goes to the current home, which carries the recovery panel).
let crisisSheet=null;
function registerCrisisSheet(definition){
  if(typeof definition?.open!=='function')throw new TypeError('UI v3 crisis sheet requires an open function.');
  if(crisisSheet)throw new Error('UI v3 crisis sheet is already registered.');
  crisisSheet=Object.freeze({open:definition.open});
  return true;
}
const crisisSheetRegistered=()=>enabled&&crisisSheet!==null;
// Opens the registered crisis response sheet (the shell's crisis notice does the same; used by the home's "crisis_active" row, UI3-10c).
const openCrisisSheet=()=>crisisSheetRegistered()&&crisisSheet.open()!==false;   // false while the crisis is not declared (the sheet has nothing to show)

function groupOf(screenID){return GROUPS.find(group=>group.screens.includes(screenID))||GROUPS[0];}
function isAvailable(screenID,g){return screenID!=='pe-portfolio'||Boolean(g?.peFirm?.unlocked);}

function registerScreen(id,definition){
  if(!ALL_SCREENS.includes(id))throw new RangeError(`Unknown UI v3 screen: ${id}`);
  if(typeof definition?.render!=='function')throw new TypeError(`UI v3 screen ${id} requires a render function.`);
  if(definition.useCurrentUI!==undefined&&typeof definition.useCurrentUI!=='function')throw new TypeError(`UI v3 screen ${id}: useCurrentUI must be a function.`);
  if(screens.has(id))throw new Error(`UI v3 screen is already registered: ${id}`);
  if(definition.mount!==undefined&&typeof definition.mount!=='function')throw new TypeError(`UI v3 screen ${id}: mount must be a function.`);
  screens.set(id,Object.freeze({render:definition.render,useCurrentUI:definition.useCurrentUI||null,mount:definition.mount||null}));
  return id;
}

// Cash-crisis status, read without normalising state (modules.playerCrisis.snapshot
// initialises g.playerCrisis; the shell must stay read-only). Absent means stable.
const CRISIS_LABELS=Object.freeze({watch:'資金繰り注意',distressed:'資金繰り危機',turnaround:'再建中',recovered:'回復確認中',insolvent:'支払不能'});
function crisisStatus(g){
  const status=g?.playerCrisis?.status;
  return typeof status==='string'&&Object.hasOwn(CRISIS_LABELS,status)?status:'stable';
}

// States in which a screen must be shown by the current UI even though a v3
// screen is registered, because the current UI carries controls v3 does not
// have yet (docs/ui-v3/README.md 6.5 and migration-ledger.md). Shell-level rules
// live here; a screen adds its own through registerScreen({useCurrentUI}).
const CURRENT_UI_RULES=Object.freeze({
  // The cash-crisis panel (js/player-crisis-ui.js) is injected into the current
  // home only, and is the only way to reach the recovery actions.
  // (Once the crisis sheet is registered, js/ui3-crisis.js carries the recovery actions and the v3 home stays; README 10.2.)
  home:g=>!crisisSheet&&crisisStatus(g)!=='stable',
  // The recall-crisis section (respond-recall-crisis, "自主回収・補償") is drawn by the current business
  // screen only. Read straight from the state, not through modules.companyRecallCrisis.view(), which
  // normalises g (design decision, 2026-11-11).
  business:g=>{const crisis=g?.activeRecallCrisis;return Boolean(crisis&&typeof crisis==='object'&&crisis.status==='active'&&!crisis.responded);}
});
// Screens the user chose to open in the current UI from a `data-ui3-current="<screen>"` row (README 6.5,
// "利用者が選んで現行の画面を開く行"): shown by the current UI until the next `tab` action.
const openedCurrent=new Set();
let openingCurrent=false;
function usesCurrentUI(screenID,g){
  if(CURRENT_UI_RULES[screenID]?.(g))return true;
  if(openedCurrent.has(screenID))return true;
  return Boolean(screens.get(screenID)?.useCurrentUI?.(g));
}

// True when js/app.js should hand this render to UI v3. Game over and the
// founding form stay on the current UI until their own tasks port them.
function rendersNatively(screenID,g){
  return enabled&&screens.has(screenID)&&Boolean(g?.configured)&&!g?.gameOver&&!usesCurrentUI(screenID,g);
}

// The founding form and the game-over screen are not tab screens: each is registered once (`registerSetup`, `registerGameOver`)
// and js/app.js asks the shell to draw it into #app (`renderSetupInto`, `renderGameOverInto`). Both return false, and draw
// nothing, unless v3 is on and the screen is registered, so the current form / overlay is drawn exactly as before.
let setupDefinition=null,gameOverDefinition=null;
function registerSetup(definition){
  if(typeof definition?.render!=='function')throw new TypeError('UI v3 setup screen requires a render function.');
  if(setupDefinition)throw new Error('UI v3 setup screen is already registered.');
  setupDefinition=Object.freeze({render:definition.render});
  return true;
}
function registerGameOver(definition){
  if(typeof definition?.render!=='function')throw new TypeError('UI v3 game-over screen requires a render function.');
  if(gameOverDefinition)throw new Error('UI v3 game-over screen is already registered.');
  gameOverDefinition=Object.freeze({render:definition.render});
  return true;
}
function drawStandalone(target,definition,kind,context){
  const {engine,engineModule}=context;
  const body=String(definition.render({engine,g:engine.g,engineModule,esc,money:engineModule.compactYen})??'');
  if(!nativeActive)modules.cityLabMap?.release?.();
  nativeActive=true;
  setBodyMode(true);
  target.innerHTML=`<div class="ui3 u-app u-standalone" data-ui3-${kind}>${body}</div>`;
  return true;
}
function renderSetupInto(target,context){
  if(!enabled||!setupDefinition||!target)return false;
  return drawStandalone(target,setupDefinition,'setup',context);
}
function renderGameOverInto(target,context){
  if(!enabled||!gameOverDefinition||!target||!context?.engine?.g?.gameOver)return false;
  return drawStandalone(target,gameOverDefinition,'gameover',context);
}
// A new game always starts from the top of the page (the founding form is a long page on a small screen).
globalThis.document?.addEventListener('submit',event=>{
  if(event.target instanceof Element&&event.target.id==='setup-form'&&event.target.closest('[data-ui3-setup]'))globalThis.scrollTo?.(0,0);
},true);

function topBar(g,engineModule){
  const date=engineModule.gameDate(g.week);
  const money=engineModule.compactYen;
  return `<header class="u-top"><div class="u-top-date"><b>第${esc(g.week)}週</b> · ${esc(date.label||date.fullLabel||'')}</div>`
    +`<div class="u-wallets"><div class="u-wallet" aria-label="会社現金"><span>会社</span><b class="u-money">${esc(money(g.companyCash))}</b></div>`
    +`<div class="u-wallet personal" aria-label="個人現金"><span>個人</span><b class="u-money">${esc(money(g.personalCash))}</b></div></div></header>`;
}
function chips(group,screenID,g){
  if(!group.chips)return '';
  const items=group.screens.filter(id=>isAvailable(id,g));
  if(items.length<2)return '';
  // Hub groups share one heading and chip row (README 5.5), so their screens start below it.
  return `<h1 class="u-h1">${esc(group.label)}</h1><nav class="u-chips" aria-label="${esc(group.label)}の画面">${items.map(id=>`<button type="button" class="u-chip" data-action="tab" data-tab="${id}"${id===screenID?' aria-current="page"':''}>${esc(SCREEN_LABELS[id])}</button>`).join('')}</nav>`;
}
function tabBar(activeGroup,g){
  return `<nav class="u-tabbar" aria-label="メインメニュー">${GROUPS.map(group=>{
    const remembered=lastScreenInGroup.get(group.id);
    const target=remembered&&isAvailable(remembered,g)?remembered:group.screens[0];
    return `<button type="button" class="u-tab" data-action="tab" data-tab="${target}" data-ui3-group="${group.id}"${group.id===activeGroup.id?' aria-current="page"':''}><i aria-hidden="true">${group.icon}</i>${esc(group.label)}</button>`;
  }).join('')}</nav>`;
}
// Every screen stays reachable by its selectedTab id through the existing
// `data-action="tab"` contract (scripts/ui3-screen-metrics.js and the
// acceptance tests rely on it), including screens whose chip is not on screen.
function screenIndex(g){
  return `<nav hidden data-ui3-all-screens>${ALL_SCREENS.filter(id=>isAvailable(id,g)).map(id=>`<button type="button" data-action="tab" data-tab="${id}" tabindex="-1">${esc(SCREEN_LABELS[id])}</button>`).join('')}</nav>`;
}
// While a cash crisis is open, every native screen points at the home screen,
// where the current UI shows the recovery actions.
function crisisNotice(g){
  const status=crisisStatus(g);
  if(status==='stable')return '';
  if(crisisSheet)return `<button type="button" class="u-action warn" data-ui3-crisis-open data-ui3-crisis="${status}"><i aria-hidden="true">⚠</i><span><b>${esc(CRISIS_LABELS[status])}</b><small>対応策を確認する</small></span></button>`;
  return `<button type="button" class="u-action warn" data-action="tab" data-tab="home" data-ui3-crisis="${status}"><i aria-hidden="true">⚠</i><span><b>${esc(CRISIS_LABELS[status])}</b><small>対応策を確認する</small></span></button>`;
}
function dock(){
  return '<div class="u-dock"><button type="button" class="u-advance4" data-action="advance-4" aria-label="4週進める">4週</button>'
    +'<button type="button" class="u-advance" data-action="advance-week">▶ 進める</button></div>';
}

function setBodyMode(native){
  const list=globalThis.document?.body?.classList;
  if(!list)return;
  if(native){
    // The D UI shell owns these classes; while a v3 screen is on screen its
    // enhancer pipeline is suppressed, so it cannot clear them itself.
    list.remove('d-ui-active','city-lab-presentation');
    list.add('ui3-native');
  }else list.remove('ui3-native');
}

// Returns the full #app markup for a registered screen and marks the render as
// native so js/ui-enhancer-registry.js skips the D UI enhancer pipeline for it.
function renderApp(context){
  const {engine,engineModule}=context;
  const g=engine.g;
  const screenID=g.selectedTab;
  const definition=screens.get(screenID);
  if(!definition)throw new Error(`UI v3 screen is not registered: ${screenID}`);
  const group=groupOf(screenID);
  lastScreenInGroup.set(group.id,screenID);
  const body=String(definition.render({engine,g,engineModule,esc,money:engineModule.compactYen})??'');
  if(!nativeActive)modules.cityLabMap?.release?.();
  nativeActive=true;
  setBodyMode(true);
  // `mount` runs once js/app.js has put this markup into #app (same task, after the caller returns), for
  // a screen that has to attach something markup cannot carry, such as the 3D map's canvas.
  if(definition.mount){
    const host=()=>globalThis.document?.querySelector?.(`[data-ui3-screen="${screenID}"]`);
    queueMicrotask(()=>{const element=host();if(nativeActive&&engine.g.selectedTab===screenID&&element)definition.mount({engine,g:engine.g,engineModule,esc,money:engineModule.compactYen,host:element});});
  }
  return `<div class="ui3 u-app" data-ui3-screen="${esc(screenID)}" data-ui3-group="${group.id}">${topBar(g,engineModule)}`
    +`<main id="screen" class="u-screen" data-screen="${esc(screenID)}">${chips(group,screenID,g)}${crisisNotice(g)}${body}</main>`
    +`${dock()}${tabBar(group,g)}${screenIndex(g)}</div>`;
}
// Called by js/app.js before it renders the current UI again.
function leaveNative(){
  if(!nativeActive)return false;
  nativeActive=false;
  setBodyMode(false);
  const app=globalThis.document?.getElementById?.('app');
  if(app?.dataset)delete app.dataset.dUiKey;   // force the D UI shell to rebuild its frame
  return true;
}

// Opens the current UI's version of a screen from a v3 screen, for what the v3 screen does not carry yet.
// It goes through the hidden screen index (the existing `tab` action), and the next `tab` action by the user
// brings v3 back. Rows ask for it with `data-ui3-current="<screen>"`; nothing is written to the engine.
function openCurrentUI(screenID){
  if(!ALL_SCREENS.includes(screenID))throw new RangeError(`Unknown UI v3 screen: ${screenID}`);
  const button=globalThis.document?.querySelector?.(`[data-ui3-all-screens] [data-action="tab"][data-tab="${screenID}"]`);
  if(!button)return false;
  openedCurrent.add(screenID);
  const root=globalThis.document.getElementById('modal-root');
  if(root)root.innerHTML='';
  openingCurrent=true;
  try{button.click();}finally{openingCurrent=false;}
  return true;
}
// "‹ 新しい画面に戻る" (UI3-9b-5, README 10.6): a button straight under <body> (outside #app, so no render drops it) that is
// shown only while a screen the user opened with a `data-ui3-current` row is on screen, and no sheet or dialog is open. It brings the
// same screen back in v3 through the existing `tab` action (a probe button inside #app carries it, as the hidden screen index does).
// Screens that are the current UI because of a state rule (CURRENT_UI_RULES) never get it. Visibility is refreshed after clicks;
// nothing here observes the DOM and nothing is written to the engine.
let returnTimers=[];
function returnTarget(){
  const g=modules.playerEngineBridge?.getEngine?.()?.g;
  if(!enabled||!g?.configured||g.gameOver)return null;
  const screenID=g.selectedTab;
  if(!openedCurrent.has(screenID)||CURRENT_UI_RULES[screenID]?.(g))return null;
  const root=globalThis.document?.getElementById('modal-root');
  if(root&&root.innerHTML.trim())return null;
  return screenID;
}
function syncReturnButton(){
  const doc=globalThis.document;
  if(!doc?.body)return;
  const screenID=returnTarget();
  let button=doc.getElementById('ui3-return');
  if(!screenID){button?.remove();return;}
  if(!button){
    button=doc.createElement('button');
    button.type='button';button.id='ui3-return';button.className='ui3 u-return';
    button.setAttribute('data-ui3-return','');
    button.textContent='‹ 新しい画面に戻る';
    doc.body.append(button);
  }
  button.dataset.ui3ReturnTo=screenID;
  // sit 12px above the current UI's bottom navigation wherever it is (README 10.6: never overlap it); the default is the CSS value
  const nav=doc.getElementById('d-ui-sidebar');
  const rect=nav?.getBoundingClientRect?.();
  const fixedNav=nav&&rect.height>0&&globalThis.getComputedStyle(nav).position==='fixed';
  if(fixedNav)button.style.bottom=`${Math.max(12,Math.round(globalThis.innerHeight-rect.top+12))}px`;
  else button.style.removeProperty('bottom');
}
function scheduleReturnSync(){
  for(const timer of returnTimers)globalThis.clearTimeout(timer);
  returnTimers=[0,120,400].map(delay=>globalThis.setTimeout(syncReturnButton,delay));
}
function returnToNative(screenID){
  const app=globalThis.document?.getElementById('app');
  if(!app||!ALL_SCREENS.includes(screenID))return false;
  const probe=globalThis.document.createElement('button');
  probe.type='button';probe.hidden=true;probe.dataset.action='tab';probe.dataset.tab=screenID;
  app.append(probe);
  try{probe.click();}finally{probe.remove();}
  return true;
}
globalThis.document?.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target:null;
  if(!target)return;
  const back=target.closest('[data-ui3-return]');
  if(back){returnToNative(back.dataset.ui3ReturnTo);scheduleReturnSync();return;}
  if(!openingCurrent&&openedCurrent.size&&target.closest('[data-action="tab"]'))openedCurrent.clear();
  const row=target.closest('[data-ui3-current]');
  if(row&&!row.disabled)openCurrentUI(row.dataset.ui3Current);
  if(enabled)scheduleReturnSync();
},true);

// Bottom sheet markup for detail, confirmation and the weekly report. The scrim
// closes through the existing `close-modal` action; callers place the result in
// #modal-root (js/app.js owns that node and its click delegation).
function sheet({eyebrow='',title='',subtitle='',body='',actions=''}={}){
  return '<div class="ui3"><div class="u-scrim" data-action="close-modal"></div>'
    +'<section class="u-sheet" data-modal-panel role="dialog" aria-modal="true">'
    +`<div class="u-sheet-head">${eyebrow?`<span class="u-h2">${esc(eyebrow)}</span>`:''}<h1 class="u-h1">${esc(title)}</h1>${subtitle?`<span class="u-h2">${esc(subtitle)}</span>`:''}</div>`
    +`<div class="u-sheet-body">${body}</div>${actions?`<div class="u-sheet-foot">${actions}</div>`:''}</section></div>`;
}

// Confirmation sheet for an operation that moves money and cannot be undone (contract, purchase, sale,
// investment, borrowing; README 2, decided 2026-11-11). It states what it costs and what the company
// holds afterwards, and its primary button carries the EXISTING `data-action` (plus data-id / data-kind)
// that js/app.js already handles; this component never runs anything itself. Place the result in
// #modal-root. Do not use it for an action that opens another modal (that modal would be closed with it).
//   facts:   [{label,value,tone?}]   value is already formatted; tone 'up' | 'down' colours it
//   confirm: {label,attributes}      attributes: {'data-action':…,'data-id':…}
function confirmSheet({eyebrow='確認',title='',subtitle='',facts=[],note='',confirm={},cancelLabel='やめる'}={}){
  const attributes=Object.entries(confirm.attributes||{}).map(([name,value])=>` ${esc(name)}="${esc(value)}"`).join('');
  const columns=facts.length===2?' two':'';
  const body=`<div class="u-stats${columns}" data-ui3-confirm-facts>${facts.map(fact=>`<div class="u-stat"><span>${esc(fact.label)}</span><b class="u-money${fact.tone==='up'?' u-up':fact.tone==='down'?' u-down':''}">${esc(fact.value)}</b></div>`).join('')}</div>`
    +(note?`<div class="u-h2" data-ui3-confirm-note>${esc(note)}</div>`:'');
  return sheet({eyebrow,title,subtitle,body,
    actions:`<button type="button" class="u-btn" data-action="close-modal">${esc(cancelLabel)}</button>`
      +`<button type="button" class="u-btn primary" data-ui3-confirm${attributes}>${esc(confirm.label||'実行する')}</button>`});
}
// The confirm button's action is dispatched by js/app.js's own click handler; afterwards the sheet is
// closed (unless the action put something else into #modal-root).
globalThis.document?.addEventListener('click',event=>{
  const button=event.target instanceof Element?event.target.closest('[data-ui3-confirm]'):null;
  const root=globalThis.document.getElementById('modal-root');
  if(!button||!root?.contains(button))return;
  setTimeout(()=>{if(root.querySelector('[data-ui3-confirm]'))root.innerHTML='';},0);
});

// Amount / quantity input sheet (README 5.7, UI3-9a): replaces js/app.js's askMoney dialog (and the iPhone amount
// dialog of js/iphone-playtest-fixes.js) while UI v3 is on. `amountSheet` returns true when it took the request;
// `submit(value)` is called with the number, after the sheet closed, exactly as askMoney's callback is.
// A screen may describe what the number means just before it dispatches the action: setAmountContext({unit:'株'|
// '円'|'店',unitPrice,wallet:'company'|'personal',direction:'spend'|'receive',max,note,presets:[{value,label}],
// preview:(value)=>[{label,value,tone?}]}). `presets` replace the default chips; `preview` replaces the default
// preview rows (built by the screen from read-only data: borrowing limit, debt after, ...; the shell only shows
// them). The next amountSheet uses
// it once (and it expires after a few seconds, so it never reaches an unrelated dialog). With a context that names a
// wallet the sheet shows the approximate amount and the wallet's cash afterwards; it never blocks on that (the engine
// decides whether the trade is allowed). Nothing here writes engine state.
const AMOUNT_CHIPS=Object.freeze({'株':[[100,'100'],[500,'500'],[1000,'1,000']],'円':[[100000,'10万'],[500000,'50万'],[1000000,'100万']],'店':[[1,'1'],[3,'3'],[5,'5']]});
const YEN_CHIPS_FROM=100000;   // the yen chips (10万 / 50万 / 100万) only appear when the dialog starts at 10万円 or more
const CONTEXT_TTL_MS=3000;
// a monotonic clock for the context's expiry only (production code draws no wall-clock source)
const clockNow=()=>{const now=Number(globalThis.performance?.now?.());return Number.isFinite(now)?now:0;};
let amountContext=null;
let amountPending=null;
function setAmountContext(context){amountContext=context&&typeof context==='object'?{...context,at:clockNow()}:null;}
function takeAmountContext(){
  const context=amountContext;amountContext=null;
  if(!context)return null;
  const age=clockNow()-context.at;
  return age>=0&&age<CONTEXT_TTL_MS?context:null;
}
// What the sheet accepts (design decision, 2026-11-11; engine.setDividend takes 0 and decimals): in yen, a number of
// 0 or more, decimals allowed (only a negative value or a non-number is refused; the engine refuses what it
// cannot use, e.g. an investment of 0); in shares or stores, a whole number of 1 or more.
function parseAmount(text,unit){
  const cleaned=String(text??'').replace(/,/g,'').trim();
  if(!cleaned)return {value:null,error:'数値を入力してください。'};
  const whole=unit==='株'||unit==='店';
  if(whole?!/^\d+$/.test(cleaned):!/^\d+(\.\d+)?$/.test(cleaned))return {value:null,error:whole?'1以上の整数を入力してください。':'0以上の数値を入力してください。'};
  const value=Number(cleaned);
  if(!Number.isFinite(value)||(whole&&value<1))return {value:null,error:whole?'1以上の整数を入力してください。':'0以上の数値を入力してください。'};
  return {value,error:''};
}
// A price is saved as whole yen (context.integer): the number is rounded to the nearest yen before anything uses it, so the
// preview, the confirmation and the saved value are the same number; a value that rounds to less than 1 is refused with the reason.
function roundAmount(parsed,context){
  if(!context?.integer||parsed.value===null)return parsed;
  const value=Math.round(parsed.value);
  return value<1?{value:null,error:'1円以上の金額にしてください（円未満は四捨五入します）。'}:{value,error:''};
}
function walletCash(wallet){
  const g=modules.playerEngineBridge?.getEngine?.()?.g;
  if(!g)return null;
  const cash=wallet==='company'?g.companyCash:wallet==='personal'?g.personalCash:null;
  return Number.isFinite(Number(cash))?Number(cash):null;
}
const yenText=value=>modules.engine?.compactYen?modules.engine.compactYen(value):`${Math.round(value).toLocaleString('ja-JP')}円`;
function amountSheet({title='',initial=0,submit}={}){
  if(!enabled||typeof submit!=='function'||!globalThis.document?.getElementById('modal-root'))return false;
  const g=modules.playerEngineBridge?.getEngine?.()?.g;
  if(!g?.configured)return false;
  const context=takeAmountContext();
  const unit=context?.unit||(String(title).includes('株数')?'株':String(title).includes('募集数')?'店':'円');
  const label=unit==='株'?'株数':unit==='店'?'店数':'金額（円）';
  amountPending={submit,unit,context};
  const max=Number.isFinite(Number(context?.max))&&Number(context.max)>0?Math.floor(Number(context.max)):null;
  // an initial value above the known maximum starts at the maximum (a loan dialog opened at 10M with 3.12M capacity)
  const start=max&&Number(initial)>max?max:initial;
  const presets=Array.isArray(context?.presets)?context.presets.filter(item=>item&&Number.isFinite(Number(item.value))).map(item=>[Number(item.value),String(item.label??item.value)])
    :unit==='円'&&!(Number(start)>=YEN_CHIPS_FROM)?[]:AMOUNT_CHIPS[unit];
  const chips=presets.map(([value,text])=>`<button type="button" class="u-chip" data-ui3-amount-chip="${value}">${esc(text)}</button>`).join('')
    +(max?`<button type="button" class="u-chip" data-ui3-amount-chip="${max}" data-ui3-amount-max>最大</button>`:'');
  const preview=context&&(context.wallet||typeof context.preview==='function')?`<div class="u-stats" data-ui3-amount-preview></div>`:'';
  const body=`<label class="u-field"><span>${esc(label)}</span><input class="u-input" data-ui3-amount-input inputmode="${unit==='円'?'decimal':'numeric'}" autocomplete="off" enterkeyhint="done" value="${esc(String(start??''))}" aria-describedby="ui3-amount-error"></label>`
    +(chips?`<nav class="u-chips" aria-label="入力の候補">${chips}</nav>`:'')
    +preview
    +(context?.note?`<div class="u-h2" data-ui3-amount-note>${esc(context.note)}</div>`:'')
    +`<p class="u-error" id="ui3-amount-error" role="alert" data-ui3-amount-error></p>`;
  globalThis.document.getElementById('modal-root').innerHTML=sheet({eyebrow:unit==='株'?'株数を入力':unit==='店'?'店数を入力':'金額を入力',title,body,
    actions:'<button type="button" class="u-btn" data-action="close-modal">やめる</button><button type="button" class="u-btn primary" data-ui3-amount-run>実行する</button>'});
  refreshAmount();
  globalThis.document.querySelector('#modal-root [data-ui3-amount-input]')?.focus?.({preventScroll:true});
  return true;
}
function refreshAmount(){
  const root=globalThis.document?.getElementById('modal-root');
  const input=root?.querySelector('[data-ui3-amount-input]');
  if(!input||!amountPending)return;
  const {unit,context}=amountPending;
  const parsed=roundAmount(parseAmount(input.value,unit),context);
  const {value}=parsed;
  // a known minimum (the engine's own, e.g. the venture minimum ticket) is refused here with the reason, not left to the engine
  const min=Number.isFinite(Number(context?.min))&&Number(context.min)>0?Number(context.min):null;
  const error=parsed.error||(min!==null&&value!==null&&value<min?`最低額は${yenText(min)}です。これ未満では実行できません。`:'');
  root.querySelector('[data-ui3-amount-error]').textContent=error;
  const run=root.querySelector('[data-ui3-amount-run]');
  if(run)run.disabled=Boolean(error);
  const box=root.querySelector('[data-ui3-amount-preview]');
  if(box){
    let rows=[];
    if(typeof context.preview==='function'){
      try{rows=value===null?[]:(context.preview(value)||[]);}catch(failure){rows=[];}
    }else{
      const amount=value===null?null:value*(Number.isFinite(Number(context.unitPrice))?Number(context.unitPrice):1);
      const cash=walletCash(context.wallet);
      const after=amount===null||cash===null?null:context.direction==='receive'?cash+amount:cash-amount;
      const walletName=context.wallet==='company'?'会社':'個人';
      rows=[{label:context.direction==='receive'?'概算の受取額':'概算の金額',value:amount===null?'—':yenText(amount)},
        {label:`実行後の${walletName}の現金`,value:after===null?'—':yenText(after),tone:after!==null&&after<0?'down':undefined}];
    }
    // a value above the known maximum is shown in red (the run is not stopped: the engine decides)
    const max=Number.isFinite(Number(context.max))&&Number(context.max)>0?Math.floor(Number(context.max)):null;
    if(max!==null&&value!==null&&value>max)rows=rows.map(row=>({...row,tone:'down'}));
    box.className=`u-stats${rows.length===2?' two':''}`;
    box.innerHTML=rows.map(row=>`<div class="u-stat"><span>${esc(row.label)}</span><b class="u-money${row.tone==='down'?' u-down':row.tone==='up'?' u-up':''}">${esc(row.value)}</b></div>`).join('');
  }
}
function runAmount(){
  const root=globalThis.document?.getElementById('modal-root');
  const input=root?.querySelector('[data-ui3-amount-input]');
  const pending=amountPending;
  if(!input||!pending)return;
  const {value,error}=roundAmount(parseAmount(input.value,pending.unit),pending.context);
  const min=Number.isFinite(Number(pending.context?.min))&&Number(pending.context.min)>0?Number(pending.context.min):null;
  if(error||(min!==null&&value<min)){refreshAmount();return;}
  amountPending=null;
  // an operation that moves money after the number is entered goes through a confirmation sheet first (README 6.6):
  // the screen's context.confirm(value) returns {title,subtitle,facts,note,confirmLabel}; the run waits for its button
  let parts=null;
  if(typeof pending.context?.confirm==='function'){
    try{parts=pending.context.confirm(value)||null;}catch(failure){parts=null;}
  }
  if(parts){
    amountConfirm={submit:pending.submit,value};
    root.innerHTML=confirmSheet({...parts,confirm:{label:parts.confirmLabel||'実行する',attributes:{'data-ui3-amount-confirm':''}}});
    return;
  }
  root.innerHTML='';
  pending.submit(value);
}
let amountConfirm=null;
globalThis.document?.addEventListener('click',event=>{
  const button=event.target instanceof Element?event.target.closest('[data-ui3-amount-confirm]'):null;
  if(!button||!amountConfirm)return;
  const {submit,value}=amountConfirm;
  amountConfirm=null;
  event.stopImmediatePropagation();
  globalThis.document.getElementById('modal-root').innerHTML='';
  submit(value);
},true);
// the cash the company must keep (the engine's own reserve threshold, the number the crisis notice shows); a confirmation
// whose cash-after falls under it says so in one line (it never blocks)
function reserveNote(cashAfter){
  const g=modules.playerEngineBridge?.getEngine?.()?.g;
  if(!g||!Number.isFinite(Number(cashAfter)))return '';
  const threshold=Number(modules.playerCrisis?.snapshot?.(g)?.reserveThreshold);
  if(!Number.isFinite(threshold)||threshold<=0||Number(cashAfter)>=threshold)return '';
  return `実行後の会社現金が必要準備（${yenText(threshold)}）を下回ります。資金繰り注意になるおそれがあります。`;
}
globalThis.document?.addEventListener('input',event=>{if(event.target instanceof Element&&event.target.matches('[data-ui3-amount-input]'))refreshAmount();},true);
globalThis.document?.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&event.target instanceof Element&&event.target.matches('[data-ui3-amount-input]')){event.preventDefault();runAmount();}
},true);
globalThis.document?.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target:null;
  if(!target)return;
  const chip=target.closest('[data-ui3-amount-chip]');
  if(chip){
    const input=globalThis.document.querySelector('#modal-root [data-ui3-amount-input]');
    if(input){input.value=String(chip.dataset.ui3AmountChip);refreshAmount();input.focus?.({preventScroll:true});}
    return;
  }
  if(target.closest('[data-ui3-amount-run]'))runAmount();
},true);

// Text input sheet (UI3-9b-4, README 10.5): the v3 form of js/app.js askText(). Returns true when it took the request.
// `allowEmpty` (default true, as the current dialog accepts anything) and `maxLength` (default none) let a caller pass its own rule.
let textPending=null;
function textSheet({title='',label='',initial='',submit,allowEmpty=true,maxLength=null}={}){
  if(!enabled||typeof submit!=='function'||!globalThis.document?.getElementById('modal-root'))return false;
  const g=modules.playerEngineBridge?.getEngine?.()?.g;
  if(!g?.configured)return false;
  const limit=Number.isFinite(Number(maxLength))&&Number(maxLength)>0?Math.floor(Number(maxLength)):null;
  textPending={submit,allowEmpty:allowEmpty!==false,limit};
  const body=`<label class="u-field"><span>${esc(label)}</span><input class="u-input" data-ui3-text-input type="text" autocomplete="off" enterkeyhint="done"${limit?` maxlength="${limit}"`:''} value="${esc(String(initial??''))}" aria-describedby="ui3-text-error"></label>`
    +`<p class="u-error" id="ui3-text-error" role="alert" data-ui3-text-error></p>`;
  globalThis.document.getElementById('modal-root').innerHTML=sheet({eyebrow:'入力',title,body,
    actions:'<button type="button" class="u-btn" data-action="close-modal">やめる</button><button type="button" class="u-btn primary" data-ui3-text-run>決定する</button>'});
  refreshText();
  globalThis.document.querySelector('#modal-root [data-ui3-text-input]')?.focus?.({preventScroll:true});
  return true;
}
function textError(value){
  if(!textPending)return '';
  if(!textPending.allowEmpty&&!String(value).trim())return '入力してください。';
  if(textPending.limit&&String(value).length>textPending.limit)return `${textPending.limit}文字以内で入力してください。`;
  return '';
}
function refreshText(){
  const root=globalThis.document?.getElementById('modal-root');
  const input=root?.querySelector('[data-ui3-text-input]');
  if(!input||!textPending)return;
  const error=textError(input.value);
  root.querySelector('[data-ui3-text-error]').textContent=error;
  const run=root.querySelector('[data-ui3-text-run]');
  if(run)run.disabled=Boolean(error);
}
function runText(){
  const root=globalThis.document?.getElementById('modal-root');
  const input=root?.querySelector('[data-ui3-text-input]');
  const pending=textPending;
  if(!input||!pending)return;
  if(textError(input.value)){refreshText();return;}
  const value=input.value;
  textPending=null;
  root.innerHTML='';
  pending.submit(value);
}
globalThis.document?.addEventListener('input',event=>{if(event.target instanceof Element&&event.target.matches('[data-ui3-text-input]'))refreshText();},true);
globalThis.document?.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&event.target instanceof Element&&event.target.matches('[data-ui3-text-input]')){event.preventDefault();runText();}
},true);
globalThis.document?.addEventListener('click',event=>{
  if(event.target instanceof Element&&event.target.closest('[data-ui3-text-run]'))runText();
},true);

// Sheets that js/app.js shows in #modal-root in place of a current-UI modal (README 6.1, "シート").
// A sheet module registers `render(context)` returning the arguments of sheet(); js/app.js asks
// renderSheet() first and falls back to its own modal when the answer is ''.
const SHEET_IDS=Object.freeze(['weekly-report']);
const sheetRenderers=new Map();
function registerSheet(id,definition){
  if(!SHEET_IDS.includes(id))throw new RangeError(`Unknown UI v3 sheet: ${id}`);
  if(typeof definition?.render!=='function')throw new TypeError(`UI v3 sheet ${id} requires a render function.`);
  if(sheetRenderers.has(id))throw new Error(`UI v3 sheet is already registered: ${id}`);
  sheetRenderers.set(id,Object.freeze({render:definition.render}));
  return id;
}
// The finished sheet markup, or '' when UI v3 is off, the sheet is not registered, or the game is
// not configured. context is {engine,engineModule,...}; the renderer also receives g, esc and money.
function renderSheet(id,context){
  if(!enabled||!sheetRenderers.has(id)||!context?.engine?.g?.configured)return '';
  const {engine,engineModule}=context;
  const parts=sheetRenderers.get(id).render({...context,g:engine.g,esc,money:engineModule.compactYen});
  return parts?sheet(parts):'';
}

modules.ui3=Object.freeze({
  PREFERENCE_KEY,GROUPS,SCREEN_LABELS,ALL_SCREENS,SHEET_IDS,
  enabled:()=>enabled,
  isNativeActive:()=>nativeActive,
  registeredScreens:()=>[...screens.keys()],
  stateRuleScreens:()=>Object.keys(CURRENT_UI_RULES),   // read-only: the screens a game state can send to the current UI (README 10.1)
  registeredSheets:()=>[...sheetRenderers.keys()],
  registerScreen,registerSheet,registerCrisisSheet,reserveNote,crisisSheetRegistered,openCrisisSheet,crisisStatus,registerSetup,registerGameOver,renderSetupInto,renderGameOverInto,rendersNatively,usesCurrentUI,renderApp,renderSheet,leaveNative,sheet,confirmSheet,openCurrentUI,amountSheet,textSheet,setAmountContext,esc
});
})();
