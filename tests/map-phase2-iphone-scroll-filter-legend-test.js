'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const panCss=read('css/d-ui-map-phase2-pan.css');
const mapCss=read('css/d-ui-map.css');
const markerCss=read('css/d-ui-map-phase2-markers.css');
const iphoneCss=read('css/iphone-playtest-fixes.css');
const canvasSrc=read('js/map-phase2-canvas.js');
const iphoneSrc=read('js/iphone-playtest-fixes.js');
let pass=0,fail=0;
function check(name,fn){try{fn();console.log('PASS:',name);pass++}catch(error){console.log('FAIL:',name,'--',error.message);fail++}}

check('map returns one-finger vertical gestures to native page scroll',()=>{
  assert.match(panCss,/\.d-city-surface-phase2\{touch-action:pan-y\}/);
  assert.doesNotMatch(panCss,/\.d-city-surface-phase2\{touch-action:none\}/);
  assert.match(canvasSrc,/Math\.abs\(dy\)>Math\.abs\(dx\)\)\{dragState=null;gestureBlocked=true;return;\}/);
});
check('horizontal pan threshold and two-pointer pinch contracts remain',()=>{
  assert.match(canvasSrc,/const PAN_THRESHOLD=8/);
  assert.match(canvasSrc,/if\(activePointers\.size===2\)\{beginPinch\(canvas\);return;\}/);
  assert.match(canvasSrc,/document\.addEventListener\('pointercancel',endDrag,true\)/);
});
check('filter checkbox overrides the global full-width input and stays bounded',()=>{
  const rule=iphoneCss.match(/\.iphone-map-popover input\[type="checkbox"\]\{([^}]*)\}/)?.[1]||'';
  assert.match(rule,/width:22px/);assert.match(rule,/min-width:22px/);
  assert.match(rule,/height:22px/);assert.match(rule,/min-height:22px/);
  assert.match(rule,/flex:0 0 22px/);assert.doesNotMatch(rule,/width:100%/);
});
check('filter labels remain horizontal with a full-row tap target',()=>{
  const rule=iphoneCss.match(/\.iphone-map-popover label\{([^}]*)\}/)?.[1]||'';
  assert.match(rule,/display:flex/);assert.match(rule,/min-height:44px/);
  assert.match(rule,/white-space:nowrap/);assert.match(rule,/font-size:13px/);
  for(const label of ['自社店舗','空きテナント','オフィス','競合店舗','不動産'])assert.ok(iphoneSrc.includes(label),label);
});
for(const [legend,marker] of [['store','store'],['tenant','tenant'],['office','office'],['competitor','competitor'],['property','realestate']]){
  check(`${legend} legend and ${marker} marker share canonical color tokens`,()=>{
    for(const edge of ['top','bottom']){
      const token=`--d2-marker-${marker}-${edge}`;
      assert.ok(mapCss.includes(token),token);assert.ok(markerCss.includes(`var(${token})`),token);assert.ok(iphoneCss.includes(`var(${token},`),token);
    }
  });
}
check('each iPhone checkbox filters only its canonical marker mapping',()=>{
  assert.match(iphoneSrc,/querySelectorAll\('\.d-map-marker'\)/);
  assert.match(iphoneSrc,/classList\.contains\('tenant'\)\?'tenant'/);
  assert.match(iphoneSrc,/classList\.contains\('office'\)\?'office'/);
  assert.match(iphoneSrc,/classList\.contains\('realestate'\)\?'property'/);
  assert.match(iphoneSrc,/classList\.contains\('competitor'\)\?'competitor'/);
  assert.match(iphoneSrc,/marker\.hidden=!state\.mapFilters\[kind\]/);
  assert.doesNotMatch(iphoneSrc,/iphone-synthetic-marker|data-iphone-map-entity/);
});

console.log(`\n${pass} passed, ${fail} failed`);if(fail)process.exitCode=1;
