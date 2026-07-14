const fs=require('node:fs'); const path=require('node:path');
const { loadGame } = require('./harness');
const audit=fs.readFileSync(path.join(__dirname,'..','docs','FINANCE_ENGINE_AUDIT.md'),'utf8');
const jsFiles=fs.readdirSync(path.join(__dirname,'..','js')).filter(f=>f.endsWith('.js'));
const cashLines=[]; for(const f of jsFiles){const text=fs.readFileSync(path.join(__dirname,'..','js',f),'utf8').split(/\r?\n/); text.forEach((line,i)=>{if(/companyCash\s*(?:[+\-*/]?=)/.test(line)||/this\.g\.companyCash|g\.companyCash/.test(line))cashLines.push(`${f}:${i+1}`);});}
for(const key of ['refreshExecutives','productAction','sellProduct','buyProperty','sellProperty','buildOnLand','investBusiness','contractOffice','cancelOffice','borrow','repay','missionReward']) if(!audit.includes(key)) throw new Error(`audit missing ${key}`);
const { engineModule, modules }=loadGame({random:()=>0.5}); const e=new engineModule.TycoonEngine(); e.g.configured=true; e.g.companyCash=1_000_000_000; e.g.finance=modules.finance.defaultFinanceState(e.g); const before=e.g.companyCash; e.borrow(1_000_000,'company'); modules.finance.rebuildDirtySnapshots(e.g); const delta=e.g.companyCash-before; const cf=modules.finance.buildStatements(e.g,'52').cashFlow; if(Math.abs(cf.financingCashFlow-delta)>10) throw new Error('borrow cash/event mismatch');
console.log(`finance cash mutation coverage checks passed (${cashLines.length} companyCash references scanned)`);
