// Quota-safe persistence for long-running browser saves. Keeps SAVE_KEY/saveVersion unchanged.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before save-storage.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('save-v9.js must be loaded before save-storage.js.');
if(!modules.finance?.rebuildDirtySnapshots)throw new Error('finance.js must be loaded before save-storage.js.');
if(modules.saveStorage)return;

const EngineClass=modules.engine.TycoonEngine;
const SAVE_KEY=modules.engine.SAVE_KEY;
const SAVE_VERSION=modules.engine.SAVE_VERSION;
const RAW_COMPACTION_THRESHOLD=1_250_000;
const OPERATING_CATEGORIES=new Set(['revenue','costOfSales','payroll','rent','advertising','researchAndDevelopment','maintenance','headOfficeExpense','interestExpense','taxPayment','otherOperating','workingCapitalIncrease','workingCapitalDecrease','accountsReceivableCollection','accountsPayablePayment','accruedExpensePayment']);
const INVESTING_CATEGORIES=new Set(['capitalExpenditure','assetPurchase','assetSale','investmentPurchase','investmentSale','investmentDividend','acquisition','otherInvesting']);
const FINANCING_CATEGORIES=new Set(['debtBorrowing','debtRepayment','equityFinancing','dividend','otherFinancing']);
const PROFILES=Object.freeze({
 normal:Object.freeze({transactionWeeks:78,maxTransactions:1800,weeklySnapshots:104,reports:104,weeklyHistory:260,news:160,history:260,priceHistory:260,startupReports:52}),
 emergency:Object.freeze({transactionWeeks:52,maxTransactions:900,weeklySnapshots:65,reports:52,weeklyHistory:104,news:80,history:104,priceHistory:104,startupReports:26}),
 critical:Object.freeze({transactionWeeks:26,maxTransactions:480,weeklySnapshots:52,reports:26,weeklyHistory:52,news:50,history:52,priceHistory:52,startupReports:13})
});

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const round=value=>Math.round(finite(value)*100)/100;
const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
const tail=(value,limit)=>Array.isArray(value)?value.slice(-Math.max(0,limit)):[];
const head=(value,limit)=>Array.isArray(value)?value.slice(0,Math.max(0,limit)):[];

function isQuotaError(error){
 const name=String(error?.name||'');
 const message=String(error?.message||error||'').toLowerCase();
 return name==='QuotaExceededError'||name==='NS_ERROR_DOM_QUOTA_REACHED'||Number(error?.code)===22||Number(error?.code)===1014||message.includes('quota')||message.includes('storage limit');
}

function isProtectedTransaction(row){
 const key=String(row?.idempotencyKey||'');
 return Boolean(key&&!/^week-\d+(?:-|$)/.test(key));
}

function archiveTransactions(state,profile){
 const ledger=state?.finance;
 if(!ledger||!Array.isArray(ledger.transactions))return {removed:0,kept:0};
 const transactions=ledger.transactions;
 if(!transactions.length)return {removed:0,kept:0};
 const cutoff=Math.max(1,Math.floor(finite(state.week,1))-profile.transactionWeeks+1);
 const protectedRows=transactions.filter(isProtectedTransaction);
 const recentRows=transactions.filter(row=>!isProtectedTransaction(row)&&Math.floor(finite(row?.week,0))>=cutoff).slice(-profile.maxTransactions);
 const keepSet=new Set([...protectedRows,...recentRows]);
 const kept=transactions.filter(row=>keepSet.has(row));
 const removed=transactions.filter(row=>!keepSet.has(row));
 if(!removed.length)return {removed:0,kept:kept.length};
 let profit=0,dividends=0,operating=0,investing=0,financing=0;
 for(const row of removed){
  const category=String(row?.category||'');
  const cashEffect=finite(row?.cashEffect);
  profit+=finite(row?.profitEffect);
  if(category==='dividend')dividends-=cashEffect;
  if(OPERATING_CATEGORIES.has(category))operating+=cashEffect;
  if(INVESTING_CATEGORIES.has(category))investing+=cashEffect;
  if(FINANCING_CATEGORIES.has(category))financing+=cashEffect;
 }
 ledger.archivedProfitTotal=round(finite(ledger.archivedProfitTotal)+profit);
 ledger.archivedDividendTotal=round(finite(ledger.archivedDividendTotal)+dividends);
 ledger.archivedOperatingCashFlow=round(finite(ledger.archivedOperatingCashFlow)+operating);
 ledger.archivedInvestingCashFlow=round(finite(ledger.archivedInvestingCashFlow)+investing);
 ledger.archivedFinancingCashFlow=round(finite(ledger.archivedFinancingCashFlow)+financing);
 ledger.transactions=kept;
 return {removed:removed.length,kept:kept.length};
}

function compactStateForStorage(source,profileName='normal'){
 const profile=PROFILES[profileName]||PROFILES.normal;
 const state=clone(source);
 state.saveVersion=SAVE_VERSION;
 state.reports=tail(state.reports,profile.reports);
 state.weeklySalesHistory=tail(state.weeklySalesHistory,profile.weeklyHistory);
 state.weeklyProfitHistory=tail(state.weeklyProfitHistory,profile.weeklyHistory);
 state.companyValueHistory=tail(state.companyValueHistory,profile.weeklyHistory);
 state.personalNetWorthHistory=tail(state.personalNetWorthHistory,profile.weeklyHistory);
 state.news=head(state.news,profile.news);
 state.history=head(state.history,profile.history);
 if(Array.isArray(state.market))for(const stock of state.market)if(stock&&typeof stock==='object')stock.priceHistory=tail(stock.priceHistory,profile.priceHistory);
 if(Array.isArray(state.startups))for(const startup of state.startups)if(startup&&typeof startup==='object')startup.reports=tail(startup.reports,profile.startupReports);
 if(state.finance&&typeof state.finance==='object')state.finance.weeklySnapshots=tail(state.finance.weeklySnapshots,profile.weeklySnapshots);
 const transactionSummary=archiveTransactions(state,profile);
 return {state,profile:profileName,transactionSummary};
}

function storagePayload(source,profileName){
 const compacted=compactStateForStorage(source,profileName);
 return {...compacted,payload:JSON.stringify(compacted.state)};
}

function notify(instance,message,severity='warning'){
 try{instance.emit?.('notify',{message,severity});}catch(_){}
}

function install(){
 const proto=EngineClass.prototype;
 if(proto.__quotaSafeSaveInstalled)return true;
 const baseSave=proto.save;
 proto.save=function(slot=null){
  if(!slot&&this._saveBlockedDueToLoadFailure){
   console.error('Save blocked because startup save migration failed',this._loadFailureReason||'unknown load failure');
   return false;
  }
  modules.engine.sanitizeBusinessRecords?.(this.g);
  if(this.g&&typeof this.g==='object')this.g.saveVersion=SAVE_VERSION;
  modules.finance.rebuildDirtySnapshots?.(this.g);
  this.g.lastSaveDate=new Date().toISOString();
  const key=slot?`${SAVE_KEY}_slot_${slot}`:SAVE_KEY;
  let raw;
  try{raw=JSON.stringify(this.g);}catch(error){
   this._lastSaveStorageInfo={ok:false,key,mode:'serialize-error',message:error?.message||String(error)};
   console.error('Save serialization failed',error);
   notify(this,'セーブデータの作成に失敗しました。JSONバックアップを保存してください。','error');
   this.emit?.('save-error',{slot,error,reason:'serialize'});
   return false;
  }
  const candidates=[];
  const seen=new Set();
  const add=(mode,payload,summary=null)=>{if(seen.has(payload))return;seen.add(payload);candidates.push({mode,payload,summary});};
  if(raw.length<=RAW_COMPACTION_THRESHOLD)add('raw',raw,null);
  for(const mode of ['normal','emergency','critical']){
   const compacted=storagePayload(this.g,mode);
   add(mode,compacted.payload,compacted.transactionSummary);
  }
  let lastError=null;
  for(const candidate of candidates){
   try{
    localStorage.setItem(key,candidate.payload);
    const info={ok:true,key,slot,mode:candidate.mode,bytes:candidate.payload.length*2,originalBytes:raw.length*2,transactions:candidate.summary||null};
    this._lastSaveStorageInfo=info;
    this.emit?.('saved',{slot,storageMode:candidate.mode,storageBytes:info.bytes,originalStorageBytes:info.originalBytes});
    if((candidate.mode==='emergency'||candidate.mode==='critical')&&this._saveStorageWarningMode!==candidate.mode){
     this._saveStorageWarningMode=candidate.mode;
     notify(this,'端末容量に合わせて古い履歴を整理し、セーブを継続しました。会社・個人資産と会計累計は保持されています。','warning');
    }
    return true;
   }catch(error){
    lastError=error;
    if(!isQuotaError(error))break;
   }
  }
  this._lastSaveStorageInfo={ok:false,key,slot,mode:'failed',message:lastError?.message||String(lastError||'storage write failed'),originalBytes:raw.length*2};
  console.error('Save storage failed without replacing the previous save',lastError);
  notify(this,'iPhoneの保存容量が不足してセーブできませんでした。以前のセーブは残っています。JSONバックアップを保存してください。','error');
  this.emit?.('save-error',{slot,error:lastError,reason:isQuotaError(lastError)?'quota':'storage'});
  return false;
 };
 Object.defineProperty(proto,'__quotaSafeSaveInstalled',{value:true});
 Object.defineProperty(proto,'__quotaSafeSaveBase',{value:baseSave});
 return true;
}

modules.saveStorage=Object.freeze({SAVE_KEY,SAVE_VERSION,RAW_COMPACTION_THRESHOLD,PROFILES,isQuotaError,archiveTransactions,compactStateForStorage,storagePayload,install,__installed:true});
install();
})();
