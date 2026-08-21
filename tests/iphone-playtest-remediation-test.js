'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const js=fs.readFileSync('js/iphone-playtest-fixes.js','utf8');
const compat=fs.readFileSync('js/play-runtime-compat.js','utf8');
const css=fs.readFileSync('css/iphone-playtest-fixes.css','utf8');
const index=fs.readFileSync('index.html','utf8');
function has(text,needle,message){assert(text.includes(needle),message||`missing ${needle}`);}
for(const forbidden of ['Math.random','localStorage','SAVE_KEY','saveVersion'])assert(!js.includes(forbidden),`UI patch must not use ${forbidden}`);
for(const forbidden of ['Math.random','localStorage','SAVE_KEY','saveVersion'])assert(!compat.includes(forbidden),`runtime compat must not use ${forbidden}`);
has(js,'inputmode="numeric"','numeric inputmode required');
has(js,'pattern="[0-9]*"','numeric pattern required');
has(js,'enterkeyhint="done"','iPhone Done key required');
has(js,'input.focus({preventScroll:true})','money modal must synchronously focus input');
has(js,"['business-invest','borrow-company','repay-company','borrow-personal','repay-personal']",'money actions must use shared iPhone modal');
for(const action of ['filter','legend','zoom-out','zoom-reset','zoom-in','view'])has(js,`data-iphone-map-action=\"${action}\"`,`map action ${action} must exist`);
for(const feature of ['iphone-store-cockpit','iphone-debt-ledger','iphone-crisis-compact','data-iphone-pref'])has(js,feature,`${feature} missing`);
has(compat,'modules.playerDebtRefinancing?.__installed','compat bridge must only activate after debt refinancing is installed');
has(compat,'compatibilityAlias:true','compat bridge marker missing');
has(css,'top:auto!important','mobile navigation must clear conflicting top');
has(css,'bottom:0!important','mobile navigation must be bottom anchored');
has(css,'max-width:100vw!important','viewport overflow guard missing');
has(css,'min-height:44px','tap target guard missing');
has(css,'#player-crisis-panel[hidden]{display:none!important}','crisis panel hidden contract missing');
has(index,'./css/mobile-release.css','production entry must load mobile release CSS');
has(index,'./css/iphone-playtest-fixes.css','production entry must directly load iPhone remediation CSS');
assert(index.indexOf('./css/mobile-release.css')<index.indexOf('./css/iphone-playtest-fixes.css'),'iPhone remediation CSS must load after mobile release CSS');
has(index,'./js/play-runtime-compat.js','production entry must load runtime compatibility before enhancements');
has(index,'./js/iphone-playtest-fixes.js','production entry must load remediation JS');
assert(index.indexOf('./js/play-runtime-compat.js')<index.indexOf('./js/iphone-playtest-fixes.js'),'runtime compatibility must load before iPhone enhancements');

// Browser remediation and the physical checklist share the broad main/nightly/manual
// iPhone executor. The deleted focused workflows must not silently return.
const smokeWorkflow='.github/workflows/iphone-webkit-smoke.yml';
const workflow=fs.readFileSync(smokeWorkflow,'utf8');
for(const removed of ['.github/workflows/iphone-playtest-remediation.yml','.github/workflows/physical-iphone-playtest.yml']){
 assert(!fs.existsSync(removed),`${removed} must remain consolidated into ${smokeWorkflow}`);
}
assert(!/^\s*pull_request\s*:/m.test(workflow),`${smokeWorkflow} must not run on pull_request`);
assert(/^\s*push\s*:/m.test(workflow),`${smokeWorkflow} must retain main push coverage`);
assert(/branches:\s*\[main\]/.test(workflow),`${smokeWorkflow} push coverage must target main`);
assert(/^\s*schedule\s*:/m.test(workflow),`${smokeWorkflow} must retain daily coverage`);
assert(/^\s*workflow_dispatch\s*:/m.test(workflow),`${smokeWorkflow} must retain manual execution`);
const pushBlock=workflow.match(/^  push:\s*\n((?: {4}.*(?:\n|$))*)/m)?.[1]||'';
assert(!/^\s*paths\s*:/m.test(pushBlock),`${smokeWorkflow} must retain broad main coverage`);
for(const command of [
 'playwright@1.61.0',
 'npx playwright install --with-deps webkit',
 'node --check js/play-runtime-compat.js',
 'node --check js/iphone-playtest-fixes.js',
 'node --check js/physical-iphone-playtest.js',
 'node --check tests/iphone-playtest-webkit-test.js',
 'node tests/iphone-playtest-remediation-test.js',
 'node tests/iphone-playtest-webkit-test.js',
 'node tests/physical-iphone-playtest-test.js',
 'if-no-files-found: error'
]) has(workflow,command,`${smokeWorkflow} must retain ${command}`);
for(const artifact of ['artifacts/iphone-playtest-remediation','artifacts/physical-iphone-playtest']){
 assert(new RegExp(`^ {12}${artifact}$`,'m').test(workflow),`${smokeWorkflow} upload must retain ${artifact}`);
}

// CSS equivalent of the all-modules wiring guard: every production CSS file must be
// reachable from an index.html stylesheet link or a recursively followed @import.
const cssRoot=path.resolve('css');
const allCss=fs.readdirSync(cssRoot,{withFileTypes:true})
 .filter(entry=>entry.isFile()&&entry.name.endsWith('.css'))
 .map(entry=>entry.name)
 .sort();
const linked=[...index.matchAll(/<link\b[^>]*href=["']\.\/css\/([^"']+\.css)["'][^>]*>/g)].map(match=>match[1]);
const reachable=new Set();
const importEdges=[];
function visit(file){
 if(reachable.has(file))return;
 const full=path.join(cssRoot,file);
 assert(fs.existsSync(full),`linked CSS file does not exist: css/${file}`);
 reachable.add(file);
 const source=fs.readFileSync(full,'utf8');
 for(const match of source.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s]+\.css)["']?\s*\)?/g)){
  const imported=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1].replace(/^\.\//,'')));
  importEdges.push([file,imported]);
  visit(imported);
 }
}
for(const file of linked)visit(file);
const unconnected=allCss.filter(file=>!reachable.has(file));
console.log(`CSS_FILES ${JSON.stringify(allCss)}`);
console.log(`CSS_LINKS ${JSON.stringify(linked)}`);
console.log(`CSS_IMPORTS ${JSON.stringify(importEdges)}`);
console.log(`CSS_REACHABLE ${JSON.stringify([...reachable].sort())}`);
assert.deepEqual(unconnected,[],`production-unconnected CSS files: ${unconnected.join(', ')}`);
console.log('iphone playtest remediation and CSS production wiring contract: ok');
