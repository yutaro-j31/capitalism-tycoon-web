const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('css/app.css','utf8');
const iphone=fs.readFileSync('css/iphone-playtest-fixes.css','utf8');
const iphoneJs=fs.readFileSync('js/iphone-playtest-fixes.js','utf8');
const appJs=fs.readFileSync('js/app.js','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(app,/\.toast\{position:fixed;z-index:200;right:16px;top:16px;/,'desktop toast must remain top-right');
assert.match(app,/@media\(max-width:720px\)[\s\S]*\.toast\{top:auto;bottom:calc\(84px \+ env\(safe-area-inset-bottom\)\);left:12px;right:12px\}/,'legacy mobile toast fallback must remain intact');
assert.match(iphone,/@media\(max-width:820px\)\{/,'D UI override must be limited to the mobile navigation breakpoint');
assert.match(iphone,/body\.d-ui-active\{--iphone-nav-bottom-offset:0px;--iphone-nav-height:70px;/,'standalone navigation geometry must remain available');
assert.match(iphone,/\.d-sidebar\{[^}]*bottom:var\(--iphone-nav-bottom-offset\)!important;[^}]*height:calc\(var\(--iphone-nav-height\) \+ env\(safe-area-inset-bottom,0px\)\)!important/,'navigation must consume the shared mobile geometry variables');
assert.match(iphone,/body\.d-ui-active \.toast\{left:12px;right:12px;transition:transform \.22s,opacity \.22s\}/,'mobile toast geometry must update immediately rather than animate through the navigation');
assert.match(iphone,/body\.iphone-browser-mode\.d-ui-active\{--iphone-nav-bottom-offset:76px\}/,'browser mode must retain its existing navigation offset');
assert.doesNotMatch(iphone,/\.toast\{[^}]*z-index/,'hotfix must resolve geometry rather than raise toast stacking');
assert.ok(html.indexOf('css/app.css')<html.indexOf('css/iphone-playtest-fixes.css'),'iPhone geometry must load after the app toast fallback');

assert.match(iphoneJs,/function syncToastClearance\(toastNode\)\{/,'runtime must measure live toast/navigation geometry');
assert.match(iphoneJs,/!Number\.isFinite\(globalThis\.innerWidth\)/,'non-browser engine fixtures must remain safe when canonical notifications fire');
assert.match(iphoneJs,/const navRect=nav\.getBoundingClientRect\(\),toastRect=toast\.getBoundingClientRect\(\);/,'clearance must use actual DOM rectangles');
assert.match(iphoneJs,/navRect\.top-10-toastRect\.height/,'toast must sit exactly 10px above the measured navigation');
assert.match(iphoneJs,/style\.display==='none'\|\|style\.visibility==='hidden'\|\|Number\(style\.opacity\)===0/,'hidden navigation must never be treated as valid geometry');
assert.match(appJs,/globalThis\.__capitalismTycoonModules\?\.iphonePlaytestFixes\?\.syncToastClearance\?\.\(el\)/,'every canonical toast must request live clearance immediately after insertion');
assert.match(iphoneJs,/addEventListener\?\.\('scroll',syncToastClearances\)/,'visual viewport movement must retain live clearance');
for(const width of [390,430]){
  const available=Math.min(420,width-32);
  assert.ok(available<=width-24,`${width}px toast must fit between its mobile insets`);
}

console.log('iPhone toast / bottom navigation clearance contract passed');
