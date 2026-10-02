// Script boundary: js/semantic-hash-v2.js (classic JavaScript)
// GF-009: canonical economic-state projection. This is deliberately an allowlist rather than a
// save checksum; adding a new production state root requires an economic-semantics review here.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('Capitalism Tycoon runtime.js must be loaded before semantic-hash-v2.js.');
if(modules.semanticHashV2)throw new Error('Capitalism Tycoon semanticHashV2 module is already registered.');
const VERSION=2,PROJECTION_ID='economic-state-v2';
const ROOT_KEYS=Object.freeze([
  'saveVersion','configured','week','month','season','difficulty','scenario','economy','policyRate','inflation','exchangeRate','realEstateCycle','macroCrisis','economicFoundation','simulationRng',
  'companyCash','personalCash','companyDebt','personalDebt','companyCredit','finance','bankFinancing','scheduledPayments','companyStocks','personalStocks','personalInvestments','realizedCompanyStockPL','realizedPersonalStockPL',
  'sharesOut','founderShares','treasuryBuybackShares','externalShareholderRatio','competitorOwnedRatio','publicCompany','stockPrice','ipoPrice','dividendPerShare','investorOffers','tenderOffers','shareholderProposals','activistCapitalUseHistory',
  'companyHQPrefID','founderHomePrefID','businesses','stores','inventoryByStoreID','purchaseOrders','supplySettingsByStoreID','supplyResultsByBusinessID','supplyResultsByStoreID','workforceSettings','workforceCandidates','workforceTeams','workforceTrainings','workforceProjects','workforceResultsByDepartmentID','workforceResultsByStoreID','departments','departmentStaff','departmentCampaigns','executives','cxoExecutives','executiveMarket','executiveDirectives',
  'properties','tenants','rentalOffices','realEstateDevelopment','contractedOfficeID','officeCapacity','officeFloors','officeLevel','officePrestige','officeWeeklyCost','hasHeadOffice','goodwillRecords','internalVentureProposals','internalVentures','internalVentureBusinessHistory','internalVentureBusinessVersion','productVentures','productEvents','productBuyoutOffers','formalProductLaunchCount','productExitCount','researchProjects','commercializationProjects','newBusinessAnalysis','newBusinessResearch','researchAssets',
  'subsidiaries','subsidiaryFundingHistory','subsidiaryFundingVersion','maSubsidiaries','overseasSubsidiaries','acquisitionTargets','startups','peDeals','peFirm','peFunds','peRivals','peNetwork','microcapMarket','sportsTeams','luxuryAssets',
  'competitorStates','competitorProjects','competitorActions','competitorCounterStates','competitorEvents','competitorMarketStrategy','competitorSettings','competitors','competitorLifecycleSchemaVersion','competitorMigrationV8Applied','competitorMigrationV9Applied',
  'franchiseQualityByBusinessID','franchiseRoyaltyRateByBusinessID','franchiseStoresByBusinessID','franchiseTrustByBusinessID','market','marketResultsByBusinessID','marketResultsByStoreID','currentCompanyFoundedInvestment','totalAcquisitions','totalImpairmentLoss','totalMAGain','benefitLevel','complianceLevel','organizationCulture','remoteWorkEnabled','wageLevel','employeeAbility','employeeSatisfaction','esgScore','companyReputation','globalPrestige','personalFame','boardEstablished','boardAgendas','autoManage','autoManageStyle','autoExecutiveManagementEnabled','gameOver','isCompanySold',
  'history','companyValueHistory','personalNetWorthHistory','weeklyProfitHistory','weeklySalesHistory','competitorPerformanceHistoryByID','competitorPresenceHistoryByID','rivalResponseHistory',
  'nextCandidateSeq','nextCompetitorActionSeq','nextCompetitorInvestmentSeq','nextCompetitorPresenceSeq','nextCompetitorProjectSeq','nextCompetitorStateSeq','nextInventoryLotSeq','nextProjectSeq','nextPurchaseOrderSeq','nextSupplyEventSeq','nextTrainingSeq','nextWorkforceEventSeq','nextWorkforceTeamSeq'
]);
const DISPLAY_KEYS=new Set(['name','displayName','companyName','playerName','ticker','title','description','label','message','text','icon','color','image','imageUrl','activistName']);
// These are entity sets: production looks them up by durable identity, not array position.
const SET_ARRAY_KEYS=new Set(['businesses','stores','properties','tenants','rentalOffices','purchaseOrders','workforceCandidates','workforceTeams','workforceTrainings','workforceProjects','departments','departmentStaff','executives','cxoExecutives','executiveMarket','internalVentureProposals','internalVentures','productVentures','researchProjects','commercializationProjects','subsidiaries','maSubsidiaries','overseasSubsidiaries','acquisitionTargets','startups','peDeals','peFunds','peRivals','sportsTeams','competitorStates','competitorProjects','competitorCounterStates','competitors','marketPresence','loans']);
const ID_KEYS=Object.freeze(['id','transactionID','dealID','projectID','propertyID','storeID','tenantID','presenceID','competitorID','businessID','candidateID','teamID','loanID','fundID','startupID','subsidiaryID','sourceID']);
function compare(a,b){const x=String(a),y=String(b);return x<y?-1:x>y?1:0;}
function identity(value){if(!value||typeof value!=='object')return null;for(const key of ID_KEYS)if(value[key]!==undefined&&value[key]!==null)return `${key}:${String(value[key])}`;return null;}
function projectValue(value,key){
  if(Array.isArray(value)){
    const rows=value.map(entry=>projectValue(entry,''));
    if(SET_ARRAY_KEYS.has(key)&&rows.every(row=>identity(row)!==null))rows.sort((a,b)=>compare(identity(a),identity(b)));
    return rows;
  }
  if(!value||typeof value!=='object')return value;
  const out={};
  for(const childKey of Object.keys(value).sort(compare))if(!DISPLAY_KEYS.has(childKey))out[childKey]=projectValue(value[childKey],childKey);
  return out;
}
function semanticProjectionV2(state){
  if(!state||typeof state!=='object'||Array.isArray(state))throw new TypeError('semanticProjectionV2 requires a state object.');
  const out={};
  for(const key of ROOT_KEYS)if(Object.prototype.hasOwnProperty.call(state,key))out[key]=projectValue(state[key],key);
  return out;
}
// Typed length-prefixed encoding makes undefined, null, non-finite numbers and user strings
// collision-safe. Object keys use code-unit order; order-semantic arrays remain in source order.
function canonicalSerializeV2(value){
  if(value===undefined)return'U';if(value===null)return'L';
  const type=typeof value;
  if(type==='number'){if(Number.isNaN(value))return'N:NaN';if(value===Infinity)return'N:+Infinity';if(value===-Infinity)return'N:-Infinity';if(Object.is(value,-0))return'N:-0';return`N:${String(value)}`;}
  if(type==='string')return`S${value.length}:${value}`;if(type==='boolean')return value?'B1':'B0';
  if(Array.isArray(value))return`A${value.length}:[${value.map(canonicalSerializeV2).join('')}]`;
  if(type==='object'){const keys=Object.keys(value).sort(compare);return`O${keys.length}:{${keys.map(key=>`${canonicalSerializeV2(key)}${canonicalSerializeV2(value[key])}`).join('')}}`;}
  throw new TypeError(`Unsupported semantic value type: ${type}`);
}
function hashSerializedV2(serialized){let h1=0x811c9dc5|0,h2=0x9e3779b9|0;for(let i=0;i<serialized.length;i++){const code=serialized.charCodeAt(i);h1=((h1<<5)-h1+code)|0;h2=((h2<<7)-h2+(code^i))|0;}return`${(h1>>>0).toString(16).padStart(8,'0')}${(h2>>>0).toString(16).padStart(8,'0')}`;}
function semanticSerializedV2(state){return canonicalSerializeV2(semanticProjectionV2(state));}
function semanticHashV2(state){return hashSerializedV2(semanticSerializedV2(state));}
modules.semanticHashV2=Object.freeze({VERSION,PROJECTION_ID,ROOT_KEYS,SET_ARRAY_KEYS,semanticProjectionV2,canonicalSerializeV2,semanticSerializedV2,hashSerializedV2,semanticHashV2,stableCompare:compare});
})();
