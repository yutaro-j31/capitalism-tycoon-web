'use strict';
// Diagnostic only: no production changes or canonical registration. Exit 1 is RED.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadGame}=require('./harness');
const {prepareAcceptedPE,makeRandom,economic}=require('./fixtures/pe-fund-acquisition-atomicity');
const {indexedDBFor,inject}=require('./fixtures/pe-fund-acquisition-faults');
const clone=x=>JSON.parse(JSON.stringify(x));
const DIR=path.resolve(process.env.WRITER_AUDIT_DIR||'artifacts/pe-portfolio-exit-audit');
function find(g,f){const fund=g.peFirm.funds.find(x=>x.id===f.fundID);return{fund,deal:fund.deals.find(x=>x.id===f.portfolioID)};}
function summary(g,f){const{fund,deal}=find(g,f);return{companyCash:g.companyCash,personalCash:g.personalCash,fundCash:fund.cash,distributed:fund.distributed,lpDistributed:fund.lpDistributed,gpDistributed:fund.gpDistributed,gpCarryPaid:fund.gpCarryPaid,coinvestReturned:fund.coinvestReturned,coinvestCapital:g.peFirm.coinvestCapital,status:deal.status,investedAmount:deal.investedAmount,exitProceeds:deal.exitProceeds,settlement:deal.settlement,transactions:g.finance.transactions.length,news:g.news.length,rng:clone(g.simulationRng),saveSequence:g.saveSequence};}
async function makeFixture(){
 const s=loadGame({headless:true,random:makeRandom()}),p=prepareAcceptedPE(s.modules,true);
 assert.equal(p.e.closeMADeal(p.dealID),true,'actual accepted PE acquisition closes');
 const fund=p.e.g.peFirm.funds.find(x=>x.id===p.fundID),deal=fund.deals.at(-1);
 assert.ok(deal.portfolioCompany&&deal.status==='active');
 // Controlled eligibility witness, matching existing exit-preview tests; not natural 156-week play.
 p.e.g.week=deal.acquiredWeek+156;
 deal.portfolioCompany.improvementScore=67;
 assert.equal(s.modules.finance.validate(clone(p.e.g)).ok,true,'valid baseline company ledger');
 const f={g:clone(p.e.g),fundID:fund.id,portfolioID:deal.id};
 for(const method of ['sale','ipo'])assert.equal(p.e.previewPEPortfolioExit(f.fundID,f.portfolioID,{method}).ok,true,'eligible '+method+' '+JSON.stringify(p.e.getPEPortfolioExitCapabilities(f.fundID,f.portfolioID)));
 return f;
}
async function setup(f){const durable=new Map(),control={attempts:[]},s=loadGame({headless:true,random:makeRandom(),indexedDB:indexedDBFor(durable,control)}),e=new s.engineModule.TycoonEngine(clone(f.g)),backend=s.modules.saveStorageIDB,key=s.engineModule.SAVE_KEY;await backend.hydrate();assert.equal(e.save(),true);await backend.flush();assert.equal(durable.get(key),backend.readSync(key));return{...s,e,key,backend,durable,control};}
function delta(a,b,p=''){const out=[];for(const k of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){const x=a?.[k],y=b?.[k],at=p?`${p}.${k}`:k;if(JSON.stringify(x)===JSON.stringify(y))continue;if(x&&y&&typeof x==='object'&&typeof y==='object'&&!Array.isArray(x)&&!Array.isArray(y))out.push(...delta(x,y,at));else out.push({path:at,before:x,after:y});}return out;}
async function fresh(s,f){const h=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await h.modules.saveStorageIDB.hydrate();const g=clone(h.engineModule.TycoonEngine.load().g);return{summary:summary(g,f),g};}
async function scenario(f,method,kind,pending=false,route='engine'){
 const s=await setup(f);if(pending){s.control.holdPut=true;assert.equal(s.e.save(),true);await new Promise(r=>setTimeout(r,0));assert.equal(typeof s.control.release,'function','real fake-IDB in-flight hold');}
 const before=clone(s.e.g),baseline=s.backend.readSync(s.key),oldDurable=s.durable.get(s.key),puts=s.control.attempts.length;
 const fault=kind==='normal'?{hits:()=>0,restore(){}}:inject(s.e,s.modules,s.ctx.localStorage,s.key,kind);
 const events=[],baseEmit=s.e.emit;s.e.emit=function(type='change',...args){events.push(type);return baseEmit.call(this,type,...args);};
 let returned,error;try{if(route==='adapter'){s.modules.playerEngineBridge.bindEngine(s.e);returned=s.modules.peUIAdapter.performPortfolio('exit',{fundID:f.fundID,dealID:f.portfolioID,method});}else returned=s.e.exitPEPortfolioCompany(f.fundID,f.portfolioID,{method});}catch(ex){error={message:ex.message,stack:ex.stack};}finally{s.e.emit=baseEmit;fault.restore();}
 if(kind!=='normal')assert.ok(fault.hits()>0,'injection reached final installed exit');
 const live=clone(s.e.g),immediate={mirror:s.ctx.__localStorageData.get(s.key),cache:s.backend.readSync(s.key),durable:s.durable.get(s.key),status:s.backend.status()};
 s.control.release?.();await s.backend.flush();const afterFlush=s.durable.get(s.key),loaded=clone(s.engineModule.TycoonEngine.load().g),firstFresh=await fresh(s,f);
 assert.equal(s.e.save(),true,'later healthy save');await s.backend.flush();const recoveryRaw=s.durable.get(s.key),recoveryLoad=clone(s.engineModule.TycoonEngine.load().g),recoveryFresh=await fresh(s,f);
 const result={route,method,fault:kind,pending,returned,error,hits:fault.hits(),events,before:summary(before,f),after:summary(live,f),liveRestored:JSON.stringify(live)===JSON.stringify(before),rngUnchanged:JSON.stringify(live.simulationRng)===JSON.stringify(before.simulationRng),ledgerUnchanged:JSON.stringify(live.finance)===JSON.stringify(before.finance),putsAdded:s.control.attempts.length-puts,immediateMirrorBaseline:immediate.mirror===baseline,immediateCacheBaseline:immediate.cache===baseline,immediateDurableBaseline:immediate.durable===oldDurable,flushBaseline:afterFlush===baseline,reload:summary(loaded,f),fresh:firstFresh.summary,recoveryReload:summary(recoveryLoad,f),recoveryFresh:recoveryFresh.summary,changes:delta(before,live)};
 fs.writeFileSync(path.join(DIR,`${route}-${method}-${pending?'pending-':''}${kind}.json`),JSON.stringify({result,before,live,baseline,oldDurable,immediate,afterFlush,loaded,fresh:firstFresh.g,recoveryRaw,recoveryLoad,recoveryFresh:recoveryFresh.g},null,2));
 if(kind==='normal'){assert.equal(returned,true);assert.equal(result.after.status,'exited');assert.equal(result.after.companyCash,result.before.companyCash);assert.equal(result.rngUnchanged,true);assert.equal(s.modules.finance.validate(clone(live)).ok,true);}
 console.log(JSON.stringify({route,method,fault:kind,pending,returned,error:error?.message,liveRestored:result.liveRestored,personalCashDelta:result.after.personalCash-result.before.personalCash,status:result.after.status,flushStatus:result.reload.status,recoveryStatus:result.recoveryFresh.status}));return result;
}
if(require.main===module)(async()=>{fs.mkdirSync(DIR,{recursive:true});const f=await makeFixture();fs.writeFileSync(path.join(DIR,'fixture.json'),JSON.stringify(f));const results=[];
 for(const method of ['sale','ipo']){results.push(await scenario(f,method,'normal'));for(const kind of ['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change'])results.push(await scenario(f,method,kind));for(const kind of ['save-false','save-throw','change'])results.push(await scenario(f,method,kind,true));}
 for(const method of ['sale','ipo'])for(const kind of ['normal','save-false','mirror','save-throw'])results.push(await scenario(f,method,kind,false,'adapter'));
 fs.writeFileSync(path.join(DIR,'node-result.json'),JSON.stringify({sha:'fbfdccdbdbee8f98aa7d6cbef3ec7e411e48ddc7',fakeIndexedDB:true,physicalInFlightHold:true,results},null,2));
 assert.ok(results.filter(x=>x.fault!=='normal').every(x=>x.liveRestored),'RED: failed PE portfolio exit must restore full live state');
})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={makeFixture,find,summary,clone};
