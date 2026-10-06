'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const phase05 = require('./phase0-5-harness');
const { ROOT, loadGame } = require('../tests/harness');

const ACCEPTANCE_SCHEMA_VERSION = 1;
const INVENTORY_PATH = path.join(ROOT, 'docs/economic-engine/phase0-5-authoritative-writers.json');
const REQUIRED_PHASE_ORDER = Object.freeze([
  'weekly-production-wrappers','delegated-executive-actions','critical-money-finite-guard',
  'finance-snapshot-finalization','liquidity-crisis-finalization','finance-validation',
  'supporting-invariant-validation','weekly-summary-finalization','transaction-commit','persistence'
]);
const WRITER_FIELDS = Object.freeze({
  companyCash: ['companyCash'], personalCash: ['personalCash'], companyDebt: ['companyDebt'],
  ownershipShares: ['sharesOut','founderShares','treasuryBuybackShares','externalShareholderRatio'],
  peFundCash: ['fundCash','committedCapital','calledCapital'],
  subsidiaryCarryingValues: ['carryingValue','bookValue'],
  propertyEconomicState: ['properties','personalRealEstateHoldings','propertyTaxAccrued'],
  financeAccountingAuthority: ['finance.transactions','finance.event','recordSnapshot','rebuildSnapshotForWeek']
});
const EXACT_WRITER_RULES = Object.freeze({
  peFundCash: Object.freeze([{path:'fund.cash',pattern:/\bfund\.cash\s*(?:\+\+|--|[+*/-]?=)/}]),
  pePortfolioCompanyCash: Object.freeze([
    {path:'portfolioCompany.cash',pattern:/\bportfolioCompany\.cash\s*(?:\+\+|--|[+*/-]?=)/},
    {path:'pc.cash',pattern:/\bpc\.cash\s*(?:\+\+|--|[+*/-]?=)/}
  ]),
  subsidiaryCarryingValues: Object.freeze([{path:'carryingBookValue',pattern:/\bcarryingBookValue\s*(?:\+\+|--|[+*/-]?=|:)/}]),
  limitedStoreRenovationCompanyCash: Object.freeze([
    {path:'state.companyCash (store renovation EconomicOperation settlement)',pattern:/function settleStoreRenovation\(state,operation\)[\s\S]{0,2500}\bstate\.companyCash\s*=/}
  ])
});
function hash(value){return crypto.createHash('sha256').update(value).digest('hex');}
function gate(code, ok, details){return Object.freeze({code,ok:Boolean(ok),details});}
function sourceFiles(options={}){
  const omitted=new Set((options.omitFiles||[]).map(String));
  return fs.readdirSync(path.join(ROOT,'js')).filter(name=>name.endsWith('.js')).sort().filter(name=>!omitted.has(`js/${name}`));
}
function discoverAuthoritativeWriters(options={}){
  const files=sourceFiles(options),categories={};
  for(const [category,tokens] of Object.entries(WRITER_FIELDS)){
    const rows=[];
    for(const file of files){
      const source=fs.readFileSync(path.join(ROOT,'js',file),'utf8');
      const matched=tokens.filter(token=>source.includes(token));
      if(matched.length)rows.push({file:`js/${file}`,tokens:matched});
    }
    categories[category]=rows;
  }
  return Object.freeze({method:'lexical-candidate-discovery-plus-exact-authority-v2',categories});
}
function discoverExactAuthority(options={}){
  const files=sourceFiles(options),categories={};
  for(const [category,rules] of Object.entries(EXACT_WRITER_RULES)){
    const rows=[];
    for(const file of files){
      const source=fs.readFileSync(path.join(ROOT,'js',file),'utf8');
      const paths=rules.filter(rule=>rule.pattern.test(source)).map(rule=>rule.path);
      if(paths.length)rows.push({file:`js/${file}`,paths:[...new Set(paths)].sort()});
    }
    categories[category]=rows;
  }
  return Object.freeze({method:'exact-production-mutation-discovery-v1',categories});
}
function canonicalInventory(value){
  const categories={};
  for(const category of Object.keys(value.categories||{}).sort())categories[category]=[...value.categories[category]].map(row=>({file:row.file,tokens:[...row.tokens].sort()})).sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0);
  const exactAuthority={};
  for(const category of Object.keys(value.exactAuthority||{}).sort())exactAuthority[category]=[...value.exactAuthority[category]].map(row=>({file:row.file,paths:[...row.paths].sort()})).sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0);
  return {method:value.method,categories,exactAuthority};
}
function verifyWriterInventory(options={}){
  const lexical=discoverAuthoritativeWriters(options),exact=discoverExactAuthority(options);
  const discovered=canonicalInventory({method:lexical.method,categories:lexical.categories,exactAuthority:exact.categories});
  if(options.refresh){fs.writeFileSync(INVENTORY_PATH,JSON.stringify({...discovered,status:'declared-and-reviewed',limitations:'Lexical discovery identifies candidates only. exactAuthority separately records production mutation evidence for reviewed economic paths; finance/accounting tests remain the behavioral verification layer.'},null,2)+'\n');}
  const declared=JSON.parse(fs.readFileSync(INVENTORY_PATH,'utf8'));
  const expected=canonicalInventory(declared);
  const discoveredHash=hash(JSON.stringify(discovered)),declaredHash=hash(JSON.stringify(expected));
  const lexicalDiscoveredHash=hash(JSON.stringify(discovered.categories)),lexicalDeclaredHash=hash(JSON.stringify(expected.categories));
  const exactAuthorityDiscoveredHash=hash(JSON.stringify(discovered.exactAuthority)),exactAuthorityDeclaredHash=hash(JSON.stringify(expected.exactAuthority));
  const lexicalHashMatch=lexicalDiscoveredHash===lexicalDeclaredHash,exactAuthorityHashMatch=exactAuthorityDiscoveredHash===exactAuthorityDeclaredHash;
  const exactAuthorityCounts=Object.fromEntries(Object.entries(discovered.exactAuthority).map(([key,rows])=>[key,rows.length]));
  const requiredExactCoverage=Object.keys(EXACT_WRITER_RULES).every(key=>exactAuthorityCounts[key]>0);
  const limitedCutoverSingleWriter=exactAuthorityCounts.limitedStoreRenovationCompanyCash===1;
  return Object.freeze({ok:discovered.method===declared.method&&lexicalHashMatch&&exactAuthorityHashMatch&&requiredExactCoverage&&limitedCutoverSingleWriter,discoveredHash,declaredHash,lexicalDiscoveredHash,lexicalDeclaredHash,lexicalHashMatch,exactAuthorityDiscoveredHash,exactAuthorityDeclaredHash,exactAuthorityHashMatch,method:discovered.method,status:declared.status,limitations:declared.limitations,categoryCounts:Object.fromEntries(Object.entries(discovered.categories).map(([key,rows])=>[key,rows.length])),exactAuthorityCounts,exactAuthority:discovered.exactAuthority,requiredExactCoverage,limitedCutoverSingleWriter});
}
function verifyPhaseOrder(){
  const loaded=loadGame({headless:true,random:()=>0.5});
  const actual=loaded.modules.financeValidationBoundary?.WEEK_EXECUTION_ORDER;
  const ok=Array.isArray(actual)&&JSON.stringify(actual)===JSON.stringify(REQUIRED_PHASE_ORDER)&&loaded.engineModule.TycoonEngine.prototype.advanceWeek.__canonicalNormalizeBoundary===true;
  return Object.freeze({ok,actual:actual?[...actual]:null,expected:[...REQUIRED_PHASE_ORDER],source:'financeValidationBoundary.WEEK_EXECUTION_ORDER'});
}
function runAcceptance(options={}){
  const tier=String(options.tier||'smoke');
  const seeds=[...(options.seeds||[0x50540001,0x50540002])].map(Number);
  const weeks=Number(options.weeks||phase05.resolveTier(tier).durationWeeks);
  const sourceMainSha=phase05.resolveSourceMainSha(options.sourceMainSha);
  const base={tier,durationWeeks:weeks,stateHashVersion:2,scenarioId:`acceptance-${tier}`,scenarioIdentityFields:{playerName:'Acceptance Founder',companyName:'Acceptance Co',ticker:'P054',fixtureLabel:'baseline'}};
  const runs=seeds.map(seed=>phase05.runBenchmarkScenario({...base,requestedScenarioSeed:seed},{sourceMainSha,includeCharacterization:false}));
  const roots=runs.map(row=>row.simulationRngSeed);
  const seedDiversity=gate('SEED_DIVERSITY',new Set(seeds).size===seeds.length&&runs.every((row,index)=>row.requestedScenarioSeed===seeds[index]&&row.simulationRngSeed===seeds[index])&&new Set(roots).size===seeds.length,{testedSeeds:seeds,persistedSimulationRngRoots:roots});
  const paths=runs.map(row=>row.outcomePathSignature);
  const pathDiversity=gate('PATH_DIVERSITY',new Set(paths).size>=Math.min(2,seeds.length),{uniquePathSignatures:new Set(paths).size,required:Math.min(2,seeds.length),pathSignatures:paths});
  const nuisance=phase05.runScenario({...base,durationWeeks:weeks,requestedScenarioSeed:seeds[0],scenarioIdentityFields:{playerName:'別の創業者',companyName:'別会社',ticker:'ZZZZ',fixtureLabel:'alternate'}},{sourceMainSha});
  const nuisanceInvariance=gate('NUISANCE_INVARIANCE',nuisance.finalSemanticStateHash===runs[0].finalSemanticStateHash&&nuisance.outcomePathSignature===runs[0].outcomePathSignature,{projection:'economic-state-v2',baselineHash:runs[0].finalSemanticStateHash,nuisanceHash:nuisance.finalSemanticStateHash,baselinePath:runs[0].outcomePathSignature,nuisancePath:nuisance.outcomePathSignature});
  const replay=phase05.runPersistenceCharacterization({...base,durationWeeks:Math.min(weeks,3),requestedScenarioSeed:seeds[0]},{sourceMainSha});
  const replayGate=gate('REPLAY',replay.ok,{exactReplay:replay.replayEvidence.ok,saveReloadFork:replay.persistenceEvidence.saveReloadFork.ok,compactedSaveReloadFork:replay.persistenceEvidence.compactedSaveReloadFork.ok,rollbackFailure:replay.rollbackEvidence.ok,idempotency:replay.idempotencyEvidence.ok});
  const classification=gate('CALIBRATION_CLASSIFICATION',runs.every(row=>row.runClassification==='new-game-seed-root'&&row.includeInCalibrationAggregation===true)&&replay.runClassification==='new-game-seed-root',{newGameRuns:runs.length,legacyRuns:0,legacyPolicy:'excluded-from-calibration'});
  const phaseOrderResult=verifyPhaseOrder(), phaseOrder=gate('WEEKLY_PHASE_ORDER',phaseOrderResult.ok,phaseOrderResult);
  const inventoryResult=verifyWriterInventory(), writerInventory=gate('AUTHORITATIVE_WRITER_INVENTORY',inventoryResult.ok,inventoryResult);
  const invariants=gate('ECONOMIC_INVARIANTS',runs.every(row=>row.invariantResult.ok)&&runs.every(row=>row.monetaryEnvelope.observedNonFiniteCount===0),{runs:runs.map(row=>row.invariantResult),nonFiniteCounts:runs.map(row=>row.monetaryEnvelope.observedNonFiniteCount)});
  const gates=[seedDiversity,pathDiversity,nuisanceInvariance,replayGate,classification,phaseOrder,writerInventory,invariants];
  const failedGates=gates.filter(row=>!row.ok).map(row=>({code:row.code,reason:row.details}));
  const report={acceptanceSchemaVersion:ACCEPTANCE_SCHEMA_VERSION,harnessSchemaVersion:phase05.HARNESS_SCHEMA_VERSION,reportSchemaVersion:phase05.REPORT_SCHEMA_VERSION,sourceMainSha,metadata:{generatedAt:options.generatedAt||new Date().toISOString(),timestampIsNonSemantic:true},engineCapabilities:runs[0].engineCapabilities,scenarioTier:tier,testedSeeds:seeds,persistedSimulationRngRoots:roots,gates:Object.fromEntries(gates.map(row=>[row.code,row])),deterministicSemanticHashes:runs.map(row=>row.finalSemanticStateHash),performance:runs.map(row=>row.tickPerformance),saveSizes:runs.map(row=>row.persistencePerformance),monetaryNumberEnvelope:runs.map(row=>row.monetaryEnvelope),classification:{newGame:runs.map(row=>row.scenarioId),legacy:[],calibrationIncludes:'new-game-only'},overallAcceptanceStatus:failedGates.length?'FAIL':'PASS',failedGates};
  if(failedGates.length&&!options.returnFailure)throw Object.assign(new Error(`Phase 0.5 acceptance failed: ${failedGates.map(row=>row.code).join(', ')}`),{report});
  return Object.freeze(report);
}
function formatMarkdown(report){return `# Phase 0.5 Acceptance Evidence\n\n- Source main SHA: \`${report.sourceMainSha}\`\n- Tier: ${report.scenarioTier}\n- Overall: **${report.overallAcceptanceStatus}**\n- Seeds / persisted roots: ${report.testedSeeds.join(', ')} / ${report.persistedSimulationRngRoots.join(', ')}\n- Classification: clean new-game only; legacy fixtures excluded from calibration\n\n## Gates\n\n${Object.values(report.gates).map(row=>`- ${row.ok?'PASS':'FAIL'} \`${row.code}\``).join('\n')}\n\n## Review boundary\n\nThis evidence does not declare owner acceptance, Gate F acceptance, an implementation baseline, or Phase 1 authorization.\n`;}
function parse(argv){const out={};for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--'))continue;const k=argv[i].slice(2),v=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true;out[k]=v;}return out;}
if(require.main===module){try{const args=parse(process.argv.slice(2));if(args['refresh-writers']){verifyWriterInventory({refresh:true});process.stdout.write(`Refreshed ${path.relative(ROOT,INVENTORY_PATH)}\n`);process.exit(0);}const report=runAcceptance({tier:args.tier||'smoke',weeks:args.weeks&&Number(args.weeks),seeds:args.seeds&&String(args.seeds).split(',').map(Number),sourceMainSha:args['source-main-sha']});const dir=path.resolve(ROOT,args['output-dir']||'artifacts/phase0-5-acceptance');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'acceptance.json'),phase05.formatJsonReport(report)+'\n');fs.writeFileSync(path.join(dir,'acceptance.md'),formatMarkdown(report));process.stdout.write(`${report.overallAcceptanceStatus}: ${dir}\n`);}catch(error){if(error.report)console.error(phase05.formatJsonReport(error.report));console.error(error.stack||error.message);process.exit(1);}}
module.exports=Object.freeze({ACCEPTANCE_SCHEMA_VERSION,REQUIRED_PHASE_ORDER,WRITER_FIELDS,EXACT_WRITER_RULES,discoverAuthoritativeWriters,discoverExactAuthority,verifyWriterInventory,verifyPhaseOrder,runAcceptance,formatMarkdown});
