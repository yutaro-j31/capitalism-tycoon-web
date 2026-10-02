'use strict';
const fs=require('node:fs'),path=require('node:path'),ROOT=path.resolve(__dirname,'..');
const DYNAMIC_CALL_ALLOWLIST=Object.freeze({
 'js/finance.js':['m'],
 'js/competitor-parity.js':["action==='acquire'?'otherInvesting':'otherOperating'"],
 'js/engine.js':["kind==='brand'?'advertising':kind==='quality'?'researchAndDevelopment':'headOfficeExpense'","kind==='marketing'?'advertising':'researchAndDevelopment'","kind==='brand'?'advertising':'researchAndDevelopment'","type&&String(type).includes('広告')?'advertising':'headOfficeExpense'"],
 'js/real-estate-complete-cycle.js':['category']
});
function callsIn(source,includeBareEvent=false){const calls=[],pattern=includeBareEvent?/\b(?:(?:f|finance|fin|__modules\.finance|modules\.finance)(?:\?|)\.event(?:\?|)\.?|event)\s*\(/g:/\b(?:f|finance|fin|__modules\.finance|modules\.finance)(?:\?|)\.event(?:\?|)\.?\s*\(/g;let match;while((match=pattern.exec(source))){if(includeBareEvent&&source.slice(Math.max(0,match.index-9),match.index)==='function ')continue;let i=pattern.lastIndex,depth=0,quote=null,escaped=false,comma=-1;for(;i<source.length;i++){const char=source[i];if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote=null;}else if(char==="'"||char==='"'||char==='`')quote=char;else if('([{'.includes(char))depth++;else if(')]}'.includes(char)){if(char===')'&&depth===0)break;depth--;}else if(char===','&&depth===0){if(comma<0)comma=i;else{calls.push({argument:source.slice(comma+1,i).trim(),index:match.index});break;}}}}return calls;}
function scanSource(file,source,approved){const failures=[];for(const call of callsIn(source,file==='js/finance.js')){const literal=call.argument.match(/^(['"])([^'"]+)\1$/)?.[2];if(literal){if(!approved.has(literal))failures.push(`${file}: unknown finance category literal ${literal}`);}else if(!(DYNAMIC_CALL_ALLOWLIST[file]||[]).includes(call.argument))failures.push(`${file}: unapproved dynamic finance category ${call.argument}`);}return failures;}
function scanProduction(approved){const failures=[];for(const name of fs.readdirSync(path.join(ROOT,'js')).filter(name=>name.endsWith('.js')).sort()){const file=`js/${name}`;failures.push(...scanSource(file,fs.readFileSync(path.join(ROOT,file),'utf8'),approved));}return failures;}
module.exports={DYNAMIC_CALL_ALLOWLIST,callsIn,scanSource,scanProduction};
