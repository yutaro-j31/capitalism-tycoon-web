'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const override=fs.readFileSync('css/d-ui-reference-fidelity.css','utf8');
const mapFocus=fs.readFileSync('css/d-ui-map-focus.css','utf8');
const mapDepth=fs.readFileSync('css/d-ui-map-depth.css','utf8');
const mobilePanels=fs.readFileSync('css/d-ui-mobile-panels.css','utf8');
const loader=fs.readFileSync('css/d-ui-mobile-company.css','utf8');
assert.match(loader,/@import url\("\.\/d-ui-reference-fidelity\.css"\);/,'reference fidelity stylesheet must load after the base D UI');
assert.match(loader,/@import url\("\.\/d-ui-map-focus\.css"\);/,'map focus stylesheet must load after reference fidelity overrides');
assert.match(loader,/@import url\("\.\/d-ui-map-depth\.css"\);/,'map depth stylesheet must load after focus overrides');
assert.match(loader,/@import url\("\.\/d-ui-mobile-panels\.css"\);/,'mobile panel carousel must load after map depth overrides');
for(const selector of ['.d-topbar','.d-kpi-strip','.d-sidebar','.d-map-workspace','.d-city-surface','.d-map-marker','.d-map-overlay','.d-context-panel','.d-bottom-dock']){
  assert.ok(override.includes(selector),`missing reference fidelity selector: ${selector}`);
}
for(const interaction of ['.d-topbar::after','.d-map-marker:hover','.d-white-card:hover','.d-context-tabs b::after','.d-context-panel:focus-within','@media(prefers-reduced-motion:reduce)']){
  assert.ok(override.includes(interaction),`missing reference interaction treatment: ${interaction}`);
}
for(const contextPanelContract of ['position:sticky','max-height:calc(100vh - 172px)','overscroll-behavior:contain','scrollbar-gutter:stable','.d-context-panel>header{position:sticky']){
  assert.ok(override.includes(contextPanelContract),`missing desktop context-panel usability contract: ${contextPanelContract}`);
}
for(const responsiveReset of ['.d-context-panel{position:static','max-height:none','overflow:visible','scrollbar-gutter:auto']){
  assert.ok(override.includes(responsiveReset),`missing responsive context-panel reset: ${responsiveReset}`);
}
for(const mobileContract of ['env(safe-area-inset-bottom,0px)','min-width:44px','min-height:44px']){
  assert.ok(override.includes(mobileContract),`missing iPhone safe-area or touch-target contract: ${mobileContract}`);
}
for(const commandMenuScrollContract of ['body.d-ui-active:has(.d-command-menu.open){overflow:hidden','overscroll-behavior:none','touch-action:none','.d-command-menu.open .d-command-panel{touch-action:auto','overscroll-behavior:contain']){
  assert.ok(override.includes(commandMenuScrollContract),`missing command-menu background scroll lock: ${commandMenuScrollContract}`);
}
for(const commandMenuMotionContract of ['.d-command-menu.open{animation:d-command-backdrop-in .16s ease-out both}','animation:d-command-panel-in .2s cubic-bezier(.2,.8,.2,1) both','@keyframes d-command-backdrop-in','@keyframes d-command-panel-in','transform:translateY(10px) scale(.985)','.d-command-menu.open,.d-command-menu.open .d-command-panel{animation:none!important}']){
  assert.ok(override.includes(commandMenuMotionContract),`missing reduced-motion-safe command-menu transition: ${commandMenuMotionContract}`);
}
for(const commandMenuSafeAreaContract of ['.d-command-menu{place-items:stretch','env(safe-area-inset-top,0px)','env(safe-area-inset-right,0px)','env(safe-area-inset-left,0px)','max-height:calc(100dvh - max(16px,env(safe-area-inset-top,0px)) - max(16px,env(safe-area-inset-bottom,0px)))','.d-command-head{position:sticky','min-width:44px;min-height:44px']){
  assert.ok(override.includes(commandMenuSafeAreaContract),`missing iPhone command-menu safe-area contract: ${commandMenuSafeAreaContract}`);
}
for(const commandMenuFocusContract of ['.d-command-head button:focus-visible','.d-command-grid .d-nav-button:focus-visible','outline:3px solid #ffe097!important','outline-offset:3px','box-shadow:0 0 0 4px rgba(217,168,77,.18)']){
  assert.ok(override.includes(commandMenuFocusContract),`missing command-menu keyboard focus treatment: ${commandMenuFocusContract}`);
}
for(const mapMarkerFocusContract of ['.d-map-marker:focus-visible','outline:3px solid #ffe097!important','outline-offset:4px','box-shadow:0 0 0 5px rgba(3,11,19,.72),0 0 0 8px rgba(217,168,77,.24)','@media(prefers-reduced-motion:reduce){.d-map-marker:focus-visible{transform:translate(-50%,-50%)}}','@media(forced-colors:active){.d-map-marker:focus-visible{outline:3px solid Highlight!important']){
  assert.ok(mapFocus.includes(mapMarkerFocusContract),`missing map-marker keyboard focus treatment: ${mapMarkerFocusContract}`);
}
for(const mapDepthContract of ['.d-city-surface::after','pointer-events:none','radial-gradient(ellipse at 50% 42%','.d-city-blocks i::before','.d-city-blocks i::after','filter:drop-shadow','background-blend-mode:screen','@media(max-width:820px)','@media(forced-colors:active)']){
  assert.ok(mapDepth.includes(mapDepthContract),`missing layered production-map depth treatment: ${mapDepthContract}`);
}
for(const mobilePanelContract of ['@media(max-width:520px)','grid-auto-flow:column','grid-auto-columns:minmax(272px,88vw)','overflow-x:auto','overscroll-behavior-inline:contain','scroll-snap-type:x mandatory','padding-inline:max(7px,env(safe-area-inset-left,0px)) max(7px,env(safe-area-inset-right,0px))','scroll-padding-inline:max(7px,env(safe-area-inset-left,0px)) max(7px,env(safe-area-inset-right,0px))','-webkit-overflow-scrolling:touch','.d-map-overlay>.d-white-card','scroll-snap-align:start','scroll-snap-stop:always','@media(prefers-reduced-motion:reduce)','@media(forced-colors:active)']){
  assert.ok(mobilePanels.includes(mobilePanelContract),`missing iPhone swipeable insight-panel contract: ${mobilePanelContract}`);
}
for(const landscapeContract of ['@media(max-width:932px) and (orientation:landscape) and (max-height:500px)','min-height:340px','.d-topbar .brand p{display:none}','height:calc(44px + env(safe-area-inset-bottom,0px))']){
  assert.ok(override.includes(landscapeContract),`missing compact iPhone landscape contract: ${landscapeContract}`);
}
for(const touchContract of ['@media(hover:none),(pointer:coarse)','touch-action:manipulation','-webkit-tap-highlight-color:transparent','.d-map-marker.selected:hover','.d-nav-button:active']){
  assert.ok(override.includes(touchContract),`missing coarse-pointer touch contract: ${touchContract}`);
}
for(const dynamicViewportContract of ['@supports(height:100dvh)','min-height:calc(100dvh - 164px)','max-height:calc(100dvh - 172px)','min-height:calc(100dvh - 154px)']){
  assert.ok(override.includes(dynamicViewportContract),`missing dynamic viewport contract: ${dynamicViewportContract}`);
}
for(const highContrastContract of ['@media(forced-colors:active)','outline:3px solid Highlight','.d-map-marker small{opacity:1','.d-status-bars em{background:Highlight!important']){
  assert.ok(override.includes(highContrastContract),`missing forced-colors accessibility contract: ${highContrastContract}`);
}
assert.ok(override.includes('@media(max-width:820px)'), 'iPhone/tablet fallback must remain explicit');
assert.ok(!/url\((?!["']?\.\/)/.test(override+mapFocus+mapDepth+mobilePanels), 'remote or root-relative assets are not allowed');
assert.ok(!/localStorage|SAVE_KEY|save version|Math\.random/.test(override+mapFocus+mapDepth+mobilePanels), 'visual overrides must not touch runtime state contracts');
console.log('D UI reference fidelity contract passed.');
