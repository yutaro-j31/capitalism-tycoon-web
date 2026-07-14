const { loadGame } = require('./harness');
const { engineModule, modules } = loadGame({random:()=>0.5});
const e=new engineModule.TycoonEngine(); e.g.configured=true; e.g.companyCash=1_000_000_000; e.g.finance=modules.finance.defaultFinanceState(e.g);
const p=e.g.properties.find(x=>!x.owner); const originalValue=p.value; e.buyProperty(p.id,'company'); p.value=originalValue*3; const st1=modules.finance.buildStatements(e.g,'52'); if(st1.balanceSheet.assets.buildingsAndLand!==p.price) throw new Error('property BS must use purchase cost, not valuation');
if(p.kind==='土地'){e.buildOnLand(p.id,'本社ビル'); const st2=modules.finance.buildStatements(e.g,'52'); if(st2.balanceSheet.assets.storeEquipment<=0) throw new Error('building capex fixed asset missing');}
const val=modules.finance.validate(e.g); if(!val.ok) throw new Error(val.errors.join('\n'));
console.log('finance book value checks passed');
