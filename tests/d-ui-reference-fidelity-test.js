'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const override=fs.readFileSync('css/d-ui-reference-fidelity.css','utf8');
const loader=fs.readFileSync('css/d-ui-mobile-company.css','utf8');
assert.match(loader,/@import url\("\.\/d-ui-reference-fidelity\.css"\);/,'reference fidelity stylesheet must load after the base D UI');
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
assert.ok(!/url\((?!["']?\.\/)/.test(override), 'remote or root-relative assets are not allowed');
assert.ok(!/localStorage|SAVE_KEY|save version|Math\.random/.test(override), 'visual override must not touch runtime state contracts');
console.log('D UI reference fidelity contract passed.');
