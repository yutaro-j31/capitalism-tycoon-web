// Script boundary: js/completion.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before completion.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.completion)throw new Error('Capitalism Tycoon completion module is already registered.');
(function(exports){
// Completion layer: web equivalents for the remaining high-impact Swift systems.
// Installed after expansion.js so it can safely extend the same save state.

const cxNum = (v,f=0) => Number.isFinite(Number(v)) ? Number(v) : f;
const cxClamp = (v,min,max) => Math.max(min,Math.min(max,cxNum(v,min)));
const cxRand = (min,max) => min + Math.random()*(max-min);
const cxPick = arr => arr[Math.floor(Math.random()*arr.length)];
const cxUID = () => globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const cxCopy = v => typeof structuredClone==='function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
const cxSum = arr => arr.reduce((a,b)=>a+cxNum(b),0);

const MEDIA_ACTIONS = [
  {id:'press',name:'記者会見',cost:2500000,weeks:1,rep:3,fame:2,heat:-.12,detail:'経営方針を説明し、企業評判と創業者知名度を上げる。'},
  {id:'social',name:'SNSキャンペーン',cost:1200000,weeks:4,rep:1.5,fame:3,heat:.10,detail:'認知を伸ばす一方、炎上リスクも少し上がる。'},
  {id:'crisis',name:'危機対応広報',cost:5000000,weeks:2,rep:2,fame:.5,heat:-.35,detail:'炎上・赤字・不祥事への説明を強化する。'},
  {id:'ir',name:'IRロードショー',cost:8000000,weeks:6,rep:4,fame:1,heat:-.05,detail:'株主信頼と資本市場評価を高める。'}
];

const TRANSPORT_REBUILD_ACTIONS = [
  {id:'digital',name:'運行・配車DX',costRate:.045,weeks:10,growth:.025,margin:.018,detail:'配車・運行計画をデータ化し収益性を改善。'},
  {id:'fleet',name:'車両・設備更新',costRate:.075,weeks:16,growth:.018,margin:.028,detail:'老朽設備を更新し安定性と利益率を改善。'},
  {id:'network',name:'路線・拠点再編',costRate:.11,weeks:22,growth:.045,margin:.012,detail:'不採算網を整理し成長地域へ再配置。'}
];

const ENDING_DEFS = [
  {id:'listed_founder',title:'上場企業創業者',icon:'📈',detail:'自社IPOを達成した。',check:(g,e)=>g.publicCompany},
  {id:'conglomerate',title:'コングロマリット王',icon:'🏙️',detail:'子会社を5社以上保有した。',check:(g,e)=>(g.subsidiaries.length+g.maSubsidiaries.length)>=5},
  {id:'global_tycoon',title:'世界的タイクーン',icon:'🌏',detail:'企業価値1兆円を達成した。',check:(g,e)=>e.companyValue()>=1e12},
  {id:'capital_king',title:'資本の王',icon:'👑',detail:'個人純資産1兆円を達成した。',check:(g,e)=>e.personalNetWorth()>=1e12},
  {id:'philanthropist',title:'社会的レガシー',icon:'🏛️',detail:'財団評価80以上・基金10億円以上。',check:(g,e)=>g.foundationReputation>=80&&g.foundationEndowment>=1e9},
  {id:'serial_founder',title:'連続起業家',icon:'🔥',detail:'3社以上を創業・EXITした。',check:(g,e)=>(g.pastCompanyRecords||[]).length>=2&&g.currentCompanySerial>=3}
];

function installCompletion(TycoonEngine){
  if(TycoonEngine.prototype.__completionInstalled)return;
  TycoonEngine.prototype.__completionInstalled=true;

  TycoonEngine.prototype.ensureCompletionDefaults=function(){
    const g=this.g;
    const defaults={
      completionVersion:3,
      branchOffices:[],employeeComplaintLog:[],overtimeRisk:.18,lastEmployeeComplaintWeek:0,lastWorkforceUpdateWeek:0,
      campusMilestoneIDs:[],transportRebuildProjects:[],transportRebuildLog:[],
      mediaCampaigns:[],mediaActionLog:[],socialMediaReputation:10,socialMediaHeat:0,shareholderTrust:50,
      inboundBuyoutOffers:[],lastInboundBuyoutOfferWeek:0,companyBuyoutHistory:[],
      pastCompanyRecords:[],serialCompanyCount:1,currentCompanySerial:1,currentCompanyFoundedWeek:1,lastNewCompanyFoundingWeek:0,
      endingRecords:[],playerTitles:[],equippedTitleID:null,
      lastCompletionUpdateWeek:0,lastProductOfferGenerationWeek:0
    };
    for(const [k,v] of Object.entries(defaults))if(g[k]===undefined||g[k]===null)g[k]=cxCopy(v);
    g.branchOffices=(g.branchOffices||[]).filter(Boolean);
    g.employeeComplaintLog=(g.employeeComplaintLog||[]).filter(Boolean).slice(0,100);
    g.productBuyoutOffers=(g.productBuyoutOffers||[]).filter(Boolean).slice(0,30);
    g.inboundBuyoutOffers=(g.inboundBuyoutOffers||[]).filter(Boolean).slice(0,12);
    if(!g.currentCompanyFoundedWeek)g.currentCompanyFoundedWeek=1;
    return g;
  };

  const baseNormalize=TycoonEngine.prototype.normalize;
  TycoonEngine.prototype.normalize=function(){baseNormalize.call(this);this.ensureCompletionDefaults();};

  const baseConfigure=TycoonEngine.prototype.configure;
  TycoonEngine.prototype.configure=function(options={}){
    return this.runTransaction(()=>{const r=baseConfigure.call(this,options);this.ensureCompletionDefaults();this.g.currentCompanyFoundedWeek=this.g.week;this.g.currentCompanySerial=1;this.g.serialCompanyCount=1;return r;});
  };

  TycoonEngine.prototype.totalOfficeCapacity=function(){return cxNum(this.g.officeCapacity);};
  TycoonEngine.prototype.totalOfficeWeeklyCost=function(){return (this.g.hasHeadOffice?cxNum(this.g.officeWeeklyCost):0)+cxSum((this.g.branchOffices||[]).map(x=>x.rent));};
  TycoonEngine.prototype.officeEmployeeCount=function(){return cxSum(Object.values(this.g.departmentStaff||{}))+Object.keys(this.g.executives||{}).length;};

  TycoonEngine.prototype.contractBranchOffice=function(officeID){
    this.ensureCompletionDefaults();if(!this.g.hasHeadOffice)return this.fail('先に本社オフィスを契約してください。');const o=this.g.rentalOffices.find(x=>x.id===officeID);if(!o)return false;
    if(o.id===this.g.contractedOfficeID||o.contracted||this.g.branchOffices.some(x=>x.officeID===o.id))return this.fail('このオフィスは契約済みです。');
    if(this.g.companyCash<o.deposit)return this.fail('保証金が不足しています。');this.g.companyCash-=o.deposit;o.contracted=true;
    this.g.branchOffices.push({id:cxUID(),officeID:o.id,name:o.name,prefID:o.prefID,grade:o.grade,capacity:o.capacity,rent:o.rent,deposit:o.deposit,prestige:o.prestige,openedWeek:this.g.week});
    this.g.officeCapacity+=o.capacity;this.g.officePrestige+=o.prestige*.25;this.notify(`${o.name}を支社オフィスとして契約しました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.closeBranchOffice=function(id){
    const i=this.g.branchOffices.findIndex(x=>x.id===id);if(i<0)return false;const b=this.g.branchOffices[i];const used=this.officeEmployeeCount(),nextCapacity=Math.max(0,this.g.officeCapacity-b.capacity);
    if(used>nextCapacity)return this.fail('在籍人数が残る定員を超えるため解約できません。');const o=this.g.rentalOffices.find(x=>x.id===b.officeID);if(o)o.contracted=false;
    this.g.companyCash+=b.deposit*.6;this.g.officeCapacity=nextCapacity;this.g.branchOffices.splice(i,1);this.notify(`${b.name}を解約しました。`,'warning');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.officeFloorSnapshot=function(){
    this.ensureCompletionDefaults();const employees=this.officeEmployeeCount(),seats=Math.max(0,this.totalOfficeCapacity()),visible=Math.min(32,Math.round(employees*(this.g.remoteWorkEnabled?.72:1)));
    const total=Math.max(1,cxSum(Object.values(this.g.departmentStaff||{})));const shares={};for(const [k,v] of Object.entries(this.g.departmentStaff||{}))shares[k]=v/total;
    return {employees,seats,visible,morale:cxNum(this.g.organizationCulture?.morale,55),satisfaction:cxNum(this.g.employeeSatisfaction,55),overtimeRisk:cxNum(this.g.overtimeRisk),remote:Boolean(this.g.remoteWorkEnabled),shares,complaints:this.g.employeeComplaintLog.filter(x=>x.status==='open').slice(0,4)};
  };

  TycoonEngine.prototype.resolveEmployeeComplaint=function(id,approach='invest'){
    const c=this.g.employeeComplaintLog.find(x=>x.id===id&&x.status==='open');if(!c)return false;const specs={invest:[1500000,7,-.08],listen:[300000,3,-.03],strict:[0,-2,.06]},s=specs[approach]||specs.listen;
    if(this.g.companyCash<s[0])return this.fail('対応費用が不足しています。');this.g.companyCash-=s[0];this.g.employeeSatisfaction=cxClamp(this.g.employeeSatisfaction+s[1],0,100);this.g.organizationCulture.morale=cxClamp(this.g.organizationCulture.morale+s[1]*.7,0,100);this.g.overtimeRisk=cxClamp(this.g.overtimeRisk+s[2],0,1);c.status='resolved';c.resolvedWeek=this.g.week;c.approach=approach;this.notify(`社員の声「${c.text}」へ対応しました。`,'success');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.campusBuildings=function(){
    const g=this.g,items=[{id:'home',title:'実家・住居',subtitle:g.founderHomePrefName||'',icon:'🏠',category:'origin',level:g.founderHomeLevel||1,tab:'founder'}];
    const open=g.stores.filter(x=>x.status==='open');if(open.length){const first=[...open].sort((a,b)=>(a.openingWeek||0)-(b.openingWeek||0))[0];items.push({id:'first',title:'初店舗',subtitle:first.name,icon:'🏪',category:'store',level:1,tab:'business'});}
    const grouped={};for(const s of open)grouped[s.businessID]=(grouped[s.businessID]||0)+1;for(const [id,count] of Object.entries(grouped).sort((a,b)=>b[1]-a[1]).slice(0,8))items.push({id:`b-${id}`,title:this.business(id)?.name||id,subtitle:`直営${count}店`,icon:'🏬',category:'store',level:Math.min(8,count),tab:'business'});
    if(g.hasHeadOffice)items.push({id:'hq',title:'本社',subtitle:`${g.officeName}・支社${g.branchOffices.length}`,icon:'🏢',category:'hq',level:Math.min(8,1+Object.keys(g.departments).length),tab:'office'});
    const subs=g.subsidiaries.length+g.maSubsidiaries.length;if(subs)items.push({id:'subs',title:'子会社棟',subtitle:`${subs}社`,icon:'🏙️',category:'subsidiary',level:Math.min(8,subs),tab:'ma'});
    const props=g.properties.filter(x=>x.owner).length+(g.personalRealEstateHoldings||[]).filter(x=>x.status==='owned').length;if(props)items.push({id:'property',title:'不動産街区',subtitle:`${props}件`,icon:'🏘️',category:'property',level:Math.min(8,props),tab:'assets'});
    if(g.sportsTeams.length)items.push({id:'stadium',title:'スタジアム',subtitle:`球団${g.sportsTeams.length}`,icon:'🏟️',category:'sports',level:Math.min(8,g.sportsTeams.length),tab:'assets'});
    if(g.publicCompany)items.push({id:'exchange',title:'証券取引所',subtitle:g.selectedListingMarket,icon:'📈',category:'market',level:5,tab:'market'});
    return items.slice(0,24);
  };
  TycoonEngine.prototype.growthMilestones=function(){const g=this.g,stores=g.stores.filter(x=>x.status==='open').length,value=this.companyValue(),subs=g.subsidiaries.length+g.maSubsidiaries.length;return [
    {id:'origin',title:'実家起業',detail:'創業者プロフィール設定',icon:'🏠',progress:g.configured?1:.3},
    {id:'first_store',title:'初店舗',detail:'最初の店舗を開店',icon:'🏪',progress:cxClamp(stores,0,1)},
    {id:'multi_store',title:'複数店舗',detail:'直営5店以上',icon:'🏬',progress:cxClamp(stores/5,0,1)},
    {id:'office',title:'本社組織',detail:'本社・部門・人材',icon:'🏢',progress:g.hasHeadOffice?1:0},
    {id:'listed',title:'上場企業',detail:'IPOと株主対応',icon:'📈',progress:g.publicCompany?1:cxClamp(value/5e9,0,.9)},
    {id:'conglomerate',title:'コングロマリット',detail:'子会社5社以上',icon:'🏙️',progress:cxClamp(subs/5,0,1)},
    {id:'global',title:'世界企業',detail:'企業価値1兆円',icon:'🌏',progress:cxClamp(value/1e12,0,1)}
  ].map(x=>({...x,achieved:x.progress>=1}));};

  TycoonEngine.prototype.startTransportRebuild=function(subID,actionID){
    const sub=[...this.g.maSubsidiaries,...this.g.subsidiaries].find(x=>x.id===subID),a=TRANSPORT_REBUILD_ACTIONS.find(x=>x.id===actionID);if(!sub||!a)return false;
    const label=`${sub.industry||sub.domain||sub.name}`;if(!/(物流|鉄道|航空|運輸|transport|logistics)/i.test(label))return this.fail('交通・物流系子会社が対象です。');
    if(this.g.transportRebuildProjects.some(x=>x.subID===subID&&x.status==='active'))return this.fail('再編プロジェクトが進行中です。');const cost=Math.max(5000000,cxNum(sub.valuation)*a.costRate);if(this.g.companyCash<cost)return this.fail('再編資金が不足しています。');
    this.g.companyCash-=cost;this.g.transportRebuildProjects.push({id:cxUID(),subID,subName:sub.name,actionID:a.id,name:a.name,cost,weeks:a.weeks,progress:0,status:'active',growth:a.growth,margin:a.margin,startedWeek:this.g.week});this.notify(`${sub.name}で「${a.name}」を開始しました。`,'success');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.startMediaAction=function(kind){
    const a=MEDIA_ACTIONS.find(x=>x.id===kind);if(!a)return false;if(this.g.companyCash<a.cost)return this.fail('広報予算が不足しています。');this.g.companyCash-=a.cost;
    this.g.mediaCampaigns.push({id:cxUID(),...cxCopy(a),status:'active',startedWeek:this.g.week,endWeek:this.g.week+a.weeks,progress:0});this.g.mediaActionLog.unshift(`第${this.g.week}週：${a.name}を開始。`);this.notify(`${a.name}を開始しました。`,'success');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.acceptProductBuyoutOffer=function(id){
    const o=this.g.productBuyoutOffers.find(x=>x.id===id&&x.status==='pending'),i=o&&this.g.productVentures.findIndex(x=>x.id===o.productID);if(!o||i<0)return false;const p=this.g.productVentures[i];this.g.companyCash+=o.offerAmount;o.status='accepted';o.acceptedWeek=this.g.week;this.g.productVentures.splice(i,1);this.g.productExitCount++;if(this.g.hallOfRecords)this.g.hallOfRecords.maxProductExit=Math.max(cxNum(this.g.hallOfRecords.maxProductExit),o.offerAmount);this.notify(`${p.name}を${Math.round(o.offerAmount).toLocaleString()}円で売却しました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.declineProductBuyoutOffer=function(id){const o=this.g.productBuyoutOffers.find(x=>x.id===id&&x.status==='pending');if(!o)return false;o.status='declined';o.declinedWeek=this.g.week;this.notify(`${o.buyerName}からのプロダクト買収提案を拒否しました。`,'warning');this.save();this.emit();return true;};

  TycoonEngine.prototype.pendingInboundBuyoutOffers=function(){return this.g.inboundBuyoutOffers.filter(x=>x.status==='pending'&&x.expiresWeek>=this.g.week);};
  TycoonEngine.prototype.acceptInboundBuyoutOffer=function(id){
    const o=this.g.inboundBuyoutOffers.find(x=>x.id===id&&x.status==='pending');if(!o||o.expiresWeek<this.g.week)return this.fail('提案は無効または期限切れです。');
    const founderProceeds=o.offerAmount*cxClamp(this.g.founderOwnershipRatio,0,1);this.recordCurrentCompany('buyout',o.offerAmount,founderProceeds,`${o.bidderName}へ売却`);this.g.personalCash+=founderProceeds;this.g.isCompanySold=true;this.g.hasSeenCompanyBuyoutEnding=true;o.status='accepted';this.g.companyBuyoutHistory.unshift(`第${this.g.week}週：${o.bidderName}へ${Math.round(o.offerAmount).toLocaleString()}円で売却。`);if(this.g.hallOfRecords)this.g.hallOfRecords.maxCompanyBuyoutPrice=Math.max(cxNum(this.g.hallOfRecords.maxCompanyBuyoutPrice),o.offerAmount);this.notify(`${this.g.companyName}を${o.bidderName}へ売却しました。創業者受取${Math.round(founderProceeds).toLocaleString()}円。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.declineInboundBuyoutOffer=function(id){const o=this.g.inboundBuyoutOffers.find(x=>x.id===id&&x.status==='pending');if(!o)return false;o.status='declined';if(o.hostile){this.g.competitorOwnedRatio=cxClamp(this.g.competitorOwnedRatio+.025,0,.49);this.g.shareholderTrust=cxClamp(this.g.shareholderTrust-2,0,100);}this.g.companyBuyoutHistory.unshift(`第${this.g.week}週：${o.bidderName}の提案を拒否。`);this.notify(`${o.bidderName}からの買収提案を拒否しました。`,o.hostile?'warning':'info');this.save();this.emit();return true;};

  TycoonEngine.prototype.recordCurrentCompany=function(exitType,exitPrice=0,founderProceeds=0,note=''){
    this.ensureCompletionDefaults();const serial=this.g.currentCompanySerial||1;if(this.g.pastCompanyRecords.some(x=>x.companySerial===serial&&x.exitType===exitType&&x.exitedWeek===this.g.week))return;
    this.g.pastCompanyRecords.unshift({id:cxUID(),companySerial:serial,companyName:this.g.companyName,foundedWeek:this.g.currentCompanyFoundedWeek||1,exitedWeek:this.g.week,exitType,exitPrice,founderProceeds,peakCompanyValue:Math.max(this.companyValue(),exitPrice),finalStoreCount:this.g.stores.filter(x=>x.status==='open').length,finalProductCount:this.g.productVentures.length,finalSubsidiaryCount:this.g.subsidiaries.length+this.g.maSubsidiaries.length,note});this.g.pastCompanyRecords=this.g.pastCompanyRecords.slice(0,20);
  };

  TycoonEngine.prototype.foundNewCompanyAfterBuyout=function(companyName,investment,mode='store'){
    this.ensureCompletionDefaults();investment=Math.max(1000000,Math.floor(cxNum(investment)));if(!this.g.isCompanySold)return this.fail('会社売却後に利用できます。');if(this.g.personalCash<investment)return this.fail('個人資金が不足しています。');
    const old=this.g,preserved={week:old.week,month:old.month,personalCash:old.personalCash-investment,personalDebt:old.personalDebt,personalStocks:cxCopy(old.personalStocks),personalInvestments:cxCopy(old.personalInvestments),luxuryAssets:cxCopy(old.luxuryAssets),sportsTeams:cxCopy(old.sportsTeams.filter(x=>x.owner==='personal')),peDeals:cxCopy(old.peDeals),angelInvestments:cxCopy(old.angelInvestments),personalRealEstateHoldings:cxCopy(old.personalRealEstateHoldings),familyTrustEstablished:old.familyTrustEstablished,familyTrustCash:old.familyTrustCash,familyTrustShares:old.familyTrustShares,founderAge:old.founderAge,founderGeneration:old.founderGeneration,founderName:old.founderName,playerName:old.playerName,founderHomePrefID:old.founderHomePrefID,founderHomePrefName:old.founderHomePrefName,founderTraitID:old.founderTraitID,founderHomeLevel:old.founderHomeLevel,currentFounderHomeRank:old.currentFounderHomeRank,founderSkillBusiness:old.founderSkillBusiness,founderSkillTech:old.founderSkillTech,founderSkillFinance:old.founderSkillFinance,founderSkillNegotiation:old.founderSkillNegotiation,founderHealth:old.founderHealth,founderEducationLevel:old.founderEducationLevel,founderNetworkLevel:old.founderNetworkLevel,foundationEndowment:old.foundationEndowment,foundationReputation:old.foundationReputation,lobbyInfluence:old.lobbyInfluence,achievements:cxCopy(old.achievements),unlockedEndings:cxCopy(old.unlockedEndings),endingRecords:cxCopy(old.endingRecords),playerTitles:cxCopy(old.playerTitles),hallOfRecords:cxCopy(old.hallOfRecords),pastCompanyRecords:cxCopy(old.pastCompanyRecords),serialCompanyCount:Math.max(old.serialCompanyCount||1,old.currentCompanySerial||1)+1,settings:cxCopy(old.settings),news:cxCopy(old.news),history:cxCopy(old.history),market:cxCopy(old.market)};
    const fresh=(new this.constructor()).g;fresh.configured=true;fresh.companyName=(companyName||`新会社${preserved.serialCompanyCount}`).trim();fresh.playerName=preserved.playerName;fresh.companyCash=investment;fresh.week=preserved.week;fresh.month=preserved.month;fresh.personalCash=preserved.personalCash;fresh.personalDebt=preserved.personalDebt;fresh.personalStocks=preserved.personalStocks;fresh.personalInvestments=preserved.personalInvestments;fresh.luxuryAssets=preserved.luxuryAssets;fresh.sportsTeams=preserved.sportsTeams;fresh.peDeals=preserved.peDeals;fresh.angelInvestments=preserved.angelInvestments;fresh.personalRealEstateHoldings=preserved.personalRealEstateHoldings;fresh.familyTrustEstablished=preserved.familyTrustEstablished;fresh.familyTrustCash=preserved.familyTrustCash;fresh.familyTrustShares=preserved.familyTrustShares;fresh.founderAge=preserved.founderAge;fresh.founderGeneration=preserved.founderGeneration;fresh.founderName=preserved.founderName;fresh.founderHomePrefID=preserved.founderHomePrefID;fresh.founderHomePrefName=preserved.founderHomePrefName;fresh.founderTraitID=preserved.founderTraitID;fresh.founderHomeLevel=preserved.founderHomeLevel;fresh.currentFounderHomeRank=preserved.currentFounderHomeRank;fresh.founderSkillBusiness=preserved.founderSkillBusiness;fresh.founderSkillTech=preserved.founderSkillTech;fresh.founderSkillFinance=preserved.founderSkillFinance;fresh.founderSkillNegotiation=preserved.founderSkillNegotiation;fresh.founderHealth=preserved.founderHealth;fresh.founderEducationLevel=preserved.founderEducationLevel;fresh.founderNetworkLevel=preserved.founderNetworkLevel;fresh.foundationEndowment=preserved.foundationEndowment;fresh.foundationReputation=preserved.foundationReputation;fresh.lobbyInfluence=preserved.lobbyInfluence;fresh.achievements=preserved.achievements;fresh.unlockedEndings=preserved.unlockedEndings;fresh.endingRecords=preserved.endingRecords;fresh.playerTitles=preserved.playerTitles;fresh.hallOfRecords=preserved.hallOfRecords;fresh.pastCompanyRecords=preserved.pastCompanyRecords;fresh.serialCompanyCount=preserved.serialCompanyCount;fresh.currentCompanySerial=preserved.serialCompanyCount;fresh.currentCompanyFoundedWeek=preserved.week;fresh.lastNewCompanyFoundingWeek=preserved.week;fresh.settings=preserved.settings;fresh.news=[`第${preserved.week}週：売却益を元手に新会社「${fresh.companyName}」を創業しました。`,...preserved.news].slice(0,300);fresh.history=preserved.history;fresh.market=preserved.market;fresh.selectedTab='home';fresh.isCompanySold=false;fresh.hasSeenCompanyBuyoutEnding=false;fresh.gameOver=false;fresh.gameOverReason='';fresh.scenario=mode;
    this.g=fresh;this.normalize();this.ensureExpansionDefaults?.();this.ensureCompletionDefaults();this.save();this.emit();this.notify(`${fresh.companyName}を創業しました。`,'success');return true;
  };

  TycoonEngine.prototype.evaluateCompletionEndings=function(){
    for(const d of ENDING_DEFS){if(this.g.endingRecords.some(x=>x.id===d.id))continue;if(d.check(this.g,this)){const rec={id:d.id,title:d.title,icon:d.icon,detail:d.detail,week:this.g.week,companyName:this.g.companyName,companyValue:this.companyValue(),personalNetWorth:this.personalNetWorth(),stores:this.g.stores.length,subsidiaries:this.g.subsidiaries.length+this.g.maSubsidiaries.length};this.g.endingRecords.unshift(rec);if(!this.g.unlockedEndings.includes(d.id))this.g.unlockedEndings.push(d.id);if(!this.g.playerTitles.some(x=>x.id===d.id))this.g.playerTitles.push({id:d.id,name:d.title,icon:d.icon});this.g.news.unshift(`第${this.g.week}週：エンディング「${d.title}」を達成しました。`);}}
  };

  TycoonEngine.prototype.updateCompletionWeekly=function(){
    const g=this.g;let companyAdjustment=0,expenseAdjustment=0;
    // Branch offices and workforce.
    if(!g.isCompanySold){const branchCost=cxSum(g.branchOffices.map(x=>x.rent));if(branchCost){g.companyCash-=branchCost;companyAdjustment-=branchCost;expenseAdjustment+=branchCost;}
      const employees=this.officeEmployeeCount(),seats=Math.max(1,this.totalOfficeCapacity()),usage=employees/seats;g.overtimeRisk=cxClamp(.10+Math.max(0,usage-.72)*.95+(g.remoteWorkEnabled?-.08:0)+(g.employeeSatisfaction<45?.10:0),0,1);
      if(employees>0){g.employeeSatisfaction=cxClamp(g.employeeSatisfaction+(usage<.85?.05:-.12)-g.overtimeRisk*.08,0,100);g.organizationCulture.morale=cxClamp(g.organizationCulture.morale+(g.employeeSatisfaction-50)/1200-g.overtimeRisk*.05,0,100);}
      if(employees>0&&g.week-g.lastEmployeeComplaintWeek>=6&&Math.random()<cxClamp(.08+g.overtimeRisk*.28+(usage>1?.22:0),.06,.5)){const texts=usage>1?['座席が足りず集中できません','会議室が不足しています']:g.overtimeRisk>.6?['残業が常態化しています','人員配置を見直してほしい']:g.remoteWorkEnabled?['リモート手当を整備してほしい','出社日ルールが曖昧です']:['評価制度を透明にしてほしい','研修機会を増やしてほしい'];g.employeeComplaintLog.unshift({id:cxUID(),week:g.week,text:cxPick(texts),type:usage>1?'capacity':g.overtimeRisk>.6?'overtime':'culture',severity:g.overtimeRisk>.7?'high':'medium',status:'open'});g.lastEmployeeComplaintWeek=g.week;g.news.unshift(`第${g.week}週：社員の声「${g.employeeComplaintLog[0].text}」`);}
    }
    // Transport rebuild.
    for(const p of g.transportRebuildProjects.filter(x=>x.status==='active')){p.progress=cxClamp(p.progress+100/p.weeks,0,100);if(p.progress>=100){p.status='completed';p.completedWeek=g.week;const sub=[...g.maSubsidiaries,...g.subsidiaries].find(x=>x.id===p.subID);if(sub){sub.growth=cxNum(sub.growth)+p.growth;if('operatingProfit'in sub)sub.operatingProfit=cxNum(sub.operatingProfit)*(1+p.margin*5);sub.valuation=cxNum(sub.valuation)*(1+.08+p.growth);}g.transportRebuildLog.unshift(`第${g.week}週：${p.subName}の${p.name}が完了。`);g.news.unshift(`第${g.week}週：${p.subName}の交通・物流再編が完了しました。`);}}
    // Media and social reputation.
    g.socialMediaHeat=cxClamp(g.socialMediaHeat*.94,0,1);for(const c of g.mediaCampaigns.filter(x=>x.status==='active')){c.progress=cxClamp(c.progress+100/Math.max(1,c.weeks),0,100);g.companyReputation=cxClamp(g.companyReputation+c.rep/Math.max(1,c.weeks),0,100);g.personalFame=cxClamp(g.personalFame+c.fame/Math.max(1,c.weeks),0,100);g.socialMediaReputation=cxClamp(g.socialMediaReputation+c.rep*.7/Math.max(1,c.weeks),0,100);g.socialMediaHeat=cxClamp(g.socialMediaHeat+c.heat/Math.max(1,c.weeks),0,1);if(g.week>=c.endWeek||c.progress>=100){c.status='completed';g.mediaActionLog.unshift(`第${g.week}週：${c.name}が完了。`);}}
    if(g.socialMediaHeat>.72&&Math.random()<.08){g.companyReputation=cxClamp(g.companyReputation-2.5,0,100);g.socialMediaReputation=cxClamp(g.socialMediaReputation-5,0,100);g.news.unshift(`第${g.week}週：SNSで批判が拡散し、企業評判が低下しました。`);}
    // Product acquisition offers.
    g.productBuyoutOffers.forEach(x=>{if(x.status==='pending'&&x.expiresWeek<g.week)x.status='expired';});if(!g.isCompanySold&&g.week-g.lastProductOfferGenerationWeek>=8&&g.productBuyoutOffers.filter(x=>x.status==='pending').length<3){const candidates=g.productVentures.filter(p=>p.status==='released'&&p.valuation>=10000000&&!g.productBuyoutOffers.some(o=>o.productID===p.id&&o.status==='pending'));if(candidates.length&&Math.random()<.16){const p=cxPick(candidates),amount=Math.max(p.valuation,p.profit*52*8)*cxRand(1.05,1.75);g.productBuyoutOffers.unshift({id:cxUID(),productID:p.id,productName:p.name,buyerName:cxPick(['大手IT企業','海外テック企業','事業会社CVC','PEファンド']),offerAmount:amount,premium:amount/Math.max(1,p.valuation)-1,createdWeek:g.week,expiresWeek:g.week+8,status:'pending'});g.lastProductOfferGenerationWeek=g.week;g.news.unshift(`第${g.week}週：${p.name}に${Math.round(amount).toLocaleString()}円の買収提案が届きました。`);}}
    // Inbound company buyout offers.
    g.inboundBuyoutOffers.forEach(x=>{if(x.status==='pending'&&x.expiresWeek<g.week)x.status='expired';});const pending=this.pendingInboundBuyoutOffers();if(!g.isCompanySold&&pending.length<2&&g.week-g.lastInboundBuyoutOfferWeek>=40&&(g.publicCompany||this.companyValue()>=1e9)){let chance=.01+(g.publicCompany?0.006:0)+(this.companyValue()>=1e10?0.006:0)+(this.companyValue()>=1e11?0.006:0);if(Math.random()<Math.min(.035,chance)){const premium=cxRand(1.05,1.45),hostile=Math.random()<.28,bidder=cxPick([...g.competitors.map(x=>x.name),'大手投資ファンド','海外戦略ファンド','総合商社系ファンド']);g.inboundBuyoutOffers.unshift({id:cxUID(),bidderName:bidder,offerAmount:this.companyValue()*premium,premiumRate:premium,createdWeek:g.week,expiresWeek:g.week+8,hostile,status:'pending'});g.lastInboundBuyoutOfferWeek=g.week;g.news.unshift(`第${g.week}週：${bidder}から会社買収提案が届きました。`);}}
    // Campus milestones and endings.
    for(const m of this.growthMilestones().filter(x=>x.achieved)){if(!g.campusMilestoneIDs.includes(m.id)){g.campusMilestoneIDs.push(m.id);g.news.unshift(`第${g.week}週：成長マップ節目「${m.title}」達成。`);}}
    this.evaluateCompletionEndings();
    return {companyAdjustment,expenseAdjustment};
  };

  const baseAdvance=TycoonEngine.prototype.advanceWeek;
  TycoonEngine.prototype.advanceWeek=function(showSummary=true){
    return this.runTransaction(()=>{const r=baseAdvance.call(this,false);if(!r)return r;this.ensureCompletionDefaults();if(this.g.lastCompletionUpdateWeek===this.g.week)return r;this.g.lastCompletionUpdateWeek=this.g.week;
    const adj=this.updateCompletionWeekly();if(this.g.lastReport&&!this.g.isCompanySold){this.g.lastReport.expenses=cxNum(this.g.lastReport.expenses)+adj.expenseAdjustment;this.g.lastReport.profit=cxNum(this.g.lastReport.profit)+adj.companyAdjustment;const idx=this.g.reports.findIndex(x=>x.week===this.g.lastReport.week);if(idx>=0)this.g.reports[idx]=cxCopy(this.g.lastReport);if(this.g.weeklyProfitHistory.length)this.g.weeklyProfitHistory[this.g.weeklyProfitHistory.length-1]=this.g.lastReport.profit;}
    const summary={...(this.g.lastReport||{}),week:this.g.week,companyCash:this.g.companyCash,companyValue:this.companyValue(),personalNetWorth:this.personalNetWorth(),newNews:this.g.news.slice(0,5)};this.g.lastWeeklySummary=summary;return r;
    },'week',()=>({summary:showSummary?this.g.lastWeeklySummary:null}));
  };
}

Object.assign(exports,{MEDIA_ACTIONS,TRANSPORT_REBUILD_ACTIONS,ENDING_DEFS,installCompletion});
})(__modules.completion={});

})();
