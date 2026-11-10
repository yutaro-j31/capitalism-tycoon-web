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

function groupOf(screenID){return GROUPS.find(group=>group.screens.includes(screenID))||GROUPS[0];}
function isAvailable(screenID,g){return screenID!=='pe-portfolio'||Boolean(g?.peFirm?.unlocked);}

function registerScreen(id,definition){
  if(!ALL_SCREENS.includes(id))throw new RangeError(`Unknown UI v3 screen: ${id}`);
  if(typeof definition?.render!=='function')throw new TypeError(`UI v3 screen ${id} requires a render function.`);
  if(screens.has(id))throw new Error(`UI v3 screen is already registered: ${id}`);
  screens.set(id,Object.freeze({render:definition.render}));
  return id;
}

// True when js/app.js should hand this render to UI v3. Game over and the
// founding form stay on the current UI until their own tasks port them.
function rendersNatively(screenID,g){
  return enabled&&screens.has(screenID)&&Boolean(g?.configured)&&!g?.gameOver;
}

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
  return `<div class="ui3 u-app" data-ui3-screen="${esc(screenID)}" data-ui3-group="${group.id}">${topBar(g,engineModule)}`
    +`<main id="screen" class="u-screen" data-screen="${esc(screenID)}">${chips(group,screenID,g)}${body}</main>`
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

// Bottom sheet markup for detail, confirmation and the weekly report. The scrim
// closes through the existing `close-modal` action; callers place the result in
// #modal-root (js/app.js owns that node and its click delegation).
function sheet({eyebrow='',title='',subtitle='',body='',actions=''}={}){
  return '<div class="ui3"><div class="u-scrim" data-action="close-modal"></div>'
    +'<section class="u-sheet" data-modal-panel role="dialog" aria-modal="true">'
    +`<div class="u-sheet-head">${eyebrow?`<span class="u-h2">${esc(eyebrow)}</span>`:''}<h1 class="u-h1">${esc(title)}</h1>${subtitle?`<span class="u-h2">${esc(subtitle)}</span>`:''}</div>`
    +`<div class="u-sheet-body">${body}</div>${actions?`<div class="u-sheet-foot">${actions}</div>`:''}</section></div>`;
}

modules.ui3=Object.freeze({
  PREFERENCE_KEY,GROUPS,SCREEN_LABELS,ALL_SCREENS,
  enabled:()=>enabled,
  isNativeActive:()=>nativeActive,
  registeredScreens:()=>[...screens.keys()],
  registerScreen,rendersNatively,renderApp,leaveNative,sheet,esc
});
})();
