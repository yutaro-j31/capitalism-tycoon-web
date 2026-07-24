// Public-play UI for quota-safe save status and truthful manual save feedback.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.saveStorage?.__installed)throw new Error('save-storage.js must be loaded before save-storage-ui.js.');
if(modules.saveStorageUI)return;
const storage=modules.saveStorage;
const ROOT_SELECTOR='[data-save-storage-health]';
const MODE_LABELS=Object.freeze({raw:'通常保存',normal:'履歴整理済み',emergency:'容量節約',critical:'最小履歴',failed:'保存失敗','serialize-error':'作成失敗'});
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const bytes=value=>{const n=Number(value)||0;if(n>=1024*1024)return `${(n/1024/1024).toFixed(2)} MB`;if(n>=1024)return `${(n/1024).toFixed(0)} KB`;return `${n} B`;};
function engine(){return storage.getActiveEngine?.()||null;}
function info(){return engine()?._lastSaveStorageInfo||null;}
function toast(message,severity='info'){
 const root=document.getElementById('toast-root');if(!root)return false;
 const el=document.createElement('div');el.className=`toast ${severity}`;el.textContent=message;root.appendChild(el);
 setTimeout(()=>el.classList.add('show'),10);setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),250);},3600);return true;
}
function cardModel(){
 const current=info();
 const mode=current?.mode||'not-saved';
 const ok=current?.ok!==false;
 const label=MODE_LABELS[mode]||'未確認';
 const size=current?.bytes?bytes(current.bytes):'未確認';
 const original=current?.originalBytes&&current.originalBytes!==current.bytes?`（整理前 ${bytes(current.originalBytes)}）`:'';
 const removed=Number(current?.transactions?.removed)||0;
 return {mode,ok,label,size,original,removed};
}
function renderCard(){
 const screen=document.querySelector('[data-screen="settings"]');if(!screen)return false;
 let node=screen.querySelector(ROOT_SELECTOR);
 if(!node){node=document.createElement('section');node.className='card';node.setAttribute('data-save-storage-health','');screen.appendChild(node);}
 const model=cardModel();
 const key=JSON.stringify(model);
 if(node.dataset.saveStorageRenderKey===key)return true;
 node.dataset.saveStorageRenderKey=key;
 node.innerHTML=`<div class="card-head"><div><h2>セーブ容量</h2><p>iPhoneの保存上限に合わせて古い履歴を整理します。会社・個人資産と会計累計は保持されます。</p></div><span class="badge ${model.ok?'good':'danger'}">${esc(model.label)}</span></div><div class="card-body"><div class="kpi-grid mini"><div class="stat"><span>保存状態</span><strong>${model.ok?'保存可能':'要バックアップ'}</strong></div><div class="stat"><span>保存サイズ</span><strong>${esc(model.size)}</strong><small>${esc(model.original)}</small></div><div class="stat"><span>整理した会計明細</span><strong>${model.removed.toLocaleString('ja-JP')}件</strong></div><div class="stat"><span>セーブ形式</span><strong>v${storage.SAVE_VERSION}</strong><small>${esc(storage.SAVE_KEY)}</small></div></div>${model.ok?'':'<p class="empty">以前のセーブは残っています。JSON書き出しを保存してから再試行してください。</p>'}</div>`;
 return true;
}
function handleSaveClick(event){
 const target=event.target?.closest?.('[data-action="save-now"],[data-action="save-slot"]');
 if(!target)return false;
 const instance=engine();if(!instance)return false;
 event.preventDefault?.();event.stopImmediatePropagation?.();event.stopPropagation?.();
 const slot=target.dataset.action==='save-slot'?target.dataset.id:null;
 const ok=instance.save(slot);
 if(ok)toast(slot?`スロット${slot}に保存しました。`:'保存しました。','success');
 else toast('保存できませんでした。以前のセーブは残っています。JSONバックアップを保存してください。','error');
 renderCard();return true;
}
function install(){
 document.addEventListener('click',handleSaveClick,true);
 const app=document.getElementById('app');if(app&&typeof MutationObserver==='function')new MutationObserver(()=>renderCard()).observe(app,{childList:true,subtree:true});
 renderCard();return true;
}
modules.saveStorageUI=Object.freeze({MODE_LABELS,bytes,engine,info,cardModel,toast,renderCard,handleSaveClick,install,__installed:true});
install();
})();