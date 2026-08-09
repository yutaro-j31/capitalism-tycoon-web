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
const playScripts=Array.from(play.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi));
assert.equal(playScripts.length,1,'play.html must remain a redirect-only legacy entry with one inline script');
assert.doesNotMatch(playScripts[0][1],/\bsrc\s*=/i,'play.html redirect script must not load application scripts itself');
for(const applicationScript of ['physical-iphone-playtest.js','save-storage-ui.js','iphone-playtest-fixes.js']){
  assert.equal(play.includes(applicationScript),false,`redirect-only play.html must not load ${applicationScript}`);
}
assert.equal(play.includes('data-play-dynamic-script-queue'),false,'redirect-only launcher must not create a dynamic script queue');
assert.equal(play.includes('__ctFlushDynamicScripts'),false,'redirect-only launcher must not intercept dynamic module insertion');
assert.equal(play.includes('prerequisitePaths'),false,'redirect-only launcher must not reorder app prerequisites');
assert.doesNotMatch(play,/document\.(?:open|write|close)\s*\(/,'redirect-only launcher must not rewrite the document');
{
  let replaced=null;
  const now=1786250000123;
  const launchContext={
    URL,
    Date:{now:()=>now},
    location:{href:'https://example.test/capitalism-tycoon-web/play.html?old=1',replace(value){replaced=String(value);}}
  };
  vm.runInNewContext(playScripts[0][2],launchContext,{filename:'play.html'});
  assert.ok(replaced,'play.html must redirect using location.replace');
  const target=new URL(replaced);
  assert.equal(target.pathname,'/capitalism-tycoon-web/index.html','play.html must redirect to index.html in the same project path');
  assert.equal(target.searchParams.get('v'),now.toString(36),'play.html must add a cache-busting launch token');
  assert.equal(target.searchParams.has('old'),false,'legacy play.html query parameters must not leak into the canonical launcher');
}

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
