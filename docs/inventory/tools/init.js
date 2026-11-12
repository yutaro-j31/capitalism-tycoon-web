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
module.exports=INIT;
