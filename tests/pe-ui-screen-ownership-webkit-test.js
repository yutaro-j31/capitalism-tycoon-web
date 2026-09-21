'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {webkit,devices}=require('playwright');

const ROOT=path.resolve(__dirname,'..');
const ARTIFACT_DIR=path.resolve(process.env.D_UI_ARTIFACT_DIR||path.join(ROOT,'artifacts','d-ui-webkit'));
const SAVE_KEY='capitalism_tycoon_web_v1';
const DEVICE_NAME='iPhone 13';
const MIME=new Map([
  ['.css','text/css; charset=utf-8'],['.html','text/html; charset=utf-8'],
  ['.js','text/javascript; charset=utf-8'],['.json','application/json; charset=utf-8'],
  ['.png','image/png'],['.svg','image/svg+xml'],['.webp','image/webp']
]);

function server(){
  return http.createServer((req,res)=>{
    try{
      const url=new URL(req.url||'/','http://127.0.0.1');
      const rel=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const file=path.resolve(ROOT,rel);
      assert.ok(file===ROOT||file.startsWith(`${ROOT}${path.sep}`),'unsafe request path');
      const target=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;
      const body=fs.readFileSync(target);
      res.writeHead(200,{'cache-control':'no-store','content-length':String(body.length),'content-type':MIME.get(path.extname(target).toLowerCase())||'application/octet-stream'});
      res.end(body);
    }catch(error){
      res.writeHead(error?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});
      res.end(error?.code==='ENOENT'?'Not found':String(error?.message||error));
    }
  });
}
async function start(s){await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});return `http://127.0.0.1:${s.address().port}/`;}
async function stop(s){await new Promise(resolve=>s.close(resolve));}
async function writeResult(result){fs.mkdirSync(ARTIFACT_DIR,{recursive:true});fs.writeFileSync(path.join(ARTIFACT_DIR,'pe-screen-ownership-result.json'),`${JSON.stringify(result,null,2)}\n`);}

async function installFixture(page){
  await page.evaluate(key=>{
    const modules=globalThis.__capitalismTycoonModules;
    const game=new modules.engine.TycoonEngine();
    game.g=modules.engine.createInitialState({configured:true,playerName:'PE WebKit Tester',companyName:'PE WebKit Holdings'});
    game.g.selectedTab='business';
    game.g.personalCash=5_000_000_000;
    game.g.companyCash=2_000_000_000;
    game.g.finance=modules.finance.defaultFinanceState(game.g);
    const pf=modules.peFund,ops=modules.pePortfolioOperations;
    pf.recordExit(game.g,{exitType:'buyout',realizedAmount:250_000_000,investedAmount:20_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
    const fund=pf.createFund(game.g,{size:2_000_000_000,gpCommit:200_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
    assertFixture(Boolean(fund),'PE fund fixture must be created');
    const deal=ops.acquirePillarCompany(game.g,fund.id,{businessID:'gym',enterpriseValue:200_000_000,useCoinvest:false,week:1});
    assertFixture(Boolean(deal),'PE portfolio fixture must be acquired');
    deal.companyName='PE WebKit Gym';
    deal.portfolioCompany.cash=100_000_000;
    deal.portfolioCompany.weeklyRevenue=8_000_000;
    deal.portfolioCompany.weeklyProfit=1_500_000;
    game.normalize();
    localStorage.setItem(key,JSON.stringify(game.g));
    function assertFixture(ok,message){if(!ok)throw new Error(message);}
  },SAVE_KEY);
  await page.reload({waitUntil:'networkidle'});
}

async function main(){
  fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
  const srv=server();
  let browser,page;
  const diagnostics={consoleErrors:[],pageErrors:[],failedRequests:[]};
  const result={startedAt:new Date().toISOString(),device:DEVICE_NAME,stages:[]};
  try{
    const base=await start(srv);
    browser=await webkit.launch();
    const context=await browser.newContext({...devices[DEVICE_NAME],locale:'ja-JP',timezoneId:'Asia/Tokyo',reducedMotion:'reduce',serviceWorkers:'block'});
    page=await context.newPage();
    page.on('console',m=>m.type()==='error'&&diagnostics.consoleErrors.push(m.text()));
    page.on('pageerror',e=>diagnostics.pageErrors.push(e.message));
    page.on('requestfailed',r=>diagnostics.failedRequests.push(`${r.method()} ${r.url()} ${r.failure()?.errorText||''}`));
    await page.goto(base,{waitUntil:'networkidle'});
    await page.evaluate(key=>localStorage.removeItem(key),SAVE_KEY);
    await installFixture(page);

    await page.locator('#screen[data-screen="business"]').waitFor({state:'visible'});
    const initial=await page.locator('#screen').evaluate(node=>({html:node.innerHTML,className:node.className,screen:node.dataset.screen||''}));
    const inactiveRender=await page.evaluate(()=>globalThis.CapitalismTycoonPEUI.render());
    const afterInactive=await page.locator('#screen').evaluate(node=>({html:node.innerHTML,className:node.className,screen:node.dataset.screen||''}));
    assert.equal(inactiveRender,false,'PE UI must refuse ownership while a normal app tab is active');
    assert.equal(afterInactive.html,initial.html,'inactive PE render must not overwrite real business DOM');
    assert.equal(afterInactive.screen,'business','normal screen identity must remain business');
    assert.ok(!afterInactive.className.split(/\s+/).includes('pe-active'),'inactive PE render must release PE-only styling');
    result.stages.push({stage:'business-refusal',screen:afterInactive.screen,unchanged:true});
    await page.screenshot({path:path.join(ARTIFACT_DIR,'pe-screen-ownership-01-business.png'),fullPage:true});

    const activeRender=await page.evaluate(()=>{
      const engine=globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine();
      engine.g.selectedTab='pe-portfolio';
      return globalThis.CapitalismTycoonPEUI.render();
    });
    assert.equal(activeRender,true,'PE UI must take ownership only on selectedTab pe-portfolio');
    await page.locator('#screen.pe-active [data-pe-view-root="fund"]').waitFor({state:'visible'});
    result.stages.push({stage:'fund',visible:true});

    await page.locator('[data-pe-view="deals"]:visible').first().click();
    await page.locator('#screen [data-pe-view-root="deals"]').waitFor({state:'visible'});
    result.stages.push({stage:'deals',visible:true});

    await page.locator('[data-pe-view="portfolio"]:visible').first().click();
    await page.locator('#screen [data-pe-view-root="portfolio"]').waitFor({state:'visible'});
    const holding=page.locator('#screen [data-pe-portfolio-open]').first();
    assert.ok(await holding.count(),'portfolio must expose the acquired holding');
    result.stages.push({stage:'portfolio',holdingCount:await page.locator('#screen [data-pe-holding]').count()});

    await holding.click();
    await page.locator('#screen [data-pe-view-root="portfolio-detail"]').waitFor({state:'visible'});
    const manage=page.locator('#screen [data-pe-portfolio-manage]').first();
    assert.ok(await manage.count(),'supported PE holding must expose management navigation');
    await manage.click();
    await page.locator('#screen [data-pe-view-root="portfolio-manage"]').waitFor({state:'visible'});
    assert.ok(await page.locator('#screen [data-pe-manage-lever]').count()>0,'PE Manage must retain production management controls');
    result.stages.push({stage:'manage',leverCount:await page.locator('#screen [data-pe-manage-lever]').count()});
    await page.screenshot({path:path.join(ARTIFACT_DIR,'pe-screen-ownership-02-manage.png'),fullPage:true});

    await page.evaluate(key=>{
      const engine=globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine();
      engine.g.selectedTab='business';
      localStorage.setItem(key,JSON.stringify(engine.g));
    },SAVE_KEY);
    await page.reload({waitUntil:'networkidle'});
    await page.locator('#screen[data-screen="business"]').waitFor({state:'visible'});
    const restoredBefore=await page.locator('#screen').evaluate(node=>node.innerHTML);
    const restoredRender=await page.evaluate(()=>globalThis.CapitalismTycoonPEUI.render());
    const restoredAfter=await page.locator('#screen').evaluate(node=>node.innerHTML);
    assert.equal(restoredRender,false,'PE render must refuse ownership again after leaving PE');
    assert.equal(restoredAfter,restoredBefore,'PE UI must never overwrite the restored normal screen');
    assert.equal(await page.locator('#screen.pe-active').count(),0,'PE-only styling must not leak onto restored normal screen');
    result.stages.push({stage:'business-restored',unchanged:true});
    await page.screenshot({path:path.join(ARTIFACT_DIR,'pe-screen-ownership-03-restored.png'),fullPage:true});

    assert.deepEqual(diagnostics.consoleErrors,[],'PE ownership flow must not emit console errors');
    assert.deepEqual(diagnostics.pageErrors,[],'PE ownership flow must not emit page errors');
    assert.deepEqual(diagnostics.failedRequests,[],'PE ownership flow must not have failed requests');
    Object.assign(result,diagnostics,{finishedAt:new Date().toISOString(),ok:true});
    await writeResult(result);
  }catch(error){
    Object.assign(result,diagnostics,{finishedAt:new Date().toISOString(),ok:false,error:error?.stack||String(error)});
    try{if(page)await page.screenshot({path:path.join(ARTIFACT_DIR,'pe-screen-ownership-failure.png'),fullPage:true});}catch{}
    await writeResult(result);
    throw error;
  }finally{
    if(browser)await browser.close();
    await stop(srv);
  }
}
main();
