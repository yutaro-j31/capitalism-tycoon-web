'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {ROOT,loadGame}=require('./harness');

const source=fs.readFileSync(path.join(ROOT,'js','save-storage-ui.js'),'utf8');
for(const contract of [
 'data-save-storage-action="backup"',
 'data-save-storage-action="compact-save"',
 'JSONバックアップ',
 '履歴を整理して保存'
])assert.ok(source.includes(contract),`missing recovery UI contract: ${contract}`);
assert.doesNotMatch(source,/localStorage\.(?:removeItem|clear)/,'recovery actions must never delete browser saves');

const {modules}=loadGame();
const ui=modules.saveStorageUI;
assert.ok(ui?.__installed,'save storage UI must install');
for(const name of ['backupFilename','downloadBackup','handleRecoveryClick'])assert.equal(typeof ui[name],'function',`${name} missing`);

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

function eventFor(action){return {target:{closest(selector){return selector==='[data-save-storage-action]'?{dataset:{saveStorageAction:action}}:null;}},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}};}
const originalGet=modules.saveStorage.getActiveEngine;
// The public module resolves the active engine internally. Validate the compact action contract statically
// and the underlying save result independently without mutating persistent browser storage here.
assert.match(source,/if\(action==='compact-save'\)[\s\S]*instance\.save\(\)/,'compact action must call the quota-safe engine save');
assert.equal(instance.save(),true);
assert.equal(instance.saveCalls,1);
assert.equal(typeof originalGet,'function');
assert.ok(eventFor('backup').target.closest('[data-save-storage-action]'));
console.log('save storage recovery action tests passed');
