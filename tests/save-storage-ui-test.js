'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const storageSource=fs.readFileSync(path.join(ROOT,'js','save-storage.js'),'utf8');
const uiSource=fs.readFileSync(path.join(ROOT,'js','save-storage-ui.js'),'utf8');
const indexHtml=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

async function main(){
 assert.match(storageSource,/let activeEngine=null/);
 assert.match(storageSource,/EngineClass\.load=function\(\)\{activeEngine=baseLoad\(\);return activeEngine;\}/);
 assert.match(storageSource,/function getActiveEngine\(\)/);
 assert.match(uiSource,/data-save-storage-health/);
 assert.match(uiSource,/navigator\?\.storage\?\.estimate/);
 assert.match(uiSource,/function savePressure/);
 assert.match(uiSource,/ブラウザ全体 危険/);
 assert.match(uiSource,/セーブ容量 危険/);
 assert.match(uiSource,/localStorage固有の上限とは異なる参考値/);
 assert.match(uiSource,/stopImmediatePropagation/);
 assert.match(uiSource,/以前のセーブは残っています/);
 assert.match(uiSource,/会社・個人資産と会計累計は保持/);
 assert.match(uiSource,/if\(node\.dataset\.saveStorageRenderKey===key\)return true/,'render must be idempotent under MutationObserver');
 const saveV9Index=indexHtml.indexOf('./js/save-v9.js');
 const storageIndex=indexHtml.indexOf('./js/save-storage.js');
 const storageUIIndex=indexHtml.indexOf('./js/save-storage-ui.js');
 assert.ok(saveV9Index>=0,'save-v9 must be directly connected in index.html');
 assert.ok(storageIndex>=0,'save storage layer must be directly connected in index.html');
 assert.ok(storageUIIndex>=0,'save storage UI must be directly connected in index.html');
 assert.ok(saveV9Index<storageIndex,'save-v9 must load before save storage');
 assert.ok(storageIndex<storageUIIndex,'storage layer must load before its UI');
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
 const context={console,document,navigator:{storage:{async estimate(){return {usage:8000000,quota:10000000};}}},setTimeout(fn){fn();return 1;},clearTimeout(){},MutationObserver:class{observe(){}},globalThis:null,__capitalismTycoonModules:{saveStorage:{__installed:true,SAVE_KEY:'capitalism_tycoon_web_v1',SAVE_VERSION:9,RAW_COMPACTION_THRESHOLD:1250000,getActiveEngine(){return engine;}}}};
 context.globalThis=context;
 vm.createContext(context);
 vm.runInContext(uiSource,context,{filename:'save-storage-ui.js'});
 const ui=context.__capitalismTycoonModules.saveStorageUI;
 assert.equal(ui.engine(),engine);
 await ui.refreshCapacity(context);
 assert.equal(ui.capacityStatus(.2).status,'good');
 assert.equal(ui.capacityStatus(.8).status,'warning');
 assert.equal(ui.capacityStatus(.95).status,'critical');
 assert.equal(ui.savePressure({ok:true,mode:'raw',bytes:500000,originalBytes:500000}).status,'good');
 assert.equal(ui.savePressure({ok:true,mode:'emergency',bytes:700000,originalBytes:3400000}).status,'warning');
 assert.equal(ui.savePressure({ok:true,mode:'critical',bytes:450000,originalBytes:7000000}).status,'critical');
 assert.equal(ui.savePressure({ok:false,mode:'failed',originalBytes:7000000}).status,'critical');
 assert.equal(ui.renderCard(),true);
 assert.match(screen.node.innerHTML,/容量節約/);
 assert.match(screen.node.innerHTML,/820件/);
 assert.match(screen.node.innerHTML,/セーブ容量 注意/);
 assert.match(screen.node.innerHTML,/ブラウザ全体 注意/);
 assert.match(screen.node.innerHTML,/80%/);
 assert.match(screen.node.innerHTML,/早めのJSONバックアップ/);
 assert.match(screen.node.innerHTML,/参考値/);
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
