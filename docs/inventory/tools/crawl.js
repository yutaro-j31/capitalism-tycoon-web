// node crawl.js <default|ui3> <out.json> [startWeek]
const {chromium}=require('playwright');const fs=require('fs');const INIT=require('./init.js');
const [mode='default',out='crawl.json',sw='30',tabsArg='']=process.argv.slice(2);
const SKIP=new Set(['tab','advance-week','advance-4','reset-game','confirm-reset','export-save','import-save','close-modal','restore-stored-save','confirm-buyout','company-buyout','confirm-accept-inbound','accept-inbound']);
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:430,height:900},acceptDownloads:true});const p=await ctx.newPage();
let perr=[];p.on('pageerror',e=>perr.push(e.message.slice(0,160)));
await p.addInitScript(INIT);
await p.goto('http://localhost:8123/index.html'+(mode==='ui3'?'?ui=3':''));await p.waitForTimeout(2500);
await p.evaluate(()=>{const f=document.getElementById('setup-form');f.requestSubmit();});await p.waitForTimeout(1200);
await p.evaluate(async(W)=>{const e=globalThis.__engine;for(let i=0;i<W;i++)e.advanceWeek(false);e.g.companyCash=1e11;e.g.personalCash=1e10;globalThis.__base=JSON.stringify(e.g);},Number(sw));
const TABS=tabsArg?tabsArg.split(','):['home','map','business','office','market','venture','ma','overseas','assets','bank','report','founder','strategy','media','legacy','missions','rivals','news','settings'];
const results=[];
async function restore(tab){await p.evaluate((tab)=>{const e=globalThis.__engine;const g=e.g;for(const k of Object.keys(g))delete g[k];Object.assign(g,JSON.parse(globalThis.__base));g.selectedTab=tab;document.getElementById('modal-root')&&(document.getElementById('modal-root').innerHTML='');document.querySelectorAll('.toast').forEach(x=>x.remove());e.emit('change');},tab);await p.waitForTimeout(60);}
async function enumerate(){return p.evaluate(()=>{const root=document.querySelector('#app');const out=[];const vis=el=>{const r=el.getBoundingClientRect();return true};
 for(const el of root.querySelectorAll('button,[data-action],input,select,textarea,a[href]')){
  const tag=el.tagName.toLowerCase();const label=(el.getAttribute('aria-label')||el.textContent||el.placeholder||el.value||el.name||el.id||'').trim().replace(/\s+/g,' ').slice(0,50);
  const ds=el.dataset;const dsAll=Object.keys(ds).filter(k=>k!=='action'&&k!=='id'&&k!=='kind').slice(0,4).map(k=>k+'='+String(ds[k]).slice(0,20)).join(';');
  out.push({tag,type:el.type||'',label,action:ds.action||'',id:ds.id||'',kind:ds.kind||'',ds:dsAll,eid:el.id||'',name:el.name||'',cls:String(el.className||'').slice(0,60),disabled:!!el.disabled,hidden:!!el.hidden||el.closest('[hidden]')!==null});}
 return out;});}
async function clickAndMeasure(tab,sig){
 await restore(tab);
 const before=await p.evaluate(()=>{const e=globalThis.__engine;return {g:JSON.stringify(e.g),calls:JSON.stringify(globalThis.__harness.protoWrapCalls),mc:JSON.stringify(globalThis.__harness.calls)}});
 perr=[];
 const r=await p.evaluate((sig)=>{const els=[...document.querySelectorAll('#app button,#app [data-action],#app a[href]')];
  const el=els.find(x=>(x.dataset.action||'')===sig.action&&(x.dataset.id||'')===sig.id&&(x.dataset.kind||'')===sig.kind&&(x.textContent||'').trim().replace(/\s+/g,' ').slice(0,50)===sig.label&&!x.disabled);
  if(!el)return {found:false};
  try{el.click();}catch(x){return {found:true,err:String(x)}}
  return {found:true};},sig);
 if(!r.found)return {found:false};
 await p.waitForTimeout(80);
 const mid=await p.evaluate(()=>{const mr=document.getElementById('modal-root');const t=[...document.querySelectorAll('.toast')].map(x=>x.textContent.trim().slice(0,80));const sheet=document.querySelector('[data-ui3-sheet],.ui3-sheet,[data-ui3-amount-sheet]');return {modal:mr?.innerHTML?mr.textContent.trim().replace(/\s+/g,' ').slice(0,80):'',sheet:sheet?sheet.textContent.trim().replace(/\s+/g,' ').slice(0,80):'',toasts:t,g:JSON.stringify(globalThis.__engine.g)}});
 let stage2=null;
 const opened=mid.modal||mid.sheet;
 if(opened){stage2=await p.evaluate(()=>{const ok=document.getElementById('modal-ok')||[...document.querySelectorAll('#modal-root [data-action^="confirm-"],#modal-root button[data-action]:not([data-action="close-modal"]),[data-ui3-sheet] button,.ui3-sheet button')].find(x=>/実行|確定|決定|OK|はい|する/.test(x.textContent));if(!ok)return {clicked:false};try{ok.click()}catch(x){return {clicked:false,err:String(x)}};return {clicked:true,label:ok.textContent.trim().slice(0,30)};});
  await p.waitForTimeout(80);}
 const after=await p.evaluate(()=>({g:JSON.stringify(globalThis.__engine.g),calls:JSON.stringify(globalThis.__harness.protoWrapCalls),mc:JSON.stringify(globalThis.__harness.calls),toasts:[...document.querySelectorAll('.toast')].map(x=>x.textContent.trim().slice(0,80))}));
 const diff=(a,b)=>{const A=JSON.parse(a),B=JSON.parse(b),o=[];for(const k of Object.keys(B))if((B[k]||0)>(A[k]||0)&&!/::(emit|runTransaction|inTransaction|save|notify|companyValue|personalNetWorth|normalize|fail|ok)$/.test(k))o.push(k.replace(/^.*::/,''));return [...new Set(o)].slice(0,12);};
 const gChanged1=mid.g!==before.g,gChanged2=after.g!==before.g;
 // which top-level keys changed
 const changedKeys=await p.evaluate(({bg})=>{const B=JSON.parse(bg),g=globalThis.__engine.g;const o=[];for(const k of new Set([...Object.keys(B),...Object.keys(g)])){if(JSON.stringify(B[k])!==JSON.stringify(g[k]))o.push(k);}return o.slice(0,15)},{bg:before.g});
 return {found:true,modal:mid.modal,sheet:mid.sheet,toasts:[...new Set([...mid.toasts,...after.toasts])].slice(0,3),stateChanged:gChanged2,stage2,fns:diff(before.calls,after.calls),mods:diff(before.mc,after.mc),changedKeys,errs:perr.slice(0,2)};
}
const tabRecs={};
for(const tab of TABS){
 await restore(tab);
 let els=await enumerate();
 // subtabs
 const subs=[...new Set(els.filter(e=>/-tab$/.test(e.action)&&e.action!=='tab').map(e=>e.action+'|'+e.id))];
 const all=[{sub:'',els}];const actv=els.find(e=>/-tab$/.test(e.action)&&e.action!=='tab'&&/active/.test(e.cls));const defaultSub=actv?actv.action+'|'+actv.id:(subs[0]||'');
 for(const s of subs){const [a,id]=s.split('|');await p.evaluate(({a,id})=>{[...document.querySelectorAll('#app button')].find(x=>x.dataset.action===a&&x.dataset.id===id)?.click()},{a,id});await p.waitForTimeout(80);all.push({sub:s,els:await enumerate()});}
 tabRecs[tab]=[];
 for(const grp of all){
  const seen={};
  for(const e of grp.els){
   const rec={tab,sub:grp.sub,...e};
   if(e.tag==='button'||e.action){
     const key=[e.action,e.label.replace(/[0-9,.%¥円万億]+/g,'#')].join('|');
     seen[key]=(seen[key]||0);seen[key]++;
     if(seen[key]>1){rec.dup=true;}
     else if(!e.action||!SKIP.has(e.action)){
       if(e.disabled)rec.measure={disabled:true};
       else{ { const subTarget=grp.sub?grp.sub:(defaultSub||''); if(subTarget){await restore(tab);const [a,id]=subTarget.split('|');await p.evaluate(({a,id})=>{[...document.querySelectorAll('#app button')].find(x=>x.dataset.action===a&&x.dataset.id===id)?.click()},{a,id});await p.waitForTimeout(60);} }
         rec.measure=await clickAndMeasure(tab,{action:e.action,id:e.id,kind:e.kind,label:e.label}).catch(x=>({error:String(x).slice(0,100)}));}
     } else rec.measure={skipped:true};
   }
   results.push(rec);
  }
 }
 fs.appendFileSync(out,JSON.stringify(results.filter(r=>r.tab===tab))+'\n');console.log(tab,results.filter(r=>r.tab===tab).length);
}
await b.close();})();
