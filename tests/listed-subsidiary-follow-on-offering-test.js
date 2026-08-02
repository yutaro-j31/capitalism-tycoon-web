'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../js/listed-subsidiary-follow-on-offering.js'),'utf8');
class Engine{constructor(state){this.g=state;this.normalize();}normalize(){}fail(message){this.lastError=message;return false;}notify(){}runTransaction(work){return work();}}
const events=[];
const modules={engine:{TycoonEngine:Engine,compactYen:v=>String(Math.round(Number(v)||0))+'円'},finance:{event:(state,type,amount,meta)=>events.push({state,type,amount,meta})},playerEngineBridge:{getEngine:()=>null}};
const context={globalThis:{__capitalismTycoonModules:modules,confirm:()=>true}};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(code,context,{filename:'listed-subsidiary-follow-on-offering.js'});
const mod=modules.listedSubsidiaryFollowOnOffering;
function makeState(){return {week:80,configured:true,selectedTab:'venture',companyCash:50000000,personalCash:5000000,saveVersion:9,subsidiaries:[{id:'listed-1',name:'再上場子会社',status:'active',publicCompany:true,ownership:0.82,valuation:400000000,carryingBookValue:180000000,subsidiaryCash:60000000,ipoPreparation:{listedWeek:40},relistedWeek:40}],listedSubsidiaryFollowOnOfferingHistory:[]};}
const a=makeState(),engine=new Engine(a),beforePersonal=a.personalCash;
const primary=engine.listedSubsidiaryFollowOnOfferingPreview('listed-1','primary');
assert.equal(primary.primaryProceeds,37600000);assert.equal(primary.secondaryProceeds,0);assert.equal(primary.ownershipAfter,0.749543);
assert.equal(engine.executeListedSubsidiaryFollowOnOffering('listed-1','primary'),true);
let sub=a.subsidiaries[0];assert.equal(sub.subsidiaryCash,97600000);assert.equal(a.companyCash,50000000);assert.equal(sub.carryingBookValue,180000000);assert.equal(sub.followOnPrimaryRaised,37600000);assert.equal(a.personalCash,beforePersonal);
assert.equal(engine.executeListedSubsidiaryFollowOnOffering('listed-1','secondary'),false);assert.ok(engine.lastError.includes('残り26週'));
a.week=106;const secondary=engine.listedSubsidiaryFollowOnOfferingPreview('listed-1','secondary');assert.equal(secondary.secondaryProceeds,42009600);assert.equal(secondary.bookSold,24014633);assert.equal(secondary.gain,17994967);assert.equal(engine.executeListedSubsidiaryFollowOnOffering('listed-1','secondary'),true);
sub=a.subsidiaries[0];assert.equal(a.companyCash,92009600);assert.equal(sub.carryingBookValue,155985367);assert.equal(sub.ownership,0.649543);assert.equal(a.personalCash,beforePersonal);assert.equal(a.saveVersion,9);
assert.equal(events.filter(e=>e.type==='capitalRaise').length,1);assert.equal(events.filter(e=>e.type==='assetSale').length,1);
const b=makeState(),engineB=new Engine(b);engineB.executeListedSubsidiaryFollowOnOffering('listed-1','primary');const c=makeState(),engineC=new Engine(c);engineC.executeListedSubsidiaryFollowOnOffering('listed-1','primary');assert.deepEqual(JSON.parse(JSON.stringify(b.subsidiaries[0])),JSON.parse(JSON.stringify(c.subsidiaries[0])));
const locked=makeState();locked.week=50;const lockedEngine=new Engine(locked);assert.equal(lockedEngine.executeListedSubsidiaryFollowOnOffering('listed-1','balanced'),false);assert.ok(lockedEngine.lastError.includes('残り16週'));
const html=mod.renderSection({g:makeState()});assert.ok(html.includes('上場子会社の追加資本政策'));assert.ok(html.includes('min-height:44px'));
const launcher=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.ok(launcher.includes('listed-subsidiary-follow-on-offering.js"></script>'));
const runAll=fs.readFileSync(path.join(__dirname,'run-all.js'),'utf8');assert.ok(runAll.includes('listed-subsidiary-follow-on-offering-test.js'));
assert.equal(code.includes('Math.random'),false);assert.equal(code.includes('Date.now'),false);assert.equal(code.includes('SAVE_KEY='),false);assert.equal(code.includes('saveVersion='),false);
console.log('Listed subsidiary follow-on offering tests passed');
