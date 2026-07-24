'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {ROOT,loadGame}=require('./harness');

const source=fs.readFileSync(path.join(ROOT,'js','save-storage.js'),'utf8');
assert.doesNotMatch(source,/SAVE_KEY\s*=\s*['"][^'"]+['"]/, 'quota layer must reuse the engine SAVE_KEY');
assert.doesNotMatch(source,/saveVersion\s*:\s*10|SAVE_VERSION\s*=\s*10/, 'quota layer must not bump saveVersion');
assert.doesNotMatch(source,/Math\.random|Date\.now\(/, 'quota compaction must be deterministic');

const {ctx,modules}=loadGame({random:()=>0.25});
vm.runInContext(source,ctx,{filename:'js/save-storage.js'});
const storage=modules.saveStorage;
const engine=ctx.__ct_engine;
assert.ok(storage?.__installed,'save storage module must install');
assert.equal(storage.SAVE_KEY,'capitalism_tycoon_web_v1');
assert.equal(storage.SAVE_VERSION,9);
assert.equal(engine.__quotaSafeSaveInstalled,true);

engine.g.week=180;
engine.g.companyCash=50_000_000;
engine.g.personalCash=7_000_000;
engine.g.reports=Array.from({length:180},(_,index)=>({week:index+1,summary:`report-${index}`,detail:'報告'.repeat(1200)}));
engine.g.news=Array.from({length:320},(_,index)=>`第${320-index}週：ニュース${index}`);
engine.g.history=Array.from({length:620},(_,index)=>`第${620-index}週 履歴${index}`);
for(const key of ['weeklySalesHistory','weeklyProfitHistory','companyValueHistory','personalNetWorthHistory'])engine.g[key]=Array.from({length:620},(_,index)=>index+1);
engine.g.market.forEach((stock,index)=>{stock.priceHistory=Array.from({length:620},(_,week)=>({week:week+1,price:100+index+week}));});
engine.g.startups.forEach((startup,index)=>{startup.reports=Array.from({length:90},(_,week)=>({week:week+1,text:`startup-${index}-${week}`}));});

const ledger=engine.g.finance;
ledger.openingCash=10_000_000;
ledger.archivedProfitTotal=1234;
ledger.archivedDividendTotal=456;
ledger.archivedOperatingCashFlow=100;
ledger.archivedInvestingCashFlow=200;
ledger.archivedFinancingCashFlow=300;
ledger.weeklySnapshots=Array.from({length:180},(_,index)=>({week:index+1,openingCash:index,endingCash:index+1,operatingCashFlow:1,investingCashFlow:0,financingCashFlow:0}));
const categories=['revenue','payroll','capitalExpenditure','debtBorrowing','dividend'];
ledger.transactions=Array.from({length:3200},(_,index)=>{
 const category=categories[index%categories.length];
 const amount=1000+(index%17);
 const cashEffect=category==='revenue'||category==='debtBorrowing'?amount:-amount;
 const profitEffect=category==='revenue'?amount:category==='payroll'?-amount:0;
 return {id:`txn-${index}`,transactionID:`txn-${index}`,operationID:`op-${index}`,idempotencyKey:null,week:1+Math.floor(index/18),category,amount,cashEffect,profitEffect,assetEffect:0,liabilityEffect:0,equityEffect:0,description:`取引${index}-${'x'.repeat(260)}`};
});
ledger.transactions[0].idempotencyKey='mission-protected-transaction';

function cashRoll(finance){return Math.round((Number(finance.archivedOperatingCashFlow||0)+Number(finance.archivedInvestingCashFlow||0)+Number(finance.archivedFinancingCashFlow||0)+finance.transactions.reduce((sum,row)=>sum+Number(row.cashEffect||0),0))*100)/100;}
function profitRoll(finance){return Math.round((Number(finance.archivedProfitTotal||0)+finance.transactions.reduce((sum,row)=>sum+Number(row.profitEffect||0),0))*100)/100;}
function dividendRoll(finance){return Math.round((Number(finance.archivedDividendTotal||0)+finance.transactions.filter(row=>row.category==='dividend').reduce((sum,row)=>sum-Number(row.cashEffect||0),0))*100)/100;}

const before={cash:cashRoll(ledger),profit:profitRoll(ledger),dividend:dividendRoll(ledger),transactions:ledger.transactions.length,reports:engine.g.reports.length,companyCash:engine.g.companyCash,personalCash:engine.g.personalCash};
const raw=JSON.stringify(engine.g);
const normal=storage.storagePayload(engine.g,'normal');
assert.ok(raw.length>storage.RAW_COMPACTION_THRESHOLD,'fixture must exceed proactive compaction threshold');
assert.ok(normal.payload.length<raw.length,'normal compaction must reduce the payload');
const quota=normal.payload.length+256;
const map=ctx.__localStorageData;
ctx.localStorage.setItem=(key,value)=>{const text=String(value);if(text.length>quota){const error=new Error('The quota has been exceeded.');error.name='QuotaExceededError';error.code=22;throw error;}map.set(key,text);};

assert.equal(engine.save(),true,'oversized save must compact and succeed');
assert.equal(engine._lastSaveStorageInfo.mode,'normal');
const storedRaw=map.get(storage.SAVE_KEY);
assert.ok(storedRaw&&storedRaw.length<=quota,'stored payload must fit the simulated iPhone quota');
const stored=JSON.parse(storedRaw);
assert.equal(stored.saveVersion,9);
assert.equal(stored.week,180);
assert.equal(stored.companyCash,before.companyCash);
assert.equal(stored.personalCash,before.personalCash);
assert.ok(stored.finance.transactions.length<=storage.PROFILES.normal.maxTransactions+1,'transaction history must be bounded while protected rows remain');
assert.ok(stored.finance.transactions.some(row=>row.idempotencyKey==='mission-protected-transaction'),'non-week idempotency evidence must survive compaction');
assert.equal(cashRoll(stored.finance),before.cash,'cash-flow archive roll-forward must be preserved');
assert.equal(profitRoll(stored.finance),before.profit,'profit archive roll-forward must be preserved');
assert.equal(dividendRoll(stored.finance),before.dividend,'dividend archive roll-forward must be preserved');
assert.equal(engine.g.finance.transactions.length,before.transactions,'save compaction must not mutate the live transaction ledger');
assert.equal(engine.g.reports.length,before.reports,'save compaction must not mutate live report history');
assert.equal(stored.reports.length,storage.PROFILES.normal.reports);
assert.equal(stored.news.length,storage.PROFILES.normal.news);
assert.equal(stored.history.length,storage.PROFILES.normal.history);
assert.equal(stored.weeklySalesHistory.length,storage.PROFILES.normal.weeklyHistory);
assert.equal(stored.market[0].priceHistory.length,storage.PROFILES.normal.priceHistory);
assert.equal(stored.startups[0].reports.length,storage.PROFILES.normal.startupReports);

const previous=JSON.stringify({saveVersion:9,week:179,marker:'previous-save-remains'});
map.set(storage.SAVE_KEY,previous);
ctx.localStorage.setItem=()=>{const error=new Error('The quota has been exceeded.');error.name='QuotaExceededError';throw error;};
const originalConsoleError=ctx.console.error;
ctx.console.error=()=>{};
assert.equal(engine.save(),false,'total quota exhaustion must return false instead of throwing');
ctx.console.error=originalConsoleError;
assert.equal(map.get(storage.SAVE_KEY),previous,'failed replacement must preserve the previous save');
assert.equal(engine._lastSaveStorageInfo.mode,'failed');
assert.equal(storage.isQuotaError(Object.assign(new Error('The quota has been exceeded.'),{name:'QuotaExceededError'})),true);

console.log('save storage quota recovery tests passed');
