// Phase 5B-3C extension: explicit saveVersion 9 migration for competitor lifecycle data.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before save-v9.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before save-v9.js.');
if(!modules.competitor?.__creditInstalled)throw new Error('competitor-credit.js must be loaded before save-v9.js.');
if(modules.engine.__saveV9Installed)throw new Error('save version 9 migration is already installed.');

const engine=modules.engine;
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
function upgradeState(state){
 competitor.ensure(state);
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
}

Object.assign(engine,{SAVE_VERSION,createInitialState,detectSaveVersion,validateMigratedState,migrateSave,migrateV8ToV9,TycoonEngine:TycoonEngineV9,__saveV9Installed:true});
})();
