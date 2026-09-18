'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

let randomCalls=0;
const {engineModule,modules}=loadGame({random:()=>{randomCalls++;return 0.99;},isolatedLegacyIndex:true});
const expansion=modules.expansion,lifecycle=modules.productLifecycle;
const plain=value=>JSON.parse(JSON.stringify(value));

// Formal product funnel parity. Lifecycle is marked already-processed for this week so the
// production wrapper exercises only expansion.js's funnel path.
{
  const engine=new engineModule.TycoonEngine();
  engine.g.configured=true;
  engine.g.week=20;
  engine.g.companyCash=100_000_000;
  engine.g.departments={};
  engine.g.founderSkillTech=1;
  const product={
    id:'kernel-app',blueprintID:'app',name:'Kernel App',category:'SaaS',status:'released',origin:'office',
    quality:55,brand:40,users:12_000,paidUsers:700,price:1800,serverCost:50_000,serverCapacity:5_000_000,
    market:2_000_000,risk:.08,valuation:60_000_000,revenue:500_000,cost:220_000,profit:280_000,
    releaseWeek:10,economicsVersion:1,lifecycleStage:'active'
  };
  const funnel={
    productID:product.id,awareness:.12,registeredUsers:12_000,monthlyActiveUsers:7_000,paidUsers:700,
    conversionRate:.08,conversionModifier:.002,churnRate:.04,churnModifier:-.001,arpu:1800,
    serverLoad:.05,supportBurden:.08,b2bContracts:2,lastUpdatedWeek:19
  };
  engine.g.productVentures=[plain(product)];
  engine.g.productFunnels={[product.id]:plain(funnel)};
  engine.g.lastProductLifecycleWeek=20;

  const kernelInput={
    product:plain(product),funnel:plain(funnel),
    economics:modules.data.DIGITAL_PRODUCT_ECONOMICS.app,
    week:20,founderSkillTech:1,
    departmentEffects:{product:0,marketing:0,dx:0}
  };
  const inputBefore=plain(kernelInput),callsBefore=randomCalls;
  const expected=expansion.calculateFormalProductFunnelWeek(kernelInput);
  assert.deepEqual(kernelInput,inputBefore,'formal product funnel kernel must not mutate its input');
  assert.equal(randomCalls,callsBefore,'formal product funnel kernel consumes no RNG');

  const cashBefore=engine.g.companyCash;
  const result=engine.updateProductFunnelsWeekly();
  const actualProduct=engine.g.productVentures[0],actualFunnel=engine.g.productFunnels[product.id];
  assert.deepEqual(plain(actualProduct),plain(expected.nextProduct),'production formal product state must exactly match the pure kernel');
  assert.deepEqual(plain(actualFunnel),plain(expected.nextFunnel),'production formal funnel state must exactly match the pure kernel');
  assert.equal(engine.g.companyCash-cashBefore,expected.adjustment,'production wrapper cash delta must equal kernel operating adjustment');
  assert.equal(result.adjustment,expected.adjustment);
  assert.equal(result.salesAdjustment,expected.salesAdjustment);
  assert.equal(result.expenseAdjustment,expected.expenseAdjustment);
  assert.equal(randomCalls,callsBefore,'no overload RNG is consumed when the pure result is below the overload threshold');
}

// Lifecycle parity for a low-debt product: the pure base kernel computes state transition and
// payable amount, while the wrapper alone writes companyCash/finance/history.
{
  const engine=new engineModule.TycoonEngine();
  engine.g.configured=true;
  engine.g.week=12;
  engine.g.companyCash=50_000_000;
  const product={
    id:'kernel-life',blueprintID:'app',name:'Kernel Lifecycle',status:'released',origin:'office',
    quality:70,brand:55,revenue:2_000_000,profit:1_500_000,users:8000,paidUsers:500,
    price:2500,serverCost:25_000,serverCapacity:200_000,market:1_500_000,valuation:60_000_000,
    maintenancePolicy:'standard',technicalDebt:20,lifecycleAgeWeeks:10,lifecycleIncidents:0,
    lifecycleStage:'active',lastInnovationWeek:0
  };
  const funnel={
    productID:product.id,awareness:.1,registeredUsers:8000,monthlyActiveUsers:4500,paidUsers:500,
    conversionRate:.08,churnRate:.05,arpu:2500,serverLoad:.1,supportBurden:.08,b2bContracts:0,lastUpdatedWeek:11
  };
  engine.g.productVentures=[plain(product)];
  engine.g.productFunnels={[product.id]:plain(funnel)};
  engine.ensureProductLifecycleDefaults();

  const normalizedProduct=plain(engine.g.productVentures[0]);
  const normalizedFunnel=plain(engine.g.productFunnels[product.id]);
  const policy=lifecycle.POLICIES.standard;
  const input={product:plain(normalizedProduct),funnel:plain(normalizedFunnel),policy,availableCash:engine.g.companyCash,week:engine.g.week};
  const inputBefore=plain(input),callsBefore=randomCalls;
  const expected=lifecycle.calculateProductLifecycleBaseWeek(input);
  assert.deepEqual(input,inputBefore,'lifecycle base kernel must not mutate product/funnel input');
  assert.equal(randomCalls,callsBefore,'lifecycle base kernel consumes no RNG');
  assert.equal(expected.incidentEligible,false,'low-debt fixture avoids wrapper incident RNG');

  const cashBefore=engine.g.companyCash;
  const txBefore=engine.g.finance.transactions.length;
  const incidents=engine.updateProductLifecycleWeekly();
  assert.deepEqual(plain(engine.g.productVentures[0]),plain(expected.nextProduct),'production lifecycle product state must match pure base kernel');
  assert.deepEqual(plain(engine.g.productFunnels[product.id]),plain(expected.nextFunnel),'production lifecycle funnel state must match pure base kernel');
  assert.equal(engine.g.companyCash,cashBefore-expected.payable,'wrapper alone settles lifecycle maintenance cash');
  assert.equal(incidents.maintenanceCost,expected.payable);
  const tx=engine.g.finance.transactions.slice(txBefore).filter(row=>row.sourceType==='productMaintenance');
  assert.equal(tx.length,1,'wrapper emits exactly one maintenance accounting event');
  assert.equal(tx[0].cashEffect,-expected.payable);
  assert.equal(randomCalls,callsBefore,'ineligible lifecycle week consumes no incident RNG');
}

// Incident application is a second pure kernel. It applies quality/churn/support effects without
// touching the base result or any global state.
{
  const product={
    id:'incident',blueprintID:'app',name:'Incident',status:'released',origin:'office',
    quality:70,revenue:2_000_000,users:8000,paidUsers:500,maintenancePolicy:'lean',
    technicalDebt:90,lifecycleAgeWeeks:30,lifecycleIncidents:2,lifecycleStage:'active',lastInnovationWeek:0
  };
  const funnel={serverLoad:.3,supportBurden:.2,churnRate:.08};
  const base=lifecycle.calculateProductLifecycleBaseWeek({
    product,funnel,policy:lifecycle.POLICIES.lean,availableCash:10_000_000,week:40
  });
  assert.equal(base.incidentEligible,true);
  const before=plain(base),callsBefore=randomCalls;
  const incident=lifecycle.applyProductLifecycleIncident(base);
  assert.deepEqual(base,before,'incident kernel must not mutate the base result');
  assert.equal(randomCalls,callsBefore,'incident kernel consumes no RNG');
  assert.equal(incident.nextProduct.lifecycleIncidents,before.nextProduct.lifecycleIncidents+1);
  assert.equal(incident.nextProduct.quality,before.nextProduct.quality-1.5);
  assert.equal(incident.nextFunnel.churnRate,before.nextFunnel.churnRate+.003);
  assert.equal(incident.nextFunnel.supportBurden,before.nextFunnel.supportBurden+.03);
}

console.log('product operating pure kernel tests passed');
