'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(seed=0x33030001,overrides={}){
  let rng=seed,draws=0;
  const loaded=loadGame({headless:true,random:()=>{draws++;rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;}});
  // Save metadata intentionally uses wall time; hold the test clock constant, not production.
  loaded.ctx.Date=class extends Date{
    constructor(...args){super(...(args.length?args:['2026-10-08T03:05:00.000Z']));}
    static now(){return Date.parse('2026-10-08T03:05:00.000Z');}
  };
  const game=new loaded.engineModule.TycoonEngine();
  game.configure({playerName:'Conservation',companyName:'Conservation Co',difficulty:'normal',scenario:'free',simulationSeed:seed});
  Object.assign(game.g,{week:12,companyCash:500000000,personalCash:10000000,companyDebt:0,publicCompany:true,sharesOut:1000000,founderShares:600000,treasuryBuybackShares:0,competitorOwnedRatio:0,stockPrice:100,ticker:'CPTY',...overrides});
  game.g.market=game.g.market.filter(row=>row.id!=='CPTY');
  game.g.market.push({id:'CPTY',name:game.g.companyName,price:100,previous:100,issuedShares:game.g.sharesOut,marketCap:100*game.g.sharesOut,dividendYield:0,volatility:0,priceHistory:[{week:12,price:100}]});
  game.updateOwnershipRatios();
  game.g.finance=loaded.modules.finance.defaultFinanceState(game.g);
  loaded.modules.finance.ensureFinance(game.g);
  return {loaded,game,finance:loaded.modules.finance,draws:()=>draws};
}
function reconciles(f){
  const result=f.loaded.modules.economicReadModel.ownershipReconciliation(f.game.g);
  assert.equal(result.ok,true,JSON.stringify(result.issues));
  const g=f.game.g,personal=g.personalStocks.CPTY?.qty||0;
  assert(g.founderShares+personal<=g.sharesOut-g.treasuryBuybackShares,'independent quantity conservation oracle');
  return result;
}
function bytes(f){return f.loaded.ctx.localStorage.getItem(f.loaded.engineModule.SAVE_KEY);}
function rejectsWithoutWrites(f,work){
  f.game.save();const before=JSON.stringify(f.game.g),saved=bytes(f),draws=f.draws();
  assert.equal(work(),false);
  assert.equal(JSON.stringify(f.game.g),before);assert.equal(bytes(f),saved);assert.equal(f.draws(),draws);
}

// P3-3-001: production personal buy followed by canonical buyback cannot retire personal units.
{
  const f=setup(),g=f.game.g;reconciles(f);
  const quote=f.loaded.engineModule.stockOrderQuote(f.game.stock('CPTY'),1000,'buy');
  const companyCash=g.companyCash,personalCash=g.personalCash,draws=f.draws(),sim=JSON.stringify(g.simulationRng);
  assert.equal(f.game.buyStock('CPTY',1000,'personal'),true);
  assert.equal(g.personalCash,personalCash-quote.cashAmount);assert.equal(g.companyCash,companyCash);
  assert.equal(f.game.stock('CPTY').price,quote.quoteAfter);reconciles(f);
  const cash=g.personalCash,holding=JSON.stringify(g.personalStocks.CPTY),price=g.stockPrice;
  assert.equal(f.game.buybackOwnShares(100000000),true);
  assert.equal(g.treasuryBuybackShares,399000,'both founder buckets are excluded');
  assert.equal(g.sharesOut-g.treasuryBuybackShares,601000);
  assert.equal(g.founderShares,600000);assert.equal(JSON.stringify(g.personalStocks.CPTY),holding);
  assert.equal(g.personalCash,cash,'no company-to-founder consideration');
  assert.equal(g.companyCash,companyCash-399000*price);
  assert.equal(g.stockPrice,price*(1+Math.min(.08,399000/g.sharesOut*.8)));
  const row=g.finance.transactions.filter(x=>x.buybackReconciliation).at(-1);
  assert.equal(row.buybackReconciliation.quantity,399000);
  assert.equal(row.cashEffect,-399000*price);assert.equal(row.equityEffect,row.cashEffect);assert.equal(row.profitEffect,0);
  assert.equal(f.finance.buybackReconciliationStatus(g).ok,true);assert.equal(f.finance.validate(g).ok,true);
  assert.equal(f.draws(),draws);assert.equal(JSON.stringify(g.simulationRng),sim);reconciles(f);
  rejectsWithoutWrites(f,()=>f.game.buyStock('CPTY',1,'personal'));
  rejectsWithoutWrites(f,()=>f.game.buybackOwnShares(1000000));
}

// The inactive base-class fallback must not bypass the same quantity protection.
// Its legacy settlement is not the installed P2 writer and is not adopted here.
{
  const f=setup(0x33030009);assert.equal(f.game.buyStock('CPTY',1000,'personal'),true);
  const base=Object.getPrototypeOf(f.loaded.engineModule.TycoonEngine.prototype).buybackOwnShares;
  assert.equal(base.call(f.game,100000000),true);assert.equal(f.game.g.treasuryBuybackShares,399000);reconciles(f);
}

// Exact residual boundary, excess rejection and the unchanged existing per-order quote cap.
{
  const f=setup(0x33030002,{founderShares:999995});
  rejectsWithoutWrites(f,()=>f.game.buyStock('CPTY',6,'personal'));
  assert.equal(f.game.buyStock('CPTY',5,'personal'),true);reconciles(f);
  rejectsWithoutWrites(f,()=>f.game.buyStock('CPTY',1,'personal'));
  for(const qty of [NaN,Infinity,-1,0])rejectsWithoutWrites(f,()=>f.game.buyStock('CPTY',qty,'personal'));
  const capped=setup(0x33030003,{founderShares:950000});
  const quote=capped.loaded.engineModule.stockOrderQuote(capped.game.stock('CPTY'),100000,'buy');
  assert.equal(quote.filledQty,50000);
  assert.equal(capped.game.buyStock('CPTY',100000,'personal'),true);
  assert.equal(capped.game.g.personalStocks.CPTY.qty,quote.filledQty);
  assert.equal(capped.game.stock('CPTY').price,quote.quoteAfter);reconciles(capped);
}

// Repeated commands, sale, split, save/import, actual critical compaction and deterministic replay.
function replay(seed){
  const f=setup(seed),g=f.game.g;
  const commands=[()=>f.game.buyStock('CPTY',1000,'personal'),()=>f.game.buybackOwnShares(5000000),()=>f.game.buyStock('CPTY',2000,'personal'),()=>f.game.sellStock('CPTY',500,'personal'),()=>f.game.buybackOwnShares(5000000),()=>f.game.stockSplit('CPTY',2),()=>f.game.buyStock('CPTY',500,'personal')];
  const draws=f.draws(),sim=JSON.stringify(g.simulationRng);
  for(const command of commands){assert.equal(command(),true);reconciles(f);}
  assert.equal(f.draws(),draws);assert.equal(JSON.stringify(g.simulationRng),sim);
  const view=plain(reconciles(f)),raw=JSON.stringify(g);
  const restored=new f.loaded.engineModule.TycoonEngine();restored.importSave(raw);
  assert.deepEqual(plain(f.loaded.modules.economicReadModel.ownershipReconciliation(restored.g)),view);
  const compact=f.loaded.modules.saveStorage.compactStateForStorage(g,'critical').state;
  const reload=new f.loaded.engineModule.TycoonEngine();reload.importSave(JSON.stringify(compact));
  assert.deepEqual(plain(f.loaded.modules.economicReadModel.ownershipReconciliation(reload.g)),view);
  assert.equal(reload.g.personalStocks.CPTY.qty,g.personalStocks.CPTY.qty);
  assert.equal(reload.g.saveVersion,9);assert.equal(f.loaded.engineModule.SAVE_KEY,'capitalism_tycoon_web_v1');
  assert.equal(f.finance.buybackReconciliationStatus(reload.g).ok,true);
  assert.equal(f.finance.validate(reload.g).ok,true);
  return raw;
}
const replayA=JSON.parse(replay(0x33030004)),replayB=JSON.parse(replay(0x33030004));
function differingPaths(a,b,path='g'){if(JSON.stringify(a)===JSON.stringify(b))return [];if(!a||!b||typeof a!=='object'||typeof b!=='object')return [path];return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(key=>differingPaths(a[key],b[key],`${path}.${key}`));}
assert.deepEqual(differingPaths(replayA,replayB),[],'same state/commands produce identical whole economic state');

// Failure in a buyback's finance writer rolls all quantities/cash/books/mirrors/save bytes back.
{
  const f=setup(0x33030005);assert.equal(f.game.buyStock('CPTY',1000,'personal'),true);
  // Existing capacity preflight fills lastStatements before buyback's transaction opens.
  // Snapshot that same preview state; retain the full-state and durable-byte assertions.
  f.game.shareholderReturnCapacity();f.game.save();
  const before=JSON.stringify(f.game.g),saved=bytes(f),state=f.game.g,draws=f.draws(),event=f.finance.event;
  f.finance.event=()=>{throw new Error('forced-buyback-recognition-failure');};
  try{assert.throws(()=>f.game.buybackOwnShares(1000000),/forced-buyback-recognition-failure/);}finally{f.finance.event=event;}
  assert.equal(f.game.g,state);assert.equal(JSON.stringify(f.game.g),before);assert.equal(bytes(f),saved);assert.equal(f.draws(),draws);reconciles(f);
  assert.throws(()=>f.game.runTransaction(()=>{assert.equal(f.game.buyStock('CPTY',1000,'personal'),true);throw new Error('outer-purchase-failure');}),/outer-purchase-failure/);
  assert.equal(f.game.g,state);assert.equal(JSON.stringify(f.game.g),before);assert.equal(bytes(f),saved);assert.equal(f.draws(),draws);reconciles(f);
}

// Already invalid legacy quantities are not repaired by guards, save/reload or compaction.
{
  const f=setup(0x33030006,{treasuryBuybackShares:400000});f.game.g.personalStocks.CPTY={qty:1000,avg:100};
  const before=plain(f.game.g.personalStocks),treasury=f.game.g.treasuryBuybackShares;
  assert.equal(f.loaded.modules.economicReadModel.ownershipReconciliation(f.game.g).ok,false);
  rejectsWithoutWrites(f,()=>f.game.buyStock('CPTY',1,'personal'));
  rejectsWithoutWrites(f,()=>f.game.buybackOwnShares(1000000));
  const compact=f.loaded.modules.saveStorage.compactStateForStorage(f.game.g,'critical').state;
  const reload=new f.loaded.engineModule.TycoonEngine();reload.importSave(JSON.stringify(compact));
  assert.deepEqual(plain(reload.g.personalStocks),before);assert.equal(reload.g.treasuryBuybackShares,treasury);
  assert.equal(f.loaded.modules.economicReadModel.ownershipReconciliation(reload.g).ok,false);
  assert.equal(reload.g.saveVersion,9);
}

// Scoped guard reads frozen state; exact fractional evidence is preserved, lossy arithmetic fails.
{
  const f=setup(0x33030007),guard=f.loaded.engineModule.playerShareAcquisitionCapacity;
  const input={ticker:'X',sharesOut:1000.5,treasuryBuybackShares:100.25,founderShares:600.25,personalStocks:{X:{qty:.5}},companyStocks:{}};
  Object.freeze(input.personalStocks.X);Object.freeze(input.personalStocks);Object.freeze(input.companyStocks);Object.freeze(input);
  assert.equal(guard(input,1),299);assert.equal(guard(input,299,true),null,'P2 buyback must not round fractional source buckets');
  for(const [index,key] of ['sharesOut','founderShares','treasuryBuybackShares'].entries()){
    const legacy=setup(0x33030100+index,{[key]:key==='sharesOut'?1000000.5:key==='founderShares'?600000.25:100.25});
    assert.equal(legacy.loaded.modules.economicReadModel.ownershipReconciliation(legacy.game.g).ok,true);
    rejectsWithoutWrites(legacy,()=>legacy.game.buybackOwnShares(100));
  }
  for(const mode of [false,true])assert.equal(guard({...input,sharesOut:NaN},1,mode),null);
  const large={ticker:'X',sharesOut:Number.MAX_SAFE_INTEGER,treasuryBuybackShares:0,founderShares:0,personalStocks:{X:{qty:2**52-.5}},companyStocks:{}};
  assert.equal(guard(large),Math.floor(2**52-.5));assert.equal(guard(large,1),null,'personal bucket addition must not lose a fractional unit');
  assert.equal(guard({...large,personalStocks:{},founderShares:2**52-.5},1),null,'beneficial total addition must be exact');
  assert.equal(guard({...large,personalStocks:{},treasuryBuybackShares:2**52-.5},1,true),null,'treasury addition must be exact');
}

// Other issuers and company-account market orders retain their existing settlement and quotes.
{
  const f=setup(0x33030008,{founderShares:1000000});f.game.g.departments.investment=true;
  const ownQuote=f.loaded.engineModule.stockOrderQuote(f.game.stock('CPTY'),100,'buy');
  assert.equal(f.game.buyStock('CPTY',100,'company'),true);
  assert.equal(f.game.g.companyStocks.CPTY.qty,100);assert.equal(f.game.stock('CPTY').price,ownQuote.quoteAfter);
  const external=f.game.g.market.find(x=>x.id!=='CPTY');
  const quote=f.loaded.engineModule.stockOrderQuote(external,1,'buy');
  assert.equal(f.game.buyStock(external.id,1,'personal'),true);
  assert.equal(f.game.g.personalStocks[external.id].qty,1);assert.equal(external.price,quote.quoteAfter);
  assert.equal(f.game.g.personalStocks.CPTY,undefined);reconciles(f);
}
console.log('Player own-share acquisition conservation regressions passed');
