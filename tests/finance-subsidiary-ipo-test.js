const { loadGame } = require('./harness');
const { engineModule, modules } = loadGame({random:()=>0.5});
const e=new engineModule.TycoonEngine(); e.g.configured=true; e.g.companyCash=800_000_000;
e.g.subsidiaries.push({id:'sub-ipo',name:'IPO Sub',ownership:.6,valuation:600_000_000,carryingBookValue:120_000_000,investedCost:120_000_000,publicCompany:false,status:'active'}); e.g.finance=modules.finance.defaultFinanceState(e.g);
const cash=e.g.companyCash; if(!e.ipoSubsidiary('sub-ipo')) throw new Error('IPO failed'); const sub=e.g.subsidiaries[0], ev=e.g.finance.transactions.find(t=>t.sourceType==='ipoSubsidiary'); const expectedSoldBook=120_000_000*(.15/.6); if(Math.abs(ev.assetEffect+expectedSoldBook)>1) throw new Error('sold book mismatch'); if(Math.abs(sub.carryingBookValue-(120_000_000-expectedSoldBook))>1) throw new Error('remaining book mismatch'); if(e.g.companyCash<=cash) throw new Error('IPO cash not received'); if(!modules.finance.validate(e.g).ok) throw new Error(modules.finance.validate(e.g).errors.join('\n'));
console.log('finance subsidiary IPO checks passed');
