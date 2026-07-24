'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const storageSource=fs.readFileSync(path.join(ROOT,'js','save-storage.js'),'utf8');
const uiSource=fs.readFileSync(path.join(ROOT,'js','save-storage-ui.js'),'utf8');
const play=fs.readFileSync(path.join(ROOT,'play.html'),'utf8');

async function main(){
 assert.match(storageSource,/let activeEngine=null/);
 assert.match(storageSource,/EngineClass\.load=function\(\)\{activeEngine=baseLoad\(\);return activeEngine;\}/);
 assert.match(storageSource,/function getActiveEngine\(\)/);
 assert.match(uiSource,/data-save-storage-health/);
 assert.match(uiSource,/navigator\?\.storage\?\.estimate/);
 assert.match(uiSource,/端末容量 危険/);
 assert.match(uiSource,/端末容量 注意/);
 assert.match(uiSource,/stopImmediatePropagation/);
 assert.match(uiSource,/以前のセーブは残っています/);
 assert.match(uiSource,/会社・個人資産と会計累計は保持/);
 assert.match(uiSource,/if\(node\.dataset\.saveStorageRenderKey===key\)return true/,'render must be idempotent under MutationObserver');
 assert.ok(play.indexOf('./js/save-storage.js?launch=')<play.indexOf('./js/save-storage-ui.js?launch='),'storage layer must load before its UI');
 assert.match(play,/save-v9\.js\?launch=.*save-storage\.js\?launch=/s);
 new vm.Script(storageSource,{filename:'save-storage.js'});
 new vm.Script(uiSource,{filename:'save-storage-ui.js'});
 const toastRoot={children:[],appendChild(node){this.children.push(node);}};
 let htmlWrites=0;
 const healthNode={className:'',dataset:{},_innerHTML:'',set innerHTML(value){htmlWrites++;this._innerHTML=value;},get innerHTML(){return this._innerHTML;},setAttribute(){},classList:{add(){},remove(){}},remove(){}};
 const screen={node:null,querySelector(){return this.node;},appendChild(node){this.node=node;}};
 const document={
  getElementById(id){if(id==='toast-root')return toastRoot;if(id==='app')return null;return null;},
  querySelector(selector){return selector==='[data-screen="settings"]'?screen:null;},
  createElement(tag){if(tag==='section')return healthNode;return {tagName:tag.toUpperCase(),className:'',dataset:{},innerHTML:'',textContent:'',setAttribute(name,value){this[name]=value;},classList:{add(){},remove(){}},remove(){}};},
  addEventListener(){}
 };
 let saveResult=true;
 const engine={_lastSaveStorageInfo:{ok:true,mode:'emergency',bytes:750000,originalBytes:3400000,transactions:{removed:820}},save(slot){this.lastSlot=slot;return saveResult;}};
 const context={console,document,navigator:{storage:{async estimate(){return {usage:8000000,quota:10000000};}}},setTimeout(fn){fn();return 1;},clearTimeout(){},MutationObserver:class{observe(){}},globalThis:null,__capitalismTycoonModules:{saveStorage:{__installed:true,SAVE_KEY:'capitalism_tycoon_web_v1',SAVE_VERSION:9,getActiveEngine(){return engine;}}}};
 context.globalThis=context;
 vm.createContext(context);
 vm.runInContext(uiSource,context,{filename:'save-storage-ui.js'});
 const ui=context.__capitalismTycoonModules.saveStorageUI;
 assert.equal(ui.engine(),engine);
 await ui.refreshCapacity(context);
 assert.equal(ui.capacityStatus(.2).status,'good');
 assert.equal(ui.capacityStatus(.8).status,'warning');
 assert.equal(ui.capacityStatus(.95).status,'critical');
 assert.equal(ui.renderCard(),true);
 assert.match(screen.node.innerHTML,/容量節約/);
 assert.match(screen.node.innerHTML,/820件/);
 assert.match(screen.node.innerHTML,/端末容量 注意/);
 assert.match(screen.node.innerHTML,/80%/);
 assert.match(screen.node.innerHTML,/早めのJSONバックアップ/);
 const writesAfterFirstRender=htmlWrites;
 assert.equal(ui.renderCard(),true);
 assert.equal(htmlWrites,writesAfterFirstRender,'unchanged card model must not rewrite DOM or retrigger observer');
 let stopped=false;
 const target={dataset:{action:'save-now'},closest(){return this;}};
 assert.equal(ui.handleSaveClick({target,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){stopped=true;}}),true);
 assert.equal(stopped,true);
 assert.equal(toastRoot.children.at(-1).textContent,'保存しました。');
 saveResult=false;
 ui.handleSaveClick({target,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}});
 assert.match(toastRoot.children.at(-1).textContent,/保存できませんでした/);
 const unsupported=await ui.refreshCapacity({...context,navigator:{},document});
 assert.equal(unsupported.supported,false);
 console.log('save storage UI tests passed');
}
main().catch(error=>{console.error(error?.stack||error);process.exit(1);});