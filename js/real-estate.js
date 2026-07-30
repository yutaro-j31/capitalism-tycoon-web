// Real estate management foundation: rental operation, vacancy, repairs, valuation and owner-separated cash flow.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must be loaded before real-estate.js.');
if(modules.realEstate)throw new Error('real estate module is already registered.');
const Engine=modules.engine.TycoonEngine, finance=modules.finance;
const VERSION=1;
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const round=v=>Math.round(n(v)*100)/100;
function hash01(id,week,salt=''){let h=2166136261;for(const c of `${id}:${week}:${salt}`){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967295;}
function ensure(state){
 if(!state.realEstate||typeof state.realEstate!=='object')state.realEstate={schemaVersion:VERSION,ledger:[],lastProcessedWeek:0};
 const r=state.realEstate;if(!Array.isArray(r.ledger))r.ledger=[];if(!Number.isFinite(r.lastProcessedWeek))r.lastProcessedWeek=0;r.schemaVersion=VERSION;
 for(const p of Array.isArray(state.properties)?state.properties:[]){
  if(!p.realEstate||typeof p.realEstate!=='object')p.realEstate={rentalEnabled:false,monthlyRent:0,targetOccupancy:.9,occupancy:0,condition:1,repairReserve:0,lastIncome:0,lastExpense:0,lastNetIncome:0,lastValuation:n(p.value,p.price)};
  const x=p.realEstate;x.targetOccupancy=Math.min(1,Math.max(0,n(x.targetOccupancy,.9)));x.occupancy=Math.min(1,Math.max(0,n(x.occupancy,0)));x.condition=Math.min(1,Math.max(.2,n(x.condition,1)));x.repairReserve=Math.max(0,n(x.repairReserve));x.monthlyRent=Math.max(0,n(x.monthlyRent));
 }
 return r;
}
function rentable(p){return Boolean(p?.owner&&p?.buildingType&&p.buildingType!=='本社ビル');}
function valuation(p,week){const base=Math.max(1,n(p.purchasePrice,p.price||p.value));const location=n(p.locationScore,p.demandScore||1);const cycle=(hash01(p.id,Math.floor(week/13),'value')-.5)*.04;const condition=n(p.realEstate?.condition,1);return round(base*(.92+location*.08)*(1+cycle)*(.75+condition*.25));}
function record(state,p,row){state.realEstate.ledger.push(row);if(state.realEstate.ledger.length>2000)state.realEstate.ledger=state.realEstate.ledger.slice(-2000);p.realEstate.lastIncome=row.grossRent;p.realEstate.lastExpense=row.expense;p.realEstate.lastNetIncome=row.netIncome;p.realEstate.lastValuation=row.valuation;}
function processWeek(engine){
 const g=engine.g,r=ensure(g),week=Math.floor(n(g.week,1));if(r.lastProcessedWeek===week)return[];const rows=[];
 for(const p of g.properties||[]){const x=p.realEstate;if(!rentable(p)||!x.rentalEnabled)continue;
  const demand=.78+hash01(p.id,week,'occupancy')*.22;const target=Math.min(1,Math.max(.2,n(x.targetOccupancy,.9)*demand));x.occupancy=round(x.occupancy*.7+target*.3);
  const weeklyRent=round(n(x.monthlyRent)/4.345*x.occupancy);const maintenance=round(Math.max(1000,n(x.lastValuation,p.value||p.price)*.00035));
  const repairShock=hash01(p.id,week,'repair')<.025?round(Math.max(50000,n(x.lastValuation)*(.003+hash01(p.id,week,'repair-cost')*.007))):0;
  const reserveUse=Math.min(x.repairReserve,repairShock);x.repairReserve=round(x.repairReserve+weeklyRent*.03-reserveUse);const cashRepair=repairShock-reserveUse;const expense=round(maintenance+cashRepair);const net=round(weeklyRent-expense);x.condition=Math.min(1,Math.max(.2,round(x.condition-maintenance/Math.max(1,n(x.lastValuation))*0.01-repairShock/Math.max(1,n(x.lastValuation))*.08+.0005)));
  p.value=valuation(p,week);const row={week,propertyID:p.id,owner:p.owner,grossRent:weeklyRent,maintenance,cashRepair,expense,netIncome:net,occupancy:x.occupancy,condition:x.condition,valuation:p.value};record(g,p,row);rows.push(row);
  if(p.owner==='company'){
   g.companyCash=round(n(g.companyCash)+net);
   finance?.event?.(g,'revenue',weeklyRent,{cashEffect:weeklyRent,profitEffect:weeklyRent,sourceType:'property-rent',sourceID:p.id,idempotencyKey:`property-rent-${p.id}-w${week}`,description:`${p.name||p.id} 賃料収入`});
   if(expense>0)finance?.event?.(g,'maintenance',expense,{cashEffect:-expense,profitEffect:-expense,sourceType:'property-maintenance',sourceID:p.id,idempotencyKey:`property-maintenance-${p.id}-w${week}`,description:`${p.name||p.id} 維持修繕費`});
  }else if(p.owner==='personal')g.personalCash=round(n(g.personalCash)+net);
 }
 r.lastProcessedWeek=week;return rows;
}
Engine.prototype.enablePropertyRental=function(propertyID,options={}){const p=(this.g.properties||[]).find(x=>x.id===propertyID);if(!rentable(p))return false;ensure(this.g);p.realEstate.rentalEnabled=true;p.realEstate.monthlyRent=Math.max(10000,n(options.monthlyRent,p.realEstate.monthlyRent||n(p.value,p.price)*.004));p.realEstate.targetOccupancy=Math.min(1,Math.max(.2,n(options.targetOccupancy,.9)));p.realEstate.occupancy=Math.max(p.realEstate.occupancy,.5);this.save?.();this.emit?.();return true;};
Engine.prototype.disablePropertyRental=function(propertyID){const p=(this.g.properties||[]).find(x=>x.id===propertyID);if(!p?.realEstate)return false;p.realEstate.rentalEnabled=false;this.save?.();this.emit?.();return true;};
Engine.prototype.getPropertyInvestmentMetrics=function(propertyID){const p=(this.g.properties||[]).find(x=>x.id===propertyID);if(!p)return null;ensure(this.g);const x=p.realEstate,price=Math.max(1,n(p.purchasePrice,p.price||p.value)),annualGross=n(x.monthlyRent)*12*n(x.targetOccupancy),annualNet=annualGross-price*.0042;return {propertyID,owner:p.owner,valuation:n(p.value,price),occupancy:n(x.occupancy),condition:n(x.condition),grossYield:annualGross/price,netYield:annualNet/price,collateralValue:n(p.value,price)*.7,repairReserve:n(x.repairReserve),lastNetIncome:n(x.lastNetIncome)};};
const baseNormalize=Engine.prototype.normalize;Engine.prototype.normalize=function(){const result=baseNormalize.call(this);ensure(this.g);return result;};
const baseAdvance=Engine.prototype.advanceWeek;Engine.prototype.advanceWeek=function(){const result=baseAdvance.apply(this,arguments);processWeek(this);this.save?.();return result;};
modules.realEstate=Object.freeze({VERSION,ensure,processWeek,valuation,rentable});
})();
