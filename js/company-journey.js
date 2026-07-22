// Script boundary: js/company-journey.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before company-journey.js.');
const modules=globalThis.__capitalismTycoonModules;
if(modules.companyJourney)throw new Error('Capitalism Tycoon companyJourney module is already registered.');
(function(exports){
const nf=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const arr=value=>Array.isArray(value)?value:[];
const esc=value=>String(value??'').replace(/[&<>\'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const MILESTONES=Object.freeze([
 Object.freeze({id:'founded',label:'会社を創業',tab:'home',focus:'[data-screen="home"],.screen',done:g=>Boolean(g?.configured)}),
 Object.freeze({id:'firstBusiness',label:'最初の事業を開始',tab:'business',focus:'[data-screen="business"],.screen',done:g=>arr(g?.stores).some(store=>store&&store.status==='open')||arr(g?.businesses).length>0||arr(g?.productVentures).length>0}),
 Object.freeze({id:'firstWeek',label:'最初の1週間を経営',tab:'home',focus:'[data-screen="home"],.screen',done:g=>nf(g?.week,1)>1}),
 Object.freeze({id:'firstRevenue',label:'初売上を達成',tab:'report',focus:'[data-screen="report"],.screen',done:g=>nf(g?.lastReport?.revenue)>0||nf(g?.totalRevenue)>0}),
 Object.freeze({id:'profitable',label:'単週黒字を達成',tab:'report',focus:'[data-screen="report"],.screen',done:g=>nf(g?.lastReport?.profit)>0}),
 Object.freeze({id:'fiveStores',label:'5店舗へ拡大',tab:'map',focus:'[data-screen="map"],.screen',done:g=>arr(g?.stores).filter(store=>store&&store.status==='open').length>=5}),
 Object.freeze({id:'sales100m',label:'累計売上1億円',tab:'report',focus:'[data-screen="report"],.screen',done:g=>Math.max(nf(g?.totalRevenue),nf(g?.lifetimeRevenue))>=100000000}),
 Object.freeze({id:'ipo',label:'株式上場を達成',tab:'office',focus:'[data-screen="office"],.screen',done:g=>Boolean(g?.publicCompany)}),
 Object.freeze({id:'marketCap10b',label:'時価総額100億円',tab:'market',focus:'[data-screen="market"],.screen',done:g=>Math.max(nf(g?.marketCap),nf(g?.companyValue))>=10000000000}),
 Object.freeze({id:'globalCompany',label:'世界企業へ成長',tab:'strategy',focus:'[data-screen="strategy"],.screen',done:g=>nf(g?.overseasStoreCount)>0||arr(g?.overseasBusinesses).length>0||arr(g?.internationalOperations).length>0})
]);
function evaluate(state){
 const items=MILESTONES.map((milestone,index)=>Object.freeze({id:milestone.id,label:milestone.label,tab:milestone.tab,focus:milestone.focus,index,done:Boolean(milestone.done(state))}));
 const completed=items.filter(item=>item.done).length;
 const next=items.find(item=>!item.done)||null;
 return Object.freeze({items:Object.freeze(items),completed,total:items.length,percent:Math.round(completed/items.length*100),next,complete:completed===items.length});
}
function render(state){
 const journey=evaluate(state),next=journey.next;
 const rows=journey.items.map(item=>`<li><span aria-hidden="true">${item.done?'✓':'□'}</span> ${esc(item.label)}</li>`).join('');
 const action=next?`<button class="btn primary small" type="button" data-company-journey-jump="1" data-tab="${esc(next.tab)}" data-focus="${esc(next.focus)}">次の目標を確認</button>`:'';
 return `<section class="card wide" data-company-journey="1" aria-labelledby="company-journey-title"><div class="card-head"><div><h2 id="company-journey-title">会社の成長ロードマップ</h2><p>${journey.completed}/${journey.total}達成 · ${journey.percent}%</p></div><span class="badge ${journey.complete?'good':'warn'}">${journey.complete?'完遂':'Company Journey'}</span></div><div class="card-body"><div class="stat" role="status"><span>次の成長目標</span><strong>${esc(next?.label||'すべての目標を達成しました')}</strong></div><details><summary>全マイルストーンを表示</summary><ol>${rows}</ol></details><div class="button-row">${action}</div></div></section>`;
}
function engine(){return modules.playerEngineBridge?.getEngine?.()||null;}
function enhance(){
 if(typeof document==='undefined')return false;
 const screen=document.getElementById('screen');
 const existing=document.querySelector('[data-company-journey]');
 if(!screen||screen.dataset?.screen!=='home'){existing?.remove?.();return false;}
 const instance=engine();if(!instance?.g)return false;
 const html=render(instance.g);
 if(existing&&existing.outerHTML===html)return false;
 if(existing){existing.outerHTML=html;return true;}
 const host=screen.querySelector('.executive-secretary-card')||screen.firstElementChild;
 if(host?.insertAdjacentHTML)host.insertAdjacentHTML('afterend',html);else screen.insertAdjacentHTML?.('afterbegin',html);
 return true;
}
function focusTarget(selector){
 const target=(selector&&document.querySelector(selector))||document.getElementById('screen');if(!target)return false;
 target.setAttribute('tabindex',target.getAttribute('tabindex')||'-1');
 const reduce=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 target.scrollIntoView?.({block:'start',behavior:reduce?'auto':'smooth'});target.focus?.({preventScroll:true});return true;
}
let scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;(typeof queueMicrotask==='function'?queueMicrotask:setTimeout)(()=>{scheduled=false;enhance();},0);}
if(typeof document!=='undefined'){
 document.addEventListener('click',event=>{const button=event.target?.closest?.('[data-company-journey-jump]');if(!button)return;event.preventDefault();const tab=button.dataset.tab;const source=[...document.querySelectorAll('[data-action="tab"]')].find(node=>node.dataset.tab===tab);source?.click?.();setTimeout(()=>focusTarget(button.dataset.focus),0);});
 schedule();const app=document.getElementById('app');if(app&&typeof MutationObserver==='function')new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
}
exports.MILESTONES=MILESTONES;exports.evaluate=evaluate;exports.render=render;exports.enhance=enhance;exports.focusTarget=focusTarget;
})(modules.companyJourney={});
})();
