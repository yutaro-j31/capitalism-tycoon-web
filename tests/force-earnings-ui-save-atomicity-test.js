'use strict';
// #955 (7B): the market-tab "決算イベントを確認" action forces an earnings event, which moves the own
// stock price, shareholder trust, activist pressure and guidance and consumes simulation RNG. It must
// run through one transaction-backed engine method so that RNG use and state changes commit with the
// save or roll back with it (deterministic w.r.t. the save outcome). The weekly path is unchanged.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {scenario,economic,snapshot}=require('./fixtures/stock-split-atomicity');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
async function fixture(){
 const s=await scenario('own'),g=s.game.g;
 Object.assign(g,{shareholderTrust:55,activistPressure:20,earningsGuidanceRevenue:1_000_000,earningsGuidanceProfit:100_000,lastEarningsAnnouncementWeek:0});
 g.lastReport={...(g.lastReport||{}),week:g.week,sales:2_000_000,profit:300_000};
 assert.equal(s.game.save(),true);await s.backend.flush();
 return s;
}
function expectEarnings(before,after){
 assert.equal(after.lastEarningsAnnouncementWeek,before.week);
 assert.equal(after.earningsEventLog.length,before.earningsEventLog.length+1);
 assert.notDeepEqual(after.simulationRng,before.simulationRng,'guidance draws consume state-held simulation RNG');
 const own=after.market.find(x=>x.id==='CPTY');assert.equal(after.stockPrice,own.price);
 for(const key of ['companyCash','personalCash','sharesOut','founderShares'])assert.equal(after[key],before[key]);
}
const h=makeTransactionFaultCase({name:'earnings event',fixture,command:s=>s.game.forceEarningsEvent(),snapshot,economic,expectSuccess:expectEarnings,
 label:(v,kind,{pending,nested})=>`forceEarningsEvent ${kind}/pending=${pending}/nested=${nested}`});
let notifyProbe=0;const s0Notify=()=>notifyProbe;
(async()=>{
 { const s=await fixture(),emit=s.game.emit;s.game.emit=function(type,...a){if(type==='notify')notifyProbe++;return emit.call(this,type,...a);};s.game.forceEarningsEvent();s.game.emit=emit; }
 // The UI dispatches to the transaction-backed method and no longer saves directly.
 const app=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
 assert.match(app,/case 'force-earnings':engine\.forceEarningsEvent\(\);break;/,'UI uses the transaction-backed method; the committed change event renders once');
 assert.doesNotMatch(app,/runEarningsEventsIfNeeded\(true\);engine\.save\(\)/,'no direct UI save path');
 // The earnings event writes news directly and never emits 'notify', so that fault kind cannot reach this
 // writer (not applicable, not counted as a pass); every other kind is exercised.
 assert.equal(s0Notify(),0);
 for(const nested of [false,true])for(const kind of FAULT_KINDS.filter(k=>k!=='notify'))await h.rejected('own',kind,{nested});
 for(const kind of ['save-false','save-throw'])await h.rejected('own',kind,{pending:true});
 // Deterministic: identical inputs give identical committed states; host RNG is never used.
 const run=async()=>{const s=await fixture(),draws=s.host.draws;assert.equal(s.game.forceEarningsEvent(),true);assert.equal(s.host.draws,draws);await s.backend.flush();await h.loaded(s,s.game.g);return economic(s.game.g);};
 assert.deepEqual(await run(),await run());
 console.log('forceEarningsEvent deterministic / single commit / reload / fresh hydration PASS');
 console.log('Force earnings UI save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
