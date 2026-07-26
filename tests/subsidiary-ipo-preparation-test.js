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
const modules={engine:{TycoonEngine:Engine,compactYen:v=>`${Math.round(Number(v)||0).toLocaleString('ja-JP')}円`},finance:{event:(state,type,amount,meta)=>financeEvents.push({state,type,amount,meta})},playerEngineBridge:{getEngine:()=>null}};
const context={globalThis:{__capitalismTycoonModules:modules,confirm:()=>true}};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(code,context,{filename:'subsidiary-ipo-preparation.js'});
const mod=modules.subsidiaryIPOPreparation;
function state(){return {week:20,configured:true,selectedTab:'venture',companyCash:100_000_000,personalCash:7_000_000,saveVersion:9,subsidiaries:[{id:'sub-1',name:'Growth Sub',ownership:.7,valuation:500_000_000,subsidiaryCash:2_000_000,publicCompany:false,status:'active'}],subsidiaryIPOPreparationHistory:[]};}
function prepare(target,engine){engine.startSubsidiaryIPOPreparation('sub-1');target.week=24;engine.advanceSubsidiaryIPOPreparation('sub-1');target.week=28;engine.advanceSubsidiaryIPOPreparation('sub-1');target.week=36;engine.advanceSubsidiaryIPOPreparation('sub-1');}
const s=state(),personalBefore=s.personalCash,e=new Engine(s);
assert.equal(e.startSubsidiaryIPOPreparation('sub-1'),true);
assert.equal(s.companyCash,95_000_000);assert.equal(s.personalCash,personalBefore);assert.equal(s.subsidiaries[0].ipoPreparation.stageIndex,0);assert.equal(s.subsidiaries[0].ipoPreparation.offerTermID,'balanced');assert.equal(financeEvents.at(-1).type,'professionalServices');
assert.equal(e.advanceSubsidiaryIPOPreparation('sub-1'),false);assert.match(e.lastError,/あと4週/);
s.week=24;assert.equal(e.advanceSubsidiaryIPOPreparation('sub-1'),true);assert.equal(s.companyCash,87_000_000);assert.equal(mod.snapshot(s,'sub-1').stageID,'underwriter');
s.week=28;assert.equal(e.advanceSubsidiaryIPOPreparation('sub-1'),true);assert.equal(s.companyCash,75_000_000);assert.equal(mod.snapshot(s,'sub-1').stageID,'review');
s.week=36;assert.equal(e.advanceSubsidiaryIPOPreparation('sub-1'),true);assert.equal(mod.snapshot(s,'sub-1').ready,true);assert.equal(s.companyCash,75_000_000);
const readyState=JSON.parse(JSON.stringify(s.subsidiaries[0].ipoPreparation));
const s2=state(),e2=new Engine(s2);prepare(s2,e2);assert.deepEqual(JSON.parse(JSON.stringify(s2.subsidiaries[0].ipoPreparation)),readyState,'IPO preparation is deterministic before listing');
const unprepared=state(),unpreparedEngine=new Engine(unprepared);assert.equal(unpreparedEngine.ipoSubsidiary('sub-1'),false);assert.match(unpreparedEngine.lastError,/準備が完了/,'direct IPO is gated by staged preparation');
assert.equal(e.selectSubsidiaryIPOOfferTerm('sub-1','growth'),true);const preview=mod.offerPreview(s.subsidiaries[0],'growth');assert.equal(preview.primaryProceeds,89_000_000);assert.equal(mod.snapshot(s,'sub-1').offerTermID,'growth');
const companyCashBeforeIPO=s.companyCash,personalCashBeforeIPO=s.personalCash,subsidiaryCashBefore=s.subsidiaries[0].subsidiaryCash,valuationBefore=s.subsidiaries[0].valuation;
assert.equal(e.executePreparedSubsidiaryIPO('sub-1'),true);const listed=s.subsidiaries[0];assert.equal(listed.publicCompany,true);assert.equal(listed.ticker,'V555');assert.equal(listed.ipoPreparation.listedWeek,36);assert.equal(listed.ipoOfferTerms.termID,'growth');assert.equal(listed.ipoOfferTerms.lockupUntilWeek,49);assert.equal(listed.ipoOfferTerms.listingPriceIndex,100);assert.equal(listed.subsidiaryCash,subsidiaryCashBefore+preview.primaryProceeds);assert.equal(listed.valuation,valuationBefore+preview.primaryProceeds);assert.equal(s.companyCash,companyCashBeforeIPO+valuationBefore*.15,'parent cash receives only existing secondary sale proceeds');assert.equal(s.personalCash,personalCashBeforeIPO,'IPO terms do not touch personal cash');
for(const id of ['control','balanced','growth']){const a=mod.offerPreview({valuation:500_000_000},id),b=mod.offerPreview({valuation:500_000_000},id);assert.deepEqual(a,b,`${id} preview must be deterministic`);}assert.ok(mod.offerPreview({valuation:500_000_000},'control').primaryProceeds<mod.offerPreview({valuation:500_000_000},'growth').primaryProceeds);
const viewState=state(),viewEngine=new Engine(viewState),html=mod.renderSection(viewEngine);assert.match(html,/子会社IPO準備/);assert.match(html,/IPO準備を開始/);assert.match(html,/data-subsidiary-ipo-action/);prepare(viewState,viewEngine);const readyHTML=mod.renderSection(viewEngine);assert.match(readyHTML,/支配維持/);assert.match(readyHTML,/成長優先/);assert.match(readyHTML,/ロックアップ/);assert.equal(mod.allSnapshots(viewState).length,1);
assert.equal(s.saveVersion,9);assert.equal(s.personalCash,personalBefore);assert.ok(!/Math\.random|Date\.now|personalCash\s*[+\-*/]?=|personalInvestments/.test(code));assert.ok(!/SAVE_KEY\s*=|saveVersion\s*=/.test(code));
console.log('Staged subsidiary IPO preparation, offer terms, primary proceeds, accounting, UI, determinism and asset separation tests passed');