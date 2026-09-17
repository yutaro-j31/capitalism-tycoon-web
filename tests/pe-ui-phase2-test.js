const assert=require('node:assert/strict');
const fs=require('node:fs');

const uiSource=fs.readFileSync('js/pe-ui.js','utf8');
const adapterSource=fs.readFileSync('js/pe-ui-adapter.js','utf8');
const phase1Css=fs.readFileSync('css/d-ui-pe.css','utf8');
const phase2Css=fs.readFileSync('css/d-ui-pe-phase2.css','utf8');

assert.match(uiSource,/data-pe-portfolio-open/,'portfolio cards must expose the company detail transition');
assert.match(uiSource,/data-pe-exit-confirm/,'exit preview must expose an explicit confirmation action');
assert.match(uiSource,/disabled aria-disabled="true">経営する <small>Coming Soon<\/small>/,'management action must remain disabled until the capability boundary is connected');
assert.doesNotMatch(uiSource,/__capitalismTycoonModules|modules\./,'Phase 2 UI must not bypass the adapter boundary');
assert.match(phase1Css,/@import url\("\.\/d-ui-pe-phase2\.css"\)/,'Phase 2 visual layer must be loaded by the existing PE stylesheet');
assert.match(phase2Css,/\.pe-portfolio-summary/);
assert.match(phase2Css,/\.pe-company-detail/);
assert.match(phase2Css,/\.pe-exit-preview/);
assert.match(phase2Css,/\.pe-holding-card footer \.btn\{min-height:44px\}/,'holding card actions must keep a 44px mobile tap target');
assert.match(phase2Css,/\.pe-holding-card footer \.pe-card-link\{[^}]*min-height:44px/,'portfolio detail link must keep a 44px mobile tap target');
assert.match(phase2Css,/\.pe-detail-head \.pe-back\{flex:0 0 44px\}/,'company detail back button must keep a 44px mobile tap target');
assert.match(adapterSource,/previewPortfolioExit/,'adapter must delegate valuation preview to the production portfolio service');
assert.match(adapterSource,/exitPortfolioCompany/,'adapter must delegate the write to the production portfolio service');
assert.doesNotMatch(adapterSource,/Math\.random|Date\.now|performance\.now|randomUUID/,'Phase 2 adapter must remain deterministic');

let saveCalls=0;
let exitCalls=[];
let state={
  week:120,
  personalCash:500000000,
  peFirm:{
    unlocked:true,
    funds:[{
      id:'fund-p2',name:'Fund I',size:10000000000,cash:2000000000,status:'investing',investmentDeadlineWeek:200,
      deals:[{
        id:'holding-1',name:'Peak Gym',businessID:'gym',status:'active',acquiredWeek:68,
        acquisitionPrice:2000000000,investedAmount:1000000000,
        portfolioCompany:{improvementScore:70,weeklyRevenue:50000000,weeklyProfit:10000000,cash:200000000,storeCount:4,priceMultiplier:1.1,gymOperatingState:{gymMembership:{membershipStrategy:'offPeak'}}}
      },{
        id:'holding-2',name:'Rising Ramen',businessID:'ramen',status:'active',acquiredWeek:80,
        acquisitionPrice:1500000000,investedAmount:800000000,
        portfolioCompany:{improvementScore:55,weeklyRevenue:20000000,weeklyProfit:3000000,cash:90000000,storeCount:2}
      }]
    }]
  },
  acquisitionTargets:[],maDealRooms:[],peNetwork:{nodes:[]}
};
const engine={g:state,save(){saveCalls+=1;}};
const preview={
  ok:true,companyName:'Peak Gym',method:'sale',acquisitionPrice:2000000000,investedAmount:1000000000,
  fundPortion:.8,coinvestPortion:.2,exitEnterpriseValue:3000000000,portfolioCash:200000000,grossProceeds:3200000000,
  holdingWeeks:52,optimalHoldingWeeks:104,currentMOIC:3.2,exitMultiple:8,marketFactor:1.05,
  settlement:{
    fundShare:2560000000,coinvestShare:640000000,fundPrincipalReturned:800000000,coinvestPrincipalReturned:200000000,
    fundCarry:300000000,coinvestCarry:50000000,gpCarry:60000000,gpPrincipalAndGain:100000000,
    distributedToFund:2260000000,returnedToCoinvestors:590000000,settledWeek:120
  },
  eligibility:{eligible:true,reason:null}
};
let priceCalls=[],strategyCalls=[];
function dealFor(dealID){return state.peFirm.funds[0].deals.find(d=>d.id===dealID);}
const portfolioOps={
  REPUTATION_THRESHOLD:65,
  leverFactors:()=>({procurementDrag:0,laborDrag:0,sideEffectFactor:1}),
  previewPortfolioExit:(_state,fundID,dealID,options)=>{
    assert.equal(_state,state);assert.equal(fundID,'fund-p2');assert.deepEqual(options,{method:'sale'});
    return dealID==='holding-1'?preview:{ok:false};
  },
  exitPortfolioCompany:(_state,fundID,dealID,options)=>{
    exitCalls.push({_state,fundID,dealID,options});
    return {ok:true};
  },
  setPriceMultiplier:(_state,fundID,dealID,value)=>{
    priceCalls.push({fundID,dealID,value});
    const deal=dealFor(dealID);if(!deal)return null;
    deal.portfolioCompany.priceMultiplier=value;
    return deal;
  },
  setPortfolioGymMembershipStrategy:(_state,fundID,dealID,strategyID)=>{
    strategyCalls.push({fundID,dealID,strategyID});
    const deal=dealFor(dealID);if(!deal||deal.businessID!=='gym')return null;
    deal.portfolioCompany.gymOperatingState={gymMembership:{membershipStrategy:strategyID}};
    return deal;
  }
};
const pf={
  NEXT_FUND_MIN_DPI:1.2,NEXT_FUND_MIN_DEPLOYMENT:.8,INVESTMENT_PERIOD_WEEKS:260,
  slotCapacity:()=>3,activeDealCount:()=>1,currentDDUsage:()=>({used:0}),ddSlotsPerYear:()=>3,ddSlotsRemaining:()=>3,
  fundDPI:()=>1.25,fundDeploymentRate:()=>.8,requiredDeploymentRate:()=>.8
};
const ma={activeStatuses:()=>new Set(),SELLER_TYPES:{},STATUS_LABELS:{},recommendedOfferRange:()=>null};

const gymMembershipModel={
  STRATEGY_ORDER:['standard','offPeak','premium'],
  STRATEGIES:{standard:{name:'標準'},offPeak:{name:'オフピーク'},premium:{name:'プレミアム'}}
};
globalThis.__capitalismTycoonModules={
  peFund:pf,maDealRoom:ma,pePortfolioOperations:portfolioOps,gymMembershipModel,
  // Mirrors js/management-context.js's real resolvePortfolioManagementCapability(): only this
  // fixture's gym deal has a detached production bridge (ramen does not) -- conveni's own bridge
  // (see tests/pe-conveni-ui-connection-test.js) is exercised in a separate, dedicated test file.
  managementContext:{canOpenPEPortfolioManagement:(_engine,fundID,dealID)=>{
    const deal=dealFor(dealID);
    if(!deal)return {ok:false,reason:'deal-not-found',capability:null};
    const actionsEnabled=deal.businessID==='gym';
    return {ok:true,capability:{supported:true,actionsEnabled,reason:null}};
  }},
  peNetwork:{MONOPOLY_TRUST_THRESHOLD:60},playerEngineBridge:{getEngine:()=>engine},peRivals:{ROSTER:[]},
  dUIShell:{money:v=>`${v}円`},data:{MASTER:{businesses:[{id:'gym',name:'ジム'},{id:'ramen',name:'ラーメン'}]}}
};

delete globalThis.CapitalismTycoonPEUIAdapter;
delete require.cache[require.resolve('../js/pe-ui-adapter.js')];
require('../js/pe-ui-adapter.js');
const adapter=globalThis.CapitalismTycoonPEUIAdapter;
const model=adapter.getPEUIData({portfolioDealId:'holding-1',includeExitPreview:true});

assert.ok(model.navigation.some(row=>row[0]==='portfolio'),'PE navigation must expose Portfolio');
assert.equal(model.portfolio.summary.holdingCount,2);
assert.equal(model.portfolio.summary.enterpriseValue,3000000000,'the ramen holding has no exit preview mock and contributes 0');
assert.equal(model.portfolio.summary.grossValue,3200000000);
assert.equal(model.portfolio.summary.unrealizedGain,3200000000-(1000000000+800000000));
assert.equal(model.portfolio.selected.companyName,'Peak Gym');
assert.equal(model.portfolio.selected.industry,'ジム');
assert.equal(model.portfolio.selected.management.supported,true);
assert.equal(model.portfolio.selected.management.actionsEnabled,true,'gym is the first pillar business with a detached production bridge, so its management actions are enabled');
assert.deepEqual(model.portfolio.selected.management.gym,{priceMultiplier:1.1,membershipStrategy:'offPeak',strategies:[{id:'standard',name:'標準'},{id:'offPeak',name:'オフピーク'},{id:'premium',name:'プレミアム'}]});
assert.equal(model.portfolio.exitPreview.settlement.personalCashProceeds,160000000,'Exit preview must expose GP principal/gain plus carry without recomputing the production waterfall');
assert.equal(model.portfolio.exitPreview.currentMOIC,3.2);

const ramenModel=adapter.getPEUIData({portfolioDealId:'holding-2'});
assert.equal(ramenModel.portfolio.selected.management.supported,true);
assert.equal(ramenModel.portfolio.selected.management.actionsEnabled,false,'other supported pillars stay disabled until they have their own detached bridge');
// portfolioManagementDetails() is business-agnostic now (see js/pe-ui-adapter.js): every deal
// gets at least {priceMultiplier}, and only gym additionally gets membershipStrategy/strategies.
// The ramen manage screen stays unreachable because manageView()'s guard checks actionsEnabled
// only (still false for ramen here), not the presence of this field.
assert.deepEqual(ramenModel.portfolio.selected.management.gym,{priceMultiplier:1},'non-gym businesses still get the business-agnostic price lever data, just no membership strategy');

assert.match(uiSource,/data-pe-portfolio-manage/,'an enabled holding must expose a way to open the manage screen');
assert.match(uiSource,/data-pe-manage-strategy/,'the manage screen must expose a membership strategy action');
assert.match(uiSource,/data-pe-manage-price/,'the manage screen must expose a price multiplier control');
assert.match(phase1Css,/\.pe-strategy-row\{/,'the membership strategy picker must have a dedicated layout rule');

assert.equal(adapter.performPortfolio('setGymPriceMultiplier',{fundID:'fund-p2',dealID:'holding-1',value:1.4}),true,'gym price action must succeed when actionsEnabled');
assert.equal(priceCalls.length,1);assert.deepEqual(priceCalls[0],{fundID:'fund-p2',dealID:'holding-1',value:1.4});
assert.equal(saveCalls,1,'a successful gym price action must persist through the engine exactly once');
assert.equal(adapter.performPortfolio('setGymMembershipStrategy',{fundID:'fund-p2',dealID:'holding-1',strategyID:'premium'}),true);
assert.equal(strategyCalls.length,1);assert.deepEqual(strategyCalls[0],{fundID:'fund-p2',dealID:'holding-1',strategyID:'premium'});
assert.equal(saveCalls,2);

// Defense in depth: the adapter must re-check actionsEnabled itself, not just trust a UI that
// disabled the button -- a stale/bypassed call for the still-disabled ramen deal must not write.
assert.equal(adapter.performPortfolio('setGymPriceMultiplier',{fundID:'fund-p2',dealID:'holding-2',value:1.4}),false,'gym-only action must refuse a non-gym deal even if called directly');
assert.equal(priceCalls.length,1,'refused action must not reach the production write path');
assert.equal(adapter.performPortfolio('setGymMembershipStrategy',{fundID:'fund-p2',dealID:'holding-2',strategyID:'premium'}),false);
assert.equal(strategyCalls.length,1);
assert.equal(saveCalls,2,'refused actions must never persist a false-positive mutation');

saveCalls=0;
assert.equal(adapter.performPortfolio('manage',{fundID:'fund-p2',dealID:'holding-1'}),false,'unsupported management action must not mutate production state');
assert.equal(saveCalls,0);
assert.equal(exitCalls.length,0);
assert.equal(adapter.performPortfolio('exit',{fundID:'fund-p2',dealID:'holding-1'}),true);
assert.equal(exitCalls.length,1);
assert.equal(exitCalls[0]._state,state);
assert.deepEqual(exitCalls[0].options,{method:'sale'});
assert.equal(saveCalls,1,'successful Exit must persist through the engine exactly once');

portfolioOps.exitPortfolioCompany=()=>false;
assert.equal(adapter.performPortfolio('exit',{fundID:'fund-p2',dealID:'holding-1'}),false);
assert.equal(saveCalls,1,'failed Exit must never persist a false-positive mutation');

console.log('pe-ui-phase2-test: portfolio normalization, gym-only management boundary, manage-screen actions, Exit delegation, save semantics and mobile tap targets passed');