'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {ROOT,loadGame}=require('./harness');

(async()=>{
const source=fs.readFileSync(path.join(ROOT,'js','save-storage-ui.js'),'utf8');
for(const contract of [
 'data-save-storage-action="backup"',
 'data-save-storage-action="import"',
 'data-save-storage-action="compact-save"',
 'JSONバックアップ',
 'JSONから復元',
 '履歴を整理して保存'
])assert.ok(source.includes(contract),`missing recovery UI contract: ${contract}`);
assert.doesNotMatch(source,/localStorage\.(?:removeItem|clear)/,'recovery actions must never delete browser saves');

const {modules}=loadGame();
const ui=modules.saveStorageUI;
assert.ok(ui?.__installed,'save storage UI must install');
for(const name of ['backupFilename','downloadBackup','ensureImportInput','importSizeError','importBackupFile','handleRecoveryClick','handleImportChange'])assert.equal(typeof ui[name],'function',`${name} missing`);
assert.equal(ui.MAX_IMPORT_BYTES,8*1024*1024,'iPhone import limit must stay explicit and testable');

const instance={g:{week:88,saveVersion:9,companyCash:123456,personalCash:654321,stores:[{id:'store-1'}]},saveCalls:0,save(){this.saveCalls++;return true;}};
assert.equal(ui.backupFilename(instance),'capitalism-tycoon-backup-week-88.json');
let clicked=false,removed=false,revoked='',appended=null,blob=null;
class BlobStub{constructor(parts,opts){this.parts=parts;this.type=opts?.type;blob=this;}}
const env={
 Blob:BlobStub,
 URL:{createObjectURL(){return 'blob:save-backup';},revokeObjectURL(value){revoked=value;}},
 setTimeout(fn){fn();},
 document:{
  body:{appendChild(node){appended=node;}},
  createElement(tag){assert.equal(tag,'a');return {hidden:false,click(){clicked=true;},remove(){removed=true;}};},
  getElementById(){return null;}
 }
};
assert.equal(ui.downloadBackup(instance,env),true);
assert.equal(clicked,true);
assert.equal(removed,true);
assert.equal(appended.download,'capitalism-tycoon-backup-week-88.json');
assert.equal(appended.href,'blob:save-backup');
assert.equal(blob.type,'application/json');
const exported=JSON.parse(blob.parts.join(''));
assert.equal(exported.saveVersion,9);
assert.equal(exported.companyCash,123456);
assert.equal(exported.personalCash,654321);
assert.deepEqual(exported.stores,[{id:'store-1'}]);
assert.equal(revoked,'blob:save-backup');

const Engine=modules.engine.TycoonEngine;
const real=new Engine();
real.g.week=14;
real.g.companyCash=9876543;
real.g.personalCash=2345678;
const restoreState=JSON.parse(JSON.stringify(real.g));
restoreState.week=41;
restoreState.companyCash=7654321;
restoreState.personalCash=3456789;
let safetyDownloads=0;
const restoreEnv={
 Blob:class{constructor(parts,opts){this.parts=parts;this.type=opts?.type;}},
 URL:{createObjectURL(){return 'blob:safety';},revokeObjectURL(){}},setTimeout(fn){fn();},
 document:{body:{appendChild(){}},createElement(){return {click(){safetyDownloads++;},remove(){}};},getElementById(){return null;}}
};
const goodFile={size:Buffer.byteLength(JSON.stringify(restoreState)),async text(){return JSON.stringify(restoreState);}};
const restored=await ui.importBackupFile(goodFile,real,restoreEnv);
assert.equal(restored.ok,true);
assert.equal(restored.week,41);
assert.equal(restored.saveVersion,9);
assert.equal(real.g.companyCash,7654321);
assert.equal(real.g.personalCash,3456789);
assert.equal(safetyDownloads,1,'current save must be backed up before restore');

const beforeInvalid=JSON.stringify(real.g);
const invalid=await ui.importBackupFile({size:9,async text(){return '{bad json';}},real,restoreEnv);
assert.equal(invalid.ok,false);
assert.equal(JSON.stringify(real.g),beforeInvalid,'invalid JSON must not mutate the active game');
assert.equal(safetyDownloads,1,'invalid JSON must fail before creating a redundant safety backup');

let oversizedRead=false;
const oversized=await ui.importBackupFile({size:ui.MAX_IMPORT_BYTES+1,async text(){oversizedRead=true;return '{}';}},real,restoreEnv);
assert.equal(oversized.ok,false);
assert.match(oversized.error,/大きすぎます/);
assert.equal(oversizedRead,false,'declared oversized files must be rejected before loading into iPhone memory');
assert.equal(JSON.stringify(real.g),beforeInvalid,'oversized JSON must not mutate the active game');
assert.equal(safetyDownloads,1,'oversized JSON must fail before creating a safety backup');

const hiddenOversized=await ui.importBackupFile({async text(){return ' '.repeat(ui.MAX_IMPORT_BYTES+1);}},real,restoreEnv);
assert.equal(hiddenOversized.ok,false);
assert.match(hiddenOversized.error,/大きすぎます/);
assert.equal(JSON.stringify(real.g),beforeInvalid,'oversized text without file metadata must not mutate the active game');
assert.equal(safetyDownloads,1,'oversized text must fail before creating a safety backup');

function eventFor(action){return {target:{closest(selector){return selector==='[data-save-storage-action]'?{dataset:{saveStorageAction:action}}:null;}},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}};}
assert.match(source,/if\(action==='compact-save'\)[\s\S]*instance\.save\(\)/,'compact action must call the quota-safe engine save');
assert.equal(instance.save(),true);
assert.equal(instance.saveCalls,1);
assert.ok(eventFor('backup').target.closest('[data-save-storage-action]'));
console.log('save storage recovery action tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});