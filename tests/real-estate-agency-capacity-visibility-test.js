'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame}=require('./harness');

function lcg(seed=502){let value=seed>>>0;return()=>{value=(value*1664525+1013904223)>>>0;return value/2**32;};}
function scenario(seed=502){
  const loaded=loadGame({random:lcg(seed),headless:true});
  const game=new loaded.engineModule.TycoonEngine();
  game.configure({playerName:'Broker',companyName:'Capacity Realty',difficulty:'normal',scenario:'free'});
  const business=game.business('realEstateAgency');
  Object.assign(business,{brand:60,quality:50,efficiency:0,dx:20});
  const tenant=game.g.tenants[0];
  game.g.companyCash=200_000_000;
  game.g.finance=loaded.modules.finance.defaultFinanceState(game.g);
  Object.assign(game.g.finance,{openingCash:game.g.companyCash,openingAssets:game.g.companyCash,openingEquity:game.g.companyCash,openingRetainedEarnings:game.g.companyCash});
  assert.equal(game.openStore({tenantID:tenant.id,businessID:business.id,name:'仲介本店'}),true);
  const store=game.g.stores.at(-1);Object.assign(store,{status:'open',openingWeek:game.g.week,weeksToOpen:0});
  return {loaded,game,store};
}

// 1. パイプラインが余裕のあるうちはcapacityLostInquiries===0（機会損失が発生しない）。
{
  const {loaded,game,store}=scenario();
  const modAPI=loaded.modules.realEstateAgencyPipeline;
  const result=modAPI.processStore(game.g,store,game.business('realEstateAgency'),game.pref(store.prefID));
  assert.ok(result.kpi.capacity>0,'store has positive capacity');
  assert.equal(result.kpi.capacityLostInquiries,0,'no capacity-bound loss on an opening week that exactly fills or stays under capacity (inquiries never exceed available)');
}

// 2. パイプラインを容量ぴったりまで埋めた状態（今週は解約も失効もしない年齢0の案件）で処理すると、
// available===0となり、今週のinquiriesが丸ごとcapacityLostInquiriesへ計上される。
{
  const {loaded,game,store}=scenario(9001);
  const modAPI=loaded.modules.realEstateAgencyPipeline;
  const business=game.business('realEstateAgency');
  const capacity=modAPI.capacityFor(business);
  assert.equal(capacity,8,'efficiency=0のとき容量は基準値8');
  store.brokeragePipeline={schemaVersion:modAPI.SCHEMA_VERSION,capacity,activeDeals:Array.from({length:capacity},(_,i)=>({id:`FILL-${i}`,storeID:store.id,createdWeek:game.g.week,askingValue:30_000_000,side:'single',segment:'residential'})),lastWeek:null,totals:{inquiries:0,mandates:0,closedDeals:0,singleClosedDeals:0,doubleClosedDeals:0,closedBySegment:{residential:0,luxury:0,investment:0,corporateDeal:0},lostDeals:0,closedTransactionVolume:0,commissionRevenue:0,capacityLostInquiries:0},history:[]};
  const result=modAPI.processStore(game.g,store,business,game.pref(store.prefID));
  assert.equal(result.kpi.activeDeals,capacity,'年齢0の案件は今週閉じないので満杯のまま');
  assert.equal(result.kpi.newMandates,0,'空き枠が無いので新規媒介はゼロ');
  assert.ok(result.kpi.inquiries>0,'このシナリオは問い合わせ自体は発生する（brand=60）');
  assert.equal(result.kpi.capacityLostInquiries,result.kpi.inquiries,'空き枠ゼロなので今週の問い合わせが丸ごと機会損失になる');
  assert.equal(store.brokeragePipeline.totals.capacityLostInquiries,result.kpi.capacityLostInquiries,'累計totalsへ計上される');
}

// 3. 決定論: 同じseedで2回計算しても同じcapacityLostInquiries。新たな乱数消費もない
// （hash()はg.seedとsaltのみに依存する純関数で、Math.randomは一切呼ばれない）。
{
  const {loaded:loadedA,game:gameA,store:storeA}=scenario(4242);
  const {loaded:loadedB,game:gameB,store:storeB}=scenario(4242);
  const business=(g)=>g.business('realEstateAgency');
  let callsA=0;const origA=loadedA.ctx.Math.random;loadedA.ctx.Math.random=()=>{callsA++;return origA();};
  const resultA=loadedA.modules.realEstateAgencyPipeline.processStore(gameA.g,storeA,business(gameA),gameA.pref(storeA.prefID));
  loadedA.ctx.Math.random=origA;
  const resultB=loadedB.modules.realEstateAgencyPipeline.processStore(gameB.g,storeB,business(gameB),gameB.pref(storeB.prefID));
  assert.equal(callsA,0,'processStoreはMath.randomを消費しない');
  assert.equal(resultA.kpi.capacityLostInquiries,resultB.kpi.capacityLostInquiries,'同一seedなら同一結果');
}

// 4. 旧save（capacityLostInquiries欄が存在しない）は安全に0へ正規化される。
{
  const {loaded,game,store}=scenario(731);
  const modAPI=loaded.modules.realEstateAgencyPipeline;
  const business=game.business('realEstateAgency');
  store.brokeragePipeline={activeDeals:[],totals:{inquiries:5,mandates:2,closedDeals:1,closedTransactionVolume:30_000_000,commissionRevenue:1_500_000}};
  const ensured=modAPI.ensureStore(store,business,game.g.week,game.g.seed);
  assert.equal(ensured.totals.capacityLostInquiries,0,'欠落フィールドは0へ正規化される');
  for(const malformed of [null,'bad',-4,NaN,Infinity]){
    store.brokeragePipeline.totals.capacityLostInquiries=malformed;
    const r=modAPI.ensureStore(store,business,game.g.week,game.g.seed);
    assert.ok(Number.isInteger(r.totals.capacityLostInquiries)&&r.totals.capacityLostInquiries>=0,`malformed値(${malformed})も安全な非負整数へ`);
  }
}

// 5. UIは新規ボタン・新規アクションを増やさず、既存KPIカードへ1項目追加しただけ。
{
  const app=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
  assert.match(app,/容量不足の機会損失（累計）/);
  assert.match(app,/capacityLostInquiries/);
  assert.equal((app.match(/'set-brokerage-focus'/g)||[]).length,2,'既存の営業方針アクション名2箇所（btn呼び出しとdispatcher）のまま増えていない');
}

console.log('real estate agency capacity visibility tests passed');
