const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

let rngCalls=0;
const {modules}=loadGame({random:()=>{rngCalls++;return .5;}}),model=modules.storeMarketEnvironment;
assert(model);

const area={id:'kanto',competition:.3,ramenFit:1,cafeFit:1.1,conveniFit:1.12};
assert.equal(model.businessAreaFit({id:'ramen'},area),area.ramenFit);
assert.equal(model.businessAreaFit({id:'cafe'},area),area.cafeFit);
assert.equal(model.businessAreaFit({id:'conveni'},area),area.conveniFit);
assert.equal(model.businessAreaFit({id:'gym'},area),1);

const competitors=[
  {areaID:'kanto',businessID:'gym',stores:4,brand:30,quality:30},
  {areaID:'kanto',businessID:'gym',stores:2,brand:20,quality:40},
  {areaID:'kinki',businessID:'gym',stores:99,brand:100,quality:100},
  {areaID:'kanto',businessID:'cafe',stores:99,brand:100,quality:100}
];
const before=JSON.stringify({area,competitors}),rngBefore=rngCalls;
const pressure=model.competitorPressure(competitors,'kanto','gym');
assert.equal(pressure,4*60/12000+2*60/12000);
assert.equal(model.competitorPressure([],'kanto','gym'),0);
assert.equal(model.localCompetition(area,pressure),area.competition+pressure);

const input={baseDemand:130,prefectureTraffic:1.55,areaTraffic:1.26,economy:1.03,season:.97,businessAreaFit:1,quality:10,brand:12,dx:0,localCompetition:area.competition+pressure,weeklyDemandMultiplier:1,siteSuitabilityFactor:1.04,dxDepartmentEffect:.7,marketingDepartmentEffect:.8,operatingHoursFactor:1.17,macroSalesFactor:.82};
let legacy=input.baseDemand*input.prefectureTraffic*input.areaTraffic*input.economy*input.season*input.businessAreaFit*(1+input.quality/100)*(1+input.brand/90)*(1+input.dx/140)*(1-input.localCompetition*.55)*input.weeklyDemandMultiplier;
legacy*=input.siteSuitabilityFactor;legacy*=1+input.dxDepartmentEffect*.05+input.marketingDepartmentEffect*.03;legacy*=input.operatingHoursFactor;legacy*=input.macroSalesFactor;
assert.strictEqual(model.storeDemand(input),legacy);
const varied={...input,weeklyDemandMultiplier:.88};
let variedLegacy=varied.baseDemand*varied.prefectureTraffic*varied.areaTraffic*varied.economy*varied.season*varied.businessAreaFit*(1+varied.quality/100)*(1+varied.brand/90)*(1+varied.dx/140)*(1-varied.localCompetition*.55)*varied.weeklyDemandMultiplier;
variedLegacy*=varied.siteSuitabilityFactor;variedLegacy*=1+varied.dxDepartmentEffect*.05+varied.marketingDepartmentEffect*.03;variedLegacy*=varied.operatingHoursFactor;variedLegacy*=varied.macroSalesFactor;
assert.strictEqual(model.storeDemand(varied),variedLegacy);
assert.equal(JSON.stringify({area,competitors}),before);
assert.equal(rngCalls,rngBefore,'pure helpers must not consume RNG');

const engine=new modules.engine.TycoonEngine();engine.configure({playerName:'p',companyName:'c',difficulty:'normal',scenario:'free'});
assert.equal(engine.fit(engine.business('gym'),engine.area('kanto')),1);
assert.equal(engine.competitorPressure('kanto','gym'),model.competitorPressure(engine.g.competitors,'kanto','gym'));
const tenant=engine.g.tenants.find(row=>row.businessID==='gym');
const estimate=engine.estimateStoreOpening({tenantID:tenant.id,businessID:'gym',operatingHours:3});
assert(estimate&&Number.isFinite(estimate.expected.units));

console.log('store market environment model ok');
