// Script boundary: js/engine.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before engine.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(!__modules.data)throw new Error('Capitalism Tycoon data module must be loaded before engine.js.');
if(__modules.engine)throw new Error('Capitalism Tycoon engine module is already registered.');
(function(exports,data){
const {MASTER,DEPARTMENT_UNLOCKS,PRODUCT_BLUEPRINTS,LUXURY_OFFERS,PERSONAL_INVESTMENT_OFFERS,OVERSEAS_COUNTRIES,SPORTS_TEAMS,MISSION_DEFS}=data;
const SAVE_KEY = 'capitalism_tycoon_web_v1';
const SAVE_VERSION = 2;

const deepClone = value => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
const finite = (n, fallback = 0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
const uuid = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const yen = n => `${Math.round(finite(n)).toLocaleString('ja-JP')}円`;
const compactYen = n => {
  n = finite(n);
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}兆円`;
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}億円`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)}万円`;
  return yen(n);
};
const pct = n => `${(finite(n) * 100).toFixed(1)}%`;
const rand = (min, max) => min + Math.random() * (max - min);
const pick = array => array[Math.floor(Math.random() * array.length)];

function makeProperties() {
  const result = [];
  for (const pref of MASTER.prefs) {
    const city = `${pref.name}中央`;
    const definitions = [
      ['駅前商業ビル', '商業ビル', 2.35, .050, .65, false, 220],
      ['郊外ロードサイド土地', '土地', 1.45, .030, .45, true, 420],
      ['小型レジデンス', '住宅', 1.90, .044, .35, false, 180],
      ['大型複合施設', '大型物件', 4.20, .046, .80, false, 650],
      ['物流センター用地', '物流', 3.10, .042, .58, true, 1200],
      ['都心オフィスタワー', 'オフィス', 5.20, .038, .72, false, 520]
    ];
    for (const [label, kind, mult, yieldRate, sensitivity, canBuildHQ, area] of definitions) {
      const basePrice = pref.landPrice * mult;
      result.push({
        id: uuid(), prefID: pref.id, name: `${pref.name} ${label}`, kind,
        price: basePrice, value: basePrice, rentIncome: basePrice * yieldRate / 52,
        owner: null, basePrice, cityName: city, yieldRate,
        economySensitivity: sensitivity, canBuildHQ, hqBuilt: false,
        landAreaSqm: area, buildingType: kind === '土地' ? '' : kind,
        buildingScale: kind === '土地' ? 0 : 1, constructionWeeksRemaining: 0,
        rentMultiplier: 1, vacancyRate: .05, maintenanceCost: basePrice * .006 / 52,
        standardRentIncome: basePrice * yieldRate / 52, depreciationPerWeek: kind === '土地' ? 0 : basePrice * .012 / 52,
        buildingLevel: kind === '土地' ? 0 : 1, buildingMaxLevel: 10, buildingQuality: kind === '土地' ? 0 : 50
      });
    }
  }
  return result;
}

function makeTenants() {
  const patterns = [
    ['駅前1階', 'ramen', 1.18, 'S'], ['商店街角地', 'cafe', 1.08, 'M'],
    ['ロードサイド', 'conveni', 1.02, 'L'], ['住宅街入口', 'ramen', .94, 'S'],
    ['オフィス街', 'cafe', 1.15, 'M'], ['駅ビル', 'apparel', 1.35, 'M'],
    ['郊外大型区画', 'gym', .88, 'L'], ['ITロフト', 'appStudio', 1.24, 'M']
  ];
  const result = [];
  for (const pref of MASTER.prefs) {
    patterns.forEach(([label, businessID, mult, size], idx) => {
      const rent = pref.rent * mult * (idx === 0 ? 1.18 : 1);
      result.push({
        id: uuid(), prefID: pref.id, cityName: `${pref.name}中央`,
        name: `${pref.name} ${label}テナント`, businessID,
        rent, deposit: rent * 8, traffic: pref.traffic * mult, size,
        occupiedBy: null, expiresWeek: 24 + idx * 3, stableKey: `tenant_${pref.id}_${idx}`
      });
    });
  }
  return result;
}

function makeRentalOffices() {
  const result = [];
  for (const pref of MASTER.prefs) {
    const rows = [
      ['スモールHQ', 'C', 1.8, 24, 8, .02],
      ['ビジネスセンター', 'B', 3.2, 120, 16, .05],
      ['プレミアムタワー', 'A', 5.4, 420, 28, .09]
    ];
    rows.forEach(([name, grade, mult, capacity, prestige, dxBonus], i) => {
      const rent = pref.rent * mult;
      result.push({id: uuid(), prefID: pref.id, cityName: `${pref.name}中央`, name: `${pref.name} ${name}`,
        grade, rent, deposit: rent * (i === 2 ? 12 : 10), capacity, prestige, dxBonus,
        contracted: false, stableKey: `office_${pref.id}_${grade}`});
    });
  }
  return result;
}

function normalizeMasterData() {
  const businesses = deepClone(MASTER.businesses).map(b => ({...b, segmentFit: b.segmentFit ?? {}}));
  const market = deepClone(MASTER.market).map(s => ({
    ...s, previous: s.previous || s.price, issuedShares: s.issuedShares || Math.max(1, finite(s.marketCap) / Math.max(1, finite(s.price))),
    shareholders: s.shareholders && typeof s.shareholders === 'object' ? s.shareholders : {},
    priceHistory: [s.price]
  }));
  const startups = deepClone(MASTER.startups).map(s => ({
    ...s, id: uuid(), ownedCompany: 0, ownedPersonal: 0, alive: true, subsidiary: false,
    totalInvestedCompany: 0, totalInvestedPersonal: 0, productProgress: .25,
    runwayWeeks: 52, reports: [], fundingRound: s.stage, fundingOpen: true
  }));
  const executives = deepClone(MASTER.executives).map(e => ({
    ...e, id: uuid(), hired: false, negotiated: false, offeredSalary: e.desiredSalary || e.salary,
    offeredSO: e.desiredSO || .005, acceptedOffer: false, rejectedOffer: false,
    age: Math.floor(rand(34, 58)), gender: Math.random() > .5 ? 'female' : 'male'
  }));
  return {businesses, market, startups, executives};
}

function createInitialState(options = {}) {
  const master = normalizeMasterData();
  return {
    saveVersion: SAVE_VERSION,
    week: 1, month: 1,
    playerName: options.playerName || '創業者', companyName: options.companyName || 'ポケット商事', ticker: 'CPTY',
    configured: Boolean(options.configured), difficulty: options.difficulty || 'normal', scenario: options.scenario || 'free',
    economy: 1, season: 1, policyRate: .005, realEstateCycle: 1, inflation: 1, exchangeRate: 1,
    companyCash: 8_000_000, companyDebt: 0, companyCredit: 60, companyReputation: 12,
    personalCash: 2_000_000, personalDebt: 0, personalFame: 0,
    publicCompany: false, sharesOut: 1_000_000, founderShares: 1_000_000, stockPrice: 0,
    dividendPerShare: 0, treasuryBuybackShares: 0, selectedListingMarket: '東証グロース',
    externalShareholderRatio: 0, founderOwnershipRatio: 1, competitorOwnedRatio: 0,
    selectedArea: 'kanto', selectedPref: 'tokyo', selectedBusiness: 'ramen', selectedTab: 'home',
    businesses: master.businesses, areas: deepClone(MASTER.areas), prefs: deepClone(MASTER.prefs),
    stores: [], properties: makeProperties(), tenants: makeTenants(), rentalOffices: makeRentalOffices(),
    market: master.market, startups: master.startups,
    executives: {}, executiveMarket: master.executives, competitors: deepClone(MASTER.competitors).map(c => ({...c,id:uuid(),ownedPlayerShares:0})),
    departments: {}, departmentStaff: {}, officeFloors: [],
    hasHeadOffice: false, officeLevel: 1, officeName: '小さな創業オフィス', officePrestige: 5,
    officeCapacity: 2, officeWeeklyCost: 85_000, contractedOfficeID: null,
    boardEstablished: false, boardAgendas: [], investorOffers: [],
    personalStocks: {}, companyStocks: {}, favoriteStockIds: [], realizedCompanyStockPL: 0, realizedPersonalStockPL: 0,
    subsidiaries: [], acquisitionTargets: [], maSubsidiaries: [], goodwillRecords: [], tenderOffers: [],
    totalAcquisitions: 0, totalMAGain: 0, totalImpairmentLoss: 0,
    productVentures: [], productBuyoutOffers: [], productExitCount: 0,
    franchiseStoresByBusinessID: {}, franchiseRoyaltyRateByBusinessID: {}, franchiseQualityByBusinessID: {}, franchiseTrustByBusinessID: {},
    overseasSubsidiaries: [], personalInvestments: [], luxuryAssets: [], sportsTeams: [], peDeals: [],
    cxoExecutives: [], executiveDirectives: [], departmentCampaigns: [], internalVentureProposals: [], internalVentures: [],
    employeeSatisfaction: 55, employeeAbility: 50, wageLevel: 1, benefitLevel: 1, remoteWorkEnabled: false,
    organizationCulture: {morale:55, innovation:30, compliance:40, turnoverRate:.08},
    autoManage: false, autoManageStyle: 'balanced', autoExecutiveManagementEnabled: false,
    esgScore: 0, complianceLevel: 0, globalPrestige: 0, founderAge: 27, founderGeneration: 1,
    macroCrisis: null, scheduledPayments: [],
    reports: [], lastReport: null, weeklySalesHistory: [], weeklyProfitHistory: [], companyValueHistory: [], personalNetWorthHistory: [],
    news: ['会社を設立しました。最初の店舗を探しましょう。'], history: [], competitorEvents: [], productEvents: [],
    activeMissionIDs: ['mission_setup'], completedMissionIDs: [], achievements: [], unlockedEndings: [],
    gameOver: false, gameOverReason: '', isCompanySold: false, hasSeenCompanyBuyoutEnding: false,
    lastSaveDate: new Date().toISOString(), settings: {detailMode:'standard', sound:false, reducedMotion:false, autoSave:true},
    lastWeeklySummary: null
  };
}


function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function detectSaveVersion(rawState) {
  if (!isPlainObject(rawState)) return {ok:false, version:null, error:'セーブデータのルートはオブジェクトである必要があります。'};
  if (!('saveVersion' in rawState) || rawState.saveVersion === undefined || rawState.saveVersion === null || rawState.saveVersion === '') return {ok:true, version:0, legacy:true};
  const version = Number(rawState.saveVersion);
  if (!Number.isInteger(version)) return {ok:false, version:null, error:`saveVersionが整数ではありません: ${rawState.saveVersion}`};
  if (version < 0) return {ok:false, version:null, error:`saveVersionが負数です: ${version}`};
  if (version > SAVE_VERSION) return {ok:false, version, future:true, error:`このゲームより新しいsaveVersion ${version} のセーブです。現在対応しているのは ${SAVE_VERSION} までです。`};
  return {ok:true, version};
}

function createDefaultEntityID(kind, index) {
  return `legacy-${kind}-${index + 1}`;
}

function entityDefaults(kind, entity = {}, index = 0, state = {}) {
  const week = finite(state.week, 1);
  const base = {
    store: {id:createDefaultEntityID('store', index), businessID:'ramen', prefID:state.selectedPref || 'tokyo', name:`店舗${index + 1}`, openedWeek:week, quality:0, brand:0, condition:100, lastSales:0, lastProfit:0, status:'open', openingWeek:week, weeksToOpen:0, tenantID:null, cityName:'', operatingHours:3},
    business: {id:createDefaultEntityID('business', index), name:'事業', category:'未分類', price:100, unitCost:0, fixedCost:0, storeCost:0, demand:1, quality:0, brand:0, efficiency:0, dx:0, segmentFit:{}},
    property: {id:createDefaultEntityID('property', index), prefID:state.selectedPref || 'tokyo', name:`不動産${index + 1}`, kind:'不動産', price:0, value:0, rentIncome:0, owner:null, basePrice:0, cityName:'', yieldRate:0, economySensitivity:0, canBuildHQ:false, hqBuilt:false, landAreaSqm:0, buildingType:'', buildingScale:0, constructionWeeksRemaining:0, rentMultiplier:1, vacancyRate:0, maintenanceCost:0, standardRentIncome:0, depreciationPerWeek:0, buildingLevel:0, buildingMaxLevel:10, buildingQuality:0},
    tenant: {id:createDefaultEntityID('tenant', index), prefID:state.selectedPref || 'tokyo', cityName:'', name:`テナント${index + 1}`, businessID:'ramen', rent:0, deposit:0, traffic:1, size:'M', occupiedBy:null, expiresWeek:week + 24},
    rentalOffice: {id:createDefaultEntityID('office', index), prefID:state.selectedPref || 'tokyo', cityName:'', name:`オフィス${index + 1}`, grade:'C', rent:0, deposit:0, capacity:0, prestige:0, dxBonus:0, contracted:false},
    market: {id:createDefaultEntityID('stock', index), name:'銘柄', sector:'', price:100, previous:100, dividend:0, volatility:.05, marketCap:0, issuedShares:1, shareholders:{}, priceHistory:[]},
    startup: {id:createDefaultEntityID('startup', index), name:'スタートアップ', domain:'', stage:'Seed', valuation:0, growth:0, risk:.2, ownedCompany:0, ownedPersonal:0, alive:true, subsidiary:false, totalInvestedCompany:0, totalInvestedPersonal:0, productProgress:.25, runwayWeeks:52, reports:[], fundingRound:'Seed', fundingOpen:true},
    competitor: {id:createDefaultEntityID('competitor', index), name:'競合', areaID:state.selectedArea || 'kanto', businessID:'ramen', stores:0, brand:0, quality:0, ownedPlayerShares:0},
    executiveMarket: {id:createDefaultEntityID('executive', index), name:'CXO候補', role:'CFO', skill:0, salary:0, desiredSalary:0, desiredSO:0, hired:false, negotiated:false, offeredSalary:0, offeredSO:0, acceptedOffer:false, rejectedOffer:false, age:40, gender:'unknown'},
    subsidiary: {id:createDefaultEntityID('subsidiary', index), name:'子会社', domain:'', industry:'', valuation:0, status:'active', weeklyProfit:0, growth:0, risk:0, ownership:1, retainedEarnings:0, acquiredWeek:week},
    acquisitionTarget: {id:createDefaultEntityID('target', index), name:'買収候補', industry:'', synergy:1, revenue:0, profit:0, valuation:0, askingPrice:0, cultureFit:50, risk:0, expiresWeek:week + 12},
    maSubsidiary: {id:createDefaultEntityID('ma', index), name:'M&A子会社', industry:'', valuation:0, acquisitionPrice:0, weeklyProfit:0, synergy:1, integration:0, risk:0, acquiredWeek:week},
    goodwillRecord: {id:createDefaultEntityID('goodwill', index), name:'のれん', amount:0, remaining:0, acquiredWeek:week, impairmentLoss:0},
    productVenture: {id:createDefaultEntityID('product', index), blueprintID:'custom', name:'プロダクト', category:'service', status:'developing', progress:0, valuation:0, invested:0, weeklyRevenue:0, weeklyCost:0, users:0, quality:0, brand:0, startedWeek:week},
    personalInvestment: {id:createDefaultEntityID('investment', index), name:'個人投資', category:'investment', purchasePrice:0, currentValue:0, maintenancePerWeek:0, purchasedWeek:week},
    luxuryAsset: {id:createDefaultEntityID('luxury', index), name:'資産', category:'luxury', purchasePrice:0, currentValue:0, maintenancePerWeek:0, statusEffect:'', purchasedWeek:week},
    sportsTeam: {id:createDefaultEntityID('sports', index), name:'スポーツチーム', league:'', owner:'personal', value:0, weeklyProfit:0, fanBase:0, performance:0, saleListed:false, acquiredWeek:week},
    peDeal: {id:createDefaultEntityID('pe', index), targetName:'PE案件', industry:'', acquiredWeek:week, investedAmount:0, ownershipRatio:0, improvementScore:0, currentValuation:0, holdingWeeks:0, status:'active'},
    cxoExecutive: {id:createDefaultEntityID('cxo', index), name:'CXO', role:'CFO', skill:0, salary:0, hiredWeek:week},
    campaign: {id:createDefaultEntityID('campaign', index), departmentID:'marketing', type:'', budget:0, startWeek:week, endWeek:week, progress:0, status:'active'},
    internalVenture: {id:createDefaultEntityID('venture', index), name:'社内ベンチャー', domain:'', requiredBudget:0, teamQuality:0, marketPotential:0, risk:0, status:'developing', progress:0, valuation:0, weeklyProfit:0},
    scheduledPayment: {id:createDefaultEntityID('payment', index), week, amount:0, label:'', account:'company', status:'pending'},
    report: {week, sales:0, expenses:0, profit:0, tax:0, companyCash:finite(state.companyCash, 0), companyValue:0, personalNetWorth:0},
    boardAgenda: {id:createDefaultEntityID('agenda', index), title:'議題', detail:'', cost:0, effect:'', approved:false},
    investorOffer: {id:createDefaultEntityID('investor', index), name:'投資家', amount:0, equity:0, expiresWeek:week, status:'pending'},
    tenderOffer: {id:createDefaultEntityID('tender', index), stockID:'', price:0, qty:0, status:'pending'},
    productBuyoutOffer: {id:createDefaultEntityID('product-offer', index), productID:'', buyerName:'買い手', offerAmount:0, status:'pending', week},
    angelInvestment: {id:createDefaultEntityID('angel', index), startupName:'エンジェル投資先', investedAmount:0, week, multiple:1, status:'active'},
    personalRealEstateHolding: {id:createDefaultEntityID('personal-real-estate', index), name:'個人不動産', purchasePrice:0, currentValue:0, rentIncome:0, maintenancePerWeek:0, purchasedWeek:week},
    branchOffice: {id:createDefaultEntityID('branch', index), officeID:null, name:'支社', rent:0, deposit:0, capacity:0, prestige:0, contractedWeek:week},
    keyPersonnel: {id:createDefaultEntityID('keyperson', index), name:'キーパーソン', role:'専門人材', level:1, salary:0, motivation:50, loyalty:50, retentionRisk:.1, hiredWeek:week},
    competitorState: {id:createDefaultEntityID('rival-state', index), name:'競合', industryID:'ramen', strength:0, cash:0, pricePressure:0, qualityPressure:0, isDistressed:false}
  };
  return {...(base[kind] || {id:createDefaultEntityID(kind, index)}), ...entity};
}

const ARRAY_ENTITY_KINDS = {
  stores:'store', businesses:'business', properties:'property', tenants:'tenant', rentalOffices:'rentalOffice', market:'market', startups:'startup', competitors:'competitor', executiveMarket:'executiveMarket', subsidiaries:'subsidiary', acquisitionTargets:'acquisitionTarget', maSubsidiaries:'maSubsidiary', goodwillRecords:'goodwillRecord', productVentures:'productVenture', personalInvestments:'personalInvestment', luxuryAssets:'luxuryAsset', sportsTeams:'sportsTeam', peDeals:'peDeal', cxoExecutives:'cxoExecutive', departmentCampaigns:'campaign', internalVentureProposals:'internalVenture', internalVentures:'internalVenture', scheduledPayments:'scheduledPayment', reports:'report', boardAgendas:'boardAgenda', investorOffers:'investorOffer', tenderOffers:'tenderOffer', productBuyoutOffers:'productBuyoutOffer', angelInvestments:'angelInvestment', personalRealEstateHoldings:'personalRealEstateHolding', branchOffices:'branchOffice', keyPersonnel:'keyPersonnel', competitorStates:'competitorState'
};

function normalizeArrayEntityList(state, key, kind) {
  const value = state[key];
  if (value === undefined || value === null) { state[key] = []; return; }
  if (!Array.isArray(value)) throw new Error(`${key}は配列である必要があります。`);
  const seenIDs = new Set();
  state[key] = value.map((item, index) => {
    if (!isPlainObject(item)) throw new Error(`${key}[${index}]はオブジェクトである必要があります。`);
    const merged = entityDefaults(kind, item, index, state);
    if (merged.id === undefined || merged.id === null || merged.id === '') merged.id = createDefaultEntityID(kind, index);
    if (seenIDs.has(merged.id)) throw new Error(`${key}で重複IDが見つかりました: ${merged.id}`);
    seenIDs.add(merged.id);
    return merged;
  });
}

function normalizeHoldingMap(state, key) {
  const value = state[key];
  if (value === undefined || value === null) { state[key] = {}; return; }
  if (!isPlainObject(value)) throw new Error(`${key}はオブジェクトである必要があります。`);
  for (const [stockID, holding] of Object.entries(value)) {
    if (!isPlainObject(holding)) throw new Error(`${key}.${stockID}は保有株式オブジェクトである必要があります。`);
    value[stockID] = {qty:0, avg:0, ...holding};
  }
}

function normalizeObjectMap(state, key, defaultValue = {}) {
  const value = state[key];
  if (value === undefined || value === null) { state[key] = deepClone(defaultValue); return; }
  if (!isPlainObject(value)) throw new Error(`${key}はオブジェクトである必要があります。`);
}

function deepNormalizeState(state) {
  for (const [key, kind] of Object.entries(ARRAY_ENTITY_KINDS)) normalizeArrayEntityList(state, key, kind);
  for (const key of ['news','history','competitorEvents','productEvents','favoriteStockIds','officeFloors','activeMissionIDs','completedMissionIDs','achievements','unlockedEndings','weeklySalesHistory','weeklyProfitHistory','companyValueHistory','personalNetWorthHistory','executiveDirectives','founderHomeActionLog','recommendedTenantIDsFromHomeSearch','supplyChainEvents','verticalIntegrationAssets','rdProjects','patentRecords','productFunnelEventLog','stockSplitHistory','ownershipHistory','activistCampaigns','shareholderEventLog','ventureForumEvents','weeklyNewspaper','majorBusinessNews','luxuryAuctionListings','sportsDraftCandidates','sportsTradeMarket','sportsSaleOffers','serialEntrepreneurHistory','endingRecords','pastCompanyRecords','employeeComplaintLog','transportRebuildProjects','transportRebuildLog','mediaCampaigns','mediaActionLog','inboundBuyoutOffers','companyBuyoutHistory','playerTitles','advisorDismissedActionIDs','advisorActionHistory','keyPersonnelEventLog','earningsEventLog','competitorEventLog','industryAwards','awardEventLog']) {
    if (state[key] === undefined || state[key] === null) state[key] = [];
    if (!Array.isArray(state[key])) throw new Error(`${key}は配列である必要があります。`);
  }
  for (const key of ['personalStocks','companyStocks']) normalizeHoldingMap(state, key);
  for (const key of ['departments','departmentStaff','franchiseStoresByBusinessID','franchiseRoyaltyRateByBusinessID','franchiseQualityByBusinessID','franchiseTrustByBusinessID','organizationCulture','settings','inventoryByBusinessID','customerSegmentsByBusinessID','marketShareByBusinessID','productFunnels','quarterlyStockResults','startupFundingHistory','startupQuarterlyReports','localReputationByPref','hallOfRecords','expandedWeeklyAdjustments']) normalizeObjectMap(state, key);
  return state;
}

function migrateUnversionedToV1(state) {
  state.saveVersion = 1;
  return state;
}

function migrateV1ToV2(state) {
  state.saveVersion = 2;
  return state;
}

function validateMigratedState(state) {
  const detected = detectSaveVersion(state);
  if (!detected.ok) return {ok:false, errors:[detected.error]};
  const errors = [];
  for (const key of ['week','month','companyCash','personalCash','companyDebt','personalDebt']) if (!Number.isFinite(Number(state[key]))) errors.push(`${key}が有限数ではありません。`);
  for (const key of ['businesses','stores','market','news','history','reports']) if (!Array.isArray(state[key])) errors.push(`${key}が配列ではありません。`);
  if (!isPlainObject(state.settings)) errors.push('settingsがオブジェクトではありません。');
  return {ok:errors.length === 0, errors};
}

function migrateSave(rawState) {
  const detected = detectSaveVersion(rawState);
  if (!detected.ok) return {ok:false, state:null, version:detected.version, errors:[detected.error]};
  let state;
  try {
    state = deepClone(rawState);
    let version = detected.version;
    if (version === 0) { state = migrateUnversionedToV1(state); version = 1; }
    if (version === 1) { state = migrateV1ToV2(state); version = 2; }
    if (version !== SAVE_VERSION) throw new Error(`未対応のsaveVersionです: ${version}`);
    state = mergeDefaults(state, createInitialState({configured:false}));
    deepNormalizeState(state);
    const validation = validateMigratedState(state);
    if (!validation.ok) return {ok:false, state:null, version, errors:validation.errors};
    return {ok:true, state, version, errors:[]};
  } catch (error) {
    return {ok:false, state:null, version:detected.version, errors:[error.message || String(error)]};
  }
}

function mergeDefaults(target, defaults) {
  if (Array.isArray(defaults)) return Array.isArray(target) ? target : deepClone(defaults);
  if (defaults && typeof defaults === 'object') {
    const out = target && typeof target === 'object' && !Array.isArray(target) ? target : {};
    for (const [key, value] of Object.entries(defaults)) {
      if (!(key in out) || out[key] === undefined || out[key] === null && value !== null) out[key] = deepClone(value);
      else if (value && typeof value === 'object' && !Array.isArray(value)) out[key] = mergeDefaults(out[key], value);
    }
    return out;
  }
  return target ?? defaults;
}

class TycoonEngine extends EventTarget {
  constructor(state = null) {
    super();
    const defaults = createInitialState({configured:false});
    if (state) {
      const migrated = migrateSave(state);
      if (!migrated.ok) throw new Error(`Save migration failed: ${migrated.errors.join('; ')}`);
      this.g = migrated.state;
    } else {
      this.g = defaults;
    }
    this.normalize();
  }

  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return new TycoonEngine(null);
      const parsed = JSON.parse(raw);
      const migrated = migrateSave(parsed);
      if (!migrated.ok) throw new Error(`Save migration failed: ${migrated.errors.join('; ')}`);
      return new TycoonEngine(migrated.state);
    } catch (error) {
      console.error('Save load failed', error);
      const fallback = new TycoonEngine();
      fallback._saveBlockedDueToLoadFailure = true;
      fallback._loadFailureReason = error?.message || String(error);
      return fallback;
    }
  }

  normalize() {
    this.g.saveVersion = SAVE_VERSION;
    this.g.market = (this.g.market || []).map(s => ({...s, price: Math.max(1, finite(s.price,100)), previous: Math.max(1,finite(s.previous,s.price)), priceHistory: Array.isArray(s.priceHistory) ? s.priceHistory.slice(-260) : [s.price]}));
    this.g.businesses = (this.g.businesses || []).map(b => ({...b, price: Math.max(1,finite(b.price,100)), unitCost: Math.max(0,finite(b.unitCost)), demand: Math.max(1,finite(b.demand,10))}));
    this.g.stores = (this.g.stores || []).map(s => ({condition:100,lastSales:0,lastProfit:0,status:'open',openingWeek:this.g.week,weeksToOpen:0,operatingHours:3,...s}));
    this.g.news = Array.isArray(this.g.news) ? this.g.news.slice(0,300) : [];
    this.g.history = Array.isArray(this.g.history) ? this.g.history.slice(0,500) : [];
    this.g.reports = Array.isArray(this.g.reports) ? this.g.reports.slice(-520) : [];
    this.updateOwnershipRatios();
  }

  emit(type = 'change', detail = {}) {
    this.dispatchEvent(new CustomEvent(type, {detail}));
  }

  runTransaction(work, eventType = 'change', detail = {}, shouldCommit = result => result !== false) {
    const previousDepth = this._transactionDepth || 0;
    const outer = previousDepth === 0;
    this._transactionDepth = previousDepth + 1;
    let result;
    try {
      result = work();
    } catch (error) {
      this._transactionDepth = previousDepth;
      throw error;
    }
    this._transactionDepth = previousDepth;
    if (outer && shouldCommit(result)) {
      this.save();
      this.emit(eventType, typeof detail === 'function' ? detail(result) : detail);
    }
    return result;
  }

  inTransaction() {
    return (this._transactionDepth || 0) > 0;
  }

  notify(message, severity = 'info') {
    this.g.news.unshift(`第${this.g.week}週：${message}`);
    this.g.news = this.g.news.slice(0,300);
    this.emit('notify', {message, severity});
  }

  save(slot = null) {
    if (!slot && this._saveBlockedDueToLoadFailure) {
      console.error('Save blocked because startup save migration failed', this._loadFailureReason || 'unknown load failure');
      return false;
    }
    this.g.lastSaveDate = new Date().toISOString();
    const key = slot ? `${SAVE_KEY}_slot_${slot}` : SAVE_KEY;
    localStorage.setItem(key, JSON.stringify(this.g));
    this.emit('saved', {slot});
    return true;
  }

  loadSlot(slot) {
    const raw = localStorage.getItem(`${SAVE_KEY}_slot_${slot}`);
    if (!raw) return false;
    try {
      const migrated = migrateSave(JSON.parse(raw));
      if (!migrated.ok) { console.error('Slot save migration failed', migrated.errors); return false; }
      this.g = migrated.state;
      this._saveBlockedDueToLoadFailure = false;
      this._loadFailureReason = '';
      this.normalize(); this.save(); this.emit(); return true;
    } catch (error) {
      console.error('Slot save migration failed', error);
      return false;
    }
  }

  reset() {
    const settings = this.g.settings;
    this.g = createInitialState({configured:false});
    this.g.settings = settings;
    this._saveBlockedDueToLoadFailure = false;
    this._loadFailureReason = '';
    this.save(); this.emit();
  }

  configure({playerName, companyName, difficulty='normal', scenario='free'}) {
    const next = createInitialState({playerName, companyName, difficulty, scenario, configured:true});
    const settings = this.g.settings;
    this.g = next; this.g.settings = settings;
    this._saveBlockedDueToLoadFailure = false;
    this._loadFailureReason = '';
    if (difficulty === 'easy') { this.g.companyCash += 4_000_000; this.g.companyCredit = 70; }
    if (difficulty === 'hard') { this.g.companyCash -= 2_000_000; this.g.companyCredit = 50; }
    this.notify(`${this.g.companyName}を創業しました。`,'success');
    if (!this.inTransaction()) { this.normalize(); this.save(); this.emit(); }
  }

  business(id) { return this.g.businesses.find(x => x.id === id); }
  area(id) { return this.g.areas.find(x => x.id === id); }
  pref(id) { return this.g.prefs.find(x => x.id === id); }
  stock(id) { return this.g.market.find(x => x.id === id); }
  companyValue() {
    const storeValue = this.g.stores.reduce((sum,s) => sum + Math.max(0, s.lastProfit) * 52 * 4 + this.business(s.businessID)?.storeCost * .5, 0);
    const propertyValue = this.g.properties.filter(p=>p.owner==='company').reduce((a,p)=>a+finite(p.value),0);
    const stocks = Object.entries(this.g.companyStocks).reduce((sum,[id,h])=>sum+(this.stock(id)?.price||0)*h.qty,0);
    const ventures = this.g.startups.reduce((sum,s)=>sum+s.valuation*finite(s.ownedCompany),0);
    const subsidiaries = this.g.subsidiaries.reduce((sum,s)=>sum+s.valuation*finite(s.ownership),0);
    const ma = this.g.maSubsidiaries.reduce((sum,s)=>sum+finite(s.valuation),0);
    const products = this.g.productVentures.reduce((sum,p)=>sum+finite(p.valuation),0);
    const overseas = this.g.overseasSubsidiaries.reduce((sum,x)=>sum+finite(x.valuation),0);
    return Math.max(0, this.g.companyCash - this.g.companyDebt + storeValue + propertyValue + stocks + ventures + subsidiaries + ma + products + overseas);
  }
  personalNetWorth() {
    const stocks = Object.entries(this.g.personalStocks).reduce((sum,[id,h])=>sum+(this.stock(id)?.price||0)*h.qty,0);
    const props = this.g.properties.filter(p=>p.owner==='personal').reduce((a,p)=>a+finite(p.value),0);
    const investments = this.g.personalInvestments.reduce((a,x)=>a+finite(x.currentValue),0);
    const lux = this.g.luxuryAssets.reduce((a,x)=>a+finite(x.currentValue),0);
    const sports = this.g.sportsTeams.reduce((a,x)=>a+finite(x.value),0);
    return Math.max(0, this.g.personalCash - this.g.personalDebt + stocks + props + investments + lux + sports);
  }
  companyCreditLimit() { return Math.max(0, this.companyValue() * (.15 + this.g.companyCredit / 250)); }
  personalCreditLimit() { return Math.max(0, this.personalNetWorth() * .25 + 5_000_000); }
  companyBorrowRate() { return clamp(this.g.policyRate + .018 + (100-this.g.companyCredit)*.00025, .012, .12); }
  personalBorrowRate() { return clamp(this.g.policyRate + .025 + Math.max(0,this.g.personalDebt/10_000_000)*.002, .018, .15); }
  departmentEffect(id) {
    if (!this.g.departments[id]) return 0;
    const staff = finite(this.g.departmentStaff[id],1);
    const head = Object.values(this.g.executives).find(e => ({accounting:'CFO',hr:'CHRO',product:'CPO',operations:'COO',marketing:'CMO',dx:'CTO',investment:'CSO'}[id] === e.role));
    return clamp(.35 + staff*.08 + finite(head?.skill)*.02, .35, 1.5);
  }
  competitorPressure(areaID,businessID) {
    const total = this.g.competitors.filter(c=>c.areaID===areaID&&c.businessID===businessID).reduce((a,c)=>a+c.stores*(c.brand+c.quality)/12000,0);
    return clamp(total,0,.35);
  }
  fit(business, area) {
    if (business.id === 'ramen') return area.ramenFit;
    if (business.id === 'cafe') return area.cafeFit;
    if (business.id === 'conveni') return area.conveniFit;
    return 1;
  }

  openStore({tenantID,businessID,name,operatingHours=3}) {
    const tenant = this.g.tenants.find(t=>t.id===tenantID);
    const business = this.business(businessID);
    if (!tenant || tenant.occupiedBy) return this.fail('選択したテナントは利用できません。');
    if (!business) return this.fail('業種が見つかりません。');
    const cost = business.storeCost + tenant.deposit;
    if (this.g.companyCash < cost) return this.fail(`出店には${yen(cost)}が必要です。`);
    this.g.companyCash -= cost; tenant.occupiedBy = 'player';
    const weeks = business.storeCost >= 15_000_000 ? 8 : business.storeCost >= 7_000_000 ? 5 : 3;
    const store = {id:uuid(),businessID,prefID:tenant.prefID,name:name||`${this.g.companyName} ${this.g.stores.length+1}号店`,openedWeek:this.g.week,
      quality:business.quality,brand:business.brand,condition:100,lastSales:0,lastProfit:0,status:'preparing',openingWeek:this.g.week+weeks,weeksToOpen:weeks,
      tenantID,cityName:tenant.cityName,operatingHours:Number(operatingHours)};
    this.g.stores.push(store);
    this.notify(`${store.name}の出店準備を開始しました。開店まで${weeks}週。`,'success');
    this.evaluateProgression(); this.save(); this.emit(); return true;
  }

  closeStore(id) {
    const index=this.g.stores.findIndex(s=>s.id===id); if(index<0)return false;
    const store=this.g.stores[index]; const tenant=this.g.tenants.find(t=>t.id===store.tenantID); if(tenant)tenant.occupiedBy=null;
    const proceeds=(this.business(store.businessID)?.storeCost||0)*.15;
    this.g.companyCash+=proceeds; this.g.stores.splice(index,1); this.notify(`${store.name}を閉店し、${yen(proceeds)}を回収しました。`,'warning');
    this.save();this.emit();return true;
  }

  investBusiness(businessID,kind,amount) {
    const b=this.business(businessID); amount=Math.max(0,finite(amount));
    if(!b||amount<=0)return this.fail('投資額が不正です。');
    if(this.g.companyCash<amount)return this.fail('会社資金が不足しています。');
    const lock={quality:'product',brand:'marketing',efficiency:'operations',dx:'dx'}[kind];
    if(lock&&!this.g.departments[lock]&&amount>=2_000_000)return this.fail(`${MASTER.departments.find(d=>d.id===lock)?.name||'担当部門'}が必要です。`);
    this.g.companyCash-=amount;
    const gain=Math.log10(1+amount/100000)*({quality:1.2,brand:1.35,efficiency:1.05,dx:1.1}[kind]||1);
    b[kind]=clamp(finite(b[kind])+gain,0,100);
    this.notify(`${b.name}の${{quality:'品質',brand:'ブランド',efficiency:'効率',dx:'DX'}[kind]}へ${yen(amount)}投資しました。`,'success');
    this.save();this.emit();return true;
  }
  adjustPrice(businessID,price) {
    const b=this.business(businessID); price=finite(price);
    if(!b||price<=0)return this.fail('価格が不正です。');
    b.price=price; this.notify(`${b.name}の価格を${yen(price)}に変更しました。`);this.save();this.emit();return true;
  }

  contractOffice(officeID) {
    if(this.g.hasHeadOffice)return this.fail('すでに本社オフィスを契約しています。');
    const office=this.g.rentalOffices.find(o=>o.id===officeID);if(!office)return false;
    if(this.g.companyCash<office.deposit)return this.fail(`保証金${yen(office.deposit)}が必要です。`);
    this.g.companyCash-=office.deposit;office.contracted=true;this.g.contractedOfficeID=office.id;this.g.hasHeadOffice=true;
    this.g.officeName=office.name;this.g.officeCapacity=office.capacity;this.g.officeWeeklyCost=office.rent;this.g.officePrestige=office.prestige;
    this.notify(`${office.name}を本社として契約しました。`,'success');this.evaluateProgression();this.save();this.emit();return true;
  }
  cancelOffice() {
    if(Object.keys(this.g.departments).length||Object.keys(this.g.executives).length)return this.fail('部門またはCXOが在籍しているため解約できません。');
    const office=this.g.rentalOffices.find(o=>o.id===this.g.contractedOfficeID);if(office){office.contracted=false;this.g.companyCash+=office.deposit*.6;}
    this.g.hasHeadOffice=false;this.g.contractedOfficeID=null;this.g.officeName='小さな創業オフィス';this.g.officeCapacity=2;this.g.officeWeeklyCost=85000;
    this.notify('本社オフィスを解約しました。','warning');this.save();this.emit();return true;
  }
  establishDepartment(id) {
    if(!this.g.hasHeadOffice)return this.fail('本社オフィスが必要です。');
    if(this.g.departments[id])return this.fail('設置済みです。');
    const d=MASTER.departments.find(x=>x.id===id);if(!d)return false;
    const unlock=DEPARTMENT_UNLOCKS[id];if(this.g.stores.length<(unlock?.minStores||0))return this.fail(`店舗数${unlock.minStores}以上が必要です。`);
    if(this.g.companyCash<d.setupCost)return this.fail(`${yen(d.setupCost)}が必要です。`);
    const used=Object.keys(this.g.departments).length*8+Object.keys(this.g.executives).length;
    if(used+8>this.g.officeCapacity)return this.fail('オフィス定員が不足しています。');
    this.g.companyCash-=d.setupCost;this.g.departments[id]={...deepClone(d),established:true};this.g.departmentStaff[id]=1;
    this.g.officeFloors.push({id:uuid(),floorNumber:this.g.officeFloors.length+1,departmentID:id,name:d.name,seats:8,weeklyCost:d.weeklyCost});
    this.notify(`${d.name}を設置しました。`,'success');this.evaluateProgression();this.save();this.emit();return true;
  }
  hireDepartmentStaff(id,count=1) {
    if(!this.g.departments[id])return this.fail('部門がありません。');
    count=Math.max(1,Math.floor(count));const cost=count*300000;
    if(this.g.companyCash<cost)return this.fail('採用費が不足しています。');
    const used=Object.values(this.g.departmentStaff).reduce((a,n)=>a+n,0)+Object.keys(this.g.executives).length;
    if(used+count>this.g.officeCapacity)return this.fail('オフィス定員が不足しています。');
    this.g.companyCash-=cost;this.g.departmentStaff[id]=finite(this.g.departmentStaff[id])+count;
    this.notify(`${this.g.departments[id].name}で${count}名採用しました。`,'success');this.save();this.emit();return true;
  }
  refreshExecutives() {
    if(!this.g.departments.hr)return this.fail('人事部門が必要です。');
    const cost=rand(500000,2000000);if(this.g.companyCash<cost)return this.fail('紹介費が不足しています。');this.g.companyCash-=cost;
    const surnames=['佐藤','鈴木','高橋','田中','伊藤','渡辺','山本','中村','小林','加藤'];
    const roles=['CEO','COO','CFO','CMO','CTO','CPO','CHRO','CSO'];
    this.g.executiveMarket=roles.map(role=>{
      const skill=rand(10,22),rank=skill>20?'S':skill>17?'A':skill>13?'B':'C';
      return {id:uuid(),role,name:`${pick(surnames)} ${role}`,salary:skill*180000,skill,rank,
        management:rand(45,95),finance:rand(40,95),marketing:rand(40,95),technology:rand(40,95),operations:rand(40,95),negotiation:rand(40,95),
        desiredSalary:skill*190000,desiredSO:clamp(skill/1500,.003,.025),trait:pick(['成長戦略','再建','組織開発','資本政策','プロダクト','海外展開']),age:Math.floor(rand(34,60)),hired:false};
    });
    this.notify(`新しいCXO候補を受け取りました。紹介費${yen(cost)}。`);this.save();this.emit();return true;
  }
  hireExecutive(candidateID,salary=null,so=null) {
    const i=this.g.executiveMarket.findIndex(e=>e.id===candidateID);if(i<0)return false;const c=this.g.executiveMarket[i];
    if(this.g.executives[c.role])return this.fail(`${c.role}は在籍済みです。`);
    salary=finite(salary,c.desiredSalary||c.salary);so=finite(so,c.desiredSO||.005);
    const bonus=salary*.25;if(this.g.companyCash<bonus)return this.fail(`契約金${yen(bonus)}が必要です。`);
    const chance=clamp(.55+(salary/(c.desiredSalary||salary)-1)*.8+(so-(c.desiredSO||0))*12+this.g.companyReputation/300,.15,.98);
    if(Math.random()>chance){this.notify(`${c.name}との交渉は不成立でした。`,'warning');return false;}
    this.g.companyCash-=bonus;this.g.executives[c.role]={...c,salary,offeredSO:so,hired:true,hireWeek:this.g.week};
    this.g.executiveMarket.splice(i,1);this.g.usedSO=finite(this.g.usedSO)+so;
    this.notify(`${c.name}が${c.role}に就任しました。`,'success');this.save();this.emit();return true;
  }
  dismissExecutive(role) {
    const e=this.g.executives[role];if(!e)return false;delete this.g.executives[role];this.notify(`${e.name}が退任しました。`,'warning');this.save();this.emit();return true;
  }
  establishBoard() {
    if(this.g.boardEstablished)return false;if(!this.g.executives.CEO||!this.g.executives.CFO)return this.fail('CEOとCFOが必要です。');
    if(this.g.companyCash<5_000_000)return this.fail('取締役会設置費500万円が必要です。');
    this.g.companyCash-=5_000_000;this.g.boardEstablished=true;this.notify('取締役会を設置しました。','success');this.save();this.emit();return true;
  }

  buyStock(stockID,qty,account='personal') {
    const stock=this.stock(stockID);qty=Math.max(0,Math.floor(qty));if(!stock||qty<1)return this.fail('数量が不正です。');
    const cost=stock.price*qty*1.001;const cashKey=account==='company'?'companyCash':'personalCash';
    if(account==='company'&&!this.g.departments.investment)return this.fail('会社口座の株式投資には投資部門が必要です。');
    if(this.g[cashKey]<cost)return this.fail('資金が不足しています。');
    this.g[cashKey]-=cost;const key=account==='company'?'companyStocks':'personalStocks';const h=this.g[key][stockID]||{qty:0,avg:0};
    h.avg=(h.avg*h.qty+stock.price*qty)/(h.qty+qty);h.qty+=qty;this.g[key][stockID]=h;
    stock.price*=1+Math.min(.03,qty/Math.max(1,stock.issuedShares)*.6);stock.marketCap=stock.price*stock.issuedShares;
    this.notify(`${account==='company'?'会社':'個人'}口座で${stock.name}を${qty.toLocaleString()}株購入しました。`,'success');this.save();this.emit();return true;
  }
  sellStock(stockID,qty,account='personal') {
    const stock=this.stock(stockID);qty=Math.max(0,Math.floor(qty));const key=account==='company'?'companyStocks':'personalStocks';const h=this.g[key][stockID];
    if(!stock||!h||qty<1||h.qty<qty)return this.fail('売却可能株数を超えています。');
    const proceeds=stock.price*qty*.999;const profit=(stock.price-h.avg)*qty;this.g[account==='company'?'companyCash':'personalCash']+=proceeds;
    h.qty-=qty;if(h.qty===0)delete this.g[key][stockID];
    this.g[account==='company'?'realizedCompanyStockPL':'realizedPersonalStockPL']+=profit;
    stock.price*=1-Math.min(.03,qty/Math.max(1,stock.issuedShares)*.6);stock.marketCap=stock.price*stock.issuedShares;
    this.notify(`${stock.name}を${qty.toLocaleString()}株売却しました。損益${yen(profit)}。`,profit>=0?'success':'warning');this.save();this.emit();return true;
  }
  toggleFavorite(stockID) {
    const a=this.g.favoriteStockIds;const i=a.indexOf(stockID);i>=0?a.splice(i,1):a.push(stockID);this.save();this.emit();
  }

  investStartup(startupID,amount,account='company') {
    const s=this.g.startups.find(x=>x.id===startupID);amount=finite(amount);if(!s||!s.alive||amount<=0)return false;
    if(account==='company'&&!this.g.departments.investment)return this.fail('会社投資には投資部門が必要です。');
    if(amount<s.minTicket)return this.fail(`最低投資額は${yen(s.minTicket)}です。`);
    const cashKey=account==='company'?'companyCash':'personalCash';if(this.g[cashKey]<amount)return this.fail('資金が不足しています。');
    const equity=clamp(amount/(s.valuation+amount),0,.35);this.g[cashKey]-=amount;s.valuation+=amount*.75;
    if(account==='company'){s.ownedCompany=clamp(s.ownedCompany+equity,0,.8);s.totalInvestedCompany+=amount;}
    else{s.ownedPersonal=clamp(s.ownedPersonal+equity,0,.49);s.totalInvestedPersonal+=amount;}
    s.fundingOpen=false;s.runwayWeeks+=Math.floor(amount/Math.max(1,s.valuation)*156);
    this.notify(`${s.name}へ${yen(amount)}投資し、持分${pct(equity)}を取得しました。`,'success');this.save();this.emit();return true;
  }
  makeSubsidiary(startupID) {
    const s=this.g.startups.find(x=>x.id===startupID);if(!s||s.subsidiary)return false;
    if(s.ownedCompany<.5)return this.fail('会社持分50%以上が必要です。');
    s.subsidiary=true;this.g.subsidiaries.push({id:uuid(),startupID:s.id,name:s.name,domain:s.domain,ownership:s.ownedCompany,valuation:s.valuation,weeklyProfit:0,growth:s.growth,risk:s.risk,publicCompany:false,status:'active',retainedEarnings:0});
    this.notify(`${s.name}を連結子会社化しました。`,'success');this.save();this.emit();return true;
  }
  ipoSubsidiary(id) {
    const sub=this.g.subsidiaries.find(s=>s.id===id);if(!sub||sub.publicCompany)return false;
    if(sub.valuation<250_000_000||sub.ownership<.5)return this.fail('評価額2.5億円以上・持分50%以上が必要です。');
    sub.publicCompany=true;sub.ticker=`V${Math.floor(rand(100,999))}`;sub.sharesOut=1_000_000;sub.stockPrice=sub.valuation/sub.sharesOut;
    const saleRatio=.15;const proceeds=sub.valuation*saleRatio;sub.ownership-=saleRatio;this.g.companyCash+=proceeds;
    this.notify(`${sub.name}を上場させ、${yen(proceeds)}を調達しました。`,'success');this.save();this.emit();return true;
  }

  launchProduct(blueprintID,name=null) {
    if(!this.g.departments.product)return this.fail('商品開発部門が必要です。');const bp=PRODUCT_BLUEPRINTS.find(x=>x.id===blueprintID);if(!bp)return false;
    if(this.g.companyCash<bp.cost)return this.fail(`${yen(bp.cost)}が必要です。`);this.g.companyCash-=bp.cost;
    this.g.productVentures.push({id:uuid(),blueprintID:bp.id,name:name||bp.name,category:bp.category,status:'developing',progress:0,weeksToLaunch:bp.weeks,
      quality:20,brand:5,users:0,paidUsers:0,price:bp.price,serverCost:bp.serverCost,market:bp.market,risk:bp.risk,valuation:bp.cost,revenue:0,cost:0,profit:0});
    this.notify(`${name||bp.name}の開発を開始しました。`,'success');this.save();this.emit();return true;
  }
  productAction(id,kind,amount) {
    const p=this.g.productVentures.find(x=>x.id===id);amount=Math.max(0,finite(amount));if(!p||amount<=0||this.g.companyCash<amount)return this.fail('資金が不足しています。');
    this.g.companyCash-=amount;
    if(kind==='quality')p.quality=clamp(p.quality+Math.log10(1+amount/100000)*2,0,100);
    if(kind==='marketing')p.brand=clamp(p.brand+Math.log10(1+amount/100000)*2.2,0,100);
    if(kind==='development')p.progress=clamp(p.progress+amount/500000,0,100);
    this.notify(`${p.name}へ${yen(amount)}追加投資しました。`,'success');this.save();this.emit();return true;
  }
  sellProduct(id) {
    const i=this.g.productVentures.findIndex(x=>x.id===id);if(i<0)return false;const p=this.g.productVentures[i];const value=Math.max(p.valuation,p.profit*52*8);
    this.g.companyCash+=value;this.g.productVentures.splice(i,1);this.g.productExitCount++;this.notify(`${p.name}を${yen(value)}で売却しました。`,'success');this.save();this.emit();return true;
  }

  buyProperty(id,owner='company') {
    const p=this.g.properties.find(x=>x.id===id);if(!p||p.owner)return false;const cashKey=owner==='company'?'companyCash':'personalCash';
    if(this.g[cashKey]<p.price)return this.fail('購入資金が不足しています。');this.g[cashKey]-=p.price;p.owner=owner;
    this.notify(`${p.name}を${owner==='company'?'会社':'個人'}で購入しました。`,'success');this.save();this.emit();return true;
  }
  sellProperty(id) {
    const p=this.g.properties.find(x=>x.id===id);if(!p||!p.owner)return false;const owner=p.owner,proceeds=p.value*.97;this.g[owner==='company'?'companyCash':'personalCash']+=proceeds;p.owner=null;
    this.notify(`${p.name}を${yen(proceeds)}で売却しました。`,'success');this.save();this.emit();return true;
  }
  buildOnLand(id,type='本社ビル') {
    const p=this.g.properties.find(x=>x.id===id);if(!p||p.owner!=='company'||p.kind!=='土地')return this.fail('会社所有の土地が必要です。');
    const costs={'本社ビル':80_000_000,'商業施設':120_000_000,'物流施設':150_000_000};const cost=costs[type]||80_000_000;
    if(this.g.companyCash<cost)return this.fail(`${yen(cost)}が必要です。`);this.g.companyCash-=cost;p.buildingType=type;p.constructionWeeksRemaining=12;p.buildingScale=1;p.depreciationPerWeek=cost*.025/52;
    this.notify(`${p.name}で${type}の建設を開始しました。`,'success');this.save();this.emit();return true;
  }
  buyLuxury(offerID) {
    const o=LUXURY_OFFERS.find(x=>x.id===offerID);if(!o||this.g.personalCash<o.price)return this.fail('個人資金が不足しています。');
    this.g.personalCash-=o.price;this.g.luxuryAssets.push({...deepClone(o),id:uuid(),purchasePrice:o.price,currentValue:o.price,purchasedWeek:this.g.week});this.g.personalFame+=o.rarity;
    this.notify(`${o.name}を個人で購入しました。`,'success');this.save();this.emit();return true;
  }
  sellLuxury(id) {
    const i=this.g.luxuryAssets.findIndex(x=>x.id===id);if(i<0)return false;const x=this.g.luxuryAssets[i],value=x.currentValue*.95;this.g.personalCash+=value;this.g.luxuryAssets.splice(i,1);this.notify(`${x.name}を${yen(value)}で売却しました。`);this.save();this.emit();return true;
  }
  buyPersonalInvestment(offerID,amount) {
    const o=PERSONAL_INVESTMENT_OFFERS.find(x=>x.id===offerID);amount=finite(amount);if(!o||amount<o.minAmount||this.g.personalCash<amount)return this.fail('投資条件を満たしていません。');
    this.g.personalCash-=amount;this.g.personalInvestments.push({id:uuid(),name:o.name,type:o.type,principal:amount,currentValue:amount,weeklyReturn:o.weeklyReturn,risk:o.risk,purchasedWeek:this.g.week,reinvest:true});
    this.notify(`${o.name}へ${yen(amount)}投資しました。`,'success');this.save();this.emit();return true;
  }
  sellPersonalInvestment(id) {
    const i=this.g.personalInvestments.findIndex(x=>x.id===id);if(i<0)return false;const x=this.g.personalInvestments[i];this.g.personalCash+=x.currentValue;this.g.personalInvestments.splice(i,1);this.notify(`${x.name}を解約しました。`);this.save();this.emit();return true;
  }
  buySportsTeam(teamID,owner='personal') {
    const t=SPORTS_TEAMS.find(x=>x.id===teamID);if(!t)return false;const cashKey=owner==='company'?'companyCash':'personalCash';if(this.g[cashKey]<t.price)return this.fail('購入資金が不足しています。');
    this.g[cashKey]-=t.price;this.g.sportsTeams.push({...deepClone(t),id:uuid(),owner,value:t.price,fanBase:40,teamStrength:45,seasonWins:0,saleListed:false});this.g.personalFame+=t.prestige;
    this.notify(`${t.name}を取得しました。`,'success');this.save();this.emit();return true;
  }
  sellSportsTeam(id) {
    const i=this.g.sportsTeams.findIndex(x=>x.id===id);if(i<0)return false;const t=this.g.sportsTeams[i],price=t.value*rand(.9,1.25);this.g[t.owner==='company'?'companyCash':'personalCash']+=price;this.g.sportsTeams.splice(i,1);this.notify(`${t.name}を${yen(price)}で売却しました。`,'success');this.save();this.emit();return true;
  }

  borrow(amount,account='company') {
    amount=Math.max(0,finite(amount));const debtKey=account==='company'?'companyDebt':'personalDebt',cashKey=account==='company'?'companyCash':'personalCash';
    const limit=account==='company'?this.companyCreditLimit():this.personalCreditLimit();if(this.g[debtKey]+amount>limit)return this.fail(`借入限度額は${yen(limit)}です。`);
    this.g[debtKey]+=amount;this.g[cashKey]+=amount;this.notify(`${account==='company'?'会社':'個人'}で${yen(amount)}借り入れました。`,'success');this.save();this.emit();return true;
  }
  repay(amount,account='company') {
    amount=Math.max(0,finite(amount));const debtKey=account==='company'?'companyDebt':'personalDebt',cashKey=account==='company'?'companyCash':'personalCash';amount=Math.min(amount,this.g[debtKey]);
    if(this.g[cashKey]<amount)return this.fail('返済資金が不足しています。');this.g[cashKey]-=amount;this.g[debtKey]-=amount;if(account==='company')this.g.companyCredit=clamp(this.g.companyCredit+amount/10_000_000,0,100);
    this.notify(`${yen(amount)}返済しました。`,'success');this.save();this.emit();return true;
  }

  ipoMissingReasons() {
    const reasons=[];const annualProfit=this.g.reports.slice(-52).reduce((a,r)=>a+r.profit,0);
    if(!this.g.hasHeadOffice)reasons.push('本社オフィス');if(!this.g.departments.accounting)reasons.push('経理部門');if(!this.g.boardEstablished)reasons.push('取締役会');
    if(this.g.stores.length<3)reasons.push('店舗3店');if(annualProfit<10_000_000)reasons.push('直近52週利益1,000万円');if(this.companyValue()<100_000_000)reasons.push('企業価値1億円');
    return reasons;
  }
  executeIPO(market='東証グロース',sellShares=100000) {
    if(this.g.publicCompany)return false;const missing=this.ipoMissingReasons();if(missing.length)return this.fail(`IPO条件不足：${missing.join('、')}`);
    const value=this.companyValue(),multiple=market==='東証プライム'?1.25:market==='東証スタンダード'?1.1:1;this.g.stockPrice=Math.max(100,value*multiple/this.g.sharesOut);
    sellShares=clamp(Math.floor(sellShares),50000,400000);const newShares=200000,companyRaise=this.g.stockPrice*newShares*.955,founderSale=this.g.stockPrice*sellShares*.955;
    this.g.sharesOut+=newShares;this.g.founderShares-=sellShares;this.g.companyCash+=companyRaise;this.g.personalCash+=founderSale;this.g.publicCompany=true;this.g.selectedListingMarket=market;
    this.g.ticker=(this.g.companyName.replace(/[^A-Za-z]/g,'').slice(0,4).toUpperCase()||'CPTY');this.updateOwnershipRatios();
    this.g.market.push({id:this.g.ticker,name:this.g.companyName,sector:'コングロマリット',price:this.g.stockPrice,previous:this.g.stockPrice,dividendYield:0,volatility:.08,trend:.003,marketCap:this.g.stockPrice*this.g.sharesOut,per:20,pbr:2,issuedShares:this.g.sharesOut,dividendPerShare:0,shareholders:{創業者:this.g.founderOwnershipRatio},description:'プレイヤーが経営する企業',listingMarket:market,priceHistory:[this.g.stockPrice]});
    this.notify(`${market}へ上場しました。会社調達${yen(companyRaise)}、創業者売出収入${yen(founderSale)}。`,'success');this.evaluateProgression();this.save();this.emit();return true;
  }
  setDividend(amount) {
    if(!this.g.publicCompany)return this.fail('未上場です。');this.g.dividendPerShare=Math.max(0,finite(amount));const own=this.stock(this.g.ticker);if(own)own.dividendPerShare=this.g.dividendPerShare;
    this.notify(`四半期配当を1株${yen(this.g.dividendPerShare)}に設定しました。`);this.save();this.emit();return true;
  }
  buybackOwnShares(amount) {
    if(!this.g.publicCompany)return this.fail('未上場です。');amount=Math.max(0,finite(amount));if(this.g.companyCash<amount)return this.fail('資金不足です。');
    const qty=Math.min((this.g.sharesOut-this.g.founderShares-this.g.treasuryBuybackShares),Math.floor(amount/this.g.stockPrice));if(qty<=0)return this.fail('買い戻せる株式がありません。');
    const cost=qty*this.g.stockPrice;this.g.companyCash-=cost;this.g.treasuryBuybackShares+=qty;this.g.stockPrice*=1+Math.min(.08,qty/this.g.sharesOut*.8);this.updateOwnershipRatios();this.notify(`自社株${qty.toLocaleString()}株を${yen(cost)}で取得しました。`,'success');this.save();this.emit();return true;
  }

  generateMATargets(force=false) {
    if(!this.g.departments.investment)return this.fail('投資部門が必要です。');if(!force&&this.g.acquisitionTargets.length>=6)return true;
    const names=['北斗フーズ','ネクスト店舗DX','東亜物流','みらい不動産管理','クラウド工房','地域メディアネット','ウェルネスパートナーズ','精密部品ラボ'];
    const domains=['外食','SaaS','物流','不動産','IT','メディア','ヘルスケア','製造'];
    this.g.acquisitionTargets=Array.from({length:8},(_,i)=>{
      const valuation=rand(40_000_000,1_800_000_000),margin=rand(-.04,.18),sales=valuation*rand(.25,1.4);
      return {id:uuid(),name:`${pick(names)}${Math.floor(rand(1,99))}`,domain:pick(domains),valuation,sales,operatingProfit:sales*margin,growth:rand(-.05,.24),risk:rand(.05,.35),synergy:rand(.02,.20),friendly:Math.random()>.25,expiresWeek:this.g.week+13};
    });
    this.notify('M&A候補企業を更新しました。');this.save();this.emit();return true;
  }
  acquireTarget(id,method='friendly') {
    const i=this.g.acquisitionTargets.findIndex(x=>x.id===id);if(i<0)return false;const t=this.g.acquisitionTargets[i];const premium=method==='hostile'?1.35:method==='shareSwap'?1.08:1.18;const price=t.valuation*premium;
    if(method!=='shareSwap'&&this.g.companyCash<price)return this.fail(`${yen(price)}が必要です。`);
    if(method==='shareSwap'&&!this.g.publicCompany)return this.fail('株式交換には自社上場が必要です。');
    if(method==='shareSwap'){const newShares=Math.ceil(price/Math.max(1,this.g.stockPrice));this.g.sharesOut+=newShares;this.g.externalShareholderRatio+=newShares/this.g.sharesOut;}
    else this.g.companyCash-=price;
    this.g.maSubsidiaries.push({...t,acquisitionPrice:price,acquisitionMethod:method,acquiredWeek:this.g.week,status:'active',retainedEarnings:0,weeklyProfit:t.operatingProfit/52});
    this.g.goodwillRecords.push({id:uuid(),name:t.name,amount:Math.max(0,price-t.valuation),carryingValue:Math.max(0,price-t.valuation),acquiredWeek:this.g.week});
    this.g.totalAcquisitions++;this.g.acquisitionTargets.splice(i,1);this.notify(`${t.name}を${method==='hostile'?'敵対的買収':method==='shareSwap'?'株式交換':'友好的買収'}で取得しました。`,'success');this.save();this.emit();return true;
  }
  sellMASubsidiary(id) {
    const i=this.g.maSubsidiaries.findIndex(x=>x.id===id);if(i<0)return false;const s=this.g.maSubsidiaries[i],price=s.valuation*rand(.85,1.3),gain=price-s.acquisitionPrice;this.g.companyCash+=price;this.g.totalMAGain+=gain;this.g.maSubsidiaries.splice(i,1);this.notify(`${s.name}を${yen(price)}で売却しました。売却損益${yen(gain)}。`,gain>=0?'success':'warning');this.save();this.emit();return true;
  }

  openOverseas(countryID,businessID) {
    if(!this.g.hasHeadOffice||!this.g.executives.CEO)return this.fail('本社とCEOが必要です。');const c=OVERSEAS_COUNTRIES.find(x=>x.id===countryID),b=this.business(businessID);if(!c||!b)return false;
    const cost=c.cost+b.storeCost*2;if(this.g.companyCash<cost)return this.fail(`${yen(cost)}が必要です。`);this.g.companyCash-=cost;
    this.g.overseasSubsidiaries.push({id:uuid(),countryID:c.id,countryName:c.name,businessID:b.id,name:`${this.g.companyName} ${c.name}`,valuation:cost,status:'preparing',openingWeek:this.g.week+8,lastRevenue:0,lastProfit:0,localization:20,brand:10,risk:c.risk});
    this.notify(`${c.name}現地法人の設立を開始しました。`,'success');this.save();this.emit();return true;
  }
  overseasAction(id,kind,amount) {
    const x=this.g.overseasSubsidiaries.find(y=>y.id===id);amount=finite(amount);if(!x||amount<=0||this.g.companyCash<amount)return false;this.g.companyCash-=amount;
    if(kind==='localization')x.localization=clamp(x.localization+amount/500000,0,100);if(kind==='brand')x.brand=clamp(x.brand+amount/600000,0,100);
    this.notify(`${x.countryName}事業へ${yen(amount)}投資しました。`);this.save();this.emit();return true;
  }

  startFranchise(businessID) {
    if(this.g.stores.filter(s=>s.businessID===businessID&&s.status==='open').length<3)return this.fail('同一業態の直営店3店が必要です。');
    if(this.g.franchiseStoresByBusinessID[businessID]!==undefined)return this.fail('FC展開済みです。');
    if(this.g.companyCash<5_000_000)return this.fail('FC本部整備費500万円が必要です。');this.g.companyCash-=5_000_000;
    this.g.franchiseStoresByBusinessID[businessID]=0;this.g.franchiseRoyaltyRateByBusinessID[businessID]=.05;this.g.franchiseQualityByBusinessID[businessID]=60;this.g.franchiseTrustByBusinessID[businessID]=60;
    this.notify(`${this.business(businessID).name}のフランチャイズ本部を設置しました。`,'success');this.save();this.emit();return true;
  }
  recruitFranchise(businessID,count=1) {
    if(this.g.franchiseStoresByBusinessID[businessID]===undefined)return false;const cost=count*1_000_000;if(this.g.companyCash<cost)return this.fail('募集費が不足しています。');this.g.companyCash-=cost;this.g.franchiseStoresByBusinessID[businessID]+=count;
    this.notify(`FC加盟店が${count}店増えました。`,'success');this.save();this.emit();return true;
  }

  addDirective(role,type,budget) {
    const e=this.g.executives[role];if(!e)return this.fail(`${role}が在籍していません。`);budget=Math.max(0,finite(budget));if(this.g.companyCash<budget)return this.fail('予算不足です。');
    this.g.companyCash-=budget;this.g.executiveDirectives.push({id:uuid(),role,executiveName:e.name,type,budget,startWeek:this.g.week,endWeek:this.g.week+4,progress:0,status:'active'});
    this.notify(`${e.name}へ「${type}」を指示しました。`,'success');this.save();this.emit();return true;
  }
  startCampaign(departmentID,type,budget) {
    if(!this.g.departments[departmentID])return this.fail('該当部門がありません。');budget=finite(budget);if(this.g.companyCash<budget)return this.fail('予算不足です。');this.g.companyCash-=budget;
    this.g.departmentCampaigns.push({id:uuid(),departmentID,type,budget,startWeek:this.g.week,endWeek:this.g.week+6,progress:0,status:'active'});this.notify(`${this.g.departments[departmentID].name}で${type}を開始しました。`,'success');this.save();this.emit();return true;
  }
  proposeInternalVenture() {
    if(!this.g.departments.product)return this.fail('商品開発部門が必要です。');const domains=['AI業務支援','地域物流','フィンテック','ヘルスケアSaaS','店舗ロボット','教育DX'];
    const p={id:uuid(),name:`${pick(domains)}プロジェクト`,domain:pick(domains),requiredBudget:rand(8_000_000,60_000_000),teamQuality:rand(40,90),marketPotential:rand(35,95),risk:rand(.08,.30),expiresWeek:this.g.week+8};this.g.internalVentureProposals.push(p);this.notify(`社内ベンチャー案「${p.name}」が提案されました。`);this.save();this.emit();return true;
  }
  approveInternalVenture(id) {
    const i=this.g.internalVentureProposals.findIndex(x=>x.id===id);if(i<0)return false;const p=this.g.internalVentureProposals[i];if(this.g.companyCash<p.requiredBudget)return this.fail('予算不足です。');this.g.companyCash-=p.requiredBudget;
    this.g.internalVentures.push({...p,status:'developing',progress:0,valuation:p.requiredBudget,weeklyProfit:0});this.g.internalVentureProposals.splice(i,1);this.notify(`${p.name}を社内ベンチャーとして承認しました。`,'success');this.save();this.emit();return true;
  }

  acceptBuyoutOffer(multiplier=1.2) {
    if(this.g.publicCompany===false&&this.companyValue()<200_000_000)return this.fail('買収提案を受ける規模に達していません。');const value=this.companyValue()*multiplier,founderProceeds=value*this.g.founderOwnershipRatio;
    this.g.personalCash+=founderProceeds;this.g.isCompanySold=true;this.g.hasSeenCompanyBuyoutEnding=false;this.notify(`${this.g.companyName}を${yen(value)}で売却しました。創業者受取${yen(founderProceeds)}。`,'success');this.save();this.emit();return true;
  }

  updateOwnershipRatios() {
    const eligible=Math.max(1,this.g.sharesOut-this.g.treasuryBuybackShares);this.g.founderOwnershipRatio=clamp(this.g.founderShares/eligible,0,1);this.g.externalShareholderRatio=clamp(1-this.g.founderOwnershipRatio-finite(this.g.competitorOwnedRatio),0,1);
  }
  fail(message) { this.emit('notify',{message,severity:'error'}); return false; }

  updateMarket() {
    for(const s of this.g.market){s.previous=s.price;let move=s.trend+(this.g.economy-1)*.018+rand(-s.volatility,s.volatility);if(s.id===this.g.ticker&&this.g.publicCompany){const last=this.g.lastReport?.profit||0;move+=clamp(last/Math.max(1,this.companyValue())*10,-.08,.08);}s.price=Math.max(10,s.price*(1+move));s.marketCap=s.price*Math.max(1,s.issuedShares||1);s.priceHistory=(s.priceHistory||[]).concat(s.price).slice(-260);if(s.per>0)s.per=clamp(s.per*(1+move*.25),3,120);}
    if(this.g.publicCompany){const own=this.stock(this.g.ticker);if(own){this.g.stockPrice=own.price;own.issuedShares=this.g.sharesOut;own.marketCap=own.price*this.g.sharesOut;}}
  }
  updateStartups() {
    for(const s of this.g.startups){if(!s.alive)continue;s.runwayWeeks--;const annual=s.growth+rand(-s.risk,s.risk)+(this.g.economy-1)*.15;s.valuation=Math.max(2_000_000,s.valuation*(1+annual/52));s.productProgress=clamp(s.productProgress+rand(.005,.035),0,1);
      if(s.runwayWeeks<8)s.fundingOpen=true;if(s.fundingOpen&&Math.random()<.08){s.stage=s.stage==='Seed'?'Series A':s.stage==='Series A'?'Series B':s.stage==='Series B'?'Series C':'Pre-IPO';s.valuation*=rand(1.15,1.65);s.runwayWeeks+=52;s.ownedCompany*=rand(.82,.94);s.ownedPersonal*=rand(.82,.94);s.fundingOpen=false;this.g.news.unshift(`第${this.g.week}週：${s.name}が${s.stage}資金調達を完了しました。`);}
      if(s.runwayWeeks<=0&&Math.random()<.25){s.alive=false;s.valuation*=.1;this.g.news.unshift(`第${this.g.week}週：${s.name}が資金枯渇で事業停止しました。`);}
      if(s.stage==='Pre-IPO'&&s.valuation>1_000_000_000&&Math.random()<.025)this.listStartup(s);
    }
  }
  listStartup(s) {
    const id=`V${Math.floor(rand(1000,9999))}`;if(this.stock(id))return;s.ipoStockID=id;const shares=1_000_000,price=s.valuation/shares;
    this.g.market.push({id,name:s.name,sector:s.domain,price,previous:price,dividendYield:0,volatility:.12,trend:.004,marketCap:s.valuation,per:0,pbr:5,issuedShares:shares,dividendPerShare:0,shareholders:{},description:`${s.domain}の新興企業`,listingMarket:'東証グロース',priceHistory:[price]});
    const companyQty=Math.floor(s.ownedCompany*shares),personalQty=Math.floor(s.ownedPersonal*shares);if(companyQty)this.g.companyStocks[id]={qty:companyQty,avg:0};if(personalQty)this.g.personalStocks[id]={qty:personalQty,avg:0};
    s.ownedCompany=0;s.ownedPersonal=0;s.alive=false;this.g.news.unshift(`第${this.g.week}週：${s.name}がIPOしました。保有持分は上場株式へ転換されました。`);
  }
  updateCompetitors() {
    for(const c of this.g.competitors){const profit=c.stores*rand(100000,450000);c.cash+=profit;c.brand=clamp(c.brand+rand(-.1,.5),0,100);c.quality=clamp(c.quality+rand(-.1,.4),0,100);if(c.cash>8_000_000&&Math.random()<.08){c.stores++;c.cash-=rand(2_000_000,7_000_000);this.g.competitorEvents.unshift(`${c.name}が${this.area(c.areaID)?.name||''}で出店しました。`);}if(this.g.publicCompany&&Math.random()<.005){const spend=Math.min(c.cash*.1,5_000_000),qty=spend/Math.max(1,this.g.stockPrice);c.cash-=spend;c.ownedPlayerShares+=qty;this.g.competitorOwnedRatio=clamp(this.g.competitorOwnedRatio+qty/this.g.sharesOut,0,.49);}}
    this.updateOwnershipRatios();
  }
  updateProducts() {
    let revenue=0,cost=0;
    for(const p of this.g.productVentures){if(p.status==='developing'){const speed=2+this.departmentEffect('product')*2+this.departmentEffect('dx');p.progress=clamp(p.progress+speed,0,100);p.weeksToLaunch=Math.max(0,p.weeksToLaunch-1);cost+=p.serverCost*.25;if(p.progress>=100||p.weeksToLaunch<=0){p.status='released';p.users=Math.floor(200+p.quality*20+p.brand*10);this.g.productEvents.unshift(`${p.name}を正式リリースしました。`);}}
      if(p.status==='released'){const churn=clamp(.08-p.quality/2000, .01,.12),newUsers=Math.max(0,Math.floor((p.brand*12+p.quality*5)*rand(.7,1.3)));p.users=Math.max(0,Math.floor(p.users*(1-churn)+newUsers));p.paidUsers=Math.floor(p.users*clamp(.02+p.quality/1500,.02,.18));const ads=p.blueprintID==='ec'||p.blueprintID==='media'?p.users*rand(8,30):0;p.revenue=p.paidUsers*p.price/4+ads;p.cost=p.serverCost+p.users*rand(2,12);p.profit=p.revenue-p.cost;p.valuation=Math.max(1_000_000,p.valuation*(1+clamp(p.profit/Math.max(1,p.valuation),-.05,.08))+newUsers*200);revenue+=p.revenue;cost+=p.cost;}}
    return {revenue,cost,profit:revenue-cost};
  }
  updateDirectivesAndCampaigns() {
    for(const d of this.g.executiveDirectives.filter(x=>x.status==='active')){d.progress+=25;if(d.type.includes('成長'))this.g.companyReputation+=.3;if(d.type.includes('収益'))this.g.businesses.forEach(b=>b.efficiency=clamp(b.efficiency+.15,0,100));if(d.type.includes('財務'))this.g.companyCredit=clamp(this.g.companyCredit+.4,0,100);if(this.g.week>=d.endWeek){d.status='completed';this.g.news.unshift(`第${this.g.week}週：${d.executiveName}の指示「${d.type}」が完了しました。`);}}
    for(const c of this.g.departmentCampaigns.filter(x=>x.status==='active')){c.progress+=100/6;if(c.departmentID==='marketing')this.g.businesses.forEach(b=>b.brand=clamp(b.brand+.1,0,100));if(c.departmentID==='operations')this.g.businesses.forEach(b=>b.efficiency=clamp(b.efficiency+.1,0,100));if(this.g.week>=c.endWeek)c.status='completed';}
    for(const v of this.g.internalVentures){if(v.status==='developing'){v.progress+=rand(2,6)+this.departmentEffect('product');v.valuation*=1+rand(-.01,.03);if(v.progress>=100){v.status='active';this.g.news.unshift(`第${this.g.week}週：社内ベンチャー${v.name}が事業化しました。`);}}else if(v.status==='active'){v.weeklyProfit=v.valuation*rand(-.001,.003);v.valuation*=1+rand(-.02,.04);}}
    this.g.internalVentureProposals=this.g.internalVentureProposals.filter(p=>p.expiresWeek>=this.g.week);
  }
  updateProperties() {
    for(const p of this.g.properties){p.value=Math.max(p.basePrice*.4,p.basePrice*(1+(this.g.economy-1)*p.economySensitivity)*(this.g.realEstateCycle||1));p.price=p.value;if(p.constructionWeeksRemaining>0){p.constructionWeeksRemaining--;if(p.constructionWeeksRemaining===0){p.kind=p.buildingType;p.value+=80_000_000;p.basePrice=p.value;p.rentIncome=p.value*.04/52;this.g.news.unshift(`第${this.g.week}週：${p.name}の${p.buildingType}が完成しました。`);}}}
  }
  updateSubsidiaries() {
    let revenue=0,profit=0,dividends=0;
    for(const s of this.g.subsidiaries){if(s.status==='bankrupt')continue;const annual=clamp(s.growth+rand(-s.risk,s.risk)+(this.g.economy-1)*.08,-.3,.8);s.valuation=Math.max(5_000_000,s.valuation*(1+annual/52));s.weeklyProfit=s.valuation*clamp(rand(.01,.055)-s.risk*.025,-.015,.06)/52;s.retainedEarnings=finite(s.retainedEarnings)+s.weeklyProfit;revenue+=Math.max(0,s.weeklyProfit/.12)*s.ownership;profit+=s.weeklyProfit*s.ownership;if(this.g.week%13===0&&s.retainedEarnings>0){const div=s.retainedEarnings*.15*s.ownership;s.retainedEarnings-=div;dividends+=div;}if(s.status==='distressed'&&Math.random()<.03){s.status='bankrupt';s.valuation*=.1;}}
    for(const s of this.g.maSubsidiaries){if(s.status!=='active')continue;s.valuation=Math.max(1_000_000,s.valuation*(1+s.growth/52+rand(-.025,.03)));s.weeklyProfit=s.operatingProfit/52*rand(.8,1.2);s.retainedEarnings=finite(s.retainedEarnings)+s.weeklyProfit;revenue+=Math.max(0,s.sales/52);profit+=s.weeklyProfit;if(this.g.week%13===0&&s.retainedEarnings>0){const div=s.retainedEarnings*.2;s.retainedEarnings-=div;dividends+=div;}if(Math.random()<s.risk*.005){const goodwill=this.g.goodwillRecords.find(g=>g.name===s.name);const loss=Math.min(goodwill?.carryingValue||0,s.valuation*.1);if(goodwill)goodwill.carryingValue-=loss;this.g.totalImpairmentLoss+=loss;profit-=loss;}}
    this.g.companyCash+=dividends;return {revenue,profit,dividends};
  }
  updateOverseas() {
    let revenue=0,cost=0;
    for(const x of this.g.overseasSubsidiaries){const c=OVERSEAS_COUNTRIES.find(y=>y.id===x.countryID),b=this.business(x.businessID);if(!c||!b)continue;if(x.status==='preparing'&&this.g.week>=x.openingWeek)x.status='active';if(x.status!=='active')continue;const demand=b.demand*c.demand*this.g.economy*(1+x.localization/150)*(1+x.brand/180)*rand(.75,1.25);x.lastRevenue=demand*b.price*this.g.exchangeRate;x.lastProfit=x.lastRevenue-demand*b.unitCost-b.fixedCost*2;revenue+=x.lastRevenue;cost+=x.lastRevenue-x.lastProfit;x.valuation=Math.max(1_000_000,x.valuation*(1+clamp(x.lastProfit/Math.max(1,x.valuation),-.04,.06)));if(Math.random()<x.risk*.01)x.lastProfit-=x.valuation*.02;}
    return {revenue,cost,profit:revenue-cost};
  }
  updatePersonalAssets() {
    for(const x of this.g.personalInvestments){const r=x.weeklyReturn+rand(-x.risk,x.risk)/20;x.currentValue=Math.max(0,x.currentValue*(1+r));}
    for(const x of this.g.luxuryAssets){x.currentValue=Math.max(x.purchasePrice*.3,x.currentValue*(1+rand(-.01,.012)));this.g.personalCash-=x.maintenancePerWeek;}
    for(const t of this.g.sportsTeams){const win=Math.random()<t.teamStrength/100;if(win)t.seasonWins++;t.fanBase=clamp(t.fanBase+(win?rand(.1,1.2):rand(-.5,.2)),10,100);const weeklyRevenue=t.revenue*(.7+t.fanBase/100),weeklyCost=t.cost;this.g[t.owner==='company'?'companyCash':'personalCash']+=weeklyRevenue-weeklyCost;t.value=Math.max(t.price*.5,t.value*(1+rand(-.01,.015)+(win?.002:-.001)));}
    this.g.personalCash-=this.g.personalDebt*this.personalBorrowRate()/52;
  }
  updateFranchise() {
    let income=0;for(const [businessID,count] of Object.entries(this.g.franchiseStoresByBusinessID)){const b=this.business(businessID);const royalty=this.g.franchiseRoyaltyRateByBusinessID[businessID]||.05;const quality=this.g.franchiseQualityByBusinessID[businessID]||60;const avg=b.demand*b.price*.7;income+=count*avg*royalty*(.6+quality/100);if(count>0&&Math.random()<.03)this.g.franchiseStoresByBusinessID[businessID]++;}return income;
  }
  updateMacro() {
    this.g.economy=clamp(this.g.economy+rand(-.025,.025),.72,1.28);this.g.season=1+Math.sin(this.g.week/52*Math.PI*2)*.08;this.g.policyRate=clamp(this.g.policyRate+rand(-.0002,.0002),0,.08);this.g.realEstateCycle=clamp(this.g.realEstateCycle+rand(-.01,.01),.65,1.55);this.g.exchangeRate=clamp(this.g.exchangeRate+rand(-.012,.012),.65,1.45);this.g.inflation*=1+rand(-.0005,.0015);
    if(!this.g.macroCrisis&&this.g.week>20&&Math.random()<.005){this.g.macroCrisis={kind:pick(['景気後退','資源高','金融不安','感染症']),weeks:Math.floor(rand(8,30)),salesMultiplier:rand(.72,.9),costMultiplier:rand(1.05,1.28)};this.g.news.unshift(`第${this.g.week}週：マクロ危機「${this.g.macroCrisis.kind}」が発生しました。`);}if(this.g.macroCrisis){this.g.macroCrisis.weeks--;if(this.g.macroCrisis.weeks<=0){this.g.news.unshift(`第${this.g.week}週：${this.g.macroCrisis.kind}が収束しました。`);this.g.macroCrisis=null;}}
  }
  autoManage() {
    if(!this.g.executives.CEO)return;const reserve=this.g.autoManageStyle==='aggressive'?3_000_000:this.g.autoManageStyle==='defensive'?20_000_000:8_000_000;
    if(this.g.companyCash>reserve+3_000_000&&this.g.week%4===0){const b=[...this.g.businesses].sort((a,b)=>b.brand+b.quality-(a.brand+a.quality))[0];this.investBusiness(b.id,'brand',Math.min(2_000_000,this.g.companyCash-reserve));}
  }

  advanceWeek(showSummary=true) {
    if(this.g.gameOver)return this.fail('会社は破綻状態です。');
    if(this.g.isCompanySold){this.g.week++;this.g.month=Math.floor((this.g.week-1)/4)+1;this.updatePersonalAssets();this.recordHistory(0,0);this.save();this.emit('week',{summary:null});return true;}
    if(this.g.autoManage)this.autoManage();
    this.g.week++;this.g.month=Math.floor((this.g.week-1)/4)+1;if(this.g.week%52===0)this.g.founderAge++;
    this.updateMacro();this.updateMarket();this.updateProperties();this.updateStartups();this.updateCompetitors();this.updateDirectivesAndCampaigns();
    const product=this.updateProducts(),overseas=this.updateOverseas(),subs=this.updateSubsidiaries(),franchise=this.updateFranchise();this.updatePersonalAssets();
    let sales=product.revenue+overseas.revenue+subs.revenue+franchise,expenses=product.cost+overseas.cost,rentIncome=0,stockIncome=0,dividend=0,propertyDepreciation=0;
    for(const store of this.g.stores){if(store.status==='preparing'&&this.g.week>=store.openingWeek){store.status='open';store.weeksToOpen=0;this.g.news.unshift(`第${this.g.week}週：${store.name}が開店しました。`);}if(store.status!=='open'){store.weeksToOpen=Math.max(0,store.openingWeek-this.g.week);continue;}
      const b=this.business(store.businessID),p=this.pref(store.prefID),a=this.area(p.areaID),localCompetition=a.competition+this.competitorPressure(a.id,b.id);let demand=b.demand*p.traffic*a.traffic*this.g.economy*this.g.season*this.fit(b,a)*(1+b.quality/100)*(1+b.brand/90)*(1+b.dx/140)*(1-localCompetition*.55)*rand(.88,1.14);
      demand*=1+this.departmentEffect('dx')*.05+this.departmentEffect('marketing')*.03;demand*=[0,.45,.75,1,1.17][store.operatingHours||3]||1;if(this.g.macroCrisis)demand*=this.g.macroCrisis.salesMultiplier;
      const storeSales=Math.max(0,demand*b.price*this.g.inflation),variable=demand*b.unitCost*this.g.inflation*(1-Math.min(.22,b.efficiency/260))/(1+this.departmentEffect('operations')*.04),fixed=(b.fixedCost+p.rent+b.wage)*this.g.inflation*([0,.55,.8,1,1.24][store.operatingHours||3]||1)*(this.g.macroCrisis?.costMultiplier||1),repair=Math.max(0,100-store.condition)*650;
      store.lastSales=storeSales;store.lastProfit=storeSales-variable-fixed-repair;store.condition=clamp(store.condition-rand(.1,1),40,100);sales+=storeSales;expenses+=variable+fixed+repair;}
    for(const p of this.g.properties){if(!p.owner)continue;const rent=p.rentIncome*clamp(this.g.economy,.75,1.25)*p.rentMultiplier*(1-p.vacancyRate);if(p.owner==='company')rentIncome+=rent;else this.g.personalCash+=rent;if(p.owner==='company')propertyDepreciation+=finite(p.depreciationPerWeek);}
    expenses+=propertyDepreciation;
    const execPayroll=this.g.week%4===0?Object.values(this.g.executives).reduce((a,e)=>a+finite(e.salary)/12,0):0;
    const deptCost=Object.values(this.g.departments).reduce((a,d)=>a+finite(d.weeklyCost),0)+Object.values(this.g.departmentStaff).reduce((a,n)=>a+Math.max(0,n-1)*65000,0);
    const officeCost=this.g.hasHeadOffice?this.g.officeWeeklyCost:0,interest=this.g.companyDebt*this.companyBorrowRate()/52;expenses+=execPayroll+deptCost+officeCost+interest;
    if(this.g.week%13===0){for(const [id,h] of Object.entries(this.g.companyStocks)){const s=this.stock(id);if(s&&id!==this.g.ticker)stockIncome+=h.qty*(s.dividendPerShare||s.price*s.dividendYield/4);}for(const [id,h] of Object.entries(this.g.personalStocks)){const s=this.stock(id);if(s&&id!==this.g.ticker)this.g.personalCash+=h.qty*(s.dividendPerShare||s.price*s.dividendYield/4)*.797;}if(this.g.publicCompany&&this.g.dividendPerShare>0){dividend=this.g.dividendPerShare*Math.max(0,this.g.sharesOut-this.g.treasuryBuybackShares);const founderGross=dividend*this.g.founderOwnershipRatio;this.g.personalCash+=founderGross*.797;expenses+=dividend;}}
    const operatingProfit=sales+rentIncome+stockIncome-expenses+subs.profit;let tax=0;if(this.g.week%13===0&&operatingProfit>0){tax=operatingProfit*.306;expenses+=tax;}
    const profit=sales+rentIncome+stockIncome-expenses+subs.profit;this.g.companyCash+=profit;this.g.companyCredit=clamp(this.g.companyCredit+(profit>=0?.15:-.3),0,100);this.g.companyReputation=clamp(this.g.companyReputation+(profit>0?.08:-.04),0,100);
    const report={week:this.g.week,sales,expenses,rentIncome,stockIncome,interest,dividend,officeCost,profit,investmentPL:subs.profit,companyStockUnrealizedPL:this.unrealizedPL('company'),propertyDepreciation,tax};this.g.lastReport=report;this.g.reports.push(report);this.g.reports=this.g.reports.slice(-520);
    this.recordHistory(sales,profit);this.evaluateProgression();this.generateRecurringEvents();
    if(this.g.companyCash<0){this.g.consecutiveNegativeCashWeeks=finite(this.g.consecutiveNegativeCashWeeks)+1;if(this.g.consecutiveNegativeCashWeeks>=2){this.g.gameOver=true;this.g.gameOverReason='会社現金が2週連続でマイナスになりました。';}}else this.g.consecutiveNegativeCashWeeks=0;
    const summary={...report,companyCash:this.g.companyCash,companyValue:this.companyValue(),personalNetWorth:this.personalNetWorth(),newNews:this.g.news.slice(0,5)};this.g.lastWeeklySummary=summary;
    if (!this.inTransaction()) { this.normalize(); this.save(); this.emit('week',{summary:showSummary?summary:null}); }
    return true;
  }

  unrealizedPL(account='company') {
    const holdings=this.g[account==='company'?'companyStocks':'personalStocks'];return Object.entries(holdings).reduce((a,[id,h])=>a+((this.stock(id)?.price||0)-h.avg)*h.qty,0);
  }
  recordHistory(sales,profit) {
    this.g.weeklySalesHistory.push(sales);this.g.weeklyProfitHistory.push(profit);this.g.companyValueHistory.push(this.companyValue());this.g.personalNetWorthHistory.push(this.personalNetWorth());
    for(const key of ['weeklySalesHistory','weeklyProfitHistory','companyValueHistory','personalNetWorthHistory'])this.g[key]=this.g[key].slice(-520);
    this.g.history.unshift(`第${this.g.week}週 売上${yen(sales)} 利益${yen(profit)} 会社現金${yen(this.g.companyCash)}`);this.g.history=this.g.history.slice(0,500);
  }
  evaluateProgression() {
    for(const m of MISSION_DEFS){if(this.g.completedMissionIDs.includes(m.id))continue;if(m.check(this.g)){this.g.completedMissionIDs.push(m.id);this.g.activeMissionIDs=this.g.activeMissionIDs.filter(x=>x!==m.id);this.g.companyCash+=m.reward;this.g.news.unshift(`第${this.g.week}週：ミッション「${m.title}」達成。報酬${yen(m.reward)}。`);const idx=MISSION_DEFS.findIndex(x=>x.id===m.id);if(MISSION_DEFS[idx+1])this.g.activeMissionIDs.push(MISSION_DEFS[idx+1].id);}}
    const achievements=[['stores10','10店舗企業',this.g.stores.length>=10],['value1b','企業価値10億円',this.companyValue()>=1e9],['networth1b','個人資産10億円',this.personalNetWorth()>=1e9],['ipo','上場企業創業者',this.g.publicCompany],['ma5','連続買収者',this.g.totalAcquisitions>=5],['products3','プロダクト企業',this.g.productVentures.filter(p=>p.status==='released').length>=3]];
    for(const [id,title,ok] of achievements)if(ok&&!this.g.achievements.includes(id)){this.g.achievements.push(id);this.g.news.unshift(`第${this.g.week}週：実績「${title}」を解除しました。`);}
  }
  generateRecurringEvents() {
    if(this.g.week%13===0){this.g.news.unshift(`第${this.g.week}週：四半期決算を発表しました。`);if(this.g.boardEstablished)this.g.boardAgendas=[{id:uuid(),title:'成長投資枠の承認',detail:'次四半期の投資予算を決定',cost:5_000_000,effect:'成長',approved:false},{id:uuid(),title:'財務規律の強化',detail:'借入削減と信用改善',cost:2_000_000,effect:'信用',approved:false}];}
    if(this.g.departments.investment&&this.g.acquisitionTargets.length<3&&this.g.week%8===0)this.generateMATargets(true);
    if(this.g.departments.product&&this.g.internalVentureProposals.length===0&&Math.random()<.08)this.proposeInternalVenture();
    if(this.g.publicCompany&&this.companyValue()>1_000_000_000&&Math.random()<.005)this.g.news.unshift(`第${this.g.week}週：同業大手から自社買収の打診が届いています。`);
    if(this.g.news.length>300)this.g.news=this.g.news.slice(0,300);
  }

  exportSave() {
    return new Blob([JSON.stringify(this.g,null,2)],{type:'application/json'});
  }
  importSave(text) {
    const parsed=JSON.parse(text);const migrated=migrateSave(parsed);if(!migrated.ok)throw new Error(migrated.errors.join(' / ')||'セーブデータ形式が不正です。');this.g=migrated.state;this._saveBlockedDueToLoadFailure=false;this._loadFailureReason='';this.normalize();this.save();this.emit();
  }
}

Object.assign(exports,{SAVE_KEY,SAVE_VERSION,clamp,finite,uuid,yen,compactYen,pct,rand,pick,createInitialState,mergeDefaults,detectSaveVersion,migrateSave,migrateUnversionedToV1,migrateV1ToV2,deepNormalizeState,validateMigratedState,TycoonEngine});
})(__modules.engine={},__modules.data);

})();
