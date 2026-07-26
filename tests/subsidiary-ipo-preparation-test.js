'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../js/subsidiary-ipo-preparation.js'),'utf8');
class Engine{
  constructor(state){this.g=state;this.saved=0;this.emitted=0;this.notices=[];this.normalize();}
  normalize(){}
  fail(message){this.lastError=message;return false;}
  notify(message,severity){this.notices.push({message,severity});}
  runTransaction(work){const result=work();if(result!==false){this.saved++;this.emitted++;}return result;}
  ipoSubsidiary(id){const sub=this.g.subsidiaries.find(s=>s.id===id);if(!sub||sub.publicCompany)return false;sub.publicCompany=true;sub.ticker='V555';sub.ownership-=.15;this.g.companyCash+=sub.valuation*.15;return true;}
}
const financeEvents=[];
const modules={engine:{TycoonEngine:Engine},finance:{event:(state,type,amount,meta)=>financeEvents.push({state,type,amount,meta})}};
const context={globalThis:{__capitalismTycoonModules:modules}};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(code,context,{filename:'subsidiary-ipo-preparation.js'});
const mod=modules.subsidiaryIPOPreparation;
function state(){return {week:20,configured:true,companyCash:100_000_000,personalCash:7_000_000,saveVersion:9,subsidiaries:[{id:'sub-1',name:'Growth Sub',ownership:.7,valuation:500_000_000,publicCompany:false,status:'active'}],subsidiaryIPOPreparationHistory:[]};}
const s=state(),personalBefore=s.personalCash,e=new Engine(s);
assert.equal(e.startSubsidiaryIPOPreparation('sub-1'),true);
assert.equal(s.companyCash,95_000_000);assert.equal(s.personalCash,personalBefore);assert.equal(s.subsidiaries[0].ipoPreparation.stageIndex,0);assert.equal(financeEvents.at(-1).type,'professionalServices');
assert.equal(e.advanceSubsidiaryIPOPreparation('sub-1'),false);assert.match(e.lastError,/あと4週/);
s.week=24;assert.equal(e.advanceSubsidiaryIPOPreparation('sub-1'),true);assert.equal(s.companyCash,87_000_000);assert.equal(mod.snapshot(s,'sub-1').stageID,'underwriter');
s.week=28;assert.equal(e.advanceSubsidiaryIPOPreparation('sub-1'),true);assert.equal(s.companyCash,75_000_000);assert.equal(mod.snapshot(s,'sub-1').stageID,'review');
s.week=36;assert.equal(e.advanceSubsidiaryIPOPreparation('sub-1'),true);assert.equal(mod.snapshot(s,'sub-1').ready,true);assert.equal(s.companyCash,75_000_000);
assert.equal(e.executePreparedSubsidiaryIPO('sub-1'),true);assert.equal(s.subsidiaries[0].publicCompany,true);assert.equal(s.subsidiaries[0].ticker,'V555');assert.equal(s.subsidiaries[0].ipoPreparation.listedWeek,36);
const s2=state(),e2=new Engine(s2);e2.startSubsidiaryIPOPreparation('sub-1');s2.week=24;e2.advanceSubsidiaryIPOPreparation('sub-1');s2.week=28;e2.advanceSubsidiaryIPOPreparation('sub-1');s2.week=36;e2.advanceSubsidiaryIPOPreparation('sub-1');assert.deepEqual(JSON.parse(JSON.stringify(s2.subsidiaries[0].ipoPreparation)),JSON.parse(JSON.stringify(s.subsidiaries[0].ipoPreparation)),'IPO preparation is deterministic before listing');
assert.equal(s.saveVersion,9);assert.equal(s.personalCash,personalBefore);assert.ok(!/Math\.random|Date\.now|personalCash\s*[+\-*/]?=|personalInvestments/.test(code));assert.ok(!/SAVE_KEY\s*=|saveVersion\s*=/.test(code));
console.log('Staged subsidiary IPO preparation, accounting, timing, determinism and asset separation tests passed');