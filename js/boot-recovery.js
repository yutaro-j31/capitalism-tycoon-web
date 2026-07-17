// Phase 6E-3: minimal recovery before the main runtime and styles are available.
(function(){'use strict';
const SLOT=Symbol.for('capitalismTycoon.bootRecovery');
if(globalThis[SLOT])throw new Error('boot recovery is already installed.');
const SAVE_KEY='capitalism_tycoon_web_v1';
const ROOT_ID='boot-recovery-root';
let latest=null;
let active=true;

const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const clip=(value,max=400)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
function sourcePath(value,env=globalThis){
  const text=String(value??'').trim();
  if(!text||text==='undefined'||text==='null')return '';
  try{return new (env.URL||URL)(text,env.location?.href||'https://local.invalid/').pathname||'';}catch(_){return text.split(/[?#]/)[0].slice(-240);}
}
function record(error,meta={},env=globalThis){
  const object=error&&typeof error==='object'?error:{};
  return Object.freeze({
    kind:clip(meta.kind||object.name||'boot',80),
    name:clip(object.name||'Error',80),
    message:clip(object.message||error||meta.message||'起動処理に失敗しました'),
    source:sourcePath(meta.source||object.fileName||'',env),
    line:Number.isFinite(Number(meta.line))?Number(meta.line):null,
    column:Number.isFinite(Number(meta.column))?Number(meta.column):null,
    occurredAt:new Date().toISOString()
  });
}
function readSave(env=globalThis){
  try{
    const raw=env.localStorage?.getItem?.(SAVE_KEY)||'';
    if(!raw)return {raw:'',week:'unknown'};
    try{const parsed=JSON.parse(raw);return {raw,week:Number.isFinite(Number(parsed?.week))?Number(parsed.week):'unknown'};}
    catch(_){return {raw,week:'unknown'};}
  }catch(_){return {raw:'',week:'unknown'};}
}
function launchUrl(env=globalThis){
  const href=String(env.location?.href||'');
  try{
    const url=new (env.URL||URL)('./play.html',href);
    url.search='';url.hash='';url.searchParams.set('reload',Date.now().toString(36));
    return url.toString();
  }catch(_){return `${href.split(/[?#]/)[0].replace(/[^/]*$/,'')}play.html?reload=${Date.now().toString(36)}`;}
}
function root(env=globalThis){
  let node=env.document?.getElementById?.(ROOT_ID);
  if(node)return node;
  if(!env.document?.createElement||!env.document?.body?.appendChild)return null;
  node=env.document.createElement('div');node.id=ROOT_ID;env.document.body.appendChild(node);return node;
}
function render(item,env=globalThis){
  const save=readSave(env);
  const location=[item.source,item.line].filter(value=>value!==null&&value!=='').join(':')||item.kind;
  return `<div role="dialog" aria-modal="true" aria-labelledby="boot-recovery-title" style="position:fixed;inset:0;z-index:2147483647;background:#02070f;color:#f5f7fb;display:grid;place-items:center;padding:20px;padding-top:max(20px,env(safe-area-inset-top));padding-bottom:max(20px,env(safe-area-inset-bottom));font:16px/1.5 -apple-system,BlinkMacSystemFont,sans-serif"><section style="width:min(520px,100%);max-height:90vh;overflow:auto;background:#111b2d;border:1px solid #33415c;border-radius:16px;padding:20px;box-sizing:border-box"><h1 id="boot-recovery-title" style="font-size:22px;margin:0 0 8px">起動エラーから復旧</h1><p style="margin:0 0 16px;color:#c7d2e5">ゲームの読み込み中に問題が発生しました。端末内のセーブは削除していません。</p><div style="background:#08101f;border-radius:10px;padding:12px;margin-bottom:16px;overflow-wrap:anywhere"><strong>${esc(item.message)}</strong><br><small>${esc(location)}</small></div><div style="display:grid;gap:10px"><button type="button" data-boot-recovery-action="reload" style="min-height:44px;border:0;border-radius:10px;font-weight:700">最新版で再起動</button><button type="button" data-boot-recovery-action="backup" ${save.raw?'':'disabled'} style="min-height:44px;border:0;border-radius:10px;font-weight:700">JSONバックアップ</button><button type="button" data-boot-recovery-action="close" style="min-height:44px;border:1px solid #64748b;border-radius:10px;background:transparent;color:inherit">画面に戻る</button></div></section></div>`;
}
function show(item,env=globalThis){const node=root(env);if(!node)return false;latest=item;node.innerHTML=render(item,env);node.hidden=false;return true;}
function dismiss(env=globalThis){const node=env.document?.getElementById?.(ROOT_ID);if(!node)return false;node.innerHTML='';node.hidden=true;return true;}
function capture(error,meta={},env=globalThis){if(!active)return false;return show(record(error,meta,env),env);}
function download(env=globalThis){
  const save=readSave(env);if(!save.raw)return false;
  if(!env.document?.createElement||!env.Blob||!env.URL?.createObjectURL)return false;
  const link=env.document.createElement('a');const href=env.URL.createObjectURL(new env.Blob([save.raw],{type:'application/json'}));
  link.href=href;link.download=`capitalism-tycoon-boot-recovery-week-${save.week}.json`;link.click?.();setTimeout(()=>env.URL.revokeObjectURL?.(href),1000);return true;
}
function onError(event){
  if(!active)return;
  if(event?.target&&event.target!==globalThis&&!event.error){
    const tag=String(event.target.tagName||'').toLowerCase();
    if(tag==='script'||tag==='link')capture('必要なファイルを読み込めませんでした',{kind:'resource',source:event.target.src||event.target.href||''});
    return;
  }
  capture(event?.error||event?.message||'起動処理に失敗しました',{kind:'error',source:event?.filename,line:event?.lineno,column:event?.colno});
}
function onRejection(event){if(active)capture(event?.reason||'起動中のPromise処理に失敗しました',{kind:'unhandledrejection'});}
function onClick(event){
  const target=event?.target?.closest?.('[data-boot-recovery-action]');if(!target)return;
  event.preventDefault?.();event.stopPropagation?.();
  const action=target.dataset?.bootRecoveryAction;
  if(action==='reload'){const url=launchUrl();if(location?.assign)location.assign(url);else location.href=url;}
  else if(action==='backup')download();
  else if(action==='close')dismiss();
}
function handoff(env=globalThis){
  active=false;env.removeEventListener?.('error',onError,true);env.removeEventListener?.('unhandledrejection',onRejection);env.document?.removeEventListener?.('click',onClick);dismiss(env);return latest;
}
function install(env=globalThis){env.addEventListener?.('error',onError,true);env.addEventListener?.('unhandledrejection',onRejection);env.document?.addEventListener?.('click',onClick);return true;}
const api=Object.freeze({SAVE_KEY,ROOT_ID,record,readSave,launchUrl,render,show,dismiss,capture,download,handoff,install,__installed:true});
Object.defineProperty(globalThis,SLOT,{value:api,configurable:false,enumerable:false,writable:false});
install();
})();
