// Script boundary: js/expansion.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before expansion.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.expansion)throw new Error('Capitalism Tycoon expansion module is already registered.');
(function(exports){
// Expansion layer for the browser port.
// Adds systems present in the Swift Playgrounds project that were missing or simplified.

const FOUNDER_TRAITS = [
  {id:'tech',name:'技術者肌',icon:'💻',detail:'プロダクト開発とR&Dが少し得意。',business:1.00,tech:1.25,finance:1.00,negotiation:1.00,localRep:20},
  {id:'merchant',name:'商売上手',icon:'🏪',detail:'店舗・仕入れ・交渉が少し得意。',business:1.25,tech:1.00,finance:1.00,negotiation:1.15,localRep:23},
  {id:'investor',name:'投資家気質',icon:'📈',detail:'金融・VC・M&A判断が少し得意。',business:1.00,tech:1.00,finance:1.30,negotiation:1.05,localRep:18},
  {id:'local',name:'地元密着',icon:'🗾',detail:'地元の信用が高く、紹介が出やすい。',business:1.10,tech:1.00,finance:1.00,negotiation:1.15,localRep:32},
  {id:'ambitious',name:'野心家',icon:'🔥',detail:'全分野に小さな成長補正。',business:1.08,tech:1.08,finance:1.08,negotiation:1.08,localRep:20}
];

const FOUNDER_HOME_PRODUCTS = [
  {id:'reservationApp',name:'店舗予約アプリ',category:'SaaS',cost:450000,weeks:8,price:980,market:3500000,risk:.08,serverCost:18000},
  {id:'posSaaS',name:'POS分析ツール',category:'業務SaaS',cost:650000,weeks:10,price:4800,market:1200000,risk:.07,serverCost:22000},
  {id:'aiDemandForecast',name:'AI需要予測SaaS',category:'AI',cost:1100000,weeks:14,price:12000,market:950000,risk:.14,serverCost:42000},
  {id:'ramenEC',name:'ラーメンEC',category:'EC',cost:500000,weeks:8,price:3200,market:4000000,risk:.09,serverCost:20000},
  {id:'investmentAI',name:'投資分析AI',category:'FinTech',cost:900000,weeks:12,price:1980,market:2300000,risk:.13,serverCost:35000},
  {id:'hrSaaS',name:'採用管理SaaS',category:'HRTech',cost:720000,weeks:10,price:7800,market:900000,risk:.08,serverCost:25000},
  {id:'accountingSaaS',name:'クラウド会計サービス',category:'FinTech',cost:800000,weeks:11,price:5800,market:1800000,risk:.09,serverCost:28000},
  {id:'mobileGame',name:'スマホゲーム',category:'ゲーム',cost:1200000,weeks:14,price:900,market:12000000,risk:.20,serverCost:65000}
];

const SUPPLIER_OFFERS = [
  {id:'local-quality',name:'地域優良サプライヤー',kind:'品質重視',discount:.02,quality:10,reliability:.96,minStores:1,setupCost:300000,weeklyFee:35000},
  {id:'national-volume',name:'全国ボリューム調達',kind:'低コスト',discount:.08,quality:2,reliability:.91,minStores:3,setupCost:1200000,weeklyFee:90000},
  {id:'premium',name:'プレミアム原料連合',kind:'高品質',discount:-.06,quality:22,reliability:.98,minStores:2,setupCost:900000,weeklyFee:70000},
  {id:'global',name:'グローバル調達網',kind:'大規模',discount:.12,quality:4,reliability:.86,minStores:8,setupCost:5000000,weeklyFee:260000}
];

const VERTICAL_INTEGRATION_OFFERS = [
  {id:'noodle-factory',name:'製麺工場',businessID:'ramen',cost:80000000,weeklyCost:650000,costReduction:.055,risk:.08},
  {id:'soup-factory',name:'スープ工場',businessID:'ramen',cost:65000000,weeklyCost:520000,costReduction:.045,risk:.07},
  {id:'food-factory',name:'食品加工工場',businessID:'all',cost:95000000,weeklyCost:760000,costReduction:.05,risk:.09},
  {id:'warehouse',name:'物流倉庫',businessID:'all',cost:120000000,weeklyCost:900000,costReduction:.06,risk:.10},
  {id:'delivery-network',name:'自社配送網',businessID:'all',cost:180000000,weeklyCost:1400000,costReduction:.07,risk:.12},
  {id:'pos-platform',name:'POSシステム',businessID:'all',cost:45000000,weeklyCost:320000,costReduction:.025,risk:.04},
  {id:'procurement-platform',name:'仕入れプラットフォーム',businessID:'all',cost:75000000,weeklyCost:480000,costReduction:.04,risk:.06},
  {id:'data-platform',name:'データ分析基盤',businessID:'all',cost:90000000,weeklyCost:620000,costReduction:.035,risk:.055},
  {id:'cloud-platform',name:'クラウド・サーバー基盤',businessID:'all',cost:150000000,weeklyCost:1100000,costReduction:.04,risk:.11}
];

// productVentures.conversionRate is a persistent week-over-week accumulator, not recomputed
// fresh from quality like churnRate is: `f.conversionRate += (quality - NEUTRAL) / 52000`. A
// freshly-launched product starts at quality 20 and, even under sustained heavy investment,
// takes roughly 90-100 weeks to cross the old neutral point of 50 -- so for close to half of a
// 208-week playthrough conversionRate was guaranteed to erode every single week no matter how
// well the product was actually being run, and the remaining weeks were spent clawing back
// what was lost rather than growing. Neutral now matches the product's actual starting quality
// (20, including founderHome's 18+founderSkillTech*5), so a brand-new product's conversion
// rate holds steady from week one and any quality gained over that starting point compounds
// immediately instead of only after crossing an arbitrary, distant threshold.
const CONVERSION_QUALITY_NEUTRAL=20;
const DIGITAL_PRODUCT_ECONOMICS=__modules.data.DIGITAL_PRODUCT_ECONOMICS||{};

const RD_PROJECTS = [
  {id:'food-process',name:'食品製造プロセス特許',field:'オペレーション',cost:18000000,weeks:18,effect:'unitCost',strength:.035,licenseIncome:90000},
  {id:'recommendation-ai',name:'需要予測AI特許',field:'AI',cost:26000000,weeks:22,effect:'demand',strength:.055,licenseIncome:150000},
  {id:'payment',name:'決済最適化特許',field:'FinTech',cost:22000000,weeks:20,effect:'product',strength:.045,licenseIncome:120000},
  {id:'logistics',name:'物流最適化特許',field:'物流',cost:32000000,weeks:26,effect:'unitCost',strength:.06,licenseIncome:210000},
  {id:'customer-data',name:'顧客データ分析特許',field:'マーケティング',cost:24000000,weeks:21,effect:'brand',strength:.05,licenseIncome:135000}
];

const PERSONAL_REAL_ESTATE_OFFERS = [
  {id:'studio-tokyo',name:'都心ワンルーム',prefID:'tokyo',price:18000000,weeklyRent:31000},
  {id:'commercial-osaka',name:'商業ビル区分',prefID:'osaka',price:65000000,weeklyRent:106000},
  {id:'logistics-aichi',name:'物流倉庫持分',prefID:'aichi',price:95000000,weeklyRent:146000}
];

const PERSONAL_REAL_ESTATE_RENEWAL_STRATEGIES = [
  {id:'income',name:'収益重視',rentChange:.08,acceptanceBonus:-.15},
  {id:'balanced',name:'標準更新',rentChange:.02,acceptanceBonus:.03},
  {id:'retention',name:'長期入居優先',rentChange:-.03,acceptanceBonus:.18}
];
const PERSONAL_REAL_ESTATE_LEASE_WEEKS=52;
const PERSONAL_REAL_ESTATE_RENEWAL_WINDOW=6;
const PERSONAL_REAL_ESTATE_FIXED_MAINTENANCE_RATE=.006;
const PERSONAL_REAL_ESTATE_MANAGEMENT_FEE_RATE=.05;
const PERSONAL_REAL_ESTATE_DEPRECIATION_USEFUL_LIFE_WEEKS=__modules.realEstate?.DEPRECIATION_USEFUL_LIFE_WEEKS??1040;
const PERSONAL_REAL_ESTATE_DEPRECIATION_SALVAGE_RATE=__modules.realEstate?.DEPRECIATION_SALVAGE_RATE??.2;
function personalRealEstateDepreciation(x){const price=n(x.purchasePrice),floor=price*PERSONAL_REAL_ESTATE_DEPRECIATION_SALVAGE_RATE,book=Number.isFinite(x.bookValue)?x.bookValue:price,dep=Math.min(Math.max(0,book-floor),Math.max(0,(price-floor)/PERSONAL_REAL_ESTATE_DEPRECIATION_USEFUL_LIFE_WEEKS));return Math.round(Math.max(0,dep)*100)/100;}

const LUXURY_AUCTION_POOL = [
  {name:'ヴィンテージ腕時計',category:'時計',basePrice:18000000,rarity:4},
  {name:'現代アート作品',category:'美術',basePrice:35000000,rarity:5},
  {name:'クラシックカー',category:'自動車',basePrice:42000000,rarity:5},
  {name:'希少ワインコレクション',category:'コレクション',basePrice:12000000,rarity:3},
  {name:'歴史的企業家の書簡',category:'史料',basePrice:8000000,rarity:4}
];

const SUCCESSOR_CANDIDATES = [
  {id:'family',name:'家族後継者',type:'family',baseSkill:42,loyalty:92,cost:700000},
  {id:'internal',name:'社内エース',type:'internal',baseSkill:58,loyalty:78,cost:1800000},
  {id:'professional',name:'プロ経営者',type:'professional',baseSkill:72,loyalty:58,cost:4500000}
];

const n = (v,f=0) => Number.isFinite(Number(v)) ? Number(v) : f;
const clamp = (v,min,max) => Math.max(min,Math.min(max,n(v,min)));
const rand = (min,max) => min + Math.random()*(max-min);
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const uid = () => globalThis.crypto?.randomUUID?.() ?? `x-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const deterministicUnit = (...parts) => {
  let h = 2166136261;
  const text = parts.map(v => String(v ?? '')).join('|');
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
};
const deterministicRange = (min, max, ...parts) => min + deterministicUnit(...parts) * (max - min);
const stableBusinessKey = business => String(business?.id || business?.name || 'legacy-business');
const stableContractKey = (contract, business) => String(contract?.contractID || contract?.id || contract?.supplierID || contract?.name || stableBusinessKey(business));
const stableAssetKey = asset => String(asset?.assetID || asset?.id || asset?.name || `${asset?.businessID || 'legacy-asset'}:${asset?.startedWeek || 0}:${asset?.cost || 0}`);
const copy = v => typeof structuredClone==='function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
const sum = arr => arr.reduce((a,b)=>a+n(b),0);

function personalRealEstateOps(asset,week){
  const raw=asset?.rentalOps&&typeof asset.rentalOps==='object'?asset.rentalOps:{};
  const occupancy=raw.occupancyStatus==='vacant'?'vacant':'occupied';
  const finiteNonnegative=(value,fallback=0)=>Math.max(0,n(value,fallback));
  const started=Math.max(0,Math.floor(n(raw.leaseStartedWeek,asset?.purchasedWeek??week)));
  const defaultRent=finiteNonnegative(asset?.weeklyRent);
  const savedContract=n(raw.contractWeeklyRent,defaultRent);
  const contract=occupancy==='occupied'?Math.max(1,savedContract>0?savedContract:defaultRent):0;
  let renewal=['none','accepted','declined'].includes(raw.renewalStatus)?raw.renewalStatus:'none';
  const strategy=PERSONAL_REAL_ESTATE_RENEWAL_STRATEGIES.some(x=>x.id===raw.renewalStrategyID)?raw.renewalStrategyID:null;
  if(occupancy==='vacant'||(renewal!=='none'&&(!strategy||!(n(raw.renewalProposedWeeklyRent)>0))))renewal='none';
  return {
    occupancyStatus:occupancy,contractWeeklyRent:contract,leaseStartedWeek:started,
    leaseEndsWeek:Math.max(started+1,Math.floor(n(raw.leaseEndsWeek,started+PERSONAL_REAL_ESTATE_LEASE_WEEKS))),
    renewalStatus:renewal,renewalStrategyID:renewal==='none'?null:strategy,
    renewalProposedWeeklyRent:renewal==='none'?0:finiteNonnegative(raw.renewalProposedWeeklyRent),
    renewalDecisionChance:renewal==='none'?0:clamp(raw.renewalDecisionChance,0,1),
    condition:clamp(n(raw.condition,90),0,100),weeksTracked:Math.floor(finiteNonnegative(raw.weeksTracked)),
    occupiedWeeks:Math.floor(finiteNonnegative(raw.occupiedWeeks)),vacantWeeks:Math.floor(finiteNonnegative(raw.vacantWeeks)),
    currentVacancyWeeks:occupancy==='vacant'?Math.floor(finiteNonnegative(raw.currentVacancyWeeks)):0,
    grossRentTotal:finiteNonnegative(raw.grossRentTotal),operatingExpenseTotal:finiteNonnegative(raw.operatingExpenseTotal),
    repairExpenseTotal:finiteNonnegative(raw.repairExpenseTotal),noiTotal:n(raw.noiTotal),
    lastGrossRent:finiteNonnegative(raw.lastGrossRent),lastOperatingExpense:finiteNonnegative(raw.lastOperatingExpense),
    lastNOI:n(raw.lastNOI),lastProcessedWeek:Number.isFinite(Number(raw.lastProcessedWeek))?Math.floor(Number(raw.lastProcessedWeek)):null
  };
}

function homeRankTitle(rank){return ({familyHome:'実家',oneRoom:'ワンルーム',liveWorkOffice:'小型オフィス兼自宅',cityApartment:'都市型マンション',luxuryCondo:'高級マンション',mansion:'邸宅',executiveResidence:'本社ビル上層階',estate:'大豪邸'})[rank]||'実家';}
function homeRankIcon(rank){return ({familyHome:'🏠',oneRoom:'🚪',liveWorkOffice:'💻',cityApartment:'🏙️',luxuryCondo:'🌃',mansion:'🏛️',executiveResidence:'🏢',estate:'🏰'})[rank]||'🏠';}

function installExpansion(TycoonEngine){
  if(TycoonEngine.prototype.__fullExpansionInstalled)return;
  TycoonEngine.prototype.__fullExpansionInstalled=true;

  const baseNormalize=TycoonEngine.prototype.normalize;
  TycoonEngine.prototype.normalize=function(){
    baseNormalize.call(this);
    this.ensureExpansionDefaults();
  };

  TycoonEngine.prototype.ensureExpansionDefaults=function(){
    const g=this.g;
    const pref=this.pref?.(g.selectedPref)||g.prefs?.[0]||{id:'tokyo',name:'東京'};
    const defaults={
      expansionVersion:2,
      founderName:g.playerName||'創業者',founderHomePrefID:pref.id,founderHomePrefName:pref.name,founderOriginCityName:`${pref.name}中央`,founderTraitID:'tech',
      currentFounderHomeRank:'familyHome',founderHomeLevel:1,founderHomeDeskSlots:1,founderHomeUsedSlots:0,founderHomeMonthlyCost:6000,
      founderSkillBusiness:1,founderSkillTech:1,founderSkillFinance:1,founderSkillNegotiation:1,
      founderHomeActionLog:[],localReputationByPref:{},recommendedTenantIDsFromHomeSearch:[],lastFounderHomeEventWeek:0,lastStoreHuntWeek:0,
      founderEducationLevel:50,founderNetworkLevel:40,successorReadiness:0,foundationEndowment:0,foundationReputation:0,lobbyInfluence:0,
      supplierContracts:[],inventoryByBusinessID:{},supplyChainEvents:[],autoSpotProcurement:true,verticalIntegrationAssets:[],rdProjects:[],patentRecords:[],patentLicenseIncome:0,
      customerSegmentsByBusinessID:{},marketShareByBusinessID:{},productFunnels:{},productFunnelEventLog:[],
      quarterlyStockResults:{},shareholderEventLog:[],activistCampaigns:[],ownershipHistory:[],stockSplitHistory:[],founderShareSaleHistory:[],
      startupFundingHistory:{},startupQuarterlyReports:{},ventureForumEvents:[],
      peDeals:[],peRealizedPL:0,angelInvestments:[],personalRealEstateHoldings:[],
      sportsDraftCandidates:[],sportsTradeMarket:[],sportsSaleOffers:[],lastSportsMarketWeek:0,
      weeklyNewspaper:[],majorBusinessNews:[],luxuryAuctionListings:[],lastNewspaperWeek:0,lastAuctionWeek:0,
      successorCandidate:null,successorTrainingWeeks:0,familyTrustEstablished:false,familyTrustCash:0,familyTrustShares:0,legacyScore:0,generationLegacyScore:0,inheritedLegacyScore:0,retirementRecords:[],lastSuccessionWeek:0,
      serialEntrepreneurHistory:[],hallOfRecords:{highestCompanyValue:0,highestPersonalNetWorth:0,highestRevenue:0,highestProfit:0,maxStores:0,maxSubsidiaries:0,maxPropertyValue:0,maxVCMultiple:0,maxProductExit:0,maxCompanyBuyoutPrice:0,fastestIPOWeek:null,fastestTrillionWeek:null,bankruptcyCount:0},
      expandedWeeklyAdjustments:{supply:0,patents:0,personal:0,product:0,media:0},lastExpansionUpdateWeek:0
    };
    for(const [k,v] of Object.entries(defaults)){
      if(g[k]===undefined||g[k]===null)g[k]=copy(v);
    }
    for(const deal of g.peDeals){
      if(deal.ownerAccount!=='company')deal.ownerAccount='personal';
      if(!Number.isFinite(deal.originalInvestedAmount))deal.originalInvestedAmount=n(deal.investedAmount);
      if(!Number.isFinite(deal.ownerCostBasis))deal.ownerCostBasis=n(deal.investedAmount);
    }
    const trait=FOUNDER_TRAITS.find(x=>x.id===g.founderTraitID)||FOUNDER_TRAITS[0];
    if(!Object.keys(g.localReputationByPref).length)g.localReputationByPref[g.founderHomePrefID]=trait.localRep;
    for(const b of g.businesses||[]){
      if(!g.inventoryByBusinessID[b.id])g.inventoryByBusinessID[b.id]={units:0,targetWeeks:2,lastDemandUnits:0,lastProcurementCost:0,disruptionWeeks:0};
      if(!g.customerSegmentsByBusinessID[b.id])g.customerSegmentsByBusinessID[b.id]={mass:35,value:25,premium:15,business:15,digital:10};
      if(g.marketShareByBusinessID[b.id]===undefined)g.marketShareByBusinessID[b.id]=0;
    }
    for(const s of g.market||[]){
      if(!g.quarterlyStockResults[s.id])g.quarterlyStockResults[s.id]=[];
      if(!s.shareholders||typeof s.shareholders!=='object')s.shareholders={};
    }
    for(const s of g.startups||[]){
      if(!g.startupFundingHistory[s.id])g.startupFundingHistory[s.id]=[];
      if(!g.startupQuarterlyReports[s.id])g.startupQuarterlyReports[s.id]=[];
    }
    for(const p of g.productVentures||[])this.ensureProductFunnel(p);
    this.refreshFounderHomeUsedSlots();
    return g;
  };

  const baseConfigure=TycoonEngine.prototype.configure;
  TycoonEngine.prototype.configure=function(options={}){return this.runTransaction(()=>{
    const result=baseConfigure.call(this,options);
    this.ensureExpansionDefaults();
    this.setFounderOrigin(options.founderPrefID||this.g.selectedPref,options.founderTraitID||'tech',options.playerName||this.g.playerName,false);
    return result;
  });};

  TycoonEngine.prototype.founderTrait=function(){return FOUNDER_TRAITS.find(x=>x.id===this.g.founderTraitID)||FOUNDER_TRAITS[0];};
  TycoonEngine.prototype.founderHomeRankTitle=function(){return homeRankTitle(this.g.currentFounderHomeRank);};
  TycoonEngine.prototype.founderHomeRankIcon=function(){return homeRankIcon(this.g.currentFounderHomeRank);};

  TycoonEngine.prototype.setFounderOrigin=function(prefID,traitID,name=null,notify=true){
    this.ensureExpansionDefaults();const p=this.pref(prefID)||this.g.prefs[0],trait=FOUNDER_TRAITS.find(x=>x.id===traitID)||FOUNDER_TRAITS[0];
    this.g.founderName=(name||this.g.playerName||'創業者').trim()||'創業者';this.g.playerName=this.g.founderName;
    this.g.founderHomePrefID=p.id;this.g.founderHomePrefName=p.name;this.g.founderOriginCityName=`${p.name}中央`;this.g.founderTraitID=trait.id;
    this.g.founderSkillBusiness=trait.business;this.g.founderSkillTech=trait.tech;this.g.founderSkillFinance=trait.finance;this.g.founderSkillNegotiation=trait.negotiation;
    this.g.localReputationByPref[p.id]=Math.max(n(this.g.localReputationByPref[p.id]),trait.localRep);
    this.g.founderHomeActionLog.unshift(`第${this.g.week}週：${p.name}出身の${trait.name}として起業人生を開始。`);
    if(notify)this.notify(`創業者プロフィールを${p.name}・${trait.name}に設定しました。`,'success');
    if (!this.inTransaction()) { this.normalize(); this.save(); this.emit(); }
    return true;
  };

  TycoonEngine.prototype.refreshFounderHomeUsedSlots=function(){
    const products=(this.g.productVentures||[]).filter(p=>p.origin==='founderHome'&&p.status!=='sold');
    this.g.founderHomeUsedSlots=products.filter(p=>p.status==='developing').length;
    return this.g.founderHomeUsedSlots;
  };

  TycoonEngine.prototype.launchFounderHomeProduct=function(){
    return this.fail('自宅開発ルートは廃止されました。IT・デジタル事業から開始してください。');
  };

  TycoonEngine.prototype.ensureProductFunnel=function(product){
    if(!product?.id)return null;this.g.productFunnels=this.g.productFunnels||{};const economics=DIGITAL_PRODUCT_ECONOMICS[product.blueprintID],legacyEconomics=!Number.isFinite(Number(product.economicsVersion))||Number(product.economicsVersion)<1;if(!this.g.productFunnels[product.id])this.g.productFunnels[product.id]={productID:product.id,awareness:n(economics?.initialAwareness,.03),registeredUsers:n(product.users),monthlyActiveUsers:n(product.users)*n(economics?.monthlyActiveRate,.55),paidUsers:n(product.paidUsers),conversionRate:n(economics?.baseConversion,.025),conversionModifier:0,churnRate:n(economics?.baseChurn,.08),churnModifier:0,arpu:n(economics?.monthlyArpu,n(product.price,1000)),serverLoad:0,supportBurden:.1,b2bContracts:0,lastUpdatedWeek:this.g.week};const funnel=this.g.productFunnels[product.id];if(economics){if(legacyEconomics&&product.blueprintID==='ai'&&n(product.price)===4800&&n(funnel.arpu)===4800){product.price=economics.monthlyArpu;funnel.arpu=economics.monthlyArpu;}product.economicsVersion=1;funnel.conversionModifier=n(funnel.conversionModifier);funnel.churnModifier=n(funnel.churnModifier);if(!Number.isFinite(funnel.arpu)||funnel.arpu<=0)funnel.arpu=n(economics.monthlyArpu,n(product.price,1000));}return funnel;
  };

  TycoonEngine.prototype.updateProductFunnelsWeekly=function(){
    const g=this.g;let adjustment=0,salesAdjustment=0,expenseAdjustment=0;
    for(const p of g.productVentures){const f=this.ensureProductFunnel(p);if(p.status!=='released')continue;const oldRevenue=n(p.revenue),oldCost=n(p.cost),solo=p.origin==='founderHome';if(!p.releaseWeek)p.releaseWeek=g.week;
      const quality=clamp(p.quality,0,100),brand=clamp(p.brand,0,100),economics=!solo&&DIGITAL_PRODUCT_ECONOMICS[p.blueprintID];let newUsers,revenue,cost;
      if(economics){
        if(n(f.registeredUsers)<=0&&n(p.users)>0){f.registeredUsers=n(p.users);f.monthlyActiveUsers=f.registeredUsers*economics.monthlyActiveRate;f.lastUpdatedWeek=g.week-1;}
        const productDepartment=1+n(g.departments?.product&&this.departmentEffect('product'))*.25,marketingDepartment=1+n(g.departments?.marketing&&this.departmentEffect('marketing'))*.55,dxDepartment=1+n(g.departments?.dx&&this.departmentEffect('dx'))*.25,founder=1+n(g.founderSkillTech)*.025;
        const acquisitionStrength=(.55+f.awareness*4)*(.65+quality*.008)*(.70+brand*.014)*productDepartment*marketingDepartment*founder;
        f.awareness=clamp(f.awareness+.0015+(quality+brand)/25000+n(g.departments?.marketing&&this.departmentEffect('marketing'))*.0015-f.churnRate*.012,.01,1);
        const remainingMarket=Math.max(0,n(p.market)-n(f.registeredUsers));newUsers=Math.min(remainingMarket,Math.max(1,economics.baseAcquisition*acquisitionStrength));
        f.churnRate=clamp(economics.baseChurn-quality*.00016+n(f.churnModifier)+f.serverLoad*.003,.006,.16);
        f.registeredUsers=clamp(f.registeredUsers*(1-f.churnRate)+newUsers,0,n(p.market));
        f.monthlyActiveUsers=f.registeredUsers*clamp(economics.monthlyActiveRate+quality*.0012-f.supportBurden*.035,.25,.88);
        f.conversionRate=clamp(economics.baseConversion+n(f.conversionModifier)+(quality-CONVERSION_QUALITY_NEUTRAL)*.00065,.003,economics.model==='commerce'?.22:.28);
        f.paidUsers=f.monthlyActiveUsers*f.conversionRate;f.serverLoad=clamp(f.monthlyActiveUsers/Math.max(1000,n(p.serverCapacity,25000)),0,2);f.supportBurden=clamp(f.supportBurden+f.serverLoad*.004-.006,0,1.5);
        const subscription=f.paidUsers*Math.max(0,n(f.arpu,economics.monthlyArpu))/4.33,b2b=f.b2bContracts*Math.max(25000,n(f.arpu)*2)/4.33;
        if(economics.model==='game'){const age=Math.max(0,g.week-p.releaseWeek),launchBoost=age<economics.launchBoostWeeks?1.8-age/economics.launchBoostWeeks*.8:1;revenue=f.monthlyActiveUsers*economics.purchaseRate*p.price*launchBoost+subscription*.18;}
        else if(economics.model==='commerce'){const gmv=f.monthlyActiveUsers*economics.purchasesPerActive*economics.averageOrderValue;revenue=gmv*economics.takeRate;cost=economics.fixedOperatingCost+(f.monthlyActiveUsers*economics.variableCostPerActive+gmv*economics.fulfillmentRate)/dxDepartment;}
        else if(economics.model==='advertising')revenue=f.monthlyActiveUsers*economics.monthlyAdArpu/4.33+subscription;
        else revenue=subscription+b2b;
        if(cost===undefined)cost=economics.fixedOperatingCost+(f.monthlyActiveUsers*economics.variableCostPerActive)/dxDepartment+revenue*.035;
        const revenueMultiple={subscription:5,game:2.5,commerce:2.2,enterprise:5.5,advertising:3}[economics.model]||3,userValue={subscription:180,game:90,commerce:120,enterprise:600,advertising:45}[economics.model]||100,target=Math.max(1_000_000,revenue*52*revenueMultiple+f.registeredUsers*userValue+Math.max(0,revenue-cost)*52*2);p.valuation=Math.max(1_000_000,p.valuation*.88+target*.12);
      }else{
        const growth=clamp(brand/950+quality/1250+n(g.founderSkillTech)*.002-p.risk*.01,.003,solo?.07:.095);f.awareness=clamp(f.awareness+growth*(solo?.16:.12)-f.churnRate*.012,.01,1);newUsers=Math.min(solo?550:25000,Math.max(8,p.market*f.awareness*growth/(solo?1800:1250)));f.registeredUsers=clamp(f.registeredUsers*(1-f.churnRate/5)+newUsers,0,solo?1200000:80000000);f.monthlyActiveUsers=f.registeredUsers*clamp(.35+quality/320-f.supportBurden*.07,.22,solo?.66:.82);f.conversionRate=clamp(f.conversionRate+(quality-CONVERSION_QUALITY_NEUTRAL)/52000,.003,p.category==='EC'?.7:.18);f.paidUsers=f.monthlyActiveUsers*f.conversionRate;f.serverLoad=clamp(f.monthlyActiveUsers/Math.max(1000,n(p.serverCapacity,solo?5000:25000)),0,2);f.supportBurden=clamp(f.supportBurden+f.serverLoad*.007-.008,0,1.5);f.churnRate=clamp(.085-quality/2200+f.serverLoad*.01,.005,.25);if((p.category.includes('SaaS')||p.category.includes('FinTech'))&&quality>=50&&Math.random()<.04)f.b2bContracts+=1;
        const sub=f.paidUsers*Math.max(50,f.arpu)/4.33,ads=f.monthlyActiveUsers*(20+quality*.45)/4.33,b2b=f.b2bContracts*Math.max(10000,f.arpu*2)/4.33;revenue=p.category==='EC'?ads*.2+sub*.5+f.monthlyActiveUsers*Math.max(18,f.arpu*.035)/4.33:p.category==='ゲーム'?ads*.65+sub:p.category.includes('SaaS')||p.category.includes('FinTech')?sub+b2b:sub+ads*.15;const server=(solo?3500:18000)+f.monthlyActiveUsers*n(p.serverCost,20000)/Math.max(1,p.market)*25+Math.max(0,f.serverLoad-1)*50000;const support=Math.max(0,f.monthlyActiveUsers-(solo?650:1800))*(solo?1.8:6.5)*(.3+f.supportBurden);const maintenance=Math.max(2500,n(p.valuation)*(solo?.0008:.0018));const payment=revenue*.035;cost=server+support+maintenance+payment;p.valuation=Math.max(1000000,p.valuation*(1+clamp((revenue-cost)/Math.max(1,p.valuation),-.05,.08))+newUsers*200);
      }
      p.users=Math.floor(f.registeredUsers);p.paidUsers=Math.floor(f.paidUsers);p.revenue=revenue;p.cost=cost;p.profit=revenue-cost;f.lastUpdatedWeek=g.week;
      const delta=(revenue-cost)-(oldRevenue-oldCost);g.companyCash+=delta;adjustment+=delta;salesAdjustment+=revenue-oldRevenue;expenseAdjustment+=cost-oldCost;if(f.serverLoad>1.15&&Math.random()<.08){f.churnRate=clamp(f.churnRate+.004,.003,.28);const text=`${p.name}のサーバー負荷が高く、解約率が悪化。`;g.productFunnelEventLog.unshift(`第${g.week}週：${text}`);g.news.unshift(`第${g.week}週：${text}`);}}
    return {adjustment,salesAdjustment,expenseAdjustment};
  };

  const baseAdvance=TycoonEngine.prototype.advanceWeek;
  TycoonEngine.prototype.advanceWeek=function(showSummary=true){return this.runTransaction(()=>{
    const result=baseAdvance.call(this,false);if(!result)return result;this.ensureExpansionDefaults();if(this.g.lastExpansionUpdateWeek===this.g.week)return result;this.g.lastExpansionUpdateWeek=this.g.week;
    this.updateFounderExpandedWeekly?.();const supply=this.g.isCompanySold?0:this.updateSupplyChainWeekly?.()||0;const patents=this.g.isCompanySold?0:this.updateRDWeekly?.()||0;const product=this.g.isCompanySold?{adjustment:0,salesAdjustment:0,expenseAdjustment:0}:this.updateProductFunnelsWeekly();const personal=this.updatePersonalExpandedWeekly?.()||0;this.updateSportsExpandedWeekly?.();this.generateMediaWeekly?.();this.updateCapitalMarketsExpandedWeekly?.();this.updateSuccessionWeekly?.();this.updateHallOfRecords?.();
    const lifecycleMaintenance=n(product.lifecycleMaintenanceExpense);this.g.expandedWeeklyAdjustments={supply,patents,personal,product:product.adjustment,...(lifecycleMaintenance>0?{lifecycleMaintenance}:{}),media:0};
    if(this.g.lastReport&&!this.g.isCompanySold){this.g.lastReport.sales=n(this.g.lastReport.sales)+product.salesAdjustment;this.g.lastReport.expenses=n(this.g.lastReport.expenses)+product.expenseAdjustment+lifecycleMaintenance-supply-patents;this.g.lastReport.profit=n(this.g.lastReport.profit)+supply+patents+product.adjustment-lifecycleMaintenance;if(lifecycleMaintenance>0)this.g.lastReport.productLifecycleMaintenance=lifecycleMaintenance;const idx=this.g.reports.findIndex(x=>x.week===this.g.lastReport.week);if(idx>=0)this.g.reports[idx]=copy(this.g.lastReport);}const fin=globalThis.__capitalismTycoonModules?.finance;if(fin&&!this.g.isCompanySold){const amount=supply+patents+product.adjustment;if(amount){fin.event(this.g,'otherOperating',Math.abs(amount),{cashEffect:amount,profitEffect:amount,sourceType:'expansionWeeklyAdjustment',sourceID:`${this.g.week}`,idempotencyKey:`week-${this.g.week}-expansion-adjustment`,operationID:`week-${this.g.week}-expansion-adjustment`,description:'拡張週次調整'});}const snap=this.g.finance?.weeklySnapshots?.find(s=>s.week===this.g.week);if(snap)fin.recordSnapshot(this.g,snap.openingCash,this.g.week,this.g.companyCash);fin.validate(this.g);}
    this.recordExpandedHistory?.();const summary={...(this.g.lastReport||{}),week:this.g.week,companyCash:this.g.companyCash,companyValue:this.companyValue(),personalNetWorth:this.personalNetWorth(),newNews:this.g.news.slice(0,5),expandedAdjustments:copy(this.g.expandedWeeklyAdjustments)};this.g.lastWeeklySummary=summary;return result;
  },'week',()=>({summary:showSummary?this.g.lastWeeklySummary:null}));};
}

Object.assign(exports,{FOUNDER_TRAITS,FOUNDER_HOME_PRODUCTS,SUPPLIER_OFFERS,VERTICAL_INTEGRATION_OFFERS,RD_PROJECTS,PERSONAL_REAL_ESTATE_OFFERS,PERSONAL_REAL_ESTATE_RENEWAL_STRATEGIES,LUXURY_AUCTION_POOL,SUCCESSOR_CANDIDATES,CONVERSION_QUALITY_NEUTRAL,DIGITAL_PRODUCT_ECONOMICS,installExpansion});
})(__modules.expansion={});

})();
