const assert = require('node:assert');
const { loadGame } = require('./harness');
const { legacyRamenStoreSales } = require('./legacy-market-helper');
const { modules } = loadGame({ random: () => 0.5 });
const market = modules.market;
function scenario(label, mutate=()=>{}, count=1, pref='tokyo') {
  const g = new modules.engine.TycoonEngine().g;
  const b = g.businesses.find(x=>x.id==='ramen');
  mutate(g,b);
  const stores = Array.from({length:count},(_,i)=>({id:`s${i}`,businessID:'ramen',prefID:pref,name:`店${i}`,status:'open',openingWeek:1,condition:100,operatingHours:3,lastSales:0,lastProfit:0}));
  const legacy = stores.reduce((a,s)=>a+legacyRamenStoreSales(g,b,s,0.5),0);
  const actual = market.calculateLocalMarket(g,b,stores).results.reduce((a,r)=>a+r.sales,0);
  return {label, legacy, actual, gap:(actual-legacy)/legacy};
}
const normal = [
  scenario('standard'),
  scenario('normal price'),
  scenario('advertising', (g,b)=>{b.brand += 15;}),
  scenario('quality', (g,b)=>{b.quality += 15;}),
  scenario('low economy', (g)=>{g.economy=.86;}),
  scenario('high economy', (g)=>{g.economy=1.14;})
];
for (const row of normal) assert(Math.abs(row.gap) <= .10, `${row.label} gap ${(row.gap*100).toFixed(2)}%`);
const multiDifferent = scenario('multiple different markets', undefined, 1, 'tokyo');
assert(Math.abs(multiDifferent.gap) <= .10);
const extremeHigh = scenario('extreme price', (g,b)=>{b.price*=2.5;});
assert(Math.abs(extremeHigh.gap) > .10, 'extreme price is an intentional exception');
console.log(JSON.stringify(normal.map(r=>({label:r.label, legacy:Math.round(r.legacy), actual:Math.round(r.actual), gap:Number((r.gap*100).toFixed(2))})), null, 2));
