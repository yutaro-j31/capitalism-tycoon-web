// Read-only physical iPhone release-candidate checklist and evidence export.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before physical-iphone-playtest.js.');
const modules=globalThis.__capitalismTycoonModules;
if(modules.physicalIphonePlaytest)return;
const CHECKS=Object.freeze([
 Object.freeze({id:'freshLaunch',label:'新規アクセスで創業者セットアップ画面まで到達できる'}),
 Object.freeze({id:'preSetupRecovery',label:'会社を作り直す前にJSONセーブを復元できる'}),
 Object.freeze({id:'oneWeek',label:'1週進行で週次レポートが表示され、その後も操作できる'}),
 Object.freeze({id:'fourWeeks',label:'4週進行が完了し、最終週のサマリーを確認できる'}),
 Object.freeze({id:'saveExportImport',label:'保存・JSON書き出し・リセット・JSON復元が操作できる'}),
 Object.freeze({id:'safeArea',label:'Safe Area、横スクロール、ボタン、フォーム、モーダルが使える'}),
 Object.freeze({id:'ceoDashboard',label:'CEOダッシュボードの全カードが横にはみ出さず表示される'}),
 Object.freeze({id:'capitalAllocation',label:'市場画面の資本配分・取締役会・ストレステスト関連カードが表示される'}),
 Object.freeze({id:'recoveryTarget',label:'復旧目標を70から50へ切替え、関連カードが同じ目標を示す'}),
 Object.freeze({id:'saveImmutable',label:'復旧目標の切替えだけでは保存済みゲームが変化しない'}),
 Object.freeze({id:'quota',label:'保存容量カードが表示され、JSONバックアップを書き出せる'}),
 Object.freeze({id:'reload',label:'Safari再読み込み後に同じセーブを復元できる'}),
 Object.freeze({id:'noConsoleError',label:'試しプレイ中にコンソールエラーや復旧ダイアログが出ない'}),
 Object.freeze({id:'touchTargets',label:'主要操作のタップ領域が十分で誤操作なく進められる'})
]);
const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function engine(){return modules.playerEngineBridge?.getEngine?.()||modules.saveStorage?.getActiveEngine?.()||null;}
function deviceSnapshot(env=globalThis){
 const nav=env.navigator||{},screen=env.screen||{};
 return Object.freeze({
  userAgent:String(nav.userAgent||''),platform:String(nav.platform||''),language:String(nav.language||''),
  viewport:`${Math.round(Number(env.innerWidth)||0)}x${Math.round(Number(env.innerHeight)||0)}`,
  screen:`${Math.round(Number(screen.width)||0)}x${Math.round(Number(screen.height)||0)}`,
  pixelRatio:Number(env.devicePixelRatio)||1,standalone:Boolean(nav.standalone),online:nav.onLine!==false
 });
}
function checklistState(root){
 const result={};
 for(const item of CHECKS)result[item.id]=Boolean(root?.querySelector?.(`[data-physical-check="${item.id}"]`)?.checked);
 return result;
}
function report(root,env=globalThis){
 const instance=engine(),checks=checklistState(root),passed=Object.values(checks).filter(Boolean).length;
 return Object.freeze({
  schema:'capitalism-tycoon-physical-iphone-playtest-v2',generatedAt:new Date().toISOString(),
  page:String(env.location?.href||''),device:deviceSnapshot(env),
  game:{week:Number(instance?.g?.week)||null,saveVersion:Number(instance?.g?.saveVersion)||null,configured:Boolean(instance?.g?.configured)},
  checks,passed,total:CHECKS.length,allPassed:passed===CHECKS.length,
  iphoneModel:String(root?.querySelector?.('[data-physical-field="model"]')?.value||'').trim(),
  iosVersion:String(root?.querySelector?.('[data-physical-field="ios"]')?.value||'').trim(),
  safariVersion:String(root?.querySelector?.('[data-physical-field="safari"]')?.value||'').trim(),
  notes:String(root?.querySelector?.('[data-physical-field="notes"]')?.value||'').trim()
 });
}
function filename(data){return `capitalism-tycoon-iphone-playtest-week-${data.game.week||'unknown'}.json`;}
function download(data,env=globalThis){
 if(!env.document?.createElement||!env.Blob||!env.URL?.createObjectURL)return false;
 const link=env.document.createElement('a'),href=env.URL.createObjectURL(new env.Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 link.href=href;link.download=filename(data);link.hidden=true;env.document.body?.appendChild?.(link);link.click?.();link.remove?.();
 env.setTimeout?.(()=>env.URL.revokeObjectURL?.(href),1000);return true;
}
async function copy(data,env=globalThis){
 const text=JSON.stringify(data,null,2);
 try{if(env.navigator?.clipboard?.writeText){await env.navigator.clipboard.writeText(text);return true;}}catch(_){}
 return false;
}
function renderCard(env=globalThis){
 const screen=env.document?.querySelector?.('[data-screen="settings"]');if(!screen)return false;
 let node=screen.querySelector?.('[data-physical-iphone-playtest]');
 if(node)return true;
 node=env.document.createElement('section');node.className='card';node.setAttribute('data-physical-iphone-playtest','');
 const rows=CHECKS.map(item=>`<label class="stat" style="display:flex;gap:12px;align-items:flex-start;min-height:44px"><input type="checkbox" data-physical-check="${esc(item.id)}" style="width:22px;height:22px;margin-top:2px"><span>${esc(item.label)}</span></label>`).join('');
 node.innerHTML=`<div class="card-head"><div><h2>物理iPhone試しプレイ</h2><p>RC1公開前の必須実機確認です。結果JSONはGitHub Issue #63の証跡として添付でき、ゲームセーブには保存しません。</p></div><span class="badge warn">Physical QA</span></div><div class="card-body"><div class="kpi-grid mini"><label class="stat"><span>iPhoneモデル</span><input type="text" placeholder="例: iPhone 15 Pro" data-physical-field="model"></label><label class="stat"><span>iOSバージョン</span><input type="text" inputmode="decimal" placeholder="例: 18.5" data-physical-field="ios"></label><label class="stat"><span>Safariバージョン</span><input type="text" inputmode="decimal" placeholder="例: 18.5" data-physical-field="safari"></label></div><div class="stack">${rows}</div><label class="stat"><span>気づいた点</span><textarea rows="4" placeholder="画面名、操作、発生した症状を記録。問題がなければ「問題なし」と入力" data-physical-field="notes"></textarea></label><div class="button-grid"><button class="btn primary" type="button" data-physical-action="download">結果JSONを書き出す</button><button class="btn secondary" type="button" data-physical-action="copy">結果をコピー</button></div><p class="muted" data-physical-summary aria-live="polite">0/${CHECKS.length}項目を確認済み</p></div>`;
 screen.appendChild(node);return true;
}
function updateSummary(root){const count=Object.values(checklistState(root)).filter(Boolean).length,summary=root?.querySelector?.('[data-physical-summary]');if(summary)summary.textContent=`${count}/${CHECKS.length}項目を確認済み${count===CHECKS.length?'・RC確認完了':''}`;}
async function handle(event,env=globalThis){
 const root=event.target?.closest?.('[data-physical-iphone-playtest]');if(!root)return false;
 if(event.target?.matches?.('[data-physical-check]')){updateSummary(root);return true;}
 const button=event.target?.closest?.('[data-physical-action]');if(!button)return false;
 event.preventDefault?.();const data=report(root,env),action=button.dataset.physicalAction;
 const ok=action==='download'?download(data,env):action==='copy'?await copy(data,env):false;
 const summary=root.querySelector?.('[data-physical-summary]');if(summary)summary.textContent=ok?`${data.passed}/${data.total}項目・結果を${action==='download'?'書き出しました':'コピーしました'}`:'結果を出力できませんでした';
 return ok;
}
function install(env=globalThis){
 env.document?.addEventListener?.('change',event=>handle(event,env));
 env.document?.addEventListener?.('click',event=>handle(event,env));
 const app=env.document?.getElementById?.('app');if(app&&typeof env.MutationObserver==='function')new env.MutationObserver(()=>renderCard(env)).observe(app,{childList:true,subtree:true});
 renderCard(env);return true;
}
modules.physicalIphonePlaytest=Object.freeze({CHECKS,deviceSnapshot,checklistState,report,filename,download,copy,renderCard,updateSummary,handle,install,__installed:true});
install();
})();
