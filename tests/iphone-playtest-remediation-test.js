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
for(const action of ['filter','legend','view'])has(js,`data-iphone-map-action=\"${action}\"`,`map action ${action} must exist`);
// zoom-out/zoom-reset/zoom-in were removed by production promotion: the legacy
// per-viewport zoom mechanism they drove only ever scaled the legacy city
// layers, and css/d-ui-map-phase2-pan.css already made the (now sole) Phase 2
// map surface ignore it -- so once Phase 2 became the only renderer, these
// buttons visibly did nothing. See docs/map-phase2-production-integration-
// audit.md section 6, PR D.
for(const removed of ['zoom-out','zoom-reset','zoom-in'])assert(!js.includes(`data-iphone-map-action="${removed}"`),`map action ${removed} must stay removed`);
for(const feature of ['iphone-store-cockpit','iphone-debt-ledger','iphone-crisis-compact','data-iphone-pref'])has(js,feature,`${feature} missing`);

// js/map-phase2-canvas.js's buildMapViewModel() already renders every unowned
// property in the selected prefecture as a canonical .d-map-marker.realestate
// button. Synthesising a second, independently-positioned
// .iphone-synthetic-marker.property for the same property id duplicated every
// listing and -- since the two systems use different position formulas and
// .iphone-synthetic-marker has a higher z-index (11 vs the real marker's 5) --
// could land the duplicate directly on top of a real marker, silently making
// it unclickable. ensureSyntheticMapEntities must not reintroduce that
// duplicate; only competitors (which have no canonical marker elsewhere) still
// get a synthetic one, and it must be placed clear of every existing
// .d-map-marker.
assert(!/class="iphone-synthetic-marker property"/.test(js),'a second, synthetic property marker must not be reintroduced (js/map-phase2-canvas.js already renders every unowned property as .d-map-marker.realestate)');
assert(!/data-iphone-map-entity="property"/.test(js),'property synthetic markers must stay removed');
has(js,'function positionsCollide(','collision-avoidance helper missing');
has(js,'function findClearMarkerPosition(','clear-position search helper missing');
has(js,'const occupied=Array.from(stage.querySelectorAll(\'.d-map-marker\'))','synthetic marker placement must seed occupied positions from real markers');
assert(/competitors\.forEach\([^)]*\)=>\{const pos=findClearMarkerPosition\(/.test(js),'competitor synthetic markers must use findClearMarkerPosition');
has(js,'occupied.push(pos)','each placed synthetic marker must be added to the occupied set so later markers avoid it too');
{
 const extractFunction=name=>{
  const marker=`function ${name}(`;
  const start=js.indexOf(marker);
  assert(start>=0,`could not locate ${name} for extraction`);
  const braceStart=js.indexOf('{',start);
  assert(braceStart>=0,`could not locate body of ${name}`);
  let depth=0,index=braceStart;
  for(;index<js.length;index+=1){
   if(js[index]==='{')depth+=1;
   else if(js[index]==='}'){depth-=1;if(depth===0)break;}
  }
  assert(depth===0,`unbalanced braces while extracting ${name}`);
  return js.slice(start,index+1);
 };
 const extractConstLine=name=>{
  const match=new RegExp(`^const ${name}=.*;$`,'m').exec(js);
  assert(match,`could not locate const ${name} for extraction`);
  return match[0];
 };
 const sandbox={};
 // eslint-disable-next-line no-new-func
 new Function('sandbox',[
  extractConstLine('MARKER_GRID_X'),
  extractConstLine('MARKER_GRID_Y'),
  extractFunction('stableHash'),
  extractFunction('markerPosition'),
  extractFunction('positionsCollide'),
  extractFunction('findClearMarkerPosition'),
  'Object.assign(sandbox,{stableHash,markerPosition,positionsCollide,findClearMarkerPosition});',
 ].join('\n'))(sandbox);
 const {positionsCollide,findClearMarkerPosition,markerPosition}=sandbox;
 assert.equal(positionsCollide({x:50,y:50},{x:55,y:52}),true,'nearby positions must be treated as colliding');
 assert.equal(positionsCollide({x:50,y:50},{x:80,y:50}),false,'far-apart positions must not be treated as colliding');
 const occupiedNear=[{x:50,y:50}];
 const resolved=findClearMarkerPosition('competitor:test-id',30,occupiedNear);
 assert(!occupiedNear.some(spot=>positionsCollide(resolved,spot)),'findClearMarkerPosition must return a position clear of every occupied spot when one exists');
 const resolvedAgain=findClearMarkerPosition('competitor:test-id',30,occupiedNear);
 assert.deepEqual(resolved,resolvedAgain,'findClearMarkerPosition must be a pure deterministic function of its inputs');
 // A field densely packed with markers on a fine grid still leaves this function
 // returning a plain, well-formed position (graceful degradation, matching this
 // codebase's fallback-to-open-space philosophy) rather than throwing or looping
 // forever, even when no grid candidate is fully clear.
 const denseOccupied=Array.from({length:60},(_,index)=>markerPosition(`blocker:${index}`,index));
 const fallback=findClearMarkerPosition('competitor:crowded',30,denseOccupied);
 assert(Number.isFinite(fallback.x)&&Number.isFinite(fallback.y),'findClearMarkerPosition must always return a finite position, even under a fully packed map');
 // Realistic density check: 14 real markers (the production cap: up to 6 stores + 6
 // tenants + 2 offices) plus up to 3 competitor markers must resolve with zero
 // overlaps across many different id/position combinations -- this is the exact
 // scenario that broke tests/d-ui-webkit-test.js's desktop map click.
 for(let trial=0;trial<200;trial+=1){
  const reals=Array.from({length:14},(_,index)=>markerPosition(`real-trial-${trial}:${index}`,index));
  const occupied=reals.slice();
  for(let index=0;index<3;index+=1){
   const pos=findClearMarkerPosition(`competitor:trial-${trial}:${index}`,index+30,occupied);
   assert(!occupied.some(spot=>positionsCollide(pos,spot)),`trial ${trial} competitor ${index} must not collide with any of the 14 real markers or earlier competitors`);
   occupied.push(pos);
  }
 }
}
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
const smokeWorkflow='.github/workflows/test.yml';
const workflow=fs.readFileSync(smokeWorkflow,'utf8');
for(const removed of ['.github/workflows/iphone-playtest-remediation.yml','.github/workflows/physical-iphone-playtest.yml']){
 assert(!fs.existsSync(removed),`${removed} must remain consolidated into ${smokeWorkflow}`);
}
assert(/github\.event_name == 'push'.*github\.event_name == 'schedule'.*inputs\.mode == 'iphone-webkit'/.test(workflow),`${smokeWorkflow} iPhone job must retain main, schedule, and manual coverage`);
assert(!/iphone-webkit-smoke:[\s\S]*?if:[^\n]*pull_request/.test(workflow),`${smokeWorkflow} iPhone job must not run on pull_request`);
assert(/^\s*push\s*:/m.test(workflow),`${smokeWorkflow} must retain main push coverage`);
assert(/branches:\s*\[\s*main\s*\]/.test(workflow),`${smokeWorkflow} push coverage must target main`);
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
