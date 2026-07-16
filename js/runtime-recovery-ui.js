// Phase 6E-2: non-destructive recovery UI for uncaught browser runtime failures.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before runtime-recovery-ui.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before runtime-recovery-ui.js.');
if(!modules.releaseDiagnosticsUI?.__installed)throw new Error('release-diagnostics-ui.js must be loaded before runtime-recovery-ui.js.');
if(modules.runtimeRecoveryUI)throw new Error('runtime recovery UI is already registered.');

const ROOT_ID='runtime-recovery-root';
const SAVE_KEY=modules.releaseDiagnosticsUI.SAVE_KEY;
const MAX_MESSAGE=500;
let lastSignature='';
let lastCapturedAt=0;
let handling=false;

const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const clip=(value,max=MAX_MESSAGE)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
function sourcePath(value){
  const text=String(value||'');
  try{return new URL(text,globalThis.location?.href||'https://local.invalid/').pathname||'';}catch(_){return text.split(/[?#]/)[0].slice(-240);}
}
function buildRecord(error,meta={}){
  const object=error&&typeof error==='object'?error:{};
  const message=clip(object.message||error||meta.message||'不明な実行時エラー');
  return Object.freeze({
    kind:clip(meta.kind||object.name||'error',80),
    name:clip(object.name||'Error',80),
    message,
    source:sourcePath(meta.source||object.fileName||''),
    line:Number.isFinite(Number(meta.line))?Number(meta.line):null,
    column:Number.isFinite(Number(meta.column))?Number(meta.column):null,
    occurredAt:new Date().toISOString()
  });
}
function readSave(env=globalThis){
  try{
    const raw=env.localStorage?.getItem?.(SAVE_KEY)||'';
    if(!raw)return {raw:'',state:null,error:null};
    try{return {raw,state:JSON.parse(raw),error:null};}
    catch(error){return {raw,state:null,error:clip(error?.message||error,200)};}
  }catch(error){return {raw:'',state:null,error:clip(error?.message||error,200)};}
}
function supportPayload(record,env=globalThis){
  let diagnostics={};
  try{diagnostics=JSON.parse(modules.releaseDiagnosticsUI.diagnosticText(env));}catch(_){}
  return Object.freeze({...diagnostics,runtimeError:{kind:record.kind,name:record.name,message:record.message,source:record.source,line:record.line,column:record.column,occurredAt:record.occurredAt}});
}
function backupFilename(save){
  const week=Number.isFinite(Number(save.state?.week))?Number(save.state.week):'unknown';
  return `capitalism-tycoon-recovery-week-${week}.json`;
}
function downloadBackup(env=globalThis){
  const save=readSave(env);
  if(!save.raw)return false;
  const doc=env.document;
  const URLApi=env.URL;
  if(!doc?.createElement||!env.Blob||!URLApi?.createObjectURL)return false;
  const link=doc.createElement('a');
  const href=URLApi.createObjectURL(new env.Blob([save.raw],{type:'application/json'}));
  link.href=href;
  link.download=backupFilename(save);
  link.click?.();
  setTimeout(()=>URLApi.revokeObjectURL?.(href),1000);
  return true;
}
function renderPanel(record,env=globalThis){
  const save=readSave(env);
  const backup=Boolean(save.raw);
  const code=[record.source,record.line].filter(value=>value!==null&&value!=='').join(':')||record.kind;
  return `<div style="position:fixed;inset:0;z-index:2147483646;background:rgba(2,7,15,.94);display:grid;place-items:center;padding:20px;padding-top:max(20px,env(safe-area-inset-top));padding-bottom:max(20px,env(safe-area-inset-bottom))" role="dialog" aria-modal="true" aria-labelledby="runtime-recovery-title">
    <section class="card" style="width:min(560px,100%);max-height:90vh;overflow:auto">
      <div class="card-head"><div><h2 id="runtime-recovery-title">エラーから復旧</h2><p>画面処理で問題が発生しました。端末内のセーブは削除していません。</p></div><span class="badge warn">RECOVERY</span></div>
      <div class="card-body">
        <div class="empty" style="text-align:left"><strong>${esc(record.message)}</strong><br><small>${esc(code)}</small></div>
        ${save.error?`<p class="muted">セーブ確認: ${esc(save.error)}</p>`:''}
        <div class="button-grid">
          <button class="btn primary" type="button" data-runtime-recovery-action="reload">最新版で再起動</button>
          <button class="btn secondary" type="button" data-runtime-recovery-action="backup" ${backup?'':'disabled'}>JSONバックアップ</button>
          <button class="btn secondary" type="button" data-runtime-recovery-action="copy">診断情報をコピー</button>
          <button class="btn ghost" type="button" data-runtime-recovery-action="close">画面に戻る</button>
        </div>
        <p class="muted">エラーは抑止していません。戻った後も操作できない場合は、JSONバックアップを保存して最新版で再起動してください。</p>
      </div>
    </section>
  </div>`;
}
function root(env=globalThis){
  let node=env.document?.getElementById?.(ROOT_ID);
  if(node)return node;
  if(!env.document?.createElement||!env.document?.body?.appendChild)return null;
  node=env.document.createElement('div');
  node.id=ROOT_ID;
  node.setAttribute?.('data-runtime-recovery-root','');
  env.document.body.appendChild(node);
  return node;
}
function show(record,env=globalThis){
  const node=root(env);
  if(!node)return false;
  node.innerHTML=renderPanel(record,env);
  node.hidden=false;
  node.__runtimeRecoveryRecord=record;
  return true;
}
function close(env=globalThis){
  const node=env.document?.getElementById?.(ROOT_ID);
  if(!node)return false;
  node.innerHTML='';
  node.hidden=true;
  node.__runtimeRecoveryRecord=null;
  return true;
}
function capture(error,meta={},env=globalThis){
  if(handling)return false;
  const record=buildRecord(error,meta);
  const signature=[record.kind,record.message,record.source,record.line,record.column].join('|');
  const now=Date.now();
  if(signature===lastSignature&&now-lastCapturedAt<1500)return false;
  lastSignature=signature;lastCapturedAt=now;handling=true;
  try{return show(record,env);}finally{handling=false;}
}
async function handleClick(event,env=globalThis){
  const target=event?.target?.closest?.('[data-runtime-recovery-action]');
  if(!target)return false;
  event.preventDefault?.();event.stopPropagation?.();
  const action=target.dataset?.runtimeRecoveryAction;
  const record=env.document?.getElementById?.(ROOT_ID)?.__runtimeRecoveryRecord||buildRecord('不明な実行時エラー');
  if(action==='close')return close(env);
  if(action==='reload'){
    const url=modules.releaseDiagnosticsUI.latestLaunchUrl(env);
    if(env.location?.assign)env.location.assign(url);else if(env.location)env.location.href=url;
    return true;
  }
  if(action==='backup')return downloadBackup(env);
  if(action==='copy'){
    const ok=await modules.releaseDiagnosticsUI.copyText(JSON.stringify(supportPayload(record,env),null,2),env);
    const before=target.textContent;target.textContent=ok?'コピーしました':'コピーできませんでした';
    setTimeout(()=>{if(target.isConnected!==false)target.textContent=before;},1800);
    return ok;
  }
  return false;
}
function onError(event){
  if(event?.target&&event.target!==globalThis&&!event.error)return;
  capture(event?.error||event?.message||'実行時エラー',{kind:'error',source:event?.filename,line:event?.lineno,column:event?.colno});
}
function onRejection(event){capture(event?.reason||'未処理のPromiseエラー',{kind:'unhandledrejection'});}
function install(env=globalThis){
  env.addEventListener?.('error',onError);
  env.addEventListener?.('unhandledrejection',onRejection);
  env.document?.addEventListener?.('click',event=>handleClick(event,env));
  return true;
}
modules.runtimeRecoveryUI=Object.freeze({ROOT_ID,SAVE_KEY,buildRecord,readSave,supportPayload,backupFilename,downloadBackup,renderPanel,show,close,capture,handleClick,install,__installed:true});
install();
})();
