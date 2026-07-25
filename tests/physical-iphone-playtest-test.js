'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'js','physical-iphone-playtest.js'),'utf8');
const play=fs.readFileSync(path.join(ROOT,'play.html'),'utf8');
for(const token of ['物理iPhone試しプレイ','結果JSONを書き出す','data-physical-check','capitalism-tycoon-physical-iphone-playtest-v1'])assert.ok(source.includes(token),`missing physical QA contract: ${token}`);
assert.doesNotMatch(source,/localStorage\.(?:setItem|removeItem|clear)/,'physical checklist must not mutate browser saves');
assert.doesNotMatch(source,/engine\(\)\.(?:save|runWeek)|\.runWeeks?\(/,'physical checklist must not execute gameplay');
assert.ok(play.includes('./js/physical-iphone-playtest.js?launch='),'public play launcher must load physical checklist');
assert.ok(play.indexOf('./js/save-storage-ui.js?launch=')<play.indexOf('./js/physical-iphone-playtest.js?launch='),'checklist must load after save UI');
assert.ok(play.includes("const bootstrapAnchor=`<script src=\"./js/capital-allocation-policy.js?launch=${encodeURIComponent(token)}\"><\\/script>`"),'public launcher must define the final static dependency anchor');
assert.ok(play.includes('data-play-dynamic-script-queue'),'public launcher must install dynamic script queue before app bootstrap');
assert.ok(play.includes('globalThis.__ctFlushDynamicScripts'),'public launcher must expose deterministic dynamic script flush');
assert.ok(play.includes('data-play-dynamic-script-flush'),'public launcher must flush after static dependencies');
assert.ok(play.includes('fresh.replace(appBootstrap,`${queueBridge}${appBootstrap}`)'),'queue bridge must precede app bootstrap');
assert.ok(play.includes('replace(bootstrapAnchor,`${bootstrapAnchor}${flushBridge}`)'),'flush bridge must follow final static dependency');
assert.ok(play.includes('n.async=false'),'queued dynamic scripts must preserve insertion order');
assert.ok(play.includes('Node.prototype.appendChild=p'),'native appendChild must be restored before flushing');
assert.ok(play.includes('Element.prototype.append=a'),'Element.append must be restored before flushing');
assert.ok(play.includes('Element.prototype.prepend=r'),'Element.prepend must be restored before flushing');
assert.ok(play.includes('Element.prototype.append=function()'),'dynamic scripts inserted with Element.append must be queued');
assert.ok(play.includes('Element.prototype.prepend=function()'),'dynamic scripts inserted with Element.prepend must be queued');

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
assert.equal(mod.CHECKS.length,10);
const device=mod.deviceSnapshot(context);
assert.equal(device.viewport,'390x700');
assert.equal(device.screen,'390x844');
assert.equal(device.pixelRatio,3);
assert.equal(device.standalone,true);
const values={ios:'18.5',safari:'18.5',notes:'no issue'};
const checked=new Set(mod.CHECKS.map(item=>item.id));
const root={querySelector(selector){
 const check=selector.match(/data-physical-check="([^"]+)"/);if(check)return{checked:checked.has(check[1])};
 const field=selector.match(/data-physical-field="([^"]+)"/);if(field)return{value:values[field[1]]||''};
 return null;
}};
const report=mod.report(root,context);
assert.equal(report.passed,10);assert.equal(report.total,10);assert.equal(report.allPassed,true);
assert.equal(report.game.week,27);assert.equal(report.game.saveVersion,9);
assert.equal(report.iosVersion,'18.5');assert.equal(report.notes,'no issue');
assert.equal(mod.filename(report),'capitalism-tycoon-iphone-playtest-week-27.json');
console.log('physical iPhone playtest checklist tests passed');