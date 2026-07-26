'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'js','physical-iphone-playtest.js'),'utf8');
const play=fs.readFileSync(path.join(ROOT,'play.html'),'utf8');
for(const token of ['物理iPhone試しプレイ','結果JSONを書き出す','data-physical-check','capitalism-tycoon-physical-iphone-playtest-v2','iPhoneモデル','Issue #63'])assert.ok(source.includes(token),`missing physical QA contract: ${token}`);
for(const requiredCheck of ['freshLaunch','preSetupRecovery','oneWeek','fourWeeks','saveExportImport','safeArea','ceoDashboard','capitalAllocation','recoveryTarget','saveImmutable','quota','reload','noConsoleError','touchTargets'])assert.ok(source.includes(`id:'${requiredCheck}'`),`missing RC1 physical check: ${requiredCheck}`);
assert.equal(source.includes('localStorage.setItem'),false,'physical checklist must not write browser saves');
assert.equal(source.includes('localStorage.removeItem'),false,'physical checklist must not remove browser saves');
assert.equal(source.includes('localStorage.clear'),false,'physical checklist must not clear browser saves');
assert.equal(source.includes('.runWeek('),false,'physical checklist must not execute gameplay');
assert.ok(play.includes('./js/physical-iphone-playtest.js?launch='),'public play launcher must load physical checklist');
assert.ok(play.indexOf('./js/save-storage-ui.js?launch=')<play.indexOf('./js/physical-iphone-playtest.js?launch='),'checklist must load after save UI');
assert.ok(play.indexOf('./js/physical-iphone-playtest.js?launch=')<play.indexOf('./js/iphone-playtest-fixes.js?launch='),'checklist must load before the final iPhone enhancement layer');
assert.equal(play.includes('data-play-dynamic-script-queue'),false,'launcher must retain the proven index script order');
assert.equal(play.includes('__ctFlushDynamicScripts'),false,'launcher must not intercept dynamic module insertion');
assert.equal(play.includes('prerequisitePaths'),false,'launcher must not move app prerequisites ahead of app bootstrap');
assert.ok(play.includes("document.open();document.write(fresh);document.close();"),'cache-safe public entry contract must remain intact');

const fakeDocument={addEventListener(){},getElementById(){return null;},querySelector(){return null;}};
const context={
 globalThis:null,document:fakeDocument,navigator:{userAgent:'iPhone Test',platform:'iPhone',language:'ja-JP',standalone:true,onLine:true},
 screen:{width:390,height:844},innerWidth:390,innerHeight:700,devicePixelRatio:3,MutationObserver:class{observe(){}},
 Blob:class{},URL:{createObjectURL(){return'blob:test';},revokeObjectURL(){}},setTimeout(){},console,
 __capitalismTycoonModules:{playerEngineBridge:{getEngine(){return{g:{week:27,saveVersion:9,configured:true}};}}}
};
context.globalThis=context;
vm.runInNewContext(source,context,{filename:'physical-iphone-playtest.js'});
const mod=context.__capitalismTycoonModules.physicalIphonePlaytest;
assert.ok(mod?.__installed);
assert.equal(mod.CHECKS.length,14);
const device=mod.deviceSnapshot(context);
assert.equal(device.viewport,'390x700');
assert.equal(device.screen,'390x844');
assert.equal(device.pixelRatio,3);
assert.equal(device.standalone,true);
const values={model:'iPhone 15 Pro',ios:'18.5',safari:'18.5',notes:'no issue'};
const checked=new Set(mod.CHECKS.map(item=>item.id));
const root={querySelector(selector){
 const check=selector.match(/data-physical-check="([^"]+)"/);if(check)return{checked:checked.has(check[1])};
 const field=selector.match(/data-physical-field="([^"]+)"/);if(field)return{value:values[field[1]]||''};
 return null;
}};
const report=mod.report(root,context);
assert.equal(report.schema,'capitalism-tycoon-physical-iphone-playtest-v2');
assert.equal(report.passed,14);assert.equal(report.total,14);assert.equal(report.allPassed,true);
assert.equal(report.game.week,27);assert.equal(report.game.saveVersion,9);
assert.equal(report.iphoneModel,'iPhone 15 Pro');assert.equal(report.iosVersion,'18.5');assert.equal(report.notes,'no issue');
assert.equal(mod.filename(report),'capitalism-tycoon-iphone-playtest-week-27.json');
console.log('physical iPhone playtest checklist tests passed');
