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
const CRITICAL_MONEY_FIELDS=Object.freeze(['companyCash','personalCash','companyDebt','personalDebt']);

function criticalMoneyError(errors){
 const error=new Error(errors.map(row=>row.message).join(' '));
 error.name='CriticalMoneyValidationError';
 error.reason='nonfinite-critical-money';
 error.fields=errors.map(row=>row.field);
 return error;
}
function validateCriticalMoneyState(state){
 const errors=[];
 for(const field of CRITICAL_MONEY_FIELDS){
  const value=state?.[field];
  if(typeof value!=='number'||!Number.isFinite(value))errors.push({field,value,message:`Runtime state: ${field} is not a finite number.`});
 }
 return {ok:errors.length===0,errors};
}
function assertCriticalMoneyState(state){
 const result=validateCriticalMoneyState(state);
 if(!result.ok)throw criticalMoneyError(result.errors);
 return state;
}

function validateRawCriticalMoneyFields(raw){
 if(!plain(raw))return {ok:false,errors:['Corrupted save: root is not an object.']};
 const errors=[];
 for(const key of CRITICAL_MONEY_FIELDS){
  if(!(key in raw))continue;
  const value=raw[key];
  if(value===null)errors.push(`Corrupted save: ${key} is null.`);
  else if(typeof value!=='number'||!Number.isFinite(value))errors.push(`Corrupted save: ${key} is not a finite number.`);
 }
 return {ok:errors.length===0,errors};
}
function assertRawCriticalMoneyFields(raw){const result=validateRawCriticalMoneyFields(raw);if(!result.ok)throw new Error(result.errors.join(' '));return raw;}

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
function adaptLegacyCompanyCash(state){
 if(plain(state)&&!Object.prototype.hasOwnProperty.call(state,'companyCash')&&typeof state.cash==='number'&&Number.isFinite(state.cash))state.companyCash=state.cash;
 return state;
}
function upgradeState(state){
 // saveSequence is storage metadata carried in the saved payload (#726), never simulation state.
 if(state&&typeof state==='object')delete state.saveSequence;
 adaptLegacyCompanyCash(state);
 // GF-012: saves written before companyHQPrefID existed (including existing v9 saves)
 // inherit persisted founder geography; transient UI selection is never an economic fallback.
 if(plain(state)&&!state.companyHQPrefID&&state.founderHomePrefID)state.companyHQPrefID=state.founderHomePrefID;
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
 const source=adaptLegacyCompanyCash(clone(rawState));
 const migrated=baseMigrateSave(source);
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
  const source=adaptLegacyCompanyCash(clone(rawState));
  const migrated=baseMigrateSave(source);
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
   // The production engine is this class, so this load() is the one app.js calls after it
   // awaits IndexedDB hydration. Read through the durable store like the base class (#726).
   const idb=globalThis.__capitalismTycoonModules?.saveStorageIDB;
   const raw=idb?idb.readSync(SAVE_KEY):localStorage.getItem(SAVE_KEY);
   if(!raw)return new TycoonEngineV9(null);
   const parsed=assertRawCriticalMoneyFields(JSON.parse(raw));
   const migrated=migrateSave(parsed);
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
  // Every load path (boot, save slot, import) normalizes the migrated state; a ledger written
  // before LEDGER_COVERAGE_VERSION is reconciled here once.
  finance.reconcileLegacyLedger(this.g);
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
   const parsed=assertRawCriticalMoneyFields(JSON.parse(raw));
   const migrated=migrateSave(parsed);
   if(!migrated.ok){console.error('Slot save migration failed',migrated.errors);return false;}
   this.g=migrated.state;
   this._saveBlockedDueToLoadFailure=false;
   this._loadFailureReason='';
   this.normalize();this.save();this.emit();return true;
  }catch(error){console.error('Slot save migration failed',error);return false;}
 }
 importSave(text){
  const parsed=assertRawCriticalMoneyFields(JSON.parse(text));
  const migrated=migrateSave(parsed);
  if(!migrated.ok)throw new Error(migrated.errors.join(' / ')||'セーブデータ形式が不正です。');
  this.g=migrated.state;
  this._saveBlockedDueToLoadFailure=false;
  this._loadFailureReason='';
  this.normalize();this.save();this.emit();
 }
 // executeIPO() previously duplicated engine.js's primary-offering math here to pre-record
 // the equity financing event, which risked drifting out of sync with the base calculation
 // (see js/engine.js's executeIPO()). The base method now records the event itself using
 // the exact companyRaise it applies to companyCash, so this class inherits it unchanged.
}

Object.assign(engine,{SAVE_VERSION,CRITICAL_MONEY_FIELDS,createInitialState,detectSaveVersion,validateRawCriticalMoneyFields,validateCriticalMoneyState,assertCriticalMoneyState,validateMigratedState,migrateSave,migrateV8ToV9,adaptLegacyCompanyCash,sanitizeBusinessRecords,TycoonEngine:TycoonEngineV9,__saveV9Installed:true,__parentIPOFinanceInstalled:true,__parentIPOEquityBalanceInstalled:true});
})();
