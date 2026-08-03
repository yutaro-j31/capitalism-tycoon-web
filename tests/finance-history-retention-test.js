const { loadGame } = require('./harness');
const { SCENARIOS, runScenario } = require('./strategy-balance-runner');

const { engineModule, modules } = loadGame({random:()=>0.5});
for(const count of [10,20,50]){
  const e=new engineModule.TycoonEngine();
  e.g.configured=true;
  e.g.companyCash=1e9;
  e.g.finance=modules.finance.defaultFinanceState(e.g);
  for(let i=0;i<count;i++)e.g.stores.push({id:`s${i}`,businessID:'ramen',prefID:'tokyo',name:`s${i}`,status:'open',tenantID:null,condition:100,operatingHours:3,openingWeek:1,weeksToOpen:0});
  for(let w=0;w<52;w++)e.advanceWeek(false);
  const st=modules.finance.buildStatements(e.g,'52');
  if(modules.finance.snapsFor(e.g,'52').length!==52)throw new Error(`${count} stores missing 52 snapshots`);
  if(Math.abs(st.cashFlow.openingCash+st.cashFlow.netCashChange-st.cashFlow.endingCash)>10)throw new Error(`${count} stores CF mismatch`);
  if(e.g.finance.transactions.length>50000)throw new Error(`${count} stores history over limit`);
}

const ramen=SCENARIOS.find(row=>row.id==='ramen-bootstrap');
const result=runScenario(ramen,1797259521,{includeState:true,difficulty:'easy',gameScenario:'free'});
const validation=result.modules.finance.validate(result.state);
if(!validation.ok)throw new Error(`seed 1797259521 accounting regression: ${validation.errors.join('\n')}`);
const brokenSnapshot=result.state.finance.weeklySnapshots.find(row=>Math.abs(Number(row.cashDifference||0))>10);
if(brokenSnapshot)throw new Error(`week ${brokenSnapshot.week} cashDifference ${brokenSnapshot.cashDifference}`);
if(result.state.finance.transactions.length>5000+250)throw new Error(`completed-week retention overflow: ${result.state.finance.transactions.length}`);
if(!result.modules.finance.__completedWeekCompressionInstalled)throw new Error('completed-week compression guard not installed');

console.log('finance history retention checks passed');
