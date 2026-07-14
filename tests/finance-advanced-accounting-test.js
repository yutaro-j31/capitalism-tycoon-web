const { loadGame } = require('./harness');
const { engineModule, modules } = loadGame({random:()=>0.5});
const e=new engineModule.TycoonEngine(); e.g.configured=true; const f=modules.finance;
e.borrow(100000,'company'); e.borrow(100000,'company');
const debtEvents=e.g.finance.transactions.filter(t=>t.category==='debtBorrowing'); if(debtEvents.length!==2) throw new Error('same-week same-amount borrow should record twice');
const b=e.g.businesses.find(x=>x.id==='ramen'), tenant=e.g.tenants.find(t=>t.businessID==='ramen'&&t.prefID==='tokyo'); e.g.companyCash=100000000; e.openStore({tenantID:tenant.id,businessID:'ramen',name:'close-test'}); const store=e.g.stores[e.g.stores.length-1]; for(let i=0;i<10;i++) e.advanceWeek(false); e.closeStore(store.id); const asset=e.g.finance.fixedAssets.find(a=>a.storeID===store.id); if(!asset||asset.status!=='disposed') throw new Error('closed store asset not disposed'); const depCount=e.g.finance.transactions.filter(t=>t.sourceID===asset.assetID&&t.category==='depreciation').length; e.advanceWeek(false); const depCount2=e.g.finance.transactions.filter(t=>t.sourceID===asset.assetID&&t.category==='depreciation').length; if(depCount2!==depCount) throw new Error('disposed asset depreciated again');
console.log('advanced accounting checks passed');
