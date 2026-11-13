// usage: node harness.js <mode: default|ui3> <weeks> <out.json>
const {chromium}=require('playwright');const fs=require('fs');
const [mode='default',weeks='80',out='out.json']=process.argv.slice(2);
const INIT=`
(()=>{
const calls={},reads={},sets=[],snaps=[],enh=[];
const fileOf=()=>{const st=(new Error()).stack||'';const m=[...st.matchAll(/\\/js\\/([a-z0-9-]+)\\.js/g)].map(x=>x[1]);return m;};
const wrapped={};const enhRun={};globalThis.__enhRun=enhRun;globalThis.__mo=new MutationObserver(()=>{});document.readyState;
const wrapMod=(mk,v)=>new Proxy({},{
 get(_,p){const val=Reflect.get(v,p);if(typeof p==='string'){const f=fileOf();const key=mk+'.'+p;const e=reads[key]||(reads[key]={n:0,by:{}});e.n++;const c=f[0]||'(none)';e.by[c]=(e.by[c]||0)+1;}
  if(typeof val==='function'&&!/^class\\s/.test(Function.prototype.toString.call(val))){return new Proxy(val,{apply(fn,th,args){if(mk==='uiEnhancerRegistry'&&p==='registerUIEnhancer'&&args[0]&&typeof args[0].enhance==='function'){const def=args[0],oe=def.enhance,id=String(def.id);const caller=fileOf()[0]||'(none)';def.enhance=function(){const t0=performance.now();globalThis.__mo.takeRecords();const r=oe.apply(this,arguments);const recs=globalThis.__mo.takeRecords().length;const e=enhRun[id]||(enhRun[id]={n:0,mut:0,ms:0,caller});e.n++;e.mut+=recs;e.ms+=performance.now()-t0;return r;};}const key=mk+'.'+String(p);const e=calls[key]||(calls[key]={n:0,by:{}});e.n++;const c=fileOf()[0]||'(none)';e.by[c]=(e.by[c]||0)+1;return Reflect.apply(fn,th,args);}});}
  return val;},
 set(_,p,val){v[p]=val;return true;},has(_,p){return p in v;},ownKeys(){return Reflect.ownKeys(v);},
 getOwnPropertyDescriptor(_,p){const d=Reflect.getOwnPropertyDescriptor(v,p);if(d)d.configurable=true;return d;},
 getPrototypeOf(){return Reflect.getPrototypeOf(v);}
});
const store=Object.create(null);
const reg=new Proxy(store,{
 set(t,k,v){sets.push(k);t[k]=v;delete wrapped[k];return true;},
 get(t,k){const v=t[k];if(v&&typeof v==='object'&&typeof k==='string'&&!/^__/.test(k)){return wrapped[k]||(wrapped[k]=wrapMod(k,v));}return v;},
 has(t,k){return k in t;},ownKeys(t){return Reflect.ownKeys(t);},getOwnPropertyDescriptor(t,k){return Reflect.getOwnPropertyDescriptor(t,k);}
});
Object.defineProperty(globalThis,'__capitalismTycoonModules',{value:reg,writable:false,configurable:false,enumerable:false});
const protoSeen=new Map();const protoWrapCalls={};
globalThis.__snap=(name)=>{
 if(!globalThis.__moDone&&document.documentElement){globalThis.__moDone=1;globalThis.__moInit();}
 const E=store.engine&&store.engine.TycoonEngine;const changed=[];
 if(E){const proto=E.prototype;for(const k of Object.getOwnPropertyNames(proto)){const d=Object.getOwnPropertyDescriptor(proto,k);const cur=d.value||d.get;if(protoSeen.get(k)!==cur){if(k!=='constructor')changed.push(k+(d.get?'(accessor)':''));
   if(typeof d.value==='function'&&k!=='constructor'){const orig=d.value;const w=new Proxy(orig,{apply(fn,th,args){const key=name+'::'+k;protoWrapCalls[key]=(protoWrapCalls[key]||0)+1;return Reflect.apply(fn,th,args);}});try{Object.defineProperty(proto,k,{...d,value:w});protoSeen.set(k,w);}catch(e){protoSeen.set(k,cur);}}
   else protoSeen.set(k,cur);}}}
 snaps.push({name,changed,setIdx:sets.length});
};
globalThis.__harness={calls,reads,sets,snaps,protoWrapCalls,enhRun};document.addEventListener('DOMContentLoaded',()=>{});globalThis.__moInit=()=>{__mo.observe(document,{subtree:true,childList:true,attributes:true,characterData:true});};

const gtrace={reads:{},writes:{},dels:{}};
const UNW=new WeakMap();const _sc=globalThis.structuredClone;globalThis.structuredClone=function(v,o){return _sc.call(globalThis,UNW.get(v)||v,o);};
globalThis.__gtrace=gtrace;
globalThis.__installG=(e)=>{
 Error.stackTraceLimit=7;
 let raw=e.g;
 const sig=()=>{const st=(new Error()).stack.split('\\n').slice(2);const fr=[];for(const l of st){const m=l.match(/at (?:(.*?) \\()?.*?(?:\\/js\\/([a-z0-9-]+)\\.js|(<anonymous>))/);if(!m)continue;if(l.includes('__installG')||l.includes('/harness'))continue;fr.push((m[1]||'?')+'@'+(m[2]||'native'));if(fr.length>=4)break;}return fr.join(' < ');};
 const add=(tbl,k,sg)=>{const t=tbl[k]||(tbl[k]={n:0,s:{}});t.n++;if(Object.keys(t.s).length<40||t.s[sg]!==undefined)t.s[sg]=(t.s[sg]||0)+1;};
 const mk=(o)=>new Proxy(o,{
  get(t,k,r){const v=Reflect.get(t,k,r);if(typeof k==='string')add(gtrace.reads,k,sig());return v;},
  set(t,k,v,r){if(typeof k==='string')add(gtrace.writes,k,sig());return Reflect.set(t,k,v,r);},
  defineProperty(t,k,d){if(typeof k==='string')add(gtrace.writes,k,sig()+' [define]');return Reflect.defineProperty(t,k,d);},
  deleteProperty(t,k){if(typeof k==='string')add(gtrace.dels,k,sig());return Reflect.deleteProperty(t,k);}
 });
 let prox=mk(raw);UNW.set(prox,raw);
 Object.defineProperty(e,'g',{configurable:true,get(){return prox;},set(v){raw=v;prox=mk(v);UNW.set(prox,raw);}});
};
// capture engine
const ael=EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener=function(t,f,o){if(t==='change'&&this&&this.g&&!globalThis.__engine){globalThis.__engine=this;}return ael.call(this,t,f,o);};
})();`;
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:430,height:900}});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,200)));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))});
await p.addInitScript(INIT);
await p.route('**/index.html*',async r=>{let t=await (await r.fetch()).text();t=t.replace(/(<script[^>]*src="\.\/js\/([a-z0-9-]+)\.js[^"]*"[^>]*><\/script>)/g,(m,a,n)=>a+'<script>__snap("'+n+'")</script>');r.fulfill({body:t,contentType:'text/html'});});
await p.goto('http://localhost:8123/index.html'+(mode==='ui3'?'?ui=3':''));await p.waitForTimeout(2500);
await p.evaluate(()=>__snap('post-boot'));
// new game
await p.evaluate(()=>{const f=document.getElementById('setup-form');if(f){f.requestSubmit?f.requestSubmit():f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));}});
await p.waitForTimeout(1500);
console.log('errs0',errs.slice(0,40));
const info=await p.evaluate(()=>({has:!!globalThis.__engine,configured:globalThis.__engine?.g?.configured,week:globalThis.__engine?.g?.week,keys:globalThis.__engine?Object.keys(globalThis.__engine.g).length:0}));
console.log('after setup',JSON.stringify(info));
if(process.env.TRACE_G){await p.evaluate(()=>{globalThis.__installG(globalThis.__engine);const e=globalThis.__engine;globalThis.__gsnap={};for(const k of Object.keys(e.g))globalThis.__gsnap[k]=JSON.stringify(e.g[k]);});}

if(process.env.ENRICH){
 const enr=await p.evaluate(()=>{const e=globalThis.__engine,g=e.g,log=[];const T=(n,f)=>{try{const r=f();log.push(n+':'+(r===undefined?'ok':JSON.stringify(r)).slice(0,60));}catch(x){log.push(n+':ERR '+String(x.message).slice(0,60));}};
  g.personalCash=3e10;T('inject',()=>e.contributeFounderCapital(2.5e10));
  const props=g.properties.slice(0,12).map(p=>p.id);
  for(let i=0;i<6;i++)T('buyProp'+i,()=>e.buyProperty(props[i],'company'));
  for(let i=6;i<9;i++)T('buyPPersonal'+i,()=>e.buyProperty(props[i],'personal'));
  T('office',()=>e.contractOffice(g.rentalOffices[0]?.id));
  T('establishBoard',()=>e.establishBoard());
  for(const id of ['accounting','hr','product','operations','marketing','dx','investment']){T('dept-'+id,()=>e.establishDepartment(id));}
  Object.keys(g.departments||{}).forEach(id=>T('staff-'+id,()=>e.hireDepartmentStaff(id,2)));
  (g.executiveMarket||[]).slice(0,3).forEach(c=>T('exec-'+c.id,()=>e.hireExecutive(c.id)));
  T('genMA',()=>e.generateMATargets(true));
  (g.startups||[]).slice(0,3).forEach(s=>T('vc-'+s.id,()=>e.investStartup(s.id,s.minTicket||5e6,'company')));
  (g.market||[]).slice(0,3).forEach(m=>{T('buyStock-'+m.id,()=>e.buyStock(m.id,500,'company'));T('buyStockP-'+m.id,()=>e.buyStock(m.id,300,'personal'));});
  T('foundDigital',()=>e.foundDigitalBusiness('app'));
  T('openOverseas',()=>e.openOverseas('usa','ramen'));
  T('createPE',()=>e.createPEDeal('テック',2e7,'company'));
  T('angel',()=>e.createAngelInvestment(5e6));
  T('personalInv',()=>e.buyPersonalInvestment('index',1e6));
  T('luxury',()=>e.buyLuxury(g.luxuryAuctionListings?.[0]?.id));
  (g.tenants||[]).slice(0,4).forEach(t=>T('store-'+t.id,()=>e.openStore({tenantID:t.id,businessID:'ramen',name:'検証店'})));
  T('ipo',()=>e.executeIPO('東証グロース',0));
  T('subsidiary',()=>e.makeSubsidiary(g.startups.find(s=>s.playerInvested||s.companyInvestment||s.invested)?.id||g.startups[0].id));
  T('ipoSub',()=>e.ipoSubsidiary((g.subsidiaries[0]||{}).id));
  T('formPEFund',()=>e.formPEFund({gpCommit:1e8}));
  T('setDividend',()=>e.setDividend?.(10));
  return log;});
 console.log('enrich',JSON.stringify(enr).slice(0,1500));
 await p.waitForTimeout(500);
}
const W=Number(weeks);
const adv=await p.evaluate(async(W)=>{const e=globalThis.__engine;let i=0,err=null;try{for(;i<W&&!e.g.gameOver;i++){e.advanceWeek(false);}}catch(x){err=String(x&&x.stack||x).slice(0,400)}return {i,err,week:e.g.week,over:e.g.gameOver}},W);
console.log('advance',JSON.stringify(adv));
// visit tabs
const tabs=await p.evaluate(()=>[...document.querySelectorAll('[data-action="tab"]')].map(x=>x.dataset.tab));
const uniq=[...new Set(tabs)];
const tabLog=[];const attrsByTab={};
for(const t of ['home','map','business','office','market','venture','ma','overseas','assets','bank','report','founder','strategy','media','legacy','missions','rivals','news','settings','pe-portfolio']){
  try{ await p.evaluate(t=>{const e=globalThis.__engine;e.g.selectedTab=t;e.emit('change');},t);await p.waitForTimeout(150);attrsByTab[t]=await p.evaluate(()=>{const o=new Set();for(const e of document.querySelectorAll('*')){for(const a of e.attributes)if(a.name.startsWith('data-'))o.add(a.name);for(const c of e.classList)o.add('.'+c);if(e.id)o.add('#'+e.id);}return [...o];});tabLog.push(t+':'+await p.evaluate(()=>document.querySelector('[data-ui3-screen]')?('u3:'+document.querySelector('[data-ui3-screen]').dataset.ui3Screen):('d:'+(document.querySelector('[data-screen]')?.dataset.screen||''))));}catch(x){tabLog.push(t+':ERR')}
}
const subtabs=await p.evaluate(async()=>{const out=[];for(const b of [...document.querySelectorAll('button[data-action$="-tab"]:not([data-action="tab"])')]){out.push(b.dataset.action+':'+b.dataset.id);}return out;});
const res=await p.evaluate(()=>{const e=globalThis.__engine;const ch=[];if(globalThis.__gsnap){for(const k of Object.keys(e.g)){let j;try{j=JSON.stringify(e.g[k])}catch(x){j='ERR'}if(j!==globalThis.__gsnap[k])ch.push(k);}}
 const raw=e.g;const sizes={};for(const k of Object.keys(raw)){try{sizes[k]=(JSON.stringify(raw[k])||'').length}catch(x){sizes[k]=-1}}
 const types={};for(const k of Object.keys(raw)){const v=raw[k];types[k]=Array.isArray(v)?'array':v===null?'null':typeof v;}
 return {h:globalThis.__harness,gk:Object.keys(raw),changed:ch,gt:globalThis.__gtrace,week:raw.week,sizes,types,final:Object.fromEntries(Object.keys(raw).map(k=>{const v=raw[k];return [k,typeof v==='object'?undefined:v]}))}});
res.subtabs=subtabs;res.attrsByTab=attrsByTab;
res.tabLog=tabLog;res.errs=errs.slice(0,30);res.adv=adv;
fs.writeFileSync(out,JSON.stringify(res));
console.log('errs',errs.length,errs.slice(0,5));
await b.close();})();
