const { loadGame } = require('./harness');

const SCENARIOS = Object.freeze([
  { id:'ramen-bootstrap', businessID:'ramen', trait:'merchant', route:['fukuoka','osaka','tokyo','aichi','miyagi'], debt:false },
  { id:'cafe-bootstrap', businessID:'cafe', trait:'local', route:['okinawa','kyoto','tokyo','kanagawa','fukuoka'], debt:false },
  { id:'bakery-bootstrap', businessID:'bakery', trait:'merchant', route:['fukuoka','osaka','tokyo','aichi','miyagi'], debt:false },
  { id:'conveni-leverage', businessID:'conveni', trait:'merchant', route:['fukuoka','aichi','tokyo','osaka','kanagawa'], debt:true },
  { id:'bookstore-retail', businessID:'bookstore', trait:'local', route:['fukuoka','osaka','tokyo','aichi','kanagawa'], debt:true },
  { id:'beauty-service', businessID:'beautySalon', trait:'local', route:['fukuoka','aichi','tokyo','osaka','kanagawa'], debt:false },
  { id:'cleaning-bootstrap', businessID:'cleaning', trait:'merchant', route:['fukuoka','osaka','tokyo','aichi','kanagawa'], debt:false },
  { id:'cram-school', businessID:'cramSchool', trait:'ambitious', route:['tokyo','kanagawa','aichi','osaka','fukuoka'], debt:true },
  { id:'real-estate-agency', businessID:'realEstateAgency', trait:'investor', route:['tokyo','kanagawa','osaka','aichi','fukuoka'], debt:true },
  { id:'insurance-agency', businessID:'insuranceAgency', trait:'investor', route:['fukuoka','osaka','tokyo','aichi','kanagawa'], debt:true },
  { id:'ma-broker', businessID:'maBroker', trait:'investor', route:['fukuoka','osaka','aichi','tokyo','kanagawa'], debt:true },
  { id:'web-agency', businessID:'webAgency', trait:'tech', route:['fukuoka','osaka','tokyo','aichi','kanagawa'], debt:true },
  { id:'app-studio', businessID:'appStudio', trait:'tech', route:['fukuoka','osaka','tokyo','aichi','kanagawa'], debt:true }
]);
const SEEDS = Object.freeze([0x6b200101,0x6b200202,0x6b200303]);
const MAX_WEEKS = 208;

function makeRandom(initialSeed){
 let seed=initialSeed>>>0;
 return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;};
}

function runScenario(def,seed,{includeState=false}={}){
 const random=makeRandom(seed);
 const {engineModule,modules}=loadGame({random});
 const game=new engineModule.TycoonEngine();
 game.configure({playerName:`監査-${def.id}`,companyName:`監査-${def.id}`,difficulty:'normal',scenario:'standard',founderPrefID:def.route[0],founderTraitID:def.trait});
 const actions=[];
 const business=game.business(def.businessID);
 const maxStores=def.route.length;

 function borrowFor(targetCash,reason){
  if(!def.debt||game.g.companyCash>=targetCash)return false;
  const available=Math.max(0,game.companyCreditLimit()-game.g.companyDebt);
  const amount=Math.min(available,Math.ceil((targetCash-game.g.companyCash)/100000)*100000);
  if(amount<500000)return false;
  const result=game.borrow(amount,'company');
  if(result)actions.push({week:game.g.week,action:'borrow',reason,amount,debt:Math.round(game.g.companyDebt)});
  return result;
 }

 function tenantFor(index){
  const prefID=def.route[index];
  return game.g.tenants.filter(row=>row.prefID===prefID&&!row.occupiedBy).sort((a,b)=>b.traffic-a.traffic||a.deposit-b.deposit)[0];
 }

 function maybeOpenStore(){
  const index=game.g.stores.length;
  if(index>=maxStores)return false;
  if(index>0&&(!game.g.stores.every(row=>row.status==='open')||Number(game.g.lastReport?.profit||0)<=0))return false;
  if(index>=3){
   const missing=game.ipoMissingReasons();
   const growthOnly=missing.every(reason=>['企業価値1億円','直近52週利益1,000万円','決算履歴52週'].includes(reason));
   if(!growthOnly)return false;
  }
  const tenant=tenantFor(index);
  if(!tenant)return false;
  const cost=business.storeCost+tenant.deposit;
  const reserve=index===0?(def.debt?0:900000):3500000;
  borrowFor(cost+reserve,`store-${index+1}`);
  if(game.g.companyCash<cost+reserve)return false;
  const result=game.openStore({tenantID:tenant.id,businessID:def.businessID,name:`${def.id}-${index+1}`,operatingHours:3});
  if(result)actions.push({week:game.g.week,action:'openStore',prefID:tenant.prefID,cash:Math.round(game.g.companyCash)});
  return result;
 }

 function cheapestOffice(){return[...game.g.rentalOffices].sort((a,b)=>a.deposit-b.deposit||a.rent-b.rent)[0];}
 function roleOffer(role){
  const candidate=game.g.executiveMarket.find(row=>row.role===role);
  if(!candidate)return null;
  const salary=Math.ceil((candidate.desiredSalary||candidate.salary)*1.5);
  return{candidate,salary,so:Math.max(candidate.desiredSO||0,.04),bonus:salary*.25};
 }
 function hireRole(role){
  if(game.g.executives[role])return true;
  const offer=roleOffer(role);
  if(!offer)return false;
  for(let attempt=0;attempt<8&&!game.g.executives[role];attempt+=1)game.hireExecutive(offer.candidate.id,offer.salary,offer.so);
  if(game.g.executives[role])actions.push({week:game.g.week,action:`hire-${role}`,cash:Math.round(game.g.companyCash)});
  return Boolean(game.g.executives[role]);
 }
 function maybeBuildCorporateRoute(){
  if(game.g.stores.filter(row=>row.status==='open').length<3)return;
  if(!game.g.hasHeadOffice){
   const office=cheapestOffice();if(!office)return;
   borrowFor(office.deposit+5000000,'office');
   if(game.g.companyCash>=office.deposit+5000000&&game.contractOffice(office.id))actions.push({week:game.g.week,action:'office',cash:Math.round(game.g.companyCash)});
   return;
  }
  if(!game.g.departments.accounting){
   const accounting=modules.data.MASTER.departments.find(row=>row.id==='accounting');
   borrowFor(accounting.setupCost+5000000,'accounting');
   if(game.g.companyCash>=accounting.setupCost+5000000&&game.establishDepartment('accounting'))actions.push({week:game.g.week,action:'accounting',cash:Math.round(game.g.companyCash)});
   return;
  }
  if(!game.g.executives.CEO||!game.g.executives.CFO){
   const offers=['CEO','CFO'].filter(role=>!game.g.executives[role]).map(roleOffer).filter(Boolean);
   const target=offers.reduce((sum,offer)=>sum+offer.bonus,0)+9000000;
   borrowFor(target,'executives');
   if(game.g.companyCash>=target){hireRole('CEO');hireRole('CFO');}
   return;
  }
  if(!game.g.boardEstablished){
   borrowFor(8000000,'board');
   if(game.g.companyCash>=8000000&&game.establishBoard())actions.push({week:game.g.week,action:'board',cash:Math.round(game.g.companyCash)});
  }
 }

 let ipoWeek=null;
 for(let i=0;i<MAX_WEEKS&&!game.g.gameOver&&!game.g.publicCompany;i+=1){
  maybeOpenStore();
  maybeBuildCorporateRoute();
  if(game.ipoMissingReasons().length===0){if(game.executeIPO('東証グロース',100000))ipoWeek=game.g.week;break;}
  game.advanceWeek(false);
 }
 const annualProfit=game.g.reports.slice(-52).reduce((sum,row)=>sum+Number(row.profit||0),0);
 const result={id:def.id,seed,businessID:def.businessID,calibratedDemand:business.demand,debtStrategy:def.debt,ipo:game.g.publicCompany,ipoWeek,gameOver:game.g.gameOver,reason:game.g.gameOverReason,week:game.g.week,stores:game.g.stores.length,openStores:game.g.stores.filter(row=>row.status==='open').length,cash:Math.round(game.g.companyCash),debt:Math.round(game.g.companyDebt),value:Math.round(game.companyValue()),annualProfit:Math.round(annualProfit),reports:game.g.reports.length,missing:game.ipoMissingReasons(),actions};
 if(includeState){result.state=game.g;result.modules=modules;}
 return result;
}

function runMatrix(options={}){
 const results=[];
 for(const scenario of SCENARIOS)for(const seed of SEEDS)results.push(runScenario(scenario,seed,options));
 return results;
}

module.exports={SCENARIOS,SEEDS,MAX_WEEKS,makeRandom,runScenario,runMatrix};
