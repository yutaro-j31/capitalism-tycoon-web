'use strict';
// P4-AUD-004: real iPhone WebKit engine + real durable IndexedDB, not a physical device.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/p4-aud-004-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server=http.createServer((req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(ROOT,pathname==='/'?'index.html':decodeURIComponent(pathname).slice(1));
 assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
 res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));
}catch(err){res.statusCode=404;res.end(String(err));}});
async function projection(page){return page.evaluate(()=>{
 const m=globalThis.__capitalismTycoonModules,e=m.engine.TycoonEngine.load(),g=e.g;
 const loan=g.realEstateMarket?.loans?.find(x=>x.propertyID==='P4-004-WB'&&x.owner==='personal');
 return {personalCash:g.personalCash,personalDebt:g.personalDebt,companyCash:g.companyCash,
 companyDebt:g.companyDebt,loanBalance:loan?.balance,loanStatus:loan?.status,
 financeRows:g.finance.transactions.length,valid:m.finance.validate(JSON.parse(JSON.stringify(g))).ok};
});}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/';let browser;
 try{browser=await webkit.launch();const context=await browser.newContext(options),page=await context.newPage();
 await page.goto(url,{waitUntil:'networkidle'});
 const proof=await page.evaluate(async()=>{
  const m=globalThis.__capitalismTycoonModules,key=m.engine.SAVE_KEY;
  const state=m.engine.createInitialState({configured:true});
  Object.assign(state,{configured:true,week:10,companyCash:100_000_000,companyDebt:0,personalCash:80_000_000,personalDebt:0,
    properties:[{id:'P4-004-WB',name:'Property Tower',owner:'personal',purchasePrice:300_000_000,marketValue:300_000_000,
      realEstate:{monthlyRent:4_000_000,occupancyRate:1,expenseRatio:.2}}]});
  state.finance=m.finance.defaultFinanceState(state);
  const e=new m.engine.TycoonEngine(state);
  if(!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok)throw Error('invalid initial books');
  if(!e.save())throw Error('initial save failed');
  const loan=e.borrowAgainstProperty('P4-004-WB',30_000_000,{rateType:'fixed',termWeeks:260});
  if(!loan||e.g.personalDebt!==30_000_000)throw Error('unable to originate specialist loan');
  await m.saveStorageIDB.flush();
  const durable=()=>new Promise((resolve,reject)=>{
   const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);
   open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);
    tx.oncomplete=()=>{const val=get.result;db.close();resolve(val)};tx.onerror=()=>reject(tx.error);};
  });
  const before=JSON.stringify(e.g),mirror=localStorage.getItem(key),priorDurable=await durable();
  let attemptedSave=false;const originalSave=e.save;e.save=()=>{attemptedSave=true;throw Error('rejected command called save');};
  let rejected;
  try{rejected=e.repay(30_000_000,'personal');}finally{e.save=originalSave;}
  await m.saveStorageIDB.flush();
  const rejectedClean=rejected===false&&!attemptedSave&&JSON.stringify(e.g)===before
   &&localStorage.getItem(key)===mirror&&m.saveStorageIDB.readSync(key)===mirror&&(await durable())===priorDurable;
  if(!rejectedClean)throw Error('invalid reject boundary '+JSON.stringify({rejected,attemptedSave}));
  if(e.borrow(5_000_000,'personal')!==true||e.g.personalDebt!==35_000_000)throw Error('generic borrowing');
  const mixed=JSON.stringify(e.g),mixedMirror=localStorage.getItem(key);
  if(e.repay(6_000_000,'personal')!==false||JSON.stringify(e.g)!==mixed||localStorage.getItem(key)!==mixedMirror)
    throw Error('mixed overpayment must reject atomically');
  if(e.repay(5_000_000,'personal')!==true)throw Error('valid generic repayment');
  if(e.g.personalDebt!==30_000_000||loan.balance!==30_000_000)throw Error('generic repayment stole specialist principal');
  if(e.prepayRealEstateLoan(loan.id,1_000_000)!==true)throw Error('specialist prepay failed');
  if(e.g.personalDebt!==29_000_000||loan.balance!==29_000_000)throw Error('specialist prepay out of sync');
  if(!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok)throw Error('company books changed');
  await m.saveStorageIDB.flush();
  return {rejectedClean,personalCash:e.g.personalCash,personalDebt:e.g.personalDebt,companyCash:e.g.companyCash,
   companyDebt:e.g.companyDebt,loanBalance:loan.balance,loanID:loan.id,sequence:JSON.parse(await durable()).saveSequence};
 });
 const expected=await projection(page);
 assert.equal(expected.personalDebt,29_000_000);assert.equal(expected.loanBalance,29_000_000);
 assert.equal(expected.companyDebt,0);assert.equal(expected.valid,true);
 await page.reload({waitUntil:'networkidle'});assert.deepEqual(await projection(page),expected,'production reload');
 const storage=await context.storageState({indexedDB:true});
 const fresh=await browser.newContext({...options,storageState:storage}),freshPage=await fresh.newPage();
 await freshPage.goto(url,{waitUntil:'networkidle'});
 assert.deepEqual(await projection(freshPage),expected,'fresh iPhone WebKit IndexedDB hydration');
 fs.writeFileSync(path.join(DIR,'p4-aud-004-result.json'),JSON.stringify({device:'iPhone 13 WebKit',proof,expected},null,2));
 console.log('P4-AUD-004 real WebKit, rejection/no writes, generic and specialist payoff, reload/IndexedDB PASS');
 await fresh.close();await context.close();
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(err=>{console.error(err);process.exitCode=1;});
