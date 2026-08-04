'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {loadGameFromHtml}=require('../tests/harness');

const OUT='issue-296-update-macro-v2.json';
const ERR='issue-296-update-macro-v2-error.txt';
const FOUNDATION='js/deterministic-economic-foundation.js';
const WEEKS=160;
const KEYS=['economy','season','policyRate','inflation','exchangeRate','realEstateCycle'];
const progress=[];
function mark(s){progress.push(s);console.log(`[stage] ${s}`);}
function rng(seed=246813579){return()=>((seed=(seed*48271)%2147483647)/2147483647);}
function clean(s=''){return String(s).replace(/^\.\//,'');}
function scripts(html){
 const out=[]; const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
 while((m=re.exec(html))){const src=(m[1].match(/\bsrc=["']([^"']+)["']/i)||[])[1]; if(src&&src.startsWith('./')){const file=clean(src);out.push({src:file,code:fs.readFileSync(file,'utf8')});}else if(!src&&m[2].trim())out.push({src:'<inline>',code:m[2]});}
 return out;
}
function defs(html){
 const all=scripts(html),i=all.findIndex(x=>x.src===FOUNDATION); if(i<0)throw new Error('foundation not found');
 const re=/\bupdateMacro\s*(?:\([^)]*\)\s*\{|=\s*function\b|=\s*\([^)]*\)\s*=>)/;
 const pick=(xs)=>xs.filter(x=>re.test(x.code)).map(x=>({src:x.src,line:x.code.slice(0,x.code.search(re)).split(/\r?\n/).length}));
 return {foundationIndex:i,before:pick(all.slice(0,i)),after:pick(all.slice(i+1))};
}
function snap(e){const g=e.g;return {week:g.week,...Object.fromEntries(KEYS.map(k=>[k,g[k]??null])),macroRegime:g.macroRegime??null,macroCrisis:g.macroCrisis??null,industryClimate:g.industryClimate??null,activeIndustryEvent:g.activeIndustryEvent??null,macroHistory:Array.isArray(g.macroHistory)?g.macroHistory.length:0,foundationHistory:Array.isArray(g.economicFoundation?.history)?g.economicFoundation.history.length:0};}
function summary(rows){const fields={};for(const k of KEYS){const v=rows.map(x=>Number(x[k])).filter(Number.isFinite);fields[k]={first:v[0]??null,last:v.at(-1)??null,min:v.length?Math.min(...v):null,max:v.length?Math.max(...v):null,unique:new Set(v.map(n=>n.toFixed(9))).size};}return{fields,regimes:[...new Set(rows.map(x=>x.macroRegime).filter(Boolean))],crises:[...new Set(rows.map(x=>x.macroCrisis?.kind||x.macroCrisis?.type).filter(Boolean))],events:[...new Set(rows.map(x=>x.activeIndustryEvent?.id).filter(Boolean))],maxMacroHistory:Math.max(0,...rows.map(x=>x.macroHistory)),maxFoundationHistory:Math.max(0,...rows.map(x=>x.foundationHistory))};}
function boot(html,seed){const loaded=loadGameFromHtml(html,{random:rng(seed),headless:true});const Engine=loaded.engineModule?.TycoonEngine||loaded.TycoonEngine;if(!Engine)throw new Error(`Engine missing; loaded keys=${Object.keys(loaded)}`);const engine=new Engine();engine.g.configured=true;return{loaded,engine};}
function run(html,label,seed=246813579){mark(`boot ${label}`);const {loaded,engine}=boot(html,seed),rows=[];let error=null;for(let i=0;i<WEEKS;i++){try{engine.advanceWeek(false);}catch(e){error=e.stack||String(e);break;}rows.push(snap(engine));}let finance=null;try{const validator=loaded.modules?.finance?.validate||loaded.finance?.validate;finance=validator?validator(engine.g):{unavailable:true,loadedKeys:Object.keys(loaded)};}catch(e){finance={ok:false,error:e.stack||String(e)};}return{label,completed:rows.length,error,summary:summary(rows),finance,samples:rows.filter((_,i)=>i<3||i%26===25||i===rows.length-1)};}
try{
 mark('read index');const html=fs.readFileSync('index.html','utf8');
 mark('extract load order');const loadOrder=defs(html);
 const tag=/\s*<script src=["']\.\/js\/deterministic-economic-foundation\.js["']><\/script>/;
 const without=html.replace(tag,'');if(without===html)throw new Error('failed to remove foundation tag');
 const report={generatedAt:new Date().toISOString(),weeks:WEEKS,loadOrder,withFoundation:run(html,'with-foundation'),withoutFoundation:run(without,'without-foundation'),repeatA:run(html,'repeat-a',13579),repeatB:run(html,'repeat-b',13579),progress};
 report.deterministic=JSON.stringify(report.repeatA.summary)===JSON.stringify(report.repeatB.summary)&&JSON.stringify(report.repeatA.samples)===JSON.stringify(report.repeatB.samples);
 fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');mark(`wrote ${OUT}`);console.log('REPORT_BEGIN');console.log(fs.readFileSync(OUT,'utf8'));console.log('REPORT_END');
 if(!report.withFoundation.completed||!report.withoutFoundation.completed)process.exitCode=1;
}catch(e){const text=`${e.stack||e}\n\nprogress=${JSON.stringify(progress,null,2)}\n`;fs.writeFileSync(ERR,text);console.error(text);process.exitCode=1;}
