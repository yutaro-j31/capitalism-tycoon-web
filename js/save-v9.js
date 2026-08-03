// Phase 5B-3C extension: explicit saveVersion 9 migration for competitor lifecycle data.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before save-v9.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before save-v9.js.');
if(!modules.finance)throw new Error('finance.js must be loaded before save-v9.js.');
if(!modules.competitor?.__creditInstalled)throw new Error('competitor-credit.js must be loaded before save-v9.js.');
if(modules.engine.__saveV9Installed)throw new Error('save version 9 migration is already installed.');

const engine=modules.engine;
const finance=modules.finance;
const competitor=modules.competitor;
const BaseTycoonEngine=engine.TycoonEngine;
const baseMigrateSave=engine.migrateSave;
const baseCreateInitialState=engine.createInitialState;
const baseValidateMigratedState=engine.validateMigratedState;
const LEGACY_SAVE_VERSION=engine.SAVE_VERSION;
const SAVE_VERSION=9;
const SAVE_KEY=engine.SAVE_KEY;
const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
const plain=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const round=value=>Math.round(finite(value)*100)/100;

const OPERATING_CATEGORIES=new Set(['revenue','costOfSales','payroll','rent','advertising','researchAndDevelopment','maintenance','headOfficeExpense','interestExpense','taxPayment','otherOperating','workingCapitalIncrease','workingCapitalDecrease','accountsReceivableCollection','accountsPayablePayment','accruedExpensePayment']);
const INVESTING_CATEGORIES=new Set(['capitalExpenditure','assetPurchase','assetSale','investmentPurchase','investmentSale','investmentDividend','acquisition','otherInvesting']);
const FINANCING_CATEGORIES=new Set(['debtBorrowing','debtRepayment','equityFinancing','dividend','otherFinancing']);
const TRANSACTION_SOFT_LIMIT=5000;
const TRANSACTION_COMPACT_TARGET=4500;

function archiveCompletedTransactions(ledger,rows){
 if(!rows.length)return;
 ledger.archivedProfitTotal=round(finite(ledger.archivedProfitTotal)+rows.reduce((sum,row)=>sum+finite(row.profitEffect),0));
 ledger.archivedDividendTotal=round(finite(ledger.archivedDividendTotal)-rows.filter(row=>row.category==='dividend').reduce((sum,row)=>sum+finite(row.cashEffect),0));
 ledger.archivedOperatingCashFlow=round(finite(ledger.archivedOperatingCashFlow)+rows.filter(row=>OPERATING_CATEGORIES.has(row.category)).reduce((sum,row)=>sum+finite(row.cashEffect),0));
 ledger.archivedInvestingCashFlow=round(finite(ledger.archivedInvestingCashFlow)+rows.filter(row=>INVESTING_CATEGORIES.has(row.category)).reduce((sum,row)=>sum+finite(row.cashEffect),0));
 ledger.archivedFinancingCashFlow=round(finite(ledger.archivedFinancingCashFlow)+rows.filter(row=>FINANCING_CATEGORIES.has(row.category)).reduce((sum,row)=>sum+finite(row.cashEffect),0));
}
function compactCompletedTransactionWeeks(ledger,incomingWeek){
 const rows=Array.isArray(ledger.transactions)?ledger.transactions:[];
 if(rows.length<TRANSACTION_SOFT_LIMIT)return 0;
 const currentWeek=Math.max(1,Math.floor(finite(incomingWeek,rows.at(-1)?.week||1)));
 const desiredRemoval=Math.max(1,rows.length-TRANSACTION_COMPACT_TARGET);
 let removeCount=0;
 while(removeCount<rows.length&&removeCount<desiredRemoval&&Math.floor(finite(rows[removeCount]?.week,currentWeek))<currentWeek)removeCount+=1;
 if(removeCount===0)return 0;
 const boundaryWeek=Math.floor(finite(rows[removeCount-1]?.week,currentWeek));
 while(removeCount<rows.length&&Math.floor(finite(rows[removeCount]?.week,currentWeek))===boundaryWeek)removeCount+=1;
 const removed=rows.slice(0,removeCount);
 archiveCompletedTransactions(ledger,removed);
 ledger.transactions=rows.slice(removeCount);
 return removeCount;
}
function installFinanceTransactionRetentionGuard(){
 if(finance.__completedWeekCompressionInstalled)return true;
 const baseEvent=finance.event;
 finance.event=function guardedFinanceEvent(g,category,amount,opts={}){
  const ledger=finance.ensureFinance(g);
  const incomingWeek=Math.max(1,Math.floor(finite(opts?.week,g?.week||1)));
  compactCompletedTransactionWeeks(ledger,incomingWeek);
  return baseEvent.apply(this,arguments);
 };
 Object.assign(finance,{compactCompletedTransactionWeeks,__completedWeekCompressionInstalled:true});
 return true;
}

function detectSaveVersion(raw){
 if(!plain(raw))return {ok:false,version:null,error:'セーブデータのルートはオブジェクトである必要があります。'};
 if(!('saveVersion' in raw)||raw.saveVersion===undefined||raw.saveVersion===null||raw.saveVersion==='')return {ok:true,version:0,legacy:true};
 const version=Number(raw.saveVersion);
 if(!Number.isInteger(version))return {ok:false,version:null,error:`saveVersionが整数ではありません: ${raw.saveVersion}`};
 if(version<0)return {ok:false,version,error:`saveVersionが負数です: ${version}`};
 if(version>SAVE_VERSION)return {ok:false,version,future:true,error:`このゲームより新しいsaveVersion ${version} のセーブです。現在対応しているのは ${SAVE_VERSION} までです。`};
 return {ok:true,version};
}
function stampV9(state){
 state.saveVersion=SAVE_VERSION;
 state.competitorMigrationV9Applied=true;
 state.competitorLifecycleSchemaVersion=1;
 return state;
}
function sanitizeBusinessRecords(state){
 if(!plain(state)||!Array.isArray(state.businesses))return state;
 state.businesses=state.businesses.filter(business=>plain(business)&&typeof business.id==='string'&&business.id.trim().length>0);
 return state;
}
function upgradeState(state){
 sanitizeBusinessRecords(state);
 competitor.ensure(state);
 if(typeof competitor.ensureCounterStates==='function')competitor.ensureCounterStates(state);
 return stampV9(state);
}
function downgradeForBase(state){const copy=clone(state);copy.saveVersion=LEGACY_SAVE_VERSION;return copy;}
function validateMigratedState(state){
 const detected=detectSaveVersion(state);
 if(!detected.ok)return {ok:false,errors:[detected.error]};
 const source=detected.version===SAVE_VERSION?downgradeForBase(state):state;
 return baseValidateMigratedState(source);
}
function migrateV8ToV9(rawState){
 const detected=detectSaveVersion(rawState);
 if(!detected.ok)return {ok:false,state:null,version:detected.version,errors:[detected.error]};
 if(detected.version!==LEGACY_SAVE_VERSION)return {ok:false,state:null,version:detected.version,errors:[`saveVersion ${LEGACY_SAVE_VERSION} からのみv9へ直接移行できます。`]};
 const migrated=baseMigrateSave(rawState);
 if(!migrated.ok)return {ok:false,state:null,version:detected.version,errors:migrated.errors||['セーブデータ移行に失敗しました。']};
 return {ok:true,state:upgradeState(clone(migrated.state)),version:SAVE_VERSION,errors:[]};
}
function migrateSave(rawState){
 const detected=detectSaveVersion(rawState);
 if(!detected.ok)return {ok:false,state:null,version:detected.version,errors:[detected.error]};
 try{
  if(detected.version===SAVE_VERSION){
   const state=upgradeState(clone(rawState));
   const validation=validateMigratedState(state);
   if(!validation.ok)return {ok:false,state:null,version:SAVE_VERSION,errors:validation.errors};
   return {ok:true,state,version:SAVE_VERSION,errors:[]};
  }
  const migrated=baseMigrateSave(rawState);
  if(!migrated.ok)return {ok:false,state:null,version:detected.version,errors:migrated.errors||['セーブデータ移行に失敗しました。']};
  return {ok:true,state:upgradeState(clone(migrated.state)),version:SAVE_VERSION,errors:[]};
 }catch(error){return {ok:false,state:null,version:detected.version,errors:[error?.message||String(error)]};}
}
function createInitialState(options={}){return upgradeState(baseCreateInitialState(options));}

class TycoonEngineV9 extends BaseTycoonEngine{
 constructor(state=null){
  if(state===null){
   super(null);
   upgradeState(this.g);
   return;
  }
  const prepared=migrateSave(state);
  if(!prepared.ok)throw new Error(`Save migration failed: ${prepared.errors.join('; ')}`);
  super(downgradeForBase(prepared.state));
  this.g=prepared.state;
  this.normalize();
 }
 static load(){
  try{
   const raw=localStorage.getItem(SAVE_KEY);
   if(!raw)return new TycoonEngineV9(null);
   const migrated=migrateSave(JSON.parse(raw));
   if(!migrated.ok)throw new Error(`Save migration failed: ${migrated.errors.join('; ')}`);
   return new TycoonEngineV9(migrated.state);
  }catch(error){
   console.error('Save load failed',error);
   const fallback=new TycoonEngineV9(null);
   fallback._saveBlockedDueToLoadFailure=true;
   fallback._loadFailureReason=error?.message||String(error);
   return fallback;
  }
 }
 normalize(){
  super.normalize();
  upgradeState(this.g);
  return this.g;
 }
 save(slot=null){
  sanitizeBusinessRecords(this.g);
  stampV9(this.g);
  return super.save(slot);
 }
 reset(){
  const settings=this.g.settings;
  this.g=createInitialState({configured:false});
  this.g.settings=settings;
  this._saveBlockedDueToLoadFailure=false;
  this._loadFailureReason='';
  this.save();this.emit();
 }
 loadSlot(slot){
  const raw=localStorage.getItem(`${SAVE_KEY}_slot_${slot}`);
  if(!raw)return false;
  try{
   const migrated=migrateSave(JSON.parse(raw));
   if(!migrated.ok){console.error('Slot save migration failed',migrated.errors);return false;}
   this.g=migrated.state;
   this._saveBlockedDueToLoadFailure=false;
   this._loadFailureReason='';
   this.normalize();this.save();this.emit();return true;
  }catch(error){console.error('Slot save migration failed',error);return false;}
 }
 importSave(text){
  const migrated=migrateSave(JSON.parse(text));
  if(!migrated.ok)throw new Error(migrated.errors.join(' / ')||'セーブデータ形式が不正です。');
  this.g=migrated.state;
  this._saveBlockedDueToLoadFailure=false;
  this._loadFailureReason='';
  this.normalize();this.save();this.emit();
 }
 executeIPO(market='東証グロース',sellShares=100000){
  if(this.g.publicCompany||this.ipoMissingReasons().length)return super.executeIPO(market,sellShares);
  const multiple=market==='東証プライム'?1.25:market==='東証スタンダード'?1.1:1;
  const projectedStockPrice=Math.max(100,this.companyValue()*multiple/Math.max(1,this.g.sharesOut));
  const companyRaise=projectedStockPrice*200000*.955;
  const operationID=`parent-ipo-${this.g.week}`;
  const ledger=finance.ensureFinance(this.g);
  const exists=(ledger.transactions||[]).some(row=>row.operationID===operationID||row.idempotencyKey===operationID);
  if(!exists){
   finance.event(this.g,'equityFinancing',companyRaise,{cashEffect:companyRaise,equityEffect:companyRaise,sourceType:'parentCompanyIPO',sourceID:operationID,idempotencyKey:operationID,operationID,description:`${market} 親会社IPO公募増資`});
   ledger.balances.capitalSurplus=finite(ledger.balances.capitalSurplus)+companyRaise;
  }
  return super.executeIPO(market,sellShares);
 }
}

installFinanceTransactionRetentionGuard();
Object.assign(engine,{SAVE_VERSION,createInitialState,detectSaveVersion,validateMigratedState,migrateSave,migrateV8ToV9,sanitizeBusinessRecords,TycoonEngine:TycoonEngineV9,__saveV9Installed:true,__parentIPOFinanceInstalled:true,__parentIPOEquityBalanceInstalled:true});
})();
