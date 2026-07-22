// Script boundary: js/expansion.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before expansion.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.expansion)throw new Error('Capitalism Tycoon expansion module is already registered.');
(function(exports){
// Expansion layer for the browser port.
// Adds systems present in the Swift Playgrounds project that were missing or simplified.

const FOUNDER_TRAITS = [
  {id:'tech',name:'技術者肌',icon:'💻',detail:'プロダクト開発とR&Dが少し得意。',business:1.00,tech:1.25,finance:1.00,negotiation:1.00,localRep:20,focus:78,energy:68},
  {id:'merchant',name:'商売上手',icon:'🏪',detail:'店舗・仕入れ・交渉が少し得意。',business:1.25,tech:1.00,finance:1.00,negotiation:1.15,localRep:23,focus:72,energy:72},
  {id:'investor',name:'投資家気質',icon:'📈',detail:'金融・VC・M&A判断が少し得意。',business:1.00,tech:1.00,finance:1.30,negotiation:1.05,localRep:18,focus:72,energy:70},
  {id:'local',name:'地元密着',icon:'🗾',detail:'出身地の信用が高く、紹介が出やすい。',business:1.10,tech:1.00,finance:1.00,negotiation:1.15,localRep:32,focus:70,energy:76},
  {id:'ambitious',name:'野心家',icon:'🔥',detail:'全分野に小さな成長補正。',business:1.08,tech:1.08,finance:1.08,negotiation:1.08,localRep:20,focus:86,energy:62}
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

const RD_PROJECTS = [
  {id:'food-process',name:'食品製造プロセス特許',field:'オペレーション',cost:18000000,weeks:18,effect:'unitCost',strength:.035,licenseIncome:90000},
  {id:'recommendation-ai',name:'需要予測AI特許',field:'AI',cost:26000000,weeks:22,effect:'demand',strength:.055,licenseIncome:150000},
  {id:'payment',name:'決済最適化特許',field:'FinTech',cost:22000000,weeks:20,effect:'product',strength:.045,licenseIncome:120000},
  {id:'logistics',name:'物流最適化特許',field:'物流',cost:32000000,weeks:26,effect:'unitCost',strength:.06,licenseIncome:210000},
  {id:'customer-data',name:'顧客データ分析特許',field:'マーケティング',cost:24000000,weeks:21,effect:'brand',strength:.05,licenseIncome:135000}
];

const PERSONAL_REAL_ESTATE_OFFERS = [
  {id:'studio-tokyo',name:'都心ワンルーム',prefID:'tokyo',price:18000000,weeklyRent:62000},
  {id:'commercial-osaka',name:'商業ビル区分',prefID:'osaka',price:65000000,weeklyRent:220000},
  {id:'logistics-aichi',name:'物流倉庫持分',prefID:'aichi',price:95000000,weeklyRent:310000}
];

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
  return (h >>> 0) / 4294967296;
};
const deterministicRange = (min, max, ...parts) => min + deterministicUnit(...parts) * (max - min);
const copy = v => typeof structuredClone==='function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
const sum = arr => arr.reduce((a,b)=>a+n(b),0);

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
      founderFocus:70,founderEnergy:70,founderSkillBusiness:1,founderSkillTech:1,founderSkillFinance:1,founderSkillNegotiation:1,
      founderHomeActionLog:[],localReputationByPref:{},recommendedTenantIDsFromHomeSearch:[],lastFounderHomeEventWeek:0,lastStoreHuntWeek:0,
      founderHealth:85,founderEducationLevel:50,founderNetworkLevel:40,successorReadiness:0,foundationEndowment:0,foundationReputation:0,lobbyInfluence:0,
      supplierContracts:[],inventoryByBusinessID:{},supplyChainEvents:[],autoSpotProcurement:true,verticalIntegrationAssets:[],rdProjects:[],patentRecords:[],patentLicenseIncome:0,
      customerSegmentsByBusinessID:{},marketShareByBusinessID:{},productFunnels:{},productFunnelEventLog:[],
      quarterlyStockResults:{},shareholderEventLog:[],activistCampaigns:[],ownershipHistory:[],stockSplitHistory:[],founderShareSaleHistory:[],
      startupFundingHistory:{},startupQuarterlyReports:{},ventureForumEvents:[],
      peDeals:[],peRealizedPL:0,angelInvestments:[],personalRealEstateHoldings:[],
      sportsDraftCandidates:[],sportsTradeMarket:[],sportsSaleOffers:[],lastSportsMarketWeek:0,
      weeklyNewspaper:[],majorBusinessNews:[],luxuryAuctionListings:[],lastNewspaperWeek:0,lastAuctionWeek:0,
      successorCandidate:null,successorTrainingWeeks:0,familyTrustEstablished:false,familyTrustCash:0,familyTrustShares:0,legacyScore:0,
      serialEntrepreneurHistory:[],hallOfRecords:{highestCompanyValue:0,highestPersonalNetWorth:0,highestRevenue:0,highestProfit:0,maxStores:0,maxSubsidiaries:0,maxPropertyValue:0,maxVCMultiple:0,maxProductExit:0,maxCompanyBuyoutPrice:0,fastestIPOWeek:null,fastestTrillionWeek:null,bankruptcyCount:0},
      expandedWeeklyAdjustments:{supply:0,patents:0,personal:0,product:0,media:0},lastExpansionUpdateWeek:0
    };
    for(const [k,v] of Object.entries(defaults)){
      if(g[k]===undefined||g[k]===null)g[k]=copy(v);
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
    this.g.founderFocus=trait.focus;this.g.founderEnergy=trait.energy;this.g.founderSkillBusiness=trait.business;this.g.founderSkillTech=trait.tech;this.g.founderSkillFinance=trait.finance;this.g.founderSkillNegotiation=trait.negotiation;
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

  TycoonEngine.prototype.launchFounderHomeProduct=function(templateID){
    this.ensureExpansionDefaults();const t=FOUNDER_HOME_PRODUCTS.find(x=>x.id===templateID);if(!t)return false;
    this.refreshFounderHomeUsedSlots();if(this.g.founderHomeUsedSlots>=this.g.founderHomeDeskSlots)return this.fail('作業机の空きがありません。自宅をアップグレードしてください。');
    const cost=t.cost/(this.g.founderSkillTech||1);if(this.g.companyCash<cost)return this.fail(`開発には${Math.round(cost).toLocaleString()}円が必要です。`);
    this.g.companyCash-=cost;
    const product={id:uid(),blueprintID:t.id,name:t.name,category:t.category,status:'developing',progress:0,weeksToLaunch:t.weeks,quality:18+this.g.founderSkillTech*5,brand:4+this.g.localReputationByPref[this.g.founderHomePrefID]/10,users:0,paidUsers:0,price:t.price,serverCost:t.serverCost,market:t.market,risk:t.risk,valuation:cost,revenue:0,cost:0,profit:0,origin:'founderHome',releaseWeek:null,serverCapacity:5000};
    this.g.productVentures.push(product);this.ensureProductFunnel(product);this.refreshFounderHomeUsedSlots();this.g.founderEnergy=clamp(this.g.founderEnergy-10,0,100);
    this.g.founderHomeActionLog.unshift(`第${this.g.week}週：実家PCで「${t.name}」の開発を開始。`);this.notify(`${t.name}の個人開発を開始しました。`,'success');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.founderHomeAction=function(action){
    this.ensureExpansionDefaults();const g=this.g,prefID=g.founderHomePrefID;
    const log=text=>{g.founderHomeActionLog.unshift(`第${g.week}週：${text}`);g.founderHomeActionLog=g.founderHomeActionLog.slice(0,80);};
    if(action==='storeHunt'){
      const candidates=g.tenants.filter(t=>t.prefID===prefID&&!t.occupiedBy).sort((a,b)=>b.traffic-a.traffic).slice(0,3);
      g.recommendedTenantIDsFromHomeSearch=candidates.map(x=>x.id);g.lastStoreHuntWeek=g.week;g.founderEnergy=clamp(g.founderEnergy-7,0,100);g.localReputationByPref[prefID]=clamp(n(g.localReputationByPref[prefID])+1.2,0,100);log(`地元を歩き、${candidates.length}件の有望テナントを発見。`);
    } else if(action==='studyBusiness'){g.founderSkillBusiness=clamp(g.founderSkillBusiness+.035,1,3);g.founderFocus=clamp(g.founderFocus-5,0,100);g.founderEducationLevel=clamp(g.founderEducationLevel+.8,0,100);log('経営書を読み、経営スキルが上昇。');
    } else if(action==='studyTech'){g.founderSkillTech=clamp(g.founderSkillTech+.035,1,3);g.founderFocus=clamp(g.founderFocus-5,0,100);g.founderEducationLevel=clamp(g.founderEducationLevel+.8,0,100);log('技術学習を行い、技術スキルが上昇。');
    } else if(action==='studyFinance'){g.founderSkillFinance=clamp(g.founderSkillFinance+.035,1,3);g.founderFocus=clamp(g.founderFocus-5,0,100);g.founderEducationLevel=clamp(g.founderEducationLevel+.8,0,100);log('財務分析を学び、金融スキルが上昇。');
    } else if(action==='network'){g.founderSkillNegotiation=clamp(g.founderSkillNegotiation+.03,1,3);g.founderNetworkLevel=clamp(g.founderNetworkLevel+1.2,0,100);g.founderEnergy=clamp(g.founderEnergy-5,0,100);log('友人・先輩起業家と交流し、人脈と交渉力が上昇。');
    } else if(action==='rest'){g.founderEnergy=clamp(g.founderEnergy+18,0,100);g.founderFocus=clamp(g.founderFocus+12,0,100);g.founderHealth=clamp(g.founderHealth+2,0,100);log('休息を取り、集中力と体力を回復。');
    } else if(action==='localEvent'){
      const events=['商店街の空き店舗','地元銀行の相談会','友人の副業案件','先輩起業家の助言','地元メディア'];const e=pick(events);
      if(e==='商店街の空き店舗')return this.founderHomeAction('storeHunt');
      if(e==='地元銀行の相談会'){g.localReputationByPref[prefID]=clamp(n(g.localReputationByPref[prefID])+1.8,0,100);g.companyCredit=clamp(g.companyCredit+.8,0,100);}
      if(e==='友人の副業案件'){g.founderSkillTech=clamp(g.founderSkillTech+.03,1,3);g.personalCash+=120000;}
      if(e==='先輩起業家の助言'){g.founderSkillBusiness=clamp(g.founderSkillBusiness+.03,1,3);g.founderSkillNegotiation=clamp(g.founderSkillNegotiation+.03,1,3);}
      if(e==='地元メディア'){g.localReputationByPref[prefID]=clamp(n(g.localReputationByPref[prefID])+1,0,100);g.personalFame+=1;}
      log(`地元イベント「${e}」が発生。`);g.news.unshift(`第${g.week}週：地元イベント「${e}」が発生しました。`);
    }
    this.save();this.emit();return true;
  };

  TycoonEngine.prototype.upgradeFounderHome=function(){
    this.ensureExpansionDefaults();const costs=[0,800000,2500000,8000000,25000000,80000000,250000000,800000000],ranks=['familyHome','oneRoom','liveWorkOffice','cityApartment','luxuryCondo','mansion','executiveResidence','estate'];
    const level=clamp(Math.floor(this.g.founderHomeLevel),1,8);if(level>=8)return this.fail('自宅は最高ランクです。');const cost=costs[level];if(this.g.personalCash<cost)return this.fail(`個人資金${cost.toLocaleString()}円が必要です。`);
    this.g.personalCash-=cost;this.g.founderHomeLevel=level+1;this.g.currentFounderHomeRank=ranks[level];this.g.founderHomeDeskSlots=Math.min(6,1+Math.floor(level/2));this.g.founderHomeMonthlyCost=Math.round(cost*.003);
    this.notify(`${homeRankTitle(this.g.currentFounderHomeRank)}へアップグレードしました。`,'success');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.contractSupplier=function(offerID,businessID){
    this.ensureExpansionDefaults();const o=SUPPLIER_OFFERS.find(x=>x.id===offerID),stores=this.g.stores.filter(s=>s.businessID===businessID).length;if(!o)return false;
    if(stores<o.minStores)return this.fail(`${o.name}は同業態${o.minStores}店以上が条件です。`);if(this.g.companyCash<o.setupCost)return this.fail('契約金が不足しています。');
    const old=this.g.supplierContracts.find(x=>x.businessID===businessID&&x.active);if(old)old.active=false;this.g.companyCash-=o.setupCost;this.g.supplierContracts.push({...copy(o),contractID:uid(),businessID,active:true,startedWeek:this.g.week});
    this.notify(`${this.business(businessID)?.name||businessID}で${o.name}と契約しました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.cancelSupplier=function(contractID){const c=this.g.supplierContracts.find(x=>x.contractID===contractID);if(!c)return false;c.active=false;this.notify(`${c.name}との仕入契約を終了しました。`,'warning');this.save();this.emit();return true;};

  TycoonEngine.prototype.addVerticalIntegration=function(id){
    this.ensureExpansionDefaults();const o=VERTICAL_INTEGRATION_OFFERS.find(x=>x.id===id);if(!o)return false;if(this.g.verticalIntegrationAssets.some(x=>x.id===id&&x.active))return this.fail('導入済みです。');if(this.g.companyCash<o.cost)return this.fail('投資資金が不足しています。');
    this.g.companyCash-=o.cost;this.g.verticalIntegrationAssets.push({...copy(o),assetID:uid(),active:true,startedWeek:this.g.week,condition:100});this.notify(`サプライチェーン垂直統合「${o.name}」を開始しました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.startRDProject=function(id){
    this.ensureExpansionDefaults();const o=RD_PROJECTS.find(x=>x.id===id);if(!o)return false;if(this.g.rdProjects.some(x=>x.id===id&&x.status==='researching')||this.g.patentRecords.some(x=>x.projectID===id))return this.fail('研究済みまたは進行中です。');if(!this.g.departments.product&&!this.g.departments.dx)return this.fail('商品開発部門またはDX部門が必要です。');if(this.g.companyCash<o.cost)return this.fail('研究資金が不足しています。');
    this.g.companyCash-=o.cost;this.g.rdProjects.push({...copy(o),projectID:uid(),progress:0,status:'researching',startedWeek:this.g.week});this.notify(`${o.name}の研究を開始しました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.licensePatent=function(id){const p=this.g.patentRecords.find(x=>x.id===id);if(!p)return false;p.licensed=!p.licensed;this.notify(`${p.name}のライセンス提供を${p.licensed?'開始':'停止'}しました。`);this.save();this.emit();return true;};

  TycoonEngine.prototype.ensureProductFunnel=function(product){
    if(!product?.id)return null;this.g.productFunnels=this.g.productFunnels||{};if(!this.g.productFunnels[product.id])this.g.productFunnels[product.id]={productID:product.id,awareness:.03,registeredUsers:n(product.users),monthlyActiveUsers:n(product.users)*.55,paidUsers:n(product.paidUsers),conversionRate:.025,churnRate:.08,arpu:n(product.price,1000),serverLoad:0,supportBurden:.1,b2bContracts:0,lastUpdatedWeek:this.g.week};return this.g.productFunnels[product.id];
  };
  TycoonEngine.prototype.productFunnelAction=function(productID,action){
    const p=this.g.productVentures.find(x=>x.id===productID);if(!p||p.status!=='released')return this.fail('公開中のプロダクトが必要です。');const f=this.ensureProductFunnel(p),solo=p.origin==='founderHome';
    const spec={ads:[solo?80000:1500000,'companyCash'],ux:[solo?60000:2000000,'companyCash'],server:[solo?50000:1200000,'companyCash'],b2b:[solo?120000:2500000,'companyCash']}[action];if(!spec)return false;if(this.g[spec[1]]<spec[0])return this.fail('資金が不足しています。');this.g[spec[1]]-=spec[0];
    if(action==='ads')f.awareness=clamp(f.awareness+(solo?.03:.045),0,1);if(action==='ux'){f.conversionRate=clamp(f.conversionRate+(solo?.004:.006),.003,.7);f.churnRate=clamp(f.churnRate-(solo?.002:.003),.003,.28);}if(action==='server'){p.serverCapacity=n(p.serverCapacity,5000)*1.45;f.serverLoad=clamp(f.serverLoad-.18,0,2);f.supportBurden=clamp(f.supportBurden-.03,0,1.5);}if(action==='b2b'){f.b2bContracts+=1;f.arpu*=1.015;}
    this.notify(`${p.name}で顧客ファネル施策を実行しました。`,'success');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.stockSplit=function(stockID,ratio=2){
    const s=this.stock(stockID);if(!s||ratio<2)return false;if(stockID===this.g.ticker&&!this.g.publicCompany)return this.fail('自社は未上場です。');s.price/=ratio;s.previous/=ratio;s.issuedShares*=ratio;s.priceHistory=(s.priceHistory||[]).map(x=>x/ratio);
    for(const key of ['companyStocks','personalStocks'])if(this.g[key][stockID]){this.g[key][stockID].qty*=ratio;this.g[key][stockID].avg/=ratio;}
    if(stockID===this.g.ticker){this.g.stockPrice/=ratio;this.g.sharesOut*=ratio;this.g.founderShares*=ratio;this.g.treasuryBuybackShares*=ratio;}
    this.g.stockSplitHistory.unshift({week:this.g.week,stockID,ratio});this.notify(`${s.name}が1:${ratio}の株式分割を実施しました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.sellFounderShares=function(qty){
    qty=Math.max(0,Math.floor(qty));if(!this.g.publicCompany||qty<1||qty>this.g.founderShares)return this.fail('売却可能株数を確認してください。');const proceeds=qty*this.g.stockPrice*.995;this.g.founderShares-=qty;this.g.personalCash+=proceeds;this.g.founderShareSaleHistory.unshift({week:this.g.week,qty,price:this.g.stockPrice,proceeds});this.updateOwnershipRatios();this.notify(`創業者保有株${qty.toLocaleString()}株を売却しました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.executeMBO=function(stockID){
    const s=this.stock(stockID),h=this.g.companyStocks[stockID];if(!s||!h||h.qty/s.issuedShares<.5)return this.fail('会社口座で過半数保有が必要です。');const remaining=s.issuedShares-h.qty,cost=remaining*s.price*1.25;if(this.g.companyCash<cost)return this.fail('MBO資金が不足しています。');this.g.companyCash-=cost;this.g.companyStocks[stockID].qty=s.issuedShares;s.privateCompany=true;s.suspended=true;this.notify(`${s.name}のMBOを成立させました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.activateDefense=function(kind){
    if(!this.g.publicCompany)return this.fail('自社が上場していません。');const costs={poisonPill:12000000,whiteKnight:25000000,irCampaign:6000000},cost=costs[kind]||6000000;if(this.g.companyCash<cost)return this.fail('防衛資金が不足しています。');this.g.companyCash-=cost;const reduction={poisonPill:.05,whiteKnight:.09,irCampaign:.025}[kind]||.025;this.g.competitorOwnedRatio=clamp(this.g.competitorOwnedRatio-reduction,0,.49);this.g.companyReputation=clamp(this.g.companyReputation+(kind==='irCampaign'?2:0),0,100);this.g.shareholderEventLog.unshift(`第${this.g.week}週：買収防衛策「${kind}」を実行。`);this.notify('買収防衛策を実行しました。','success');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.createPEDeal=function(industry,amount){
    amount=Math.max(1000000,n(amount));if(this.g.personalCash<amount)return this.fail('個人資金が不足しています。');this.g.personalCash-=amount;const names=['再生工業','地域サービス','成長テック','老舗フーズ','物流ソリューション'];this.g.peDeals.push({id:uid(),targetName:`${industry||pick(names)} ${Math.floor(rand(10,99))}`,industry:industry||'テック',acquiredWeek:this.g.week,investedAmount:amount,ownershipRatio:rand(.55,.9),improvementScore:20,currentValuation:amount*rand(.9,1.15),holdingWeeks:0,status:'active'});this.notify('PE案件を組成しました。','success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.improvePEDeal=function(id){const d=this.g.peDeals.find(x=>x.id===id&&x.status==='active');if(!d)return false;const cost=Math.max(500000,d.investedAmount*.02);if(this.g.personalCash<cost)return this.fail('個人資金が不足しています。');this.g.personalCash-=cost;d.improvementScore=clamp(d.improvementScore+6,0,100);d.currentValuation*=1.05;this.notify(`${d.targetName}で改善施策を実行しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.exitPEDeal=function(id){const d=this.g.peDeals.find(x=>x.id===id&&x.status==='active');if(!d)return false;this.g.personalCash+=d.currentValuation;this.g.peRealizedPL+=d.currentValuation-d.investedAmount;d.status='exited';this.notify(`${d.targetName}をEXITしました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.createAngelInvestment=function(amount){amount=Math.max(500000,n(amount));if(this.g.personalCash<amount)return this.fail('個人資金が不足しています。');this.g.personalCash-=amount;this.g.angelInvestments.push({id:uid(),startupName:`スタートアップ${this.g.week}-${Math.floor(rand(10,99))}`,investedAmount:amount,week:this.g.week,multiple:1,status:'active'});this.notify('エンジェル投資を実行しました。','success');this.save();this.emit();return true;};
  TycoonEngine.prototype.exitAngelInvestment=function(id){const a=this.g.angelInvestments.find(x=>x.id===id&&x.status==='active');if(!a)return false;this.g.personalCash+=a.investedAmount*a.multiple;a.status='exited';this.notify(`${a.startupName}をEXITしました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.buyPersonalRealEstate=function(id){const o=PERSONAL_REAL_ESTATE_OFFERS.find(x=>x.id===id);if(!o||this.g.personalCash<o.price)return this.fail('個人資金が不足しています。');this.g.personalCash-=o.price;this.g.personalRealEstateHoldings.push({...copy(o),assetID:uid(),purchasePrice:o.price,currentValue:o.price,purchasedWeek:this.g.week,status:'owned'});this.notify(`${o.name}を個人で購入しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.sellPersonalRealEstate=function(id){const a=this.g.personalRealEstateHoldings.find(x=>x.assetID===id&&x.status==='owned');if(!a)return false;this.g.personalCash+=a.currentValue;a.status='sold';a.soldWeek=this.g.week;a.salePrice=a.currentValue;this.notify(`${a.name}を売却しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.investFounder=function(kind){const specs={health:[500000,8],education:[800000,6],network:[600000,7],successor:[700000,5],foundation:[5000000,1],lobby:[4000000,1]},s=specs[kind];if(!s||this.g.personalCash<s[0])return this.fail('個人資金が不足しています。');this.g.personalCash-=s[0];if(kind==='health')this.g.founderHealth=clamp(this.g.founderHealth+s[1],0,100);if(kind==='education')this.g.founderEducationLevel=clamp(this.g.founderEducationLevel+s[1],0,100);if(kind==='network')this.g.founderNetworkLevel=clamp(this.g.founderNetworkLevel+s[1],0,100);if(kind==='successor')this.g.successorReadiness=clamp(this.g.successorReadiness+s[1],0,100);if(kind==='foundation'){this.g.foundationEndowment+=s[0];this.g.foundationReputation=clamp(this.g.foundationReputation+s[0]/5000000,0,100);}if(kind==='lobby')this.g.lobbyInfluence=clamp(this.g.lobbyInfluence+s[0]/4000000,0,100);this.save();this.emit();return true;};

  TycoonEngine.prototype.refreshSportsMarket=function(){
    const positions=['投手','捕手','内野手','外野手','FW','MF','DF','GK'];const surnames=['佐藤','鈴木','高橋','田中','山本','中村','小林','加藤'];this.g.sportsDraftCandidates=Array.from({length:6},()=>({id:uid(),name:`${pick(surnames)} ${Math.floor(rand(10,99))}`,position:pick(positions),potential:rand(48,92),expectedSalary:rand(8000000,65000000)}));this.g.sportsTradeMarket=Array.from({length:6},()=>({id:uid(),playerName:`${pick(surnames)} ${Math.floor(rand(10,99))}`,position:pick(positions),askingPrice:rand(20000000,180000000),rating:rand(52,90)}));this.g.lastSportsMarketWeek=this.g.week;this.save();this.emit();return true;
  };
  TycoonEngine.prototype.draftPlayer=function(teamID,candidateID){const t=this.g.sportsTeams.find(x=>x.id===teamID),c=this.g.sportsDraftCandidates.find(x=>x.id===candidateID);if(!t||!c)return false;const cashKey=t.owner==='company'?'companyCash':'personalCash';if(this.g[cashKey]<c.expectedSalary)return this.fail('契約資金が不足しています。');this.g[cashKey]-=c.expectedSalary;if(t.owner==='company')finance.event(this.g,'payroll',c.expectedSalary,{cashEffect:-c.expectedSalary,profitEffect:-c.expectedSalary,sourceType:'draftPlayer',sourceID:`${teamID}-${candidateID}`,description:'球団選手契約金'});t.teamStrength=clamp(t.teamStrength+c.potential/35,0,100);t.roster=(t.roster||[]);t.roster.push(c);this.g.sportsDraftCandidates=this.g.sportsDraftCandidates.filter(x=>x.id!==candidateID);this.notify(`${t.name}が${c.name}を指名しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.tradePlayer=function(teamID,assetID){const t=this.g.sportsTeams.find(x=>x.id===teamID),a=this.g.sportsTradeMarket.find(x=>x.id===assetID);if(!t||!a)return false;const cashKey=t.owner==='company'?'companyCash':'personalCash';if(this.g[cashKey]<a.askingPrice)return this.fail('獲得資金が不足しています。');this.g[cashKey]-=a.askingPrice;if(t.owner==='company')finance.event(this.g,'otherOperating',a.askingPrice,{cashEffect:-a.askingPrice,profitEffect:-a.askingPrice,sourceType:'tradePlayer',sourceID:`${teamID}-${assetID}`,description:'球団トレード獲得費'});t.teamStrength=clamp(t.teamStrength+a.rating/28,0,100);t.roster=(t.roster||[]);t.roster.push(a);this.g.sportsTradeMarket=this.g.sportsTradeMarket.filter(x=>x.id!==assetID);this.notify(`${t.name}が${a.playerName}をトレード獲得しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.signForeignPlayer=function(teamID){const t=this.g.sportsTeams.find(x=>x.id===teamID);if(!t)return false;const cost=rand(50000000,220000000),cashKey=t.owner==='company'?'companyCash':'personalCash';if(this.g[cashKey]<cost)return this.fail('補強資金が不足しています。');this.g[cashKey]-=cost;if(t.owner==='company')finance.event(this.g,'otherOperating',cost,{cashEffect:-cost,profitEffect:-cost,sourceType:'signForeignPlayer',sourceID:teamID,description:'球団外国人補強費'});t.teamStrength=clamp(t.teamStrength+rand(3,8),0,100);this.notify(`${t.name}が外国人選手を補強しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.toggleTeamSale=function(teamID){const t=this.g.sportsTeams.find(x=>x.id===teamID);if(!t)return false;t.saleListed=!t.saleListed;this.save();this.emit();return true;};
  TycoonEngine.prototype.acceptTeamSaleOffer=function(id){const o=this.g.sportsSaleOffers.find(x=>x.id===id&&x.status==='pending'),t=o&&this.g.sportsTeams.find(x=>x.id===o.teamID);if(!o||!t)return false;this.g[t.owner==='company'?'companyCash':'personalCash']+=o.price;if(t.owner==='company')finance.event(this.g,'assetSale',o.price,{cashEffect:o.price,assetEffect:-Number(t.purchasePrice||t.price)||0,profitEffect:o.price-Number(t.purchasePrice||t.price)||0,sourceType:'acceptTeamSaleOffer',sourceID:id,description:`${t.name} 球団売却オファー承諾`});this.g.sportsTeams=this.g.sportsTeams.filter(x=>x.id!==t.id);o.status='accepted';this.notify(`${t.name}を${Math.round(o.price).toLocaleString()}円で売却しました。`,'success');this.save();this.emit();return true;};

  TycoonEngine.prototype.attendVentureForum=function(id){const e=this.g.ventureForumEvents.find(x=>x.id===id&&x.status==='open');if(!e)return false;if(this.g.personalCash<e.fee)return this.fail('参加費が不足しています。');this.g.personalCash-=e.fee;this.g.founderNetworkLevel=clamp(this.g.founderNetworkLevel+e.networkGain,0,100);this.g.companyReputation=clamp(this.g.companyReputation+e.repGain,0,100);e.status='attended';this.notify(`${e.name}へ参加しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.bidLuxuryAuction=function(id){const x=this.g.luxuryAuctionListings.find(x=>x.id===id&&x.status==='open');if(!x)return false;const price=x.currentBid*1.08;if(this.g.personalCash<price)return this.fail('個人資金が不足しています。');this.g.personalCash-=price;x.status='won';this.g.luxuryAssets.push({id:uid(),name:x.name,category:x.category,purchasePrice:price,currentValue:price,maintenancePerWeek:price*.00015,rarity:x.rarity,statusEffect:'名声・人脈',purchasedWeek:this.g.week});this.g.personalFame+=x.rarity;this.notify(`${x.name}を落札しました。`,'success');this.save();this.emit();return true;};

  TycoonEngine.prototype.appointSuccessor=function(id){const c=SUCCESSOR_CANDIDATES.find(x=>x.id===id);if(!c)return false;if(this.g.personalCash<c.cost)return this.fail('育成・契約費が不足しています。');this.g.personalCash-=c.cost;this.g.successorCandidate={...copy(c),skill:c.baseSkill,readiness:10,appointedWeek:this.g.week};this.g.successorReadiness=Math.max(this.g.successorReadiness,10);this.notify(`${c.name}を後継者候補に指名しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.trainSuccessorExpanded=function(){if(!this.g.successorCandidate)return this.fail('後継者候補を指名してください。');const cost=1500000;if(this.g.personalCash<cost)return this.fail('個人資金が不足しています。');this.g.personalCash-=cost;this.g.successorCandidate.readiness=clamp(this.g.successorCandidate.readiness+6,0,100);this.g.successorCandidate.skill=clamp(this.g.successorCandidate.skill+2,0,100);this.g.successorReadiness=this.g.successorCandidate.readiness;this.g.successorTrainingWeeks+=1;this.save();this.emit();return true;};
  TycoonEngine.prototype.establishFamilyTrust=function(){if(this.g.familyTrustEstablished)return false;const cost=10000000;if(this.g.personalCash<cost)return this.fail('設立費用が不足しています。');this.g.personalCash-=cost;this.g.familyTrustEstablished=true;this.g.familyTrustCash=cost;this.notify('ファミリートラストを設立しました。','success');this.save();this.emit();return true;};
  TycoonEngine.prototype.transferToFamilyTrust=function(amount){amount=Math.max(0,n(amount));if(!this.g.familyTrustEstablished||this.g.personalCash<amount)return this.fail('移管条件を満たしていません。');this.g.personalCash-=amount;this.g.familyTrustCash+=amount;this.save();this.emit();return true;};
  TycoonEngine.prototype.executeSuccession=function(){if(!this.g.successorCandidate||this.g.successorCandidate.readiness<70)return this.fail('後継者の準備度70以上が必要です。');this.g.founderGeneration+=1;this.g.founderAge=Math.max(27,Math.floor(rand(30,45)));this.g.playerName=this.g.successorCandidate.name;this.g.founderName=this.g.successorCandidate.name;this.g.serialEntrepreneurHistory.push({week:this.g.week,companyName:this.g.companyName,value:this.companyValue(),generation:this.g.founderGeneration-1});this.g.successorCandidate=null;this.g.successorReadiness=0;this.notify(`第${this.g.founderGeneration}世代へ経営承継しました。`,'success');this.save();this.emit();return true;};

  TycoonEngine.prototype.updateFounderExpandedWeekly=function(){
    const g=this.g;const storeLoad=clamp(g.stores.length/220,0,.6);g.founderHealth=clamp(g.founderHealth-.15-storeLoad,0,100);g.founderEducationLevel=clamp(g.founderEducationLevel-.02,0,100);g.founderNetworkLevel=clamp(g.founderNetworkLevel-.01,0,100);g.founderEnergy=clamp(g.founderEnergy+2,0,100);g.founderFocus=clamp(g.founderFocus+1,0,100);
    if(g.week%4===0)g.personalCash-=g.founderHomeMonthlyCost;
    const value=this.personalNetWorth();const ranks=value>=1e10?'estate':value>=3e9?'executiveResidence':value>=1e9?'mansion':value>=3e8?'luxuryCondo':value>=1e8?'cityApartment':value>=3e7?'liveWorkOffice':value>=1e7?'oneRoom':'familyHome';g.currentFounderHomeRank=ranks;
  };

  TycoonEngine.prototype.updateSupplyChainWeekly=function(){
    const g=this.g;let adjustment=0;const events=[];
    for(const b of g.businesses){if(globalThis.__capitalismTycoonModules?.supply?.isTargetBusinessID?.(b.id))continue;const stores=g.stores.filter(s=>s.businessID===b.id&&s.status==='open'),units=sum(stores.map(s=>s.lastSales/Math.max(1,b.price)));if(!stores.length)continue;const inv=g.inventoryByBusinessID[b.id];inv.lastDemandUnits=units;const contract=g.supplierContracts.find(x=>x.businessID===b.id&&x.active);
      if(contract){g.companyCash-=contract.weeklyFee;adjustment-=contract.weeklyFee;const baseCOGS=units*b.unitCost;const savings=baseCOGS*contract.discount;g.companyCash+=savings;adjustment+=savings;b.quality=clamp(b.quality+contract.quality*.002,0,100);if(Math.random()>contract.reliability){inv.disruptionWeeks=Math.max(inv.disruptionWeeks,Math.floor(rand(1,4)));events.push(`${contract.name}で供給遅延が発生。`);}}
      else if(g.autoSpotProcurement){const premium=units*b.unitCost*.03;g.companyCash-=premium;adjustment-=premium;}
      const target=units*inv.targetWeeks;inv.units=clamp(inv.units+Math.max(0,target-inv.units)-units,0,target*2);inv.lastProcurementCost=units*b.unitCost;
      if(inv.disruptionWeeks>0){const shortage=clamp(.12+Math.random()*.22,0,.45),lostMargin=sum(stores.map(s=>Math.max(0,s.lastSales)*shortage*Math.max(.12,1-b.unitCost/Math.max(1,b.price))));g.companyCash-=lostMargin;adjustment-=lostMargin;for(const s of stores){s.lastSales*=1-shortage;s.lastProfit-=lostMargin/stores.length;}inv.disruptionWeeks--;events.push(`${b.name}で欠品が発生し、機会損失${Math.round(lostMargin).toLocaleString()}円。`);}
      const marketDemand=Math.max(1,b.demand*stores.length*1.8);g.marketShareByBusinessID[b.id]=clamp(units/marketDemand,0,1);
    }
    for(const a of g.verticalIntegrationAssets.filter(x=>x.active)){g.companyCash-=a.weeklyCost;adjustment-=a.weeklyCost;const affected=g.stores.filter(s=>a.businessID==='all'||s.businessID===a.businessID);const cogs=sum(affected.map(s=>{const b=this.business(s.businessID);return s.lastSales/Math.max(1,b.price)*b.unitCost;}));const saving=cogs*a.costReduction;g.companyCash+=saving;adjustment+=saving;const assetKey=a.assetID||a.id||a.name;a.condition=clamp(a.condition-deterministicRange(.02,.25,'vertical-condition',assetKey,g.week),50,100);if(deterministicUnit('vertical-incident',assetKey,g.week)<a.risk*.01){const loss=a.cost*.01;g.companyCash-=loss;adjustment-=loss;events.push(`${a.name}で品質・供給トラブル。修繕費${Math.round(loss).toLocaleString()}円。`);}}
    g.supplyChainEvents=[...events.map(x=>`第${g.week}週：${x}`),...g.supplyChainEvents].slice(0,100);g.news.unshift(...events.map(x=>`第${g.week}週：${x}`));return adjustment;
  };

  TycoonEngine.prototype.updateRDWeekly=function(){
    const g=this.g;let adjustment=0;for(const p of g.rdProjects.filter(x=>x.status==='researching')){const speed=100/p.weeks*(.7+this.departmentEffect('product')*.2+this.departmentEffect('dx')*.2+n(g.founderSkillTech)*.1);p.progress=clamp(p.progress+speed,0,100);if(p.progress>=100){p.status='completed';g.patentRecords.push({id:uid(),projectID:p.id,name:p.name,field:p.field,effect:p.effect,strength:p.strength,licenseIncome:p.licenseIncome,licensed:false,completedWeek:g.week});g.news.unshift(`第${g.week}週：R&D「${p.name}」が特許化されました。`);}}
    for(const p of g.patentRecords){if(p.licensed){g.companyCash+=p.licenseIncome;adjustment+=p.licenseIncome;}if(p.effect==='unitCost')for(const b of g.businesses)b.efficiency=clamp(b.efficiency+p.strength*.01,0,100);if(p.effect==='brand')for(const b of g.businesses)b.brand=clamp(b.brand+p.strength*.008,0,100);}
    g.patentLicenseIncome=sum(g.patentRecords.filter(x=>x.licensed).map(x=>x.licenseIncome));return adjustment;
  };

  TycoonEngine.prototype.updateProductFunnelsWeekly=function(){
    const g=this.g;let adjustment=0,salesAdjustment=0,expenseAdjustment=0;
    for(const p of g.productVentures){const f=this.ensureProductFunnel(p);if(p.status!=='released')continue;const oldRevenue=n(p.revenue),oldCost=n(p.cost),solo=p.origin==='founderHome';if(!p.releaseWeek)p.releaseWeek=g.week;
      const quality=clamp(p.quality,0,100),brand=clamp(p.brand,0,100),growth=clamp(brand/950+quality/1250+n(g.founderSkillTech)*.002-p.risk*.01,.003,solo?.07:.095);f.awareness=clamp(f.awareness+growth*(solo?.16:.12)-f.churnRate*.012,.01,1);const newUsers=Math.min(solo?550:25000,Math.max(8,p.market*f.awareness*growth/(solo?1800:1250)));f.registeredUsers=clamp(f.registeredUsers*(1-f.churnRate/5)+newUsers,0,solo?1200000:80000000);f.monthlyActiveUsers=f.registeredUsers*clamp(.35+quality/320-f.supportBurden*.07,.22,solo?.66:.82);f.conversionRate=clamp(f.conversionRate+(quality-50)/52000,.003,p.category==='EC'?.7:.18);f.paidUsers=f.monthlyActiveUsers*f.conversionRate;f.serverLoad=clamp(f.monthlyActiveUsers/Math.max(1000,n(p.serverCapacity,solo?5000:25000)),0,2);f.supportBurden=clamp(f.supportBurden+f.serverLoad*.007-.008,0,1.5);f.churnRate=clamp(.085-quality/2200+f.serverLoad*.01,.005,.25);if((p.category.includes('SaaS')||p.category.includes('FinTech'))&&quality>=50&&Math.random()<.04)f.b2bContracts+=1;
      const sub=f.paidUsers*Math.max(50,f.arpu)/4.33,ads=f.monthlyActiveUsers*(20+quality*.45)/4.33,b2b=f.b2bContracts*Math.max(10000,f.arpu*2)/4.33;const revenue=p.category==='EC'?ads*.2+sub*.5+f.monthlyActiveUsers*Math.max(18,f.arpu*.035)/4.33:p.category==='ゲーム'?ads*.65+sub:p.category.includes('SaaS')||p.category.includes('FinTech')?sub+b2b:sub+ads*.15;const server=(solo?3500:18000)+f.monthlyActiveUsers*n(p.serverCost,20000)/Math.max(1,p.market)*25+Math.max(0,f.serverLoad-1)*50000;const support=Math.max(0,f.monthlyActiveUsers-(solo?650:1800))*(solo?1.8:6.5)*(.3+f.supportBurden);const maintenance=Math.max(2500,n(p.valuation)* (solo?.0008:.0018));const payment=revenue*.035;const cost=server+support+maintenance+payment;
      p.users=Math.floor(f.registeredUsers);p.paidUsers=Math.floor(f.paidUsers);p.revenue=revenue;p.cost=cost;p.profit=revenue-cost;p.valuation=Math.max(1000000,p.valuation*(1+clamp(p.profit/Math.max(1,p.valuation),-.05,.08))+newUsers*200);f.lastUpdatedWeek=g.week;
      const delta=(revenue-cost)-(oldRevenue-oldCost);g.companyCash+=delta;adjustment+=delta;salesAdjustment+=revenue-oldRevenue;expenseAdjustment+=cost-oldCost;if(f.serverLoad>1.15&&Math.random()<.08){f.churnRate=clamp(f.churnRate+.004,.003,.28);const text=`${p.name}のサーバー負荷が高く、解約率が悪化。`;g.productFunnelEventLog.unshift(`第${g.week}週：${text}`);g.news.unshift(`第${g.week}週：${text}`);}}
    return {adjustment,salesAdjustment,expenseAdjustment};
  };

  TycoonEngine.prototype.updatePersonalExpandedWeekly=function(){
    const g=this.g;let adjustment=0;for(const d of g.peDeals.filter(x=>x.status==='active')){d.holdingWeeks++;d.currentValuation=Math.max(d.investedAmount*.25,d.currentValuation*(1+rand(-.012,.025)+d.improvementScore/50000));}
    for(const a of g.angelInvestments.filter(x=>x.status==='active')){const event=Math.random();a.multiple=clamp(a.multiple*(event<.02?1.9:event>.98?.55:rand(.98,1.03)),.1,20);}
    for(const x of g.personalRealEstateHoldings.filter(x=>x.status==='owned')){const cycle=clamp((g.realEstateCycle+g.economy)/2,.7,1.4);x.currentValue=clamp(x.currentValue*(1.0005+(cycle-1)*.05),x.purchasePrice*.5,x.purchasePrice*6);x.weeklyRent=clamp(x.weeklyRent*(1+(cycle-1)*.03),x.purchasePrice*.0003,x.purchasePrice*.004);g.personalCash+=x.weeklyRent;adjustment+=x.weeklyRent;}
    if(g.familyTrustEstablished){const r=g.familyTrustCash*.0004;g.familyTrustCash+=r;}
    return adjustment;
  };

  TycoonEngine.prototype.updateSportsExpandedWeekly=function(){
    const g=this.g;if(g.sportsTeams.length&&!g.sportsDraftCandidates.length)this.refreshSportsMarket();if(g.week-g.lastSportsMarketWeek>=13)this.refreshSportsMarket();for(const t of g.sportsTeams){t.roster=t.roster||[];t.teamStrength=clamp(t.teamStrength+rand(-.25,.35),10,100);if(t.saleListed&&!g.sportsSaleOffers.some(x=>x.teamID===t.id&&x.status==='pending')&&Math.random()<.08)g.sportsSaleOffers.push({id:uid(),teamID:t.id,buyer:`投資家グループ${Math.floor(rand(10,99))}`,price:t.value*rand(.95,1.35),status:'pending',expiresWeek:g.week+8});}g.sportsSaleOffers.forEach(x=>{if(x.status==='pending'&&x.expiresWeek<g.week)x.status='expired';});
  };

  TycoonEngine.prototype.generateMediaWeekly=function(){
    const g=this.g;if(g.week-g.lastNewspaperWeek>=4){g.lastNewspaperWeek=g.week;const r=g.lastReport||{};const articles=[{category:'企業',title:`${g.companyName}、第${g.week}週の利益${Math.round(n(r.profit)).toLocaleString()}円`,detail:`直営${g.stores.length}店、企業価値${Math.round(this.companyValue()).toLocaleString()}円。`},{category:'市場',title:`景気指数${g.economy.toFixed(2)}、政策金利${(g.policyRate*100).toFixed(2)}%`,detail:g.macroCrisis?`${g.macroCrisis.kind}が継続中。`:'大きなマクロ危機は確認されていない。'},{category:'競合',title:'競争環境アップデート',detail:g.competitorEvents[0]||'主要競合は通常運転。'}];g.weeklyNewspaper.unshift({id:uid(),week:g.week,name:`TYCOON WEEKLY 第${g.week}号`,articles});g.weeklyNewspaper=g.weeklyNewspaper.slice(0,52);}
    if(Math.random()<.035){const item={id:uid(),week:g.week,title:pick(['AI投資が加速','物流再編の波','消費者の節約志向','M&A市場が活況','人材獲得競争が激化']),impact:rand(-.04,.06),detail:'市場環境と企業戦略に影響する大型ニュース。'};g.majorBusinessNews.unshift(item);g.majorBusinessNews=g.majorBusinessNews.slice(0,80);g.economy=clamp(g.economy+item.impact,.72,1.28);g.news.unshift(`第${g.week}週：大型ニュース「${item.title}」`);}
    if(g.ventureForumEvents.filter(x=>x.status==='open'&&x.expiresWeek>=g.week).length<2&&Math.random()<.08)g.ventureForumEvents.push({id:uid(),name:pick(['東京スタートアップフォーラム','地域金融イノベーション会議','SaaS経営者サミット','グローバルVCデモデー']),fee:rand(100000,800000),networkGain:rand(2,6),repGain:rand(.5,2),status:'open',expiresWeek:g.week+12});g.ventureForumEvents.forEach(x=>{if(x.status==='open'&&x.expiresWeek<g.week)x.status='expired';});
    if(g.week-g.lastAuctionWeek>=8){g.lastAuctionWeek=g.week;g.luxuryAuctionListings=LUXURY_AUCTION_POOL.sort(()=>Math.random()-.5).slice(0,3).map(x=>({id:uid(),...copy(x),currentBid:x.basePrice*rand(.8,1.25),status:'open',expiresWeek:g.week+8}));}
  };

  TycoonEngine.prototype.updateCapitalMarketsExpandedWeekly=function(){
    const g=this.g;if(g.week%13===0){for(const s of g.market){const revenue=s.marketCap*rand(.04,.12),profit=revenue*rand(.03,.24),eps=profit/Math.max(1,s.issuedShares);g.quarterlyStockResults[s.id].unshift({week:g.week,revenue,profit,eps,price:s.price});g.quarterlyStockResults[s.id]=g.quarterlyStockResults[s.id].slice(0,12);}for(const st of g.startups){g.startupQuarterlyReports[st.id].unshift({week:g.week,valuation:st.valuation,runwayWeeks:st.runwayWeeks,growth:st.growth,risk:st.risk});g.startupQuarterlyReports[st.id]=g.startupQuarterlyReports[st.id].slice(0,12);}}
    for(const st of g.startups){const hist=g.startupFundingHistory[st.id];if(st.fundingOpen&&!hist.some(x=>x.openedWeek===g.week))hist.unshift({id:uid(),stage:st.fundingRound||st.stage,openedWeek:g.week,valuation:st.valuation,status:'open'});const latest=hist.find(x=>x.status==='open');if(latest&&!st.fundingOpen){latest.status='closed';latest.closedWeek=g.week;latest.postMoney=st.valuation;}}
    if(g.publicCompany){g.ownershipHistory.push({week:g.week,founder:g.founderOwnershipRatio,external:g.externalShareholderRatio,competitor:g.competitorOwnedRatio});g.ownershipHistory=g.ownershipHistory.slice(-260);if(g.founderOwnershipRatio<.5&&g.competitorOwnedRatio>.1&&!g.activistCampaigns.some(x=>x.status==='active')&&Math.random()<.04){const c={id:uid(),investorName:'アクティビスト・キャピタル',demand:pick(['不採算事業売却','増配','自社株買い','経営陣刷新']),createdWeek:g.week,expiresWeek:g.week+16,pressure:rand(.2,.7),status:'active'};g.activistCampaigns.unshift(c);g.shareholderEventLog.unshift(`第${g.week}週：${c.investorName}が「${c.demand}」を要求。`);g.news.unshift(`第${g.week}週：アクティビスト株主が経営改善を要求しています。`);}}
  };

  TycoonEngine.prototype.updateSuccessionWeekly=function(){const g=this.g;if(g.successorCandidate){g.successorCandidate.readiness=clamp(g.successorCandidate.readiness+.05+n(g.successorCandidate.skill)/2500,0,100);g.successorReadiness=g.successorCandidate.readiness;}g.legacyScore=Math.round(this.companyValue()/10000000+this.personalNetWorth()/10000000+g.foundationReputation*2+g.founderGeneration*50);};
  TycoonEngine.prototype.updateHallOfRecords=function(){const g=this.g,h=g.hallOfRecords,r=g.lastReport||{};h.highestCompanyValue=Math.max(h.highestCompanyValue,this.companyValue());h.highestPersonalNetWorth=Math.max(h.highestPersonalNetWorth,this.personalNetWorth());h.highestRevenue=Math.max(h.highestRevenue,n(r.sales));h.highestProfit=Math.max(h.highestProfit,n(r.profit));h.maxStores=Math.max(h.maxStores,g.stores.length);h.maxSubsidiaries=Math.max(h.maxSubsidiaries,g.subsidiaries.length+g.maSubsidiaries.length);h.maxPropertyValue=Math.max(h.maxPropertyValue,sum(g.properties.filter(x=>x.owner).map(x=>x.value)));h.maxVCMultiple=Math.max(h.maxVCMultiple,...g.angelInvestments.map(x=>x.multiple),0);if(g.publicCompany&&h.fastestIPOWeek===null)h.fastestIPOWeek=g.week;if(this.companyValue()>=1e12&&h.fastestTrillionWeek===null)h.fastestTrillionWeek=g.week;};

  const baseCompanyValue=TycoonEngine.prototype.companyValue;
  TycoonEngine.prototype.companyValue=function(){const base=baseCompanyValue.call(this),vertical=sum((this.g.verticalIntegrationAssets||[]).filter(x=>x.active).map(x=>x.cost*.65)),patents=sum((this.g.patentRecords||[]).map(x=>x.licenseIncome*52*5));return Math.max(0,base+vertical+patents);};
  const basePersonalNetWorth=TycoonEngine.prototype.personalNetWorth;
  TycoonEngine.prototype.personalNetWorth=function(){const base=basePersonalNetWorth.call(this),pe=sum((this.g.peDeals||[]).filter(x=>x.status==='active').map(x=>x.currentValuation)),angel=sum((this.g.angelInvestments||[]).filter(x=>x.status==='active').map(x=>x.investedAmount*x.multiple)),realEstate=sum((this.g.personalRealEstateHoldings||[]).filter(x=>x.status==='owned').map(x=>x.currentValue)),trust=n(this.g.familyTrustCash);return Math.max(0,base+pe+angel+realEstate+trust);};

  const baseAdvance=TycoonEngine.prototype.advanceWeek;
  TycoonEngine.prototype.advanceWeek=function(showSummary=true){return this.runTransaction(()=>{
    const result=baseAdvance.call(this,false);if(!result)return result;this.ensureExpansionDefaults();if(this.g.lastExpansionUpdateWeek===this.g.week)return result;this.g.lastExpansionUpdateWeek=this.g.week;
    this.updateFounderExpandedWeekly();const supply=this.g.isCompanySold?0:this.updateSupplyChainWeekly();const patents=this.g.isCompanySold?0:this.updateRDWeekly();const product=this.g.isCompanySold?{adjustment:0,salesAdjustment:0,expenseAdjustment:0}:this.updateProductFunnelsWeekly();const personal=this.updatePersonalExpandedWeekly();this.updateSportsExpandedWeekly();this.generateMediaWeekly();this.updateCapitalMarketsExpandedWeekly();this.updateSuccessionWeekly();this.updateHallOfRecords();
    this.g.expandedWeeklyAdjustments={supply,patents,personal,product:product.adjustment,media:0};
    if(this.g.lastReport&&!this.g.isCompanySold){this.g.lastReport.sales=n(this.g.lastReport.sales)+product.salesAdjustment;this.g.lastReport.expenses=n(this.g.lastReport.expenses)+product.expenseAdjustment-supply-patents;this.g.lastReport.profit=n(this.g.lastReport.profit)+supply+patents+product.adjustment;const idx=this.g.reports.findIndex(x=>x.week===this.g.lastReport.week);if(idx>=0)this.g.reports[idx]=copy(this.g.lastReport);}const fin=globalThis.__capitalismTycoonModules?.finance;if(fin&&!this.g.isCompanySold){const amount=supply+patents+product.adjustment;if(amount){fin.event(this.g,'otherOperating',Math.abs(amount),{cashEffect:amount,profitEffect:amount,sourceType:'expansionWeeklyAdjustment',sourceID:`${this.g.week}`,idempotencyKey:`week-${this.g.week}-expansion-adjustment`,operationID:`week-${this.g.week}-expansion-adjustment`,description:'拡張週次調整'});}const snap=this.g.finance?.weeklySnapshots?.find(s=>s.week===this.g.week);if(snap)fin.recordSnapshot(this.g,snap.openingCash,this.g.week,this.g.companyCash);fin.validate(this.g);}
    this.recordExpandedHistory();const summary={...(this.g.lastReport||{}),week:this.g.week,companyCash:this.g.companyCash,companyValue:this.companyValue(),personalNetWorth:this.personalNetWorth(),newNews:this.g.news.slice(0,5),expandedAdjustments:copy(this.g.expandedWeeklyAdjustments)};this.g.lastWeeklySummary=summary;return result;
  },'week',()=>({summary:showSummary?this.g.lastWeeklySummary:null}));};

  TycoonEngine.prototype.recordExpandedHistory=function(){const g=this.g;if(g.companyValueHistory.length){g.companyValueHistory[g.companyValueHistory.length-1]=this.companyValue();g.personalNetWorthHistory[g.personalNetWorthHistory.length-1]=this.personalNetWorth();if(g.lastReport){g.weeklySalesHistory[g.weeklySalesHistory.length-1]=g.lastReport.sales;g.weeklyProfitHistory[g.weeklyProfitHistory.length-1]=g.lastReport.profit;}}};
}

Object.assign(exports,{FOUNDER_TRAITS,FOUNDER_HOME_PRODUCTS,SUPPLIER_OFFERS,VERTICAL_INTEGRATION_OFFERS,RD_PROJECTS,PERSONAL_REAL_ESTATE_OFFERS,LUXURY_AUCTION_POOL,SUCCESSOR_CANDIDATES,installExpansion});
})(__modules.expansion={});

})();
