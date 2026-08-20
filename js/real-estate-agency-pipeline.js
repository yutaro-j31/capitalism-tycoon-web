// Deterministic per-store brokerage pipeline for the realEstateAgency business.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('runtime.js must be loaded before real-estate-agency-pipeline.js.');
if(modules.realEstateAgencyPipeline)throw new Error('real-estate-agency-pipeline.js already registered.');
// A 50/50 mix keeps the expected fee yield at the previously calibrated 6%.
const BUSINESS_ID='realEstateAgency',SCHEMA_VERSION=3,SINGLE_COMMISSION_RATE=.055,DOUBLE_COMMISSION_RATE=.065,DOUBLE_SIDE_RATE=.5,HISTORY_LIMIT=52;
const SEGMENTS=Object.freeze(['residential','luxury','investment','corporateDeal']);
// Weighted asking value (1.019x) and closing propensity (1.067x at a neutral cycle)
// stay close to the pre-segment brokerage calibration while making deal types meaningful.
const SEGMENT_CONFIG=Object.freeze({
  residential:Object.freeze({weight:.58,valueMultiplier:.8,closeMultiplier:1.14,expiryOffset:0,cycleSensitivity:1}),
  luxury:Object.freeze({weight:.14,valueMultiplier:1.45,closeMultiplier:.88,expiryOffset:3,cycleSensitivity:1}),
  investment:Object.freeze({weight:.18,valueMultiplier:1.12,closeMultiplier:1.08,expiryOffset:1,cycleSensitivity:2}),
  corporateDeal:Object.freeze({weight:.1,valueMultiplier:1.5,closeMultiplier:.88,expiryOffset:4,cycleSensitivity:1})
});
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,finite(value,min)));
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));
const hash=(seed,salt)=>{let h=2166136261>>>0;for(const c of `${seed}:${salt}`){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h/4294967296;};
const commissionRateForSide=side=>side==='double'?DOUBLE_COMMISSION_RATE:SINGLE_COMMISSION_RATE;
const sideForDeal=(seed,dealID,storeID)=>hash(seed||1,`${storeID}:${dealID}:side`)<DOUBLE_SIDE_RATE?'double':'single';
const segmentForDeal=(seed,dealID,storeID)=>{const roll=hash(seed||1,`${storeID}:${dealID}:segment`);let cumulative=0;for(const segment of SEGMENTS){cumulative+=SEGMENT_CONFIG[segment].weight;if(roll<cumulative)return segment;}return 'corporateDeal';};
const emptySegmentCounts=()=>({residential:0,luxury:0,investment:0,corporateDeal:0});
const sanitizeSegmentCounts=value=>{const counts=emptySegmentCounts();for(const segment of SEGMENTS)counts[segment]=integer(segment==='corporateDeal'&&value?.corporateDeal===undefined?value?.corporate:value?.[segment]);return counts;};
function marketIndicator(g){return clamp(finite(g?.realEstateCycle,1),.65,1.55);}
function capacityFor(business){return Math.max(6,8+Math.floor(clamp(business?.efficiency,0,100)/5));}
function eligibleStores(stores){return (Array.isArray(stores)?stores:[]).filter(store=>store?.businessID===BUSINESS_ID&&store.status==='open');}
function sanitizeDeal(deal,storeID,week,seed){
  if(!deal||typeof deal!=='object')return null;
  const id=typeof deal.id==='string'&&deal.id?deal.id:null;if(!id)return null;
  const side=deal.side==='single'||deal.side==='double'?deal.side:sideForDeal(seed,id,storeID);
  const segment=deal.segment==='corporate'?'corporateDeal':SEGMENTS.includes(deal.segment)?deal.segment:segmentForDeal(seed,id,storeID);
  return {id,storeID,createdWeek:Math.min(week,Math.max(1,integer(deal.createdWeek,week))),askingValue:Math.max(1_000_000,integer(deal.askingValue,30_000_000)),side,segment};
}
function ensureStore(store,business,week,seed){
  const raw=store.brokeragePipeline&&typeof store.brokeragePipeline==='object'?store.brokeragePipeline:{};
  const active=Array.isArray(raw.activeDeals)?raw.activeDeals.map(x=>sanitizeDeal(x,store.id,week,seed)).filter(Boolean):[];
  const capacity=capacityFor(business),totals=raw.totals&&typeof raw.totals==='object'?raw.totals:{};
  store.brokeragePipeline={schemaVersion:SCHEMA_VERSION,capacity,activeDeals:active.slice(0,capacity),lastWeek:raw.lastWeek&&typeof raw.lastWeek==='object'?raw.lastWeek:null,totals:{inquiries:integer(totals.inquiries),mandates:integer(totals.mandates),closedDeals:integer(totals.closedDeals),singleClosedDeals:integer(totals.singleClosedDeals),doubleClosedDeals:integer(totals.doubleClosedDeals),closedBySegment:sanitizeSegmentCounts(totals.closedBySegment),lostDeals:integer(totals.lostDeals),closedTransactionVolume:integer(totals.closedTransactionVolume),commissionRevenue:integer(totals.commissionRevenue)},history:Array.isArray(raw.history)?raw.history.filter(x=>x&&typeof x==='object').slice(-HISTORY_LIMIT):[]};
  return store.brokeragePipeline;
}
function normalize(g){
  const businesses=Array.isArray(g?.businesses)?g.businesses:[],business=businesses.find(x=>x?.id===BUSINESS_ID);
  for(const store of Array.isArray(g?.stores)?g.stores:[])if(store?.businessID===BUSINESS_ID&&store.brokeragePipeline&&typeof store.brokeragePipeline==='object')ensureStore(store,business,integer(g.week,1),g.seed);
}
function processStore(g,store,business,pref){
  if(!store||store.businessID!==BUSINESS_ID||store.status!=='open')return null;
  const week=Math.max(1,integer(g?.week,1)),pipeline=ensureStore(store,business,week,g?.seed),cycle=marketIndicator(g);
  const quality=clamp(business?.quality,0,100),brand=clamp(business?.brand,0,100),dx=clamp(business?.dx,0,100),efficiency=clamp(business?.efficiency,0,100);
  let closedDeals=0,singleClosedDeals=0,doubleClosedDeals=0,lostDeals=0,closedTransactionVolume=0,singleCommissionRevenue=0,doubleCommissionRevenue=0,totalCloseWeeks=0;const closedBySegment=emptySegmentCounts();
  const survivors=[];
  for(const deal of pipeline.activeDeals){
    const age=Math.max(0,week-deal.createdWeek),config=SEGMENT_CONFIG[deal.segment],baseCloseChance=.18+quality*.0022+dx*.001+(cycle-1)*.18+efficiency*.0006,cycleAdjustment=(cycle-1)*.18*(config.cycleSensitivity-1),closeChance=clamp(baseCloseChance*config.closeMultiplier+cycleAdjustment,.08,.68);
    const closeRoll=hash(g.seed||1,`${store.id}:${deal.id}:close:${week}`),expiryWeeks=Math.max(6,14-Math.floor(efficiency/18)-Math.floor(dx/30)+config.expiryOffset);
    if(age>=1&&closeRoll<closeChance){const negotiation=.88+hash(g.seed||1,`${deal.id}:value:${week}`)*.2,transactionValue=Math.round(deal.askingValue*negotiation),fee=Math.round(transactionValue*commissionRateForSide(deal.side));closedDeals++;closedBySegment[deal.segment]++;closedTransactionVolume+=transactionValue;totalCloseWeeks+=age;if(deal.side==='double'){doubleClosedDeals++;doubleCommissionRevenue+=fee;}else{singleClosedDeals++;singleCommissionRevenue+=fee;}}
    else if(age>=expiryWeeks){lostDeals++;}
    else survivors.push(deal);
  }
  pipeline.activeDeals=survivors;
  const inquiryBase=(2+brand/12)*(finite(pref?.traffic,1))*(.72+cycle*.28)*(1+dx/250),inquiries=Math.max(0,Math.floor(inquiryBase+hash(g.seed||1,`${store.id}:inquiries:${week}`)*2));
  const available=Math.max(0,pipeline.capacity-pipeline.activeDeals.length),mandateChance=clamp(.34+brand*.002+quality*.0015+(cycle-1)*.12,.2,.68);let mandates=0;
  for(let i=0;i<inquiries&&mandates<available;i++)if(hash(g.seed||1,`${store.id}:mandate:${week}:${i}`)<mandateChance){
    const id=`BRA-${store.id}-${week}-${i}`,segment=segmentForDeal(g.seed||1,id,store.id),marketValue=(18_000_000+hash(g.seed||1,`${id}:asking`)*52_000_000)*cycle*SEGMENT_CONFIG[segment].valueMultiplier;
    pipeline.activeDeals.push({id,storeID:store.id,createdWeek:week,askingValue:Math.round(marketValue),side:sideForDeal(g.seed||1,id,store.id),segment});mandates++;
  }
  const commissionRevenue=singleCommissionRevenue+doubleCommissionRevenue,conversionDenominator=closedDeals+lostDeals;
  const row={week,marketIndicator:cycle,inquiries,newMandates:mandates,activeDeals:pipeline.activeDeals.length,closedDeals,singleClosedDeals,doubleClosedDeals,closedBySegment,lostDeals,closedTransactionVolume,singleCommissionRevenue,doubleCommissionRevenue,commissionRevenue,conversionRate:conversionDenominator?closedDeals/conversionDenominator:0,averageCloseWeeks:closedDeals?totalCloseWeeks/closedDeals:0,capacity:pipeline.capacity};
  pipeline.lastWeek=row;pipeline.history.push(row);pipeline.history=pipeline.history.slice(-HISTORY_LIMIT);
  for(const key of ['inquiries','closedDeals','singleClosedDeals','doubleClosedDeals','lostDeals','closedTransactionVolume','commissionRevenue'])pipeline.totals[key]+=row[key];pipeline.totals.mandates+=mandates;
  for(const segment of SEGMENTS)pipeline.totals.closedBySegment[segment]+=closedBySegment[segment];
  return {sales:commissionRevenue,variable:Math.round(commissionRevenue*.1),kpi:row};
}
modules.realEstateAgencyPipeline=Object.freeze({BUSINESS_ID,SCHEMA_VERSION,SINGLE_COMMISSION_RATE,DOUBLE_COMMISSION_RATE,DOUBLE_SIDE_RATE,HISTORY_LIMIT,SEGMENTS,SEGMENT_CONFIG,commissionRateForSide,sideForDeal,segmentForDeal,marketIndicator,capacityFor,eligibleStores,ensureStore,normalize,processStore});
})();
