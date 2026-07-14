const { loadGame } = require('./harness');
let seed=42; const random=()=>((seed=(seed*48271)%2147483647)/2147483647);
const { engineModule, modules } = loadGame({random});
const e=new engineModule.TycoonEngine(); e.g.configured=true;
for(let i=0;i<52;i++) e.advanceWeek(false);
const v=modules.finance.validate(e.g); if(!v.ok) throw new Error(v.errors.join('\n'));
for(const t of e.g.finance.transactions) for(const val of Object.values(t)) if(typeof val==='number'&&!Number.isFinite(val)) throw new Error('non finite transaction');
if(e.g.finance.transactions.length>2500) throw new Error('finance history grew too much');
console.log('accounting invariant checks passed');
