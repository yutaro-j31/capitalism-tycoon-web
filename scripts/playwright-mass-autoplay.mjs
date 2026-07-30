import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const SAVE_KEY='capitalism_tycoon_web_v1';
const baseURL=process.env.AUTOPLAY_BASE_URL||'http://127.0.0.1:4173';
const weeks=Math.max(4,Number(process.env.AUTOPLAY_WEEKS||104));
const runs=Math.max(1,Number(process.env.AUTOPLAY_RUNS||3));
const outDir=process.env.AUTOPLAY_OUT_DIR||'artifacts/autoplay';
const browserNames=(process.env.AUTOPLAY_BROWSERS||'chromium,webkit').split(',').map(v=>v.trim()).filter(Boolean);
const difficulties=(process.env.AUTOPLAY_DIFFICULTIES||'easy,normal,hard').split(',').map(v=>v.trim()).filter(Boolean);
const strategies=(process.env.AUTOPLAY_STRATEGIES||'passive,conservative,growth,leveraged,diversified').split(',').map(v=>v.trim()).filter(Boolean);

const browserTypes={chromium,webkit};
const strategyRules={
  passive:[],
  conservative:[/研修|改善|節約|再建|返済|在庫圧縮|価格改定/],
  growth:[/出店|開業|増設|商品開発|採用|広告|設備投資|研究開発/],
  leveraged:[/借入|融資|社債|転換社債|CB|優先株|資金調達/],
  diversified:[/VC|投資|買収|M&A|不動産|株式|海外|子会社/]
};

function stableSeed(browser,difficulty,strategy,index){
  const s=`${browser}:${difficulty}:${strategy}:${index}`;
  let h=2166136261;
  for(const ch of s){h^=ch.codePointAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
}
function mulberry32(seed){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function finite(v,fallback=null){const n=Number(v);return Number.isFinite(n)?n:fallback;}
function classifyFailure(state,errors){
  if(errors.length)return'javascript-error';
  if(!state)return'unreadable-save';
  const cash=finite(state.companyCash,0);
  if(cash<0)return'cash-insolvency';
  const crisis=state.playerCrisis||state.crisis||{};
  const text=JSON.stringify(crisis).toLowerCase();
  if(text.includes('covenant'))return'covenant-breach';
  if(text.includes('default'))return'debt-default';
  if(state.gameOver)return String(state.gameOverReason||state.endingReason||'game-over');
  return null;
}
async function readState(page){
  return page.evaluate(key=>{
    const raw=localStorage.getItem(key);
    if(!raw)return null;
    try{return JSON.parse(raw);}catch{return null;}
  },SAVE_KEY);
}
async function visibleEnabledButtons(page){
  return page.locator('button:not([disabled])').evaluateAll(nodes=>nodes.filter(node=>{
    const r=node.getBoundingClientRect();const s=getComputedStyle(node);
    return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';
  }).map(node=>({text:(node.textContent||'').trim(),action:node.dataset.action||'',tab:node.dataset.tab||''})));
}
async function dismissTransientModals(page){
  for(let attempt=0;attempt<8;attempt++){
    const panel=page.locator('#modal-root [data-modal-panel], #modal-root [role="dialog"]').last();
    if(!(await panel.count())||!(await panel.isVisible().catch(()=>false)))return;
    const closeButton=panel.locator('button:not([disabled])').filter({hasText:/閉じる|次へ|続ける|確認|OK|了解|完了/}).last();
    if(await closeButton.count()){
      await closeButton.click({timeout:1000,force:true}).catch(()=>{});
    }else{
      const closer=page.locator('#modal-root [data-action="close-modal"], #modal-root .modal-backdrop').last();
      if(await closer.count())await closer.click({timeout:1000,force:true}).catch(()=>{});
      else await page.keyboard.press('Escape').catch(()=>{});
    }
    await page.waitForTimeout(20);
  }
  const remaining=page.locator('#modal-root [data-modal-panel], #modal-root [role="dialog"]').last();
  if(await remaining.count()&&await remaining.isVisible().catch(()=>false))throw new Error('modal-remained-open');
}
async function clickMatchingAction(page,rules,random){
  if(!rules.length)return null;
  await dismissTransientModals(page);
  const buttons=await visibleEnabledButtons(page);
  const candidates=buttons.filter(b=>rules.some(rule=>rule.test(`${b.text} ${b.action} ${b.tab}`)))
    .filter(b=>!/削除|破棄|解任|売却|清算|倒産|リセット|全額/.test(b.text));
  if(!candidates.length)return null;
  const chosen=candidates[Math.floor(random()*candidates.length)];
  const locator=page.locator('button:not([disabled])').filter({hasText:chosen.text}).first();
  try{
    await locator.click({timeout:1500});
    const confirm=page.locator('#modal-root button[data-action]:not([disabled])').filter({hasText:/実行する|確認|借りる|購入|契約|発行/}).last();
    if(await confirm.count())await confirm.click({timeout:1000}).catch(()=>{});
    await dismissTransientModals(page);
    return chosen;
  }catch{return null;}
}
async function createGame(page,difficulty,index){
  await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  await page.evaluate(key=>localStorage.removeItem(key),SAVE_KEY);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('input[name="playerName"]').fill(`Auto-${index}`);
  await page.locator('input[name="companyName"]').fill(`自動試験${index}`);
  await page.locator('select[name="difficulty"]').selectOption(difficulty);
  await page.locator('#setup-form button[type="submit"]').click();
  await page.waitForSelector('button[data-action="advance-week"]',{timeout:10000});
  await dismissTransientModals(page);
}
async function runOne(browserName,browser,difficulty,strategy,index){
  const seed=stableSeed(browserName,difficulty,strategy,index);
  const random=mulberry32(seed);
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const consoleErrors=[];const pageErrors=[];const actionLog=[];const snapshots=[];
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
  const startedAt=new Date().toISOString();
  let completedSteps=0;let minCash=Infinity,maxDebt=0,firstProfitWeek=null;
  try{
    await createGame(page,difficulty,index);
    for(let step=0;step<weeks;step++){
      await dismissTransientModals(page);
      const state=await readState(page);
      if(!state)break;
      const cash=finite(state.companyCash,0);minCash=Math.min(minCash,cash);
      const debt=finite(state.totalDebt??state.finance?.totalLiabilities??state.liabilities,0);maxDebt=Math.max(maxDebt,debt);
      if(firstProfitWeek===null&&finite(state.cumulativeProfit,-1)>0)firstProfitWeek=finite(state.week,step);
      if(state.gameOver)break;
      const rules=strategyRules[strategy]||[];
      const shouldAct=strategy!=='passive'&&(step%4===0||random()<0.25);
      if(shouldAct){
        const action=await clickMatchingAction(page,rules,random);
        if(action)actionLog.push({week:finite(state.week,step),...action});
      }
      await dismissTransientModals(page);
      const advance=page.locator('button[data-action="advance-week"]:not([disabled])');
      if(!(await advance.count()))break;
      await advance.click({timeout:5000});
      completedSteps++;
      await page.waitForTimeout(25);
      await dismissTransientModals(page);
      if(step%13===0)snapshots.push({week:finite(state.week,step),companyCash:cash,cumulativeProfit:finite(state.cumulativeProfit),debt});
    }
    const state=await readState(page);
    const errors=[...consoleErrors,...pageErrors];
    return{schemaVersion:2,runId:`${browserName}-${difficulty}-${strategy}-${index}`,browser:browserName,difficulty,strategy,index,seed,weeksRequested:weeks,weeksCompleted:completedSteps,saveWeek:finite(state?.week),startedAt,finishedAt:new Date().toISOString(),gameOver:Boolean(state?.gameOver),failureReason:classifyFailure(state,errors),companyCash:finite(state?.companyCash),personalCash:finite(state?.personalCash),cumulativeProfit:finite(state?.cumulativeProfit),companyValue:finite(state?.companyValue),storeCount:Array.isArray(state?.stores)?state.stores.length:null,subsidiaryCount:Array.isArray(state?.subsidiaries)?state.subsidiaries.length:null,minCompanyCash:Number.isFinite(minCash)?minCash:null,maxDebt,firstProfitWeek,consoleErrors,pageErrors,actionLog:actionLog.slice(-100),snapshots};
  }catch(error){
    const state=await readState(page).catch(()=>null);
    return{schemaVersion:2,runId:`${browserName}-${difficulty}-${strategy}-${index}`,browser:browserName,difficulty,strategy,index,seed,weeksRequested:weeks,weeksCompleted:completedSteps,saveWeek:finite(state?.week),startedAt,finishedAt:new Date().toISOString(),gameOver:Boolean(state?.gameOver),failureReason:'runner-error',runnerError:String(error?.stack||error),companyCash:finite(state?.companyCash),personalCash:finite(state?.personalCash),cumulativeProfit:finite(state?.cumulativeProfit),consoleErrors,pageErrors,actionLog,snapshots};
  }finally{await context.close();}
}

await fs.mkdir(outDir,{recursive:true});
const all=[];
for(const browserName of browserNames){
  const type=browserTypes[browserName];if(!type)throw new Error(`Unsupported browser: ${browserName}`);
  const browser=await type.launch({headless:true});
  try{
    for(const difficulty of difficulties){for(const strategy of strategies){for(let index=1;index<=runs;index++){
      const result=await runOne(browserName,browser,difficulty,strategy,index);all.push(result);
      process.stdout.write(`${result.runId}: week=${result.weeksCompleted} gameOver=${result.gameOver} reason=${result.failureReason||'none'}\n`);
    }}}
  }finally{await browser.close();}
}
await fs.writeFile(path.join(outDir,'runs.json'),JSON.stringify(all,null,2)+'\n');
await fs.writeFile(path.join(outDir,'runs.jsonl'),all.map(v=>JSON.stringify(v)).join('\n')+'\n');
console.log(`Wrote ${all.length} autoplay runs to ${outDir}`);
