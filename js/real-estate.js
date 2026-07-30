// Real estate management: rental operation, split valuation, vacancy, repairs and collateral financing.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must be loaded before real-estate.js.');
if(modules.realEstate)throw new Error('real estate module is already registered.');
const Engine=modules.engine.TycoonEngine,finance=modules.finance;
const VERSION=2;
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const round=v=>Math.round(n(v)*100)/100;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,n(v,min)));
function hash01(id,week,salt=''){let h=2166136261;for(const c of `${id}:${week}:${salt}`){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967295;}
function splitBase(p){
 const total=Math.max(1,n(p.purchasePrice,p.price||p.value));
 const existingLand=n(p.landPurchasePrice,p.landValue);
 const existingBuilding=n(p.buildingPurchasePrice,p.buildingValue||p.buildingCost);
 if(existingLand>0||existingBuilding>0){const sum=Math.max(1,existingLand+existingBuilding);return {land:round(total*existingLand/sum),building:round(total*existingBuilding/sum)};}
 const buildingShare=p.buildingType?clamp(n(p.buildingShare,.55),.2,.8):0;
 return {land:round(total*(1-buildingShare)),building:round(total*buildingShare)};
}
function ensureProperty(p){
 if(!p.realEstate||typeof p.realEstate!=='object')p.realEstate={};
 const x=p.realEstate,base=splitBase(p);
 x.rentalEnabled=Boolean(x.rentalEnabled);x.monthlyRent=Math.max(0,n(x.monthlyRent));x.targetOccupancy=clamp(x.targetOccupancy,.2,1);x.occupancy=clamp(x.occupancy,0,1);x.condition=clamp(x.condition,.2,1);x.repairReserve=Math.max(0,n(x.repairReserve));
 x.landBookValue=Math.max(0,n(x.landBookValue,base.land));x.buildingBookValue=Math.max(0,n(x.buildingBookValue,base.building));x.landValue=Math.max(0,n(x.landValue,x.landBookValue));x.buildingValue=Math.max(0,n(x.buildingValue,x.buildingBookValue));
 x.lastIncome=n(x.lastIncome);x.lastExpense=n(x.lastExpense);x.lastNetIncome=n(x.lastNetIncome);x.lastValuation=Math.max(0,n(x.lastValuation,x.landValue+x.buildingValue));
 return x;
}
function ensure(state){
 if(!state.realEstate||typeof state.realEstate!=='object')state.realEstate={};
 const r=state.realEstate;if(!Array.isArray(r.ledger))r.ledger=[];if(!Array.isArray(r.loans))r.loans=[];if(!Number.isFinite(r.lastProcessedWeek))r.lastProcessedWeek=0;r.schemaVersion=VERSION;
 for(const p of Array.isArray(state.properties)?state.properties:[])ensureProperty(p);
 for(const loan of r.loans){loan.principal=Math.max(0,n(loan.principal));loan.outstandingPrincipal=Math.max(0,n(loan.outstandingPrincipal,loan.principal));loan.interestRate=clamp(loan.interestRate,0,.25);loan.remainingWeeks=Math.max(0,Math.floor(n(loan.remainingWeeks)));loan.status=loan.outstandingPrincipal>0&&loan.status!=='defaulted'?'active':loan.status||'paid';}
 return r;
}
function rentable(p){return Boolean(p?.owner&&p?.buildingType&&p.buildingType!=='本社ビル');}
function valuationParts(p,week){
 const x=ensureProperty(p),location=clamp(n(p.locationScore,p.demandScore||1),.4,1.8);
 const landCycle=(hash01(p.id,Math.floor(week/13),'land')-.5)*.05;
 const buildingCycle=(hash01(p.id,Math.floor(week/13),'building')-.5)*.025;
 const land=round(Math.max(0,x.landBookValue*(.94+location*.06)*(1+landCycle)));
 const building=round(Math.max(0,x.buildingBookValue*(1+buildingCycle)*(.55+x.condition*.45)));
 return {land,building,total:round(land+building)};
}
function securedOutstanding(state,propertyID){return (state.realEstate?.loans||[]).filter(l=>l.propertyID===propertyID&&l.status==='active').reduce((a,l)=>a+n(l.outstandingPrincipal),0);}
function collateralCapacity(state,p){const x=ensureProperty(p),gross=round((x.landValue+x.buildingValue)*.7),used=securedOutstanding(state,p.id);return {gross,used,available:Math.max(0,round(gross-used))};}
function record(state,p,row){state.realEstate.ledger.push(row);if(state.realEstate.ledger.length>2000)state.realEstate.ledger=state.realEstate.ledger.slice(-2000);p.realEstate.lastIncome=row.grossRent;p.realEstate.lastExpense=row.expense;p.realEstate.lastNetIncome=row.netIncome;p.realEstate.lastValuation=row.valuation;}
function processLoans(engine,week){
 const g=engine.g,r=ensure(g),rows=[];
 for(const loan of r.loans){if(loan.status!=='active'||loan.lastPaymentWeek===week)continue;
  const interest=round(n(loan.outstandingPrincipal)*n(loan.interestRate)/52);
  const principal=loan.remainingWeeks>0?round(Math.min(loan.outstandingPrincipal,n(loan.outstandingPrincipal)/loan.remainingWeeks)):0;
  const payment=round(interest+principal),cashKey=loan.owner==='company'?'companyCash':'personalCash';
  if(n(g[cashKey])<payment){loan.missedPayments=Math.floor(n(loan.missedPayments))+1;if(loan.missedPayments>=4)loan.status='defaulted';rows.push({loanID:loan.loanID,owner:loan.owner,interest,principal:0,payment:0,status:loan.status});continue;}
  g[cashKey]=round(n(g[cashKey])-payment);loan.outstandingPrincipal=round(Math.max(0,n(loan.outstandingPrincipal)-principal));loan.remainingWeeks=Math.max(0,loan.remainingWeeks-1);loan.lastPaymentWeek=week;loan.missedPayments=0;if(loan.outstandingPrincipal<=0)loan.status='paid';
  if(loan.owner==='company'){
   g.companyDebt=round(Math.max(0,n(g.companyDebt)-principal));
   if(interest>0)finance?.event?.(g,'interestExpense',interest,{cashEffect:-interest,profitEffect:-interest,sourceType:'property-collateral-interest',sourceID:loan.loanID,idempotencyKey:`property-loan-interest-${loan.loanID}-w${week}`,description:'不動産担保融資 利息'});
   if(principal>0)finance?.event?.(g,'debtRepayment',principal,{cashEffect:-principal,liabilityEffect:-principal,sourceType:'property-collateral-principal',sourceID:loan.loanID,idempotencyKey:`property-loan-principal-${loan.loanID}-w${week}`,description:'不動産担保融資 元本返済'});
  }else g.personalDebt=round(Math.max(0,n(g.personalDebt)-principal));
  rows.push({loanID:loan.loanID,owner:loan.owner,interest,principal,payment,status:loan.status});
 }
 return rows;
}
function processWeek(engine){
 const g=engine.g,r=ensure(g),week=Math.floor(n(g.week,1));if(r.lastProcessedWeek===week)return[];const rows=[];
 for(const p of g.properties||[]){const x=ensureProperty(p),parts=valuationParts(p,week);x.landValue=parts.land;x.buildingValue=parts.building;p.value=parts.total;
  if(!rentable(p)||!x.rentalEnabled)continue;
  const demand=.78+hash01(p.id,week,'occupancy')*.22,target=clamp(x.targetOccupancy*demand,.2,1);x.occupancy=round(x.occupancy*.7+target*.3);
  const weeklyRent=round(x.monthlyRent/4.345*x.occupancy),maintenance=round(Math.max(1000,parts.total*.00035));
  const repairShock=hash01(p.id,week,'repair')<.025?round(Math.max(50000,parts.total*(.003+hash01(p.id,week,'repair-cost')*.007))):0;
  const reserveUse=Math.min(x.repairReserve,repairShock);x.repairReserve=round(x.repairReserve+weeklyRent*.03-reserveUse);const cashRepair=round(repairShock-reserveUse),expense=round(maintenance+cashRepair),net=round(weeklyRent-expense);
  x.condition=clamp(x.condition-maintenance/Math.max(1,parts.total)*.01-repairShock/Math.max(1,parts.total)*.08+.0005,.2,1);
  const row={week,propertyID:p.id,owner:p.owner,grossRent:weeklyRent,maintenance,cashRepair,expense,netIncome:net,occupancy:x.occupancy,condition:x.condition,landValue:parts.land,buildingValue:parts.building,valuation:parts.total};record(g,p,row);rows.push(row);
  if(p.owner==='company'){
   g.companyCash=round(n(g.companyCash)+net);
   finance?.event?.(g,'revenue',weeklyRent,{cashEffect:weeklyRent,profitEffect:weeklyRent,sourceType:'property-rent',sourceID:p.id,idempotencyKey:`property-rent-${p.id}-w${week}`,description:`${p.name||p.id} 賃料収入`});
   if(expense>0)finance?.event?.(g,'maintenance',expense,{cashEffect:-expense,profitEffect:-expense,sourceType:'property-maintenance',sourceID:p.id,idempotencyKey:`property-maintenance-${p.id}-w${week}`,description:`${p.name||p.id} 維持修繕費`});
  }else if(p.owner==='personal')g.personalCash=round(n(g.personalCash)+net);
 }
 processLoans(engine,week);r.lastProcessedWeek=week;return rows;
}
Engine.prototype.enablePropertyRental=function(propertyID,options={}){const p=(this.g.properties||[]).find(x=>x.id===propertyID);if(!rentable(p))return false;ensure(this.g);p.realEstate.rentalEnabled=true;p.realEstate.monthlyRent=Math.max(10000,n(options.monthlyRent,p.realEstate.monthlyRent||n(p.value,p.price)*.004));p.realEstate.targetOccupancy=clamp(options.targetOccupancy??p.realEstate.targetOccupancy,.2,1);p.realEstate.occupancy=Math.max(p.realEstate.occupancy,.5);this.save?.();this.emit?.();return true;};
Engine.prototype.disablePropertyRental=function(propertyID){const p=(this.g.properties||[]).find(x=>x.id===propertyID);if(!p?.realEstate)return false;p.realEstate.rentalEnabled=false;this.save?.();this.emit?.();return true;};
Engine.prototype.getPropertyInvestmentMetrics=function(propertyID){const p=(this.g.properties||[]).find(x=>x.id===propertyID);if(!p)return null;ensure(this.g);const x=p.realEstate,price=Math.max(1,n(p.purchasePrice,p.price||p.value)),annualGross=x.monthlyRent*12*x.targetOccupancy,annualNet=annualGross-price*.0042,capacity=collateralCapacity(this.g,p);return {propertyID,owner:p.owner,valuation:n(p.value,price),landValue:x.landValue,buildingValue:x.buildingValue,occupancy:x.occupancy,condition:x.condition,grossYield:annualGross/price,netYield:annualNet/price,collateralValue:capacity.gross,collateralUsed:capacity.used,collateralAvailable:capacity.available,repairReserve:x.repairReserve,lastNetIncome:x.lastNetIncome};};
Engine.prototype.borrowAgainstProperty=function(propertyID,amount,options={}){return this.runTransaction(()=>{const g=this.g,p=(g.properties||[]).find(x=>x.id===propertyID);if(!p?.owner)return false;ensure(g);const capacity=collateralCapacity(g,p),principal=round(Math.max(0,n(amount)));if(principal<=0||principal>capacity.available)return false;const owner=p.owner==='personal'?'personal':'company',termWeeks=Math.max(13,Math.floor(n(options.termWeeks,260))),interestRate=clamp(options.interestRate??(owner==='company'?.045:.055),.005,.25),loanID=`property-loan-${propertyID}-w${Math.floor(n(g.week,1))}-${g.realEstate.loans.length+1}`;g.realEstate.loans.push({loanID,propertyID,owner,principal,outstandingPrincipal:principal,interestRate,termWeeks,remainingWeeks:termWeeks,status:'active',originatedWeek:Math.floor(n(g.week,1)),lastPaymentWeek:0,missedPayments:0});if(owner==='company'){g.companyCash=round(n(g.companyCash)+principal);g.companyDebt=round(n(g.companyDebt)+principal);finance?.event?.(g,'debtBorrowing',principal,{cashEffect:principal,liabilityEffect:principal,sourceType:'property-collateral-borrowing',sourceID:loanID,idempotencyKey:`property-loan-origination-${loanID}`,description:`${p.name||propertyID} 担保融資`});}else{g.personalCash=round(n(g.personalCash)+principal);g.personalDebt=round(n(g.personalDebt)+principal);}return loanID;});};
Engine.prototype.repayPropertyLoan=function(loanID,amount=Infinity){return this.runTransaction(()=>{const g=this.g;ensure(g);const loan=g.realEstate.loans.find(x=>x.loanID===loanID&&x.status==='active');if(!loan)return false;const owner=loan.owner,cashKey=owner==='company'?'companyCash':'personalCash',pay=round(Math.min(n(loan.outstandingPrincipal),n(amount,loan.outstandingPrincipal),n(g[cashKey])));if(pay<=0)return false;g[cashKey]=round(n(g[cashKey])-pay);loan.outstandingPrincipal=round(n(loan.outstandingPrincipal)-pay);if(owner==='company'){g.companyDebt=round(Math.max(0,n(g.companyDebt)-pay));finance?.event?.(g,'debtRepayment',pay,{cashEffect:-pay,liabilityEffect:-pay,sourceType:'property-collateral-prepayment',sourceID:loanID,description:'不動産担保融資 繰上返済'});}else g.personalDebt=round(Math.max(0,n(g.personalDebt)-pay));if(loan.outstandingPrincipal<=0)loan.status='paid';return pay;});};
const baseNormalize=Engine.prototype.normalize;Engine.prototype.normalize=function(){const result=baseNormalize.call(this);ensure(this.g);return result;};
const baseParityWeekly=Engine.prototype.updateParityWeekly;if(typeof baseParityWeekly!=='function')throw new Error('updateParityWeekly hook is missing.');Engine.prototype.updateParityWeekly=function(){const result=baseParityWeekly.apply(this,arguments);processWeek(this);return result;};
modules.realEstate=Object.freeze({VERSION,ensure,processWeek,processLoans,valuationParts,collateralCapacity,rentable});
})();