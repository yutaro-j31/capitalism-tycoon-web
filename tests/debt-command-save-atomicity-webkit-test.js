'use strict';
// Installed debt commands, real iPhone WebKit emulation and real IndexedDB (not a physical device).
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {fixture,command,VARIANTS,AMOUNT}=require('./fixtures/debt-command-atomicity');
const {inject}=require('./fixtures/pe-fund-acquisition-faults');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/debt-command-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const file=path.resolve(ROOT,new URL(req.url,'http://localhost').pathname.slice(1)||'index.html');assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
const FAULTS=['normal','save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','notify','pending-save-false','pending-save-throw'];
async function run(browser,url,f,fault,reference){
 const context=await browser.newContext(options),p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});
 await p.evaluate(`globalThis.__debtInject=(${inject.toString()});globalThis.__debtCommand=(s)=>{const AMOUNT=${AMOUNT};return (${command.toString()})(s);};`);
 const proof=await p.evaluate(async({f,fault,reference})=>{
  const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(f.g),b=m.saveStorageIDB,key=m.engine.SAVE_KEY,call=()=>__debtCommand({game:e,variant:f.variant});
  const economic=g=>{const c=JSON.parse(JSON.stringify(g));delete c.lastSaveDate;delete c.saveSequence;return c;};
  await b.hydrate();if(!b.status().available)throw Error('real IDB required');if(!e.save())throw Error('baseline');await b.flush();
  const durable=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('capitalism-tycoon',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction('saves','readonly'),g=t.objectStore('saves').get(key);t.oncomplete=()=>{db.close();resolve(g.result);};t.onerror=()=>reject(t.error);};});
  const pending=fault.startsWith('pending-'),kind=fault.replace(/^pending-/,''),normal=kind==='normal';
  if(pending&&!e.save())throw Error('pending predecessor');
  const before=JSON.stringify(e.g),bytes=b.readSync(key),injection=normal?{hits:()=>0,restore(){}}:__debtInject(e,m,localStorage,key,kind);
  let result,error;try{result=call();}catch(ex){error=ex.message;}finally{injection.restore();}
  if(normal){if(result!==true||error)throw Error('normal command');}
  else{
   if(!injection.hits())throw Error('fault not reached');
   if(['save-false','mirror','enqueue-false','enqueue-throw'].includes(kind)?result!==false||error:!/threw/.test(error||''))throw Error('fault result '+JSON.stringify({result,error}));
   if(JSON.stringify(e.g)!==before||localStorage.getItem(key)!==bytes||b.readSync(key)!==bytes)throw Error('live/mirror/cache rollback');
   await b.flush();if(await durable()!==bytes)throw Error('failed debt became durable');
   if(!e.save())throw Error('recovery save');await b.flush();
   if(call()!==true)throw Error('retry');
  }
  await b.flush();if(await durable()!==b.readSync(key))throw Error('durable commit');
  if(!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok)throw Error('accounting');
  const expected=economic(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g);
  if(reference&&JSON.stringify(expected)!==JSON.stringify(reference))throw Error('retry differs from unfaulted state');
  if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw Error('save identity');
  return {expected,variant:f.variant,fault};
 },{f,fault,reference});
 const loaded=async page=>page.evaluate(async()=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;delete g.lastSaveDate;delete g.saveSequence;return g;});
 await p.reload({waitUntil:'networkidle'});assert.deepEqual(await loaded(p),proof.expected,'production reload');
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});assert.deepEqual(await loaded(fp),proof.expected,'fresh durable-only hydration');
 await fresh.close();await context.close();return proof;
}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();const url='http://127.0.0.1:'+server.address().port+'/';
 for(const variant of VARIANTS){const s=await fixture(variant),f={g:JSON.parse(JSON.stringify(s.game.g)),variant};let reference;
  for(const fault of FAULTS){const proof=await run(browser,url,f,fault,reference);reference=reference||proof.expected;results.push({variant,fault,ok:true});console.log(variant+' '+fault+' rollback/retry/reload/fresh real IDB PASS');fs.writeFileSync(path.join(DIR,'debt-command-result.json'),JSON.stringify({physicalDevice:false,ok:false,results},null,2));}}
 fs.writeFileSync(path.join(DIR,'debt-command-result.json'),JSON.stringify({physicalDevice:false,ok:true,results},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
