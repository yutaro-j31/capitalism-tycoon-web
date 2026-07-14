const { loadGame } = require('./harness');
const { engineModule, modules } = loadGame(); const e=new engineModule.TycoonEngine(); e.g.configured=true; e.g.companyCash=10_000_000; e.g.finance=modules.finance.defaultFinanceState(e.g); const f=modules.finance;
for(let i=0;i<50020;i++){f.event(e.g,'revenue',1,{cashEffect:1,profitEffect:1,week:1,sourceType:'archive-test',operationID:`archive-${i}`}); e.g.companyCash+=1;}
f.rebuildDirtySnapshots(e.g); if(e.g.finance.transactions.length>50000) throw new Error('transaction cap exceeded'); const st=f.buildStatements(e.g,'52'); if(Math.abs(st.balanceSheet.equity.retainedEarnings-(e.g.finance.openingRetainedEarnings+50020))>.1) throw new Error('retained earnings lost after archive'); const val=f.validate(e.g); if(!val.ok) throw new Error(val.errors.join('\n'));
console.log('finance archive rollforward checks passed');
