const { loadGame } = require('./harness');
let seed=42; const random=()=>((seed=(seed*48271)%2147483647)/2147483647);
const { engineModule, modules } = loadGame({random});
const e=new engineModule.TycoonEngine(); e.g.configured=true;
for(let i=0;i<52;i++) e.advanceWeek(false);
for(const p of ['week','13','quarter','year','52']){const cf=modules.finance.buildStatements(e.g,p).cashFlow;if(Math.abs(cf.openingCash+cf.netCashChange-cf.endingCash)>0.1) throw new Error(`${p} CF identity`);}
const v=modules.finance.validate(e.g); if(!v.ok) throw new Error(v.errors.join('\n'));
for(const t of e.g.finance.transactions) for(const val of Object.values(t)) if(typeof val==='number'&&!Number.isFinite(val)) throw new Error('non finite transaction');
if(e.g.finance.transactions.length>50000) throw new Error('finance history grew too much');
console.log('accounting invariant checks passed');
