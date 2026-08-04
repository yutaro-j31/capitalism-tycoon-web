'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {readIndex,extractScripts,loadGameFromHtml}=require('../tests/harness');

const FOUNDATION='js/deterministic-economic-foundation.js';
const WEEKS=160;
const TRACKED=['economy','season','policyRate','inflation','exchangeRate','realEstateCycle'];

function seeded(initial=246813579){let seed=initial;return()=>((seed=(seed*48271)%2147483647)/2147483647);}
function cleanSrc(src=''){return String(src).replace(/^\.\//,'');}
function clone(value){return JSON.parse(JSON.stringify(value??null));}
function load(html,seed=246813579){
  const loaded=loadGameFromHtml(html,{random:seeded(seed),headless:true});
  const engine=new loaded.engineModule.TycoonEngine();
  engine.g.configured=true;
  return {...loaded,engine};
}
function snapshot(engine){
  const g=engine.g;
  return {
    week:g.week,
    ...Object.fromEntries(TRACKED.map(key=>[key,g[key]??null])),
    macroCrisis:clone(g.macroCrisis),
    macroRegime:g.macroRegime??null,
    industryClimate:clone(g.industryClimate),
    activeIndustryEvent:clone(g.activeIndustryEvent),
    macroHistoryLength:Array.isArray(g.macroHistory)?g.macroHistory.length:0,
    foundationHistoryLength:Array.isArray(g.economicFoundation?.history)?g.economicFoundation.history.length:0
  };
}
function summarize(rows){
  const fields={};
  for(const key of TRACKED){
    const values=rows.map(row=>Number(row[key])).filter(Number.isFinite);
    fields[key]={first:values[0]??null,last:values.at(-1)??null,min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,unique:new Set(values.map(v=>v.toFixed(9))).size};
  }
  return {
    fields,
    macroRegimes:[...new Set(rows.map(row=>row.macroRegime).filter(Boolean))],
    industryEvents:[...new Set(rows.map(row=>row.activeIndustryEvent?.id).filter(Boolean))],
    crises:[...new Set(rows.map(row=>row.macroCrisis?.kind).filter(Boolean))],
    maxMacroHistory:Math.max(0,...rows.map(row=>row.macroHistoryLength)),
    maxFoundationHistory:Math.max(0,...rows.map(row=>row.foundationHistoryLength))
  };
}
function runAdvance(label,html,seed=246813579){
  const loaded=load(html,seed),{engine,modules}=loaded,rows=[];
  let advanceError=null;
  for(let i=0;i<WEEKS;i++){
    try{engine.advanceWeek(false);}catch(error){advanceError={week:engine.g.week,message:error?.stack||String(error)};break;}
    rows.push(snapshot(engine));
  }
  let financeValidation=null;
  try{financeValidation=modules.finance.validate(engine.g);}catch(error){financeValidation={ok:false,errors:[error?.stack||String(error)]};}
  return {label,completedWeeks:rows.length,advanceError,summary:summarize(rows),financeValidation,samples:rows.filter((_,i)=>i<3||[25,51,77,103,129,155].includes(i)||i===rows.length-1)};
}
function runDirect(label,html,seed=246813579){
  const {engine,modules}=load(html,seed),rows=[];
  for(let week=2;week<=WEEKS+1;week++){
    engine.g.week=week;
    engine.updateMacro();
    rows.push(snapshot(engine));
  }
  return {label,summary:summarize(rows),macroCycleValidation:modules.macroCycle?.validate?.(engine.g)??null,samples:rows.filter((_,i)=>i<3||[25,51,77,103,129,155].includes(i)||i===rows.length-1)};
}
function classifyPreFoundationDefinitions(html){
  const scripts=extractScripts(html).filter(script=>script.file);
  const foundationIndex=scripts.findIndex(script=>cleanSrc(script.src)===FOUNDATION);
  if(foundationIndex<0)throw new Error(`${FOUNDATION} script tag not found`);
  const definition=/\bupdateMacro\s*(?:\([^)]*\)\s*\{|=\s*function\b|=\s*\([^)]*\)\s*=>)/;
  return {
    foundationIndex,
    before:scripts.slice(0,foundationIndex).filter(script=>definition.test(script.code)).map(script=>({src:cleanSrc(script.src),line:script.code.slice(0,script.code.search(definition)).split(/\r?\n/).length})),
    after:scripts.slice(foundationIndex+1).filter(script=>definition.test(script.code)).map(script=>({src:cleanSrc(script.src),line:script.code.slice(0,script.code.search(definition)).split(/\r?\n/).length}))
  };
}

const html=readIndex();
const without=html.replace(/\s*<script src=["']\.\/js\/deterministic-economic-foundation\.js["']><\/script>/,'');
if(without===html)throw new Error('deterministic economic foundation script tag not found');

const report={
  generatedAt:new Date().toISOString(),
  trackedFields:TRACKED,
  weeks:WEEKS,
  loadOrderDefinitions:classifyPreFoundationDefinitions(html),
  direct:{withoutFoundation:runDirect('without-foundation',without),withFoundation:runDirect('with-foundation',html)},
  advanceWeek:{withoutFoundation:runAdvance('without-foundation',without),withFoundation:runAdvance('with-foundation',html)},
  determinism:{first:runDirect('with-foundation-seed-a',html,13579),second:runDirect('with-foundation-seed-a-repeat',html,13579)}
};
report.determinism.same=JSON.stringify(report.determinism.first.summary)===JSON.stringify(report.determinism.second.summary)&&JSON.stringify(report.determinism.first.samples)===JSON.stringify(report.determinism.second.samples);

const output=JSON.stringify(report,null,2);
const outputPath=path.resolve('issue-296-update-macro-impact.json');
fs.writeFileSync(outputPath,`${output}\n`);
console.log('ISSUE_296_UPDATE_MACRO_REPORT_BEGIN');
console.log(output);
console.log('ISSUE_296_UPDATE_MACRO_REPORT_END');
console.log(`reportPath=${outputPath}`);
if(!report.advanceWeek.withFoundation.completedWeeks)throw new Error('with-foundation advanceWeek produced no samples');
if(!report.advanceWeek.withoutFoundation.completedWeeks)throw new Error('without-foundation advanceWeek produced no samples');
