// Script boundary: js/microcap-listings.js (classic JavaScript)
'use strict';
(function(exports){
const INTERVAL_MIN=8,INTERVAL_MAX=18,ISSUED_SHARES=1_000_000,HISTORY_LIMIT=200,SIGNAL_NOISE=.15;
const ARCHETYPES=Object.freeze([
  Object.freeze({id:'speculative',ceiling:.55,trend:-.003,volatility:.08,profitable:false,per:0}),
  Object.freeze({id:'steady',ceiling:.83,trend:.0015,volatility:.08,profitable:true,per:14}),
  Object.freeze({id:'quality',ceiling:.95,trend:.006,volatility:.13,profitable:true,per:9}),
  Object.freeze({id:'breakout',ceiling:1,trend:.011,volatility:.18,profitable:true,per:7})
]);
const NAME_A=['蒼空','北辰','みらい','東雲','若葉','潮路','光輪','瑞穂','山吹','白樺'];
const NAME_B=['技研','デジタル','素材','物流','バイオ','システム','フーズ','エナジー','工業','サービス'];
function finite(v,f=0){return Number.isFinite(Number(v))?Number(v):f;}
function hash(parts){let h=2166136261;String(parts.join('|')).split('').forEach(c=>{h^=c.charCodeAt(0);h=Math.imul(h,16777619);});h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;return h>>>0;}
function unit(...parts){return hash(parts)/4294967295;}
function integerBetween(a,b,...parts){return Math.min(b,a+Math.floor(unit(...parts)*(b-a+1)));}
function seedKey(state){return `${state.playerName||'創業者'}|${state.companyName||'ポケット商事'}`;}
function intervalFor(state,sequence){return integerBetween(INTERVAL_MIN,INTERVAL_MAX,'microcap',seedKey(state),'interval',sequence);}
function ensure(state){
  const raw=state.microcapMarket&&typeof state.microcapMarket==='object'?state.microcapMarket:{};
  const listings=Array.isArray(raw.listings)?raw.listings.slice(-HISTORY_LIMIT):[];
  const sequence=Math.max(listings.length,Math.floor(finite(raw.sequence,listings.length)));
  const next=finite(raw.nextSpawnWeek,0)>0?Math.floor(raw.nextSpawnWeek):Math.floor(finite(state.week,1))+intervalFor(state,sequence);
  state.microcapMarket={nextSpawnWeek:next,listings,sequence};return state.microcapMarket;
}
function archetypeFor(state,sequence){const roll=unit('microcap',seedKey(state),'archetype',sequence);return ARCHETYPES.find(a=>roll<a.ceiling)||ARCHETYPES[ARCHETYPES.length-1];}
function buildListing(state,week,sequence){
  const key=seedKey(state),archetype=archetypeFor(state,sequence),valuation=integerBetween(100,190,'microcap',key,'valuation',sequence)*10_000_000;
  const noisy=unit('microcap',key,'signal-noise',sequence)<SIGNAL_NOISE,profitable=noisy?!archetype.profitable:archetype.profitable;
  const per=profitable?(archetype.profitable?archetype.per:integerBetween(12,18,'microcap',key,'noise-per',sequence)):0;
  const name=`${NAME_A[hash([key,'name-a',sequence])%NAME_A.length]}${NAME_B[hash([key,'name-b',sequence])%NAME_B.length]}`,id=`MC${String(hash([key,'ticker',sequence])).padStart(10,'0').slice(0,10)}`,price=valuation/ISSUED_SHARES;
  return {stock:{id,name,sector:'小型株',price,previous:price,dividendYield:0,volatility:archetype.volatility,trend:archetype.trend,marketCap:valuation,per,pbr:2,issuedShares:ISSUED_SHARES,dividendPerShare:0,shareholders:{},description:'新興小型上場企業',listingMarket:'東証グロース',microcap:true,priceHistory:[{week,price}]},metadata:{week,stockID:id,valuation,archetype:archetype.id,trend:archetype.trend,volatility:archetype.volatility,profitable,signalNoisy:noisy}};
}
function process(state,notify){
  const market=ensure(state),created=[];
  while(finite(state.week,1)>=market.nextSpawnWeek){const week=market.nextSpawnWeek,sequence=market.sequence,built=buildListing(state,week,sequence);if(!state.market.some(stock=>stock.id===built.stock.id)){state.market.push(built.stock);market.listings.push(built.metadata);created.push(built.stock);}market.sequence+=1;market.nextSpawnWeek=week+intervalFor(state,market.sequence);}
  market.listings=market.listings.slice(-HISTORY_LIMIT);created.forEach(stock=>notify?.(`${stock.name}（${stock.id}）が小型株市場へ新規上場しました。`,'info'));return created;
}
Object.assign(exports,{INTERVAL_MIN,INTERVAL_MAX,ISSUED_SHARES,HISTORY_LIMIT,SIGNAL_NOISE,ARCHETYPES,hash,unit,intervalFor,ensure,archetypeFor,buildListing,process});
})(globalThis.__capitalismTycoonModules.microcapListings={});
