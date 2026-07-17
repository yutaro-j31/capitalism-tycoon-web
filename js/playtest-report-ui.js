// Phase 6E-4: privacy-safe playtest report download and recent UI action breadcrumbs.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before playtest-report-ui.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before playtest-report-ui.js.');
if(!modules.releaseDiagnosticsUI?.__installed)throw new Error('release-diagnostics-ui.js must be loaded before playtest-report-ui.js.');
if(modules.playtestReportUI)throw new Error('playtest report UI is already registered.');

const SCHEMA_VERSION=1;
const KIND='capitalism-tycoon-playtest-report';
const MAX_ACTIONS=30;
const BUTTON_MARKER='data-playtest-report-button';
const ACTION_SELECTOR='[data-action],[data-release-diagnostics-action],[data-runtime-recovery-action],[data-boot-recovery-action]';
const actions=[];
let observer=null;
let installed=false;
let scheduled=false;

function safeToken(value,max=80){
  const text=String(value??'').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9:_-]*$/.test(text)&&text.length<=max?text:'';
}
function utf8Bytes(value){
  let total=0;
  for(const char of String(value??'')){
    const code=char.codePointAt(0);
    total+=code<=0x7f?1:code<=0x7ff?2:code<=0xffff?3:4;
  }
  return total;
}
function checksum(value){
  let hash=2166136261;
  for(const char of String(value??'')){
    const code=char.codePointAt(0);
    hash^=code&255;hash=Math.imul(hash,16777619);
    if(code>255){hash^=(code>>>8)&255;hash=Math.imul(hash,16777619);}
    if(code>65535){hash^=(code>>>16)&255;hash=Math.imul(hash,16777619);}
  }
  return `fnv1a32-${(hash>>>0).toString(16).padStart(8,'0')}`;
}
function record(action,detail={},now=Date.now()){
  const name=safeToken(action);
  if(!name)return false;
  const item={at:new Date(now).toISOString(),action:name};
  for(const key of ['source','tab','kind','binding']){
    const value=safeToken(detail[key]);
    if(value)item[key]=value;
  }
  actions.push(Object.freeze(item));
  if(actions.length>MAX_ACTIONS)actions.splice(0,actions.length-MAX_ACTIONS);
  return true;
}
function activeTab(env=globalThis){
  const node=env.document?.querySelector?.('.tabs button.active');
  return safeToken(node?.dataset?.tab)||null;
}
function saveFingerprint(env=globalThis){
  try{
    const raw=env.localStorage?.getItem?.(modules.releaseDiagnosticsUI.SAVE_KEY)||'';
    if(!raw)return Object.freeze({present:false,readable:true,bytes:0,checksum:null});
    let readable=true;
    try{JSON.parse(raw);}catch(_){readable=false;}
    return Object.freeze({present:true,readable,bytes:utf8Bytes(raw),checksum:checksum(raw)});
  }catch(_){return Object.freeze({present:false,readable:false,bytes:null,checksum:null});}
}
function viewport(env=globalThis){
  return Object.freeze({
    width:Number.isFinite(Number(env.innerWidth))?Number(env.innerWidth):null,
    height:Number.isFinite(Number(env.innerHeight))?Number(env.innerHeight):null,
    devicePixelRatio:Number.isFinite(Number(env.devicePixelRatio))?Number(env.devicePixelRatio):null,
    orientation:safeToken(env.screen?.orientation?.type,40)||null
  });
}
function buildReport(env=globalThis){
  return Object.freeze({
    schemaVersion:SCHEMA_VERSION,
    kind:KIND,
    generatedAt:new Date().toISOString(),
    diagnostics:modules.releaseDiagnosticsUI.diagnosticSnapshot(env),
    viewport:viewport(env),
    visibility:safeToken(env.document?.visibilityState,24)||'unknown',
    activeTab:activeTab(env),
    save:saveFingerprint(env),
    recentActions:actions.slice()
  });
}
function filename(report){
  const week=Number.isFinite(Number(report?.diagnostics?.week))?Number(report.diagnostics.week):'unknown';
  const stamp=String(report?.generatedAt||new Date().toISOString()).replace(/[:.]/g,'-');
  return `capitalism-tycoon-playtest-week-${week}-${stamp}.json`;
}
function download(env=globalThis){
  const report=buildReport(env);
  if(!env.document?.createElement||!env.Blob||!env.URL?.createObjectURL)return false;
  const link=env.document.createElement('a');
  const href=env.URL.createObjectURL(new env.Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));
  link.href=href;link.download=filename(report);link.hidden=true;
  env.document.body?.appendChild?.(link);
  link.click?.();link.remove?.();
  setTimeout(()=>env.URL.revokeObjectURL?.(href),1000);
  return true;
}
function flash(target,text){
  if(!target)return;
  const before=target.textContent;target.textContent=text;
  setTimeout(()=>{if(target.isConnected!==false)target.textContent=before;},1800);
}
function enhance(env=globalThis){
  const card=env.document?.querySelector?.('[data-release-diagnostics-card]');
  if(!card)return false;
  if(card.querySelector?.(`[${BUTTON_MARKER}]`))return false;
  const grid=card.querySelector?.('.button-grid');
  if(!grid||!env.document?.createElement)return false;
  const button=env.document.createElement('button');
  button.type='button';button.className='btn secondary';
  button.setAttribute(BUTTON_MARKER,'1');
  button.setAttribute('data-playtest-report-action','download');
  button.textContent='不具合報告ファイルを保存';
  grid.appendChild(button);
  return true;
}
function schedule(env=globalThis){
  if(scheduled)return;
  scheduled=true;
  const run=()=>{scheduled=false;enhance(env);};
  if(typeof env.queueMicrotask==='function')env.queueMicrotask(run);else setTimeout(run,0);
}
function eventAction(target){
  if(target?.dataset?.action)return {action:target.dataset.action,source:'click',tab:target.dataset.tab,kind:target.dataset.kind};
  if(target?.dataset?.releaseDiagnosticsAction)return {action:`diagnostics-${target.dataset.releaseDiagnosticsAction}`,source:'click'};
  if(target?.dataset?.runtimeRecoveryAction)return {action:`runtime-recovery-${target.dataset.runtimeRecoveryAction}`,source:'click'};
  if(target?.dataset?.bootRecoveryAction)return {action:`boot-recovery-${target.dataset.bootRecoveryAction}`,source:'click'};
  return null;
}
function handleClick(event,env=globalThis){
  const reportTarget=event?.target?.closest?.('[data-playtest-report-action]');
  if(reportTarget){
    event.preventDefault?.();event.stopPropagation?.();
    record('playtest-report-download',{source:'click'});
    const ok=download(env);flash(reportTarget,ok?'保存しました':'保存できませんでした');return ok;
  }
  const target=event?.target?.closest?.(ACTION_SELECTOR);
  const info=eventAction(target);
  return info?record(info.action,info):false;
}
function handleChange(event){
  const target=event?.target?.closest?.('[data-bind]');
  return target?record('setting-change',{source:'change',binding:target.dataset?.bind}):false;
}
function handleSubmit(event){
  return event?.target?.id==='setup-form'?record('setup-submit',{source:'submit'}):false;
}
function install(env=globalThis){
  if(installed)return false;
  installed=true;
  env.document?.addEventListener?.('click',event=>handleClick(event,env),true);
  env.document?.addEventListener?.('change',handleChange,true);
  env.document?.addEventListener?.('submit',handleSubmit,true);
  const app=env.document?.getElementById?.('app');
  if(app&&typeof env.MutationObserver==='function'){
    observer=new env.MutationObserver(()=>schedule(env));observer.observe(app,{childList:true,subtree:true});
  }
  schedule(env);return true;
}

modules.playtestReportUI=Object.freeze({
  SCHEMA_VERSION,KIND,MAX_ACTIONS,safeToken,utf8Bytes,checksum,record,activeTab,saveFingerprint,
  viewport,buildReport,filename,download,enhance,handleClick,handleChange,handleSubmit,install,__installed:true
});
install();
})();
