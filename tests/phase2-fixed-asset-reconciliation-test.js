'use strict';

const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

const plain=value=>JSON.parse(JSON.stringify(value));
const money=value=>Math.round(Number(value)*100)/100;
function lcg(seed=0x52500001){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/0x100000000;};}

function setup(seed=0x52500001){
  const loaded=loadGame({random:lcg(seed)});
  const engine=loaded.ctx.__ct_engine;
  engine.g.companyCash=1_000_000_000;
  engine.g.companyDebt=0;
  engine.g.finance=loaded.modules.finance.defaultFinanceState(engine.g);
  loaded.modules.finance.ensureFinance(engine.g);
  return {loaded,modules:loaded.modules,ctx:loaded.ctx,engine};
}
function openStore(f){
  const tenant=f.engine.g.tenants.find(t=>!t.occupiedBy&&t.businessID==='ramen')||f.engine.g.tenants.find(t=>!t.occupiedBy);
  assert.ok(tenant,'free tenant exists');
  assert.notEqual(f.engine.openStore({tenantID:tenant.id,businessID:'ramen',name:'P2 Asset Store',operatingHours:3}),false);
  const store=f.engine.g.stores.at(-1);store.status='open';return store;
}
function status(f){
  const result=f.modules.finance.fixedAssetReconciliationStatus(f.engine.g);
  assert.equal(result.ok,true,JSON.stringify(result,null,2));
  return result;
}

// Store opening creates exactly one reconciled capitalization row and investing cash outflow.
{
  const f=setup(),g=f.engine.g,finance=f.modules.finance,cashBefore=g.companyCash;
  const store=openStore(f),asset=g.finance.fixedAssets.find(a=>a.assetID===`store-${store.id}`);
  assert.ok(asset);
  assert.equal(asset.p2Lifecycle.origin,'recognized');
  assert.equal(asset.p2Lifecycle.acquisitionRecognized,true);
  const row=g.finance.transactions.find(tx=>tx.fixedAssetLifecycle==='acquisition'&&tx.fixedAssetID===asset.assetID);
  assert.ok(row);
  assert.equal(row.category,'capitalExpenditure');
  assert.equal(row.amount,asset.acquisitionCost);
  assert.equal(row.cashEffect,-asset.acquisitionCost);
  assert.equal(row.assetEffect,asset.acquisitionCost);
  assert.equal(row.profitEffect,0);
  assert.equal(g.companyCash,cashBefore-asset.acquisitionCost-f.engine.g.tenants.find(t=>t.id===store.tenantID).deposit);
  const st=finance.buildStatements(g,'week');
  assert.ok(st.cashFlow.investingCashFlow<0);
  status(f);
  assert.equal(finance.standaloneClose(g).ok,true,finance.standaloneClose(g).errors.join(' / '));
  assert.equal(finance.validate(g).ok,true,finance.validate(g).errors.join(' / '));
}

// Equipment upgrade is a second independent capitalized asset, not an expense.
{
  const f=setup(0x52500002),store=openStore(f),before=f.engine.g.finance.fixedAssets.length;
  assert.equal(f.engine.upgradeStoreEquipment(store.id),true);
  assert.equal(f.engine.g.finance.fixedAssets.length,before+1);
  const asset=f.engine.g.finance.fixedAssets.at(-1);
  const row=f.engine.g.finance.transactions.find(tx=>tx.fixedAssetID===asset.assetID&&tx.fixedAssetLifecycle==='acquisition');
  assert.ok(row);
  assert.equal(row.profitEffect,0);
  assert.equal(row.cashEffect,-asset.acquisitionCost);
  assert.equal(row.assetEffect,asset.acquisitionCost);
  status(f);
}

// Weekly depreciation is non-cash, reduces P&L/assets once, and rolls the asset book exactly.
{
  const f=setup(0x52500003),store=openStore(f),finance=f.modules.finance;
  const asset=f.engine.g.finance.fixedAssets.find(a=>a.assetID===`store-${store.id}`);
  const cashBefore=f.engine.g.companyCash,bookBefore=asset.bookValue;
  f.engine.advanceWeek(false);
  const row=f.engine.g.finance.transactions.filter(tx=>tx.fixedAssetLifecycle==='depreciation'&&tx.fixedAssetID===asset.assetID).at(-1);
  assert.ok(row);
  assert.equal(row.cashEffect,0);
  assert.equal(row.profitEffect,-row.amount);
  assert.equal(row.assetEffect,-row.amount);
  assert.equal(f.engine.g.companyCash>0,true);
  assert.ok(asset.bookValue<bookBefore);
  assert.equal(asset.accumulatedDepreciation,asset.p2Lifecycle.recognizedDepreciation);
  assert.equal(asset.p2Lifecycle.depreciationCount,1);
  status(f);
  assert.equal(finance.validate(f.engine.g).ok,true,finance.validate(f.engine.g).errors.join(' / '));
  assert.ok(Math.abs(f.engine.g.companyCash-cashBefore)>0,'weekly operations may move cash, depreciation itself remains non-cash');
}

// Re-evaluating weekly finance in the same week cannot depreciate an asset twice.
{
  const f=setup(0x5250000b),store=openStore(f),finance=f.modules.finance,g=f.engine.g;
  const asset=g.finance.fixedAssets.find(a=>a.assetID===`store-${store.id}`);
  const beginningCash=g.companyCash;
  finance.recordWeekly(g,{stores:[],other:{},beginningCash});
  const bookAfterFirst=asset.bookValue,accAfterFirst=asset.accumulatedDepreciation,countAfterFirst=asset.p2Lifecycle.depreciationCount;
  finance.recordWeekly(g,{stores:[],other:{},beginningCash});
  assert.equal(asset.bookValue,bookAfterFirst);
  assert.equal(asset.accumulatedDepreciation,accAfterFirst);
  assert.equal(asset.p2Lifecycle.depreciationCount,countAfterFirst);
  assert.equal(g.finance.transactions.filter(tx=>tx.fixedAssetLifecycle==='depreciation'&&tx.fixedAssetID===asset.assetID&&tx.week===g.week).length,1);
  status(f);
}

// Straight-line depreciation stops at salvage value and never over-depreciates.
{
  const f=setup(0x52500004),g=f.engine.g,finance=f.modules.finance,cost=100,salvage=20,assetID='p2-short-life';
  const opening=g.companyCash;
  g.companyCash=money(g.companyCash-cost);
  finance.addFixedAsset(g,{assetID,assetType:'storeEquipment',acquisitionCost:cost,usefulLifeWeeks:2,salvageValue:salvage});
  finance.event(g,'capitalExpenditure',cost,{cashEffect:-cost,assetEffect:cost,profitEffect:0,sourceType:'p2-test',sourceID:assetID,operationID:`fixed-asset-acquisition-${assetID}`,idempotencyKey:`fixed-asset-acquisition-${assetID}`,fixedAssetLifecycle:'acquisition',fixedAssetID});
  finance.rebuildSnapshotForWeek(g,g.week);
  for(let i=0;i<3;i++){
    const begin=g.companyCash;
    finance.recordWeekly(g,{stores:[],other:{},beginningCash:begin});
    g.week+=1;
  }
  const asset=g.finance.fixedAssets.find(a=>a.assetID===assetID);
  assert.equal(asset.bookValue,salvage);
  assert.equal(asset.accumulatedDepreciation,cost-salvage);
  assert.equal(g.finance.transactions.filter(tx=>tx.fixedAssetLifecycle==='depreciation'&&tx.fixedAssetID===assetID).length,2);
  assert.equal(g.companyCash,opening-cost);
  status(f);
}

// Closing a store disposes every active equipment layer (base + upgrades) in one investing event.
{
  const f=setup(0x52500005),store=openStore(f),finance=f.modules.finance;
  assert.equal(f.engine.upgradeStoreEquipment(store.id),true);
  assert.equal(f.engine.upgradeStoreEquipment(store.id),true);
  const assets=f.engine.g.finance.fixedAssets.filter(a=>String(a.storeID)===String(store.id));
  assert.equal(assets.length,3);
  const depBefore=new Map(assets.map(a=>[a.assetID,f.engine.g.finance.transactions.filter(tx=>tx.fixedAssetLifecycle==='depreciation'&&tx.fixedAssetID===a.assetID).length]));
  assert.equal(f.engine.closeStore(store.id),true);
  for(const asset of assets){assert.equal(asset.status,'disposed');assert.equal(asset.bookValue,0);assert.equal(asset.p2Lifecycle.disposalRecognized,true);}
  const sale=f.engine.g.finance.transactions.filter(tx=>Array.isArray(tx.fixedAssetDisposals)&&tx.fixedAssetDisposals.length===3).at(-1);
  assert.ok(sale);
  assert.equal(sale.category,'assetSale');
  assert.ok(sale.cashEffect>0);
  assert.equal(sale.assetEffect,-money(assets.reduce((sum,a)=>sum+a.disposalBookValue,0)));
  status(f);
  f.engine.advanceWeek(false);
  for(const asset of assets)assert.equal(f.engine.g.finance.transactions.filter(tx=>tx.fixedAssetLifecycle==='depreciation'&&tx.fixedAssetID===asset.assetID).length,depBefore.get(asset.assetID),'disposed asset must not depreciate later');
  status(f);
  assert.equal(finance.validate(f.engine.g).ok,true,finance.validate(f.engine.g).errors.join(' / '));
}

// Constructed building acquisition and property disposal carry fixed-asset evidence without double capitalization.
{
  const f=setup(0x52500006),g=f.engine.g,finance=f.modules.finance;
  const land=g.properties.find(p=>p.kind==='土地'&&!p.owner);
  assert.ok(land);
  assert.equal(f.engine.buyProperty(land.id,'company'),true);
  assert.equal(f.engine.buildOnLand(land.id,'本社ビル'),true);
  const asset=g.finance.fixedAssets.find(a=>a.propertyID===land.id&&a.status==='active');
  assert.ok(asset);
  const acq=g.finance.transactions.find(tx=>tx.fixedAssetLifecycle==='acquisition'&&tx.fixedAssetID===asset.assetID);
  assert.ok(acq);
  assert.equal(acq.profitEffect,0);
  status(f);
  assert.equal(f.engine.sellProperty(land.id),true);
  assert.equal(asset.status,'disposed');
  assert.equal(asset.bookValue,0);
  assert.equal(asset.p2Lifecycle.disposalRecognized,true);
  status(f);
  assert.equal(finance.validate(g).ok,true,finance.validate(g).errors.join(' / '));
}

// Save/reload preserves P2-5 lifecycle evidence without a saveVersion change.
{
  const f=setup(0x52500007),store=openStore(f);
  assert.equal(f.engine.upgradeStoreEquipment(store.id),true);
  f.engine.save();
  const saved=JSON.parse(f.ctx.localStorage.getItem('capitalism_tycoon_web_v1'));
  assert.equal(saved.saveVersion,9);
  const restored=f.loaded.modules.engine.TycoonEngine.load();
  const after=f.modules.finance.fixedAssetReconciliationStatus(restored.g);
  assert.equal(after.ok,true,JSON.stringify(after,null,2));
  assert.equal(restored.g.saveVersion,9);
}

// Old saveVersion-9 assets are adopted forward-only; historical receipts are not fabricated.
{
  const f=setup(0x52500008),g=f.engine.g,finance=f.modules.finance;
  g.finance.fixedAssets.push({assetID:'legacy-p2-asset',assetType:'storeEquipment',acquisitionWeek:1,acquisitionCost:1000,usefulLifeWeeks:100,salvageValue:100,accumulatedDepreciation:90,bookValue:910,businessID:null,storeID:null,propertyID:null,status:'active'});
  delete g.finance.fixedAssetReconciliation;
  delete g.finance.fixedAssets.at(-1).p2Lifecycle;
  const s=finance.fixedAssetReconciliationStatus(g);
  assert.equal(s.ok,true,JSON.stringify(s,null,2));
  const asset=g.finance.fixedAssets.find(a=>a.assetID==='legacy-p2-asset');
  assert.equal(asset.p2Lifecycle.origin,'adopted');
  assert.equal(asset.p2Lifecycle.openingAccumulatedDepreciation,90);
  assert.equal(asset.p2Lifecycle.acquisitionTransactionID,null);
}

// Duplicate capitalization, expensed acquisition and non-finite acquisition fail closed.
{
  const f=setup(0x52500009),g=f.engine.g,finance=f.modules.finance,cost=12345,assetID='p2-duplicate';
  g.companyCash-=cost;
  finance.addFixedAsset(g,{assetID,acquisitionCost:cost,usefulLifeWeeks:100,salvageValue:100});
  finance.event(g,'capitalExpenditure',cost,{cashEffect:-cost,assetEffect:cost,profitEffect:0,sourceType:'p2-test',sourceID:assetID,operationID:'p2-acq-1',idempotencyKey:'p2-acq-1',fixedAssetLifecycle:'acquisition',fixedAssetID});
  assert.throws(()=>finance.event(g,'capitalExpenditure',cost,{cashEffect:-cost,assetEffect:cost,profitEffect:0,sourceType:'p2-test',sourceID:assetID,operationID:'p2-acq-2',idempotencyKey:'p2-acq-2',fixedAssetLifecycle:'acquisition',fixedAssetID}),/P2-ASSET-DUPLICATE/);
  const badID='p2-expensed';
  finance.addFixedAsset(g,{assetID:badID,acquisitionCost:cost,usefulLifeWeeks:100,salvageValue:100});
  assert.throws(()=>finance.event(g,'capitalExpenditure',cost,{cashEffect:-cost,assetEffect:cost,profitEffect:-cost,sourceType:'p2-test',sourceID:badID,operationID:'p2-expensed',idempotencyKey:'p2-expensed',fixedAssetLifecycle:'acquisition',fixedAssetID:badID}),/P2-ASSET-ACQUISITION/);
  assert.throws(()=>finance.addFixedAsset(g,{assetID:'p2-nonfinite',acquisitionCost:Infinity}),/P2-ASSET-FINITE/);
}

// Same seed + same actions produce the same fixed-asset reconciliation state and consume no extra RNG.
{
  const run=()=>{
    const f=setup(0x5250000a),rngBefore=plain(f.engine.g.simulationRng),store=openStore(f);
    f.engine.upgradeStoreEquipment(store.id);
    const result={assets:plain(f.engine.g.finance.fixedAssets),status:plain(f.modules.finance.fixedAssetReconciliationStatus(f.engine.g)),rngBefore,rngAfter:plain(f.engine.g.simulationRng)};
    return result;
  };
  const a=run(),b=run();
  assert.deepEqual(a,b);
}

console.log('Phase 2 fixed-asset reconciliation tests passed');
