'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/ma-deal-room-webkit');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };
const server = http.createServer((req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1));
    assert.ok(file.startsWith(ROOT + path.sep));
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store'); res.end(fs.readFileSync(file));
  } catch (error) { res.statusCode = 404; res.end(String(error)); }
});
async function observed(page,id) {
  return page.evaluate(id=>{
    const m=globalThis.__capitalismTycoonModules,e=m.engine.TycoonEngine.load(),s=e.stock(id);
    return {history:s.priceHistory,price:s.price,previous:s.previous,issued:s.issuedShares,
      personal:e.g.personalStocks[id],company:e.g.companyStocks[id],shares:e.g.sharesOut,
      founder:e.g.founderShares,treasury:e.g.treasuryBuybackShares,rootPrice:e.g.stockPrice,
      companyCash:e.g.companyCash,personalCash:e.g.personalCash,finance:e.g.finance,
      splitHistory:e.g.stockSplitHistory,rng:e.g.simulationRng,version:e.g.saveVersion,
      valid:m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok};
  },id);
}
(async()=>{
  fs.mkdirSync(ARTIFACT_DIR,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/`;let browser;const results=[];
  try {
    browser=await webkit.launch();
    for(const id of ['CPTY','EXT']) {
      const context=await browser.newContext(options),page=await context.newPage();
      await page.goto(url,{waitUntil:'networkidle'});
      const proof=await page.evaluate(async id=>{
        const m=globalThis.__capitalismTycoonModules,state=m.engine.createInitialState({configured:true});
        Object.assign(state,{week:12,publicCompany:true,sharesOut:1000000,founderShares:600000,
          treasuryBuybackShares:10000,stockPrice:100,ticker:'CPTY',companyCash:100000000,companyDebt:0});
        state.departments.investment=true;
        for(const key of ['CPTY','EXT']) {
          state.market=state.market.filter(x=>x.id!==key);
          state.market.push({id:key,name:key,sector:'コングロマリット',price:100,previous:96,
            issuedShares:1000000,marketCap:100000000,dividendYield:0,volatility:0,trend:0,per:20,pbr:2,
            dividendPerShare:0,shareholders:{},description:'fixture',listingMarket:'東証グロース',
            priceHistory:[{week:9,price:90,tag:'first'},{week:10,price:96},{week:12,price:100}]});
          state.personalStocks[key]={qty:20000,avg:100};state.companyStocks[key]={qty:3000,avg:120};
        }
        state.finance=m.finance.defaultFinanceState(state);
        const e=new m.engine.TycoonEngine(state),plain=x=>JSON.parse(JSON.stringify(x));
        if(!m.finance.validate(plain(e.g)).ok||!e.save())throw new Error('invalid baseline');
        await m.saveStorageIDB.flush();
        const before=plain(e.g),rng=JSON.stringify(e.g.simulationRng),finance=JSON.stringify(e.g.finance);
        for(const ratio of [2,2,3])if(e.stockSplit(id,ratio)!==true)throw new Error('normal split refused');
        const expected=before.market.find(x=>x.id===id).priceHistory.map(x=>({...x,price:x.price/2/2/3}));
        if(JSON.stringify(e.stock(id).priceHistory)!==JSON.stringify(expected))throw new Error('split history lost');
        if(JSON.stringify(e.g.finance)!==finance||JSON.stringify(e.g.simulationRng)!==rng)throw new Error('split ledger/RNG changed');
        if(e.g.personalStocks[id].qty!==240000||e.g.companyStocks[id].qty!==36000
          ||e.g.personalStocks[id].avg!==100/2/2/3||e.g.companyStocks[id].avg!==10)throw new Error('both lots diverged');
        for(const [key,divisor] of [['sharesOut',1],['founderShares',1],['treasuryBuybackShares',1],['stockPrice',-1]]) {
          const wanted=id==='CPTY'?(divisor===1?before[key]*12:before[key]/2/2/3):before[key];
          if(e.g[key]!==wanted)throw new Error('issuer root mismatch');
        }
        const raw=JSON.stringify(e.g);
        if(e.stockSplit('MISSING',2)!==false||e.stockSplit(id,1)!==false||JSON.stringify(e.g)!==raw)throw new Error('refusal mutated state');
        for(const account of ['personal','company'])if(!e.buyStock(id,1000,account)||!e.sellStock(id,1000,account))throw new Error('post-split trade failed');
        await m.saveStorageIDB.flush();
        const bytes=localStorage.getItem(m.engine.SAVE_KEY),cache=m.saveStorageIDB.readSync(m.engine.SAVE_KEY);
        const durable=await new Promise((resolve,reject)=>{
          const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);
          open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(m.engine.SAVE_KEY);
            tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};
        });
        if(bytes!==cache||bytes!==durable)throw new Error('save layers disagree');
        if(JSON.stringify(JSON.parse(durable).market.find(x=>x.id===id).priceHistory)!==JSON.stringify(expected))throw new Error('durable history lost');
        return {id,history:expected,bothLots:true,storageAgreement:true};
      },id);
      const baseline=await observed(page,id);assert.deepEqual(baseline.history,proof.history);assert.equal(baseline.valid,true);
      await page.reload({waitUntil:'networkidle'});assert.deepEqual(await observed(page,id),baseline);
      const storageState=await context.storageState({indexedDB:true}),fresh=await browser.newContext({...options,storageState}),freshPage=await fresh.newPage();
      await freshPage.goto(url,{waitUntil:'networkidle'});assert.deepEqual(await observed(freshPage,id),baseline);
      await freshPage.screenshot({path:path.join(ARTIFACT_DIR,`split-history-${id}.png`),fullPage:true});
      await fresh.close();await context.close();results.push(proof);
    }
    fs.writeFileSync(path.join(ARTIFACT_DIR,'stock-split-price-history-result.json'),JSON.stringify({ok:true,device:'iPhone 13',results},null,2));
    console.log('iPhone WebKit stock-split price-history preservation and fresh IndexedDB hydration PASS');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
