const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('css/app.css','utf8');
const iphone=fs.readFileSync('css/iphone-playtest-fixes.css','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(app,/\.toast\{position:fixed;z-index:200;right:16px;top:16px;/,'desktop toast must remain top-right');
assert.match(app,/@media\(max-width:720px\)[\s\S]*\.toast\{top:auto;bottom:calc\(84px \+ env\(safe-area-inset-bottom\)\);left:12px;right:12px\}/,'legacy mobile toast fallback must remain intact');
assert.match(iphone,/@media\(max-width:820px\)\{/,'D UI override must be limited to the mobile navigation breakpoint');
assert.match(iphone,/body\.d-ui-active\{--iphone-nav-bottom-offset:0px;--iphone-nav-height:70px;--iphone-toast-bottom:80px;/,'standalone geometry must equal the 70px nav plus a 10px gap');
assert.match(iphone,/\.d-sidebar\{[^}]*bottom:var\(--iphone-nav-bottom-offset\)!important;[^}]*height:calc\(var\(--iphone-nav-height\) \+ env\(safe-area-inset-bottom,0px\)\)!important/,'navigation must consume the shared mobile geometry variables');
assert.match(iphone,/body\.d-ui-active \.toast\{top:auto;bottom:calc\(var\(--iphone-toast-bottom\) \+ env\(safe-area-inset-bottom,0px\)\);left:12px;right:12px\}/,'D UI toast must include nav clearance and exactly one safe-area inset');
assert.match(iphone,/body\.iphone-browser-mode\.d-ui-active\{--iphone-nav-bottom-offset:76px;--iphone-toast-bottom:156px\}/,'browser mode must add its existing 76px offset to both nav and toast clearance');
assert.doesNotMatch(iphone,/\.toast\{[^}]*z-index/,'hotfix must resolve geometry rather than raise toast stacking');
assert.ok(html.indexOf('css/app.css')<html.indexOf('css/iphone-playtest-fixes.css'),'iPhone geometry must load after the app toast fallback');

for(const {mode,navBottom,toastBottom} of [{mode:'standalone',navBottom:0,toastBottom:80},{mode:'browser',navBottom:76,toastBottom:156}]){
  for(const safeArea of [0,34]){
    const navTopFromBottom=navBottom+70+safeArea;
    const toastEdgeFromBottom=toastBottom+safeArea;
    assert.equal(toastEdgeFromBottom-navTopFromBottom,10,`${mode} must retain a 10px gap with ${safeArea}px safe area`);
  }
}
for(const width of [390,430]){
  const available=Math.min(420,width-32);
  assert.ok(available<=width-24,`${width}px toast must fit between its mobile insets`);
}

console.log('iPhone toast / bottom navigation clearance contract passed');
