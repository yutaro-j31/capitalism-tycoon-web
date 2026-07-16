// Phase 6E-1: settings diagnostics, privacy-safe support data, and cache-safe mobile restart.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before release-diagnostics-ui.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before release-diagnostics-ui.js.');
if(modules.releaseDiagnosticsUI)throw new Error('release diagnostics UI is already registered.');

const VERSION='2.0.0-rc.1';
const SAVE_KEY='capitalism_tycoon_web_v1';
const SAVE_VERSION=9;
const SAFE_ENTRY='play.html';
const MARKER='data-release-diagnostics-card';
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function pathName(href){
  try{
    const URLClass=globalThis.URL;
    if(typeof URLClass==='function')return new URLClass(String(href||''),'https://local.invalid/').pathname;
  }catch(_){}
  return String(href||'').split(/[?#]/)[0];
}

function diagnosticSnapshot(env=globalThis){
  const location=env.location||{};
  const navigator=env.navigator||{};
  const href=String(location.href||'');
  const pathname=String(location.pathname||pathName(href)||'/');
  const entrypoint=pathname.split('/').filter(Boolean).pop()||'index.html';
  let week=null;
  let saveReadable=true;
  try{
    const raw=env.localStorage&&env.localStorage.getItem?env.localStorage.getItem(SAVE_KEY):null;
    if(raw){
      const parsed=JSON.parse(raw);
      week=Number.isFinite(Number(parsed&&parsed.week))?Number(parsed.week):null;
    }
  }catch(_){saveReadable=false;}
  return Object.freeze({
    gameVersion:VERSION,
    saveKey:SAVE_KEY,
    saveVersion:Number(modules.engine.SAVE_VERSION)||SAVE_VERSION,
    entrypoint,
    launchMode:entrypoint===SAFE_ENTRY?'最新版起動':'通常起動',
    page:pathname,
    userAgent:String(navigator.userAgent||'unknown'),
    online:navigator.onLine!==false,
    week,
    saveReadable
  });
}

function renderKey(snapshot){
  let hash=2166136261;
  const text=JSON.stringify(snapshot);
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(36);
}

function renderCard(snapshot){
  const key=renderKey(snapshot);
  const week=snapshot.week===null?'未確認':`第${snapshot.week}週`;
  const save=snapshot.saveReadable?'読込可能':'読込エラー';
  return `<section class="card release-diagnostics-card" ${MARKER}="1" data-release-diagnostics-render-key="${key}">
    <div class="card-head"><div><h2>起動・診断情報</h2><p>白画面や古い表示が発生した場合の復旧と、問い合わせ用情報をまとめます。</p></div><span class="badge good">${esc(snapshot.gameVersion)}</span></div>
    <div class="card-body">
      <div class="kpi-grid mini">
        <div class="stat"><span>起動方式</span><strong>${esc(snapshot.launchMode)}</strong><small>${esc(snapshot.entrypoint)}</small></div>
        <div class="stat"><span>セーブ</span><strong>v${esc(snapshot.saveVersion)}</strong><small>${esc(week)} · ${esc(save)}</small></div>
        <div class="stat"><span>通信</span><strong>${snapshot.online?'オンライン':'オフライン'}</strong><small>${esc(snapshot.page)}</small></div>
      </div>
      <div class="button-grid">
        <button class="btn primary" type="button" data-release-diagnostics-action="reload">最新版で再起動</button>
        <button class="btn secondary" type="button" data-release-diagnostics-action="copy">診断情報をコピー</button>
      </div>
      <p class="muted">再起動しても端末内のセーブデータは削除されません。JSON書き出しも併用すると安全です。</p>
    </div>
  </section>`;
}

function latestLaunchUrl(env=globalThis){
  const href=String(env.location&&env.location.href||'');
  try{
    const URLClass=env.URL||globalThis.URL;
    if(typeof URLClass==='function'){
      const url=new URLClass(`./${SAFE_ENTRY}`,href);
      url.search='';
      url.hash='';
      url.searchParams.set('reload',Date.now().toString(36));
      return url.toString();
    }
  }catch(_){}
  const base=href.split(/[?#]/)[0].replace(/[^/]*$/,'');
  return `${base}${SAFE_ENTRY}?reload=${Date.now().toString(36)}`;
}

function diagnosticText(env=globalThis){
  return JSON.stringify({...diagnosticSnapshot(env),generatedAt:new Date().toISOString()},null,2);
}

async function copyText(text,env=globalThis){
  const clipboard=env.navigator&&env.navigator.clipboard;
  if(clipboard&&typeof clipboard.writeText==='function'){
    await clipboard.writeText(text);
    return true;
  }
  const doc=env.document;
  if(!doc||!doc.createElement||!doc.body||!doc.body.appendChild)return false;
  const area=doc.createElement('textarea');
  area.value=text;
  area.setAttribute&&area.setAttribute('readonly','');
  area.style.position='fixed';
  area.style.opacity='0';
  doc.body.appendChild(area);
  area.select&&area.select();
  let ok=false;
  try{ok=Boolean(doc.execCommand&&doc.execCommand('copy'));}catch(_){}
  area.remove&&area.remove();
  return ok;
}

function settingsVisible(screen){
  return Boolean(screen&&screen.querySelector&&screen.querySelector('button[data-action="save-now"]'));
}

function enhance(){
  const screen=document.getElementById('screen');
  if(!screen)return false;
  const existing=screen.querySelector&&screen.querySelector(`[${MARKER}]`);
  if(!settingsVisible(screen)){
    if(existing&&existing.remove){existing.remove();return true;}
    return false;
  }
  const snapshot=diagnosticSnapshot();
  const key=renderKey(snapshot);
  if(existing&&String(existing.getAttribute&&existing.getAttribute('data-release-diagnostics-render-key')||'')===key)return false;
  const html=renderCard(snapshot);
  if(existing){existing.outerHTML=html;return true;}
  if(typeof screen.insertAdjacentHTML==='function'){
    screen.insertAdjacentHTML('beforeend',html);
    return true;
  }
  return false;
}

function flash(target,text){
  if(!target)return;
  const before=target.textContent;
  target.textContent=text;
  setTimeout(()=>{if(target.isConnected!==false)target.textContent=before;},1800);
}

async function handleClick(event){
  const target=event&&event.target&&event.target.closest?event.target.closest('[data-release-diagnostics-action]'):null;
  if(!target)return false;
  event.preventDefault&&event.preventDefault();
  event.stopPropagation&&event.stopPropagation();
  const action=target.dataset&&target.dataset.releaseDiagnosticsAction;
  if(action==='reload'){
    const url=latestLaunchUrl();
    const location=globalThis.location;
    if(location&&typeof location.assign==='function')location.assign(url);
    else if(location)location.href=url;
    return true;
  }
  if(action==='copy'){
    const ok=await copyText(diagnosticText());
    flash(target,ok?'コピーしました':'コピーできませんでした');
    return ok;
  }
  return false;
}

let observer=null;
let bound=false;
let scheduled=false;
function schedule(){
  if(scheduled)return;
  scheduled=true;
  const run=()=>{scheduled=false;enhance();};
  if(typeof queueMicrotask==='function')queueMicrotask(run);else setTimeout(run,0);
}
function install(){
  const app=document.getElementById('app');
  if(!app)return false;
  if(!bound){app.addEventListener('click',handleClick);bound=true;}
  if(!observer&&typeof MutationObserver==='function'){
    observer=new MutationObserver(schedule);
    observer.observe(app,{childList:true,subtree:true});
  }
  schedule();
  return true;
}

modules.releaseDiagnosticsUI=Object.freeze({
  VERSION,SAVE_KEY,SAVE_VERSION,SAFE_ENTRY,
  diagnosticSnapshot,renderKey,renderCard,latestLaunchUrl,diagnosticText,copyText,
  settingsVisible,enhance,handleClick,install,__installed:true
});
install();
})();
