const assert=require('node:assert/strict');const {loadGame}=require('./harness');
const {modules}=loadGame({random:()=>.5});
function run({stores=1,prefs=['tokyo'],quality=0,economy=1,stockout=false,emergency=false,ap=false}={}){const e=new modules.engine.TycoonEngine();e.g.configured=true;e.g.economy=economy;e.g.companyCash=100_000_000;e.g.finance=modules.finance.defaultFinanceState(e.g);const b=e.g.businesses.find(x=>x.id==='ramen');b.quality+=quality;for(let i=0;i<stores;i++){e.g.stores.push({id:'s'+i,businessID:'ramen',prefID:prefs[i%prefs.length],name:'S'+i,status:'open',tenantID:null,condition:100,operatingHours:3,openingWeek:1,weeksToOpen:0});}
if(stockout){for(const st of e.g.stores){modules.supply.ensureStore(e.g,st);e.g.supplySettingsByStoreID[st.id].initialProcurementDone=true;e.g.supplySettingsByStoreID[st.id].emergencyProcurementEnabled=emergency;}}
if(ap){for(const st of e.g.stores){modules.supply.ensureStore(e.g,st);e.g.supplySettingsByStoreID[st.id].initialProcurementDone=true;const po=modules.supply.createOrder(e.g,st.id,'ramen_noodles',100,{paymentTermsWeeks:2,leadTimeWeeks:0});modules.supply.receiveOrderNow(e.g,modules.finance,po,po.orderedQuantity);}}
const cash=e.g.companyCash;e.advanceWeek(false);const units=Object.values(e.g.supplyResultsByStoreID).reduce((a,r)=>a+r.fulfilledUnits,0),sales=e.g.lastReport.sales,cogs=e.g.finance.transactions.filter(t=>t.category==='costOfSales').reduce((a,t)=>a-t.profitEffect,0),margin=sales-cogs;return {units,sales,cogs,margin,cashDelta:e.g.companyCash-cash,inventory:modules.supply.physicalInventoryValue(e.g),ap:e.g.finance.balances.accountsPayable,ok:modules.supply.validate(e.g).ok};}
const scenarios={standard:run(),sameMarket:run({stores:2,prefs:['tokyo']}),diffMarket:run({stores:2,prefs:['tokyo','osaka']}),ads:run(),quality:run({quality:20}),low:run({economy:.8}),high:run({economy:1.2}),stockout:run({stockout:true}),emergency:run({stockout:true,emergency:true}),ap:run({ap:true})};
for(const [k,v] of Object.entries(scenarios)){assert(Number.isFinite(v.units+v.sales+v.cogs+v.margin+v.cashDelta+v.inventory+v.ap),k);assert(v.ok,k);}assert(scenarios.standard.units>0);assert(scenarios.stockout.units===0);assert(scenarios.emergency.units>=scenarios.stockout.units);assert(scenarios.ap.ap>0);
const expected={
  standard:{units:1028,sales:946232.88,cogs:260782.77,margin:685450.11,cashDelta:1049035.52,inventory:206.72,ap:193957.13},
  sameMarket:{units:1349.3799720701045,sales:1242050.28,cogs:348961.96,margin:893088.32,cashDelta:2081720.28,inventory:38952.28,ap:387914.26},
  diffMarket:{units:1786,sales:1643941.56,cogs:456662.94,margin:1187278.62,cashDelta:2474539.53,inventory:353.35,ap:387914.26},
  ads:{units:1028,sales:946232.88,cogs:260782.77,margin:685450.11,cashDelta:1049035.52,inventory:206.72,ap:193957.13},
  quality:{units:1281,sales:1179109.26,cogs:321598.91,margin:857510.35,cashDelta:1221239.98,inventory:62.5,ap:193957.13},
  low:{units:823,sales:757538.58,cogs:211504.87,margin:546033.71,cashDelta:909804.2,inventory:21.64,ap:193957.13},
  high:{units:1234,sales:1135847.64,cogs:310301.05,margin:825546.59,cashDelta:1189184.87,inventory:153.85,ap:193957.13},
  stockout:{units:0,sales:0,cogs:0,margin:0,cashDelta:169835,inventory:0,ap:0},
  emergency:{units:740,sales:681140.4,cogs:177881.2,margin:503259.2,cashDelta:672906.7,inventory:187.5,ap:0},
  ap:{units:740,sales:681140.4,cogs:174925.2,margin:506215.2,cashDelta:672906.7,inventory:12441.5,ap:9298}
};
function near(a,b,label){assert(Math.abs(a-b)<=Math.max(0.05,Math.abs(b)*0.0005),`${label}: ${a} !== ${b}`);}
for(const [name,expectedValues] of Object.entries(expected)){
  for(const [key,value] of Object.entries(expectedValues))near(Number(scenarios[name][key].toFixed(8)),value,`${name}.${key}`);
}
console.log(JSON.stringify(scenarios,null,2));console.log('supply calibration ok');
