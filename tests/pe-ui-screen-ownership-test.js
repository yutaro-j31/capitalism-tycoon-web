'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

let active=false;
const screen={
  innerHTML:'<section data-screen="home">HOME CORE</section>',
  classList:{
    values:new Set(['pe-active']),
    add(v){this.values.add(v);},
    remove(v){this.values.delete(v);},
    contains(v){return this.values.has(v);}
  }
};
const document={
  addEventListener(){},
  querySelector(){return null;},
  getElementById(id){return id==='screen'?screen:null;}
};
const adapter={
  NAVIGATION:[['fund','F','Fund']],
  getPEUIData(){return {unlocked:true,active,navigation:this.NAVIGATION,dashboard:{fund:null},deals:[],bid:null,portfolio:null};},
  perform(){return false;},
  performPortfolio(){return false;}
};
const context=vm.createContext({console,document,CapitalismTycoonPEUIAdapter:adapter});
new vm.Script(fs.readFileSync('js/pe-ui.js','utf8'),{filename:'js/pe-ui.js'}).runInContext(context);

const ui=context.CapitalismTycoonPEUI;
assert(ui&&typeof ui.render==='function','PE UI exports render');

const original=screen.innerHTML;
assert.equal(ui.render(),false,'PE render must refuse ownership on a normal app tab');
assert.equal(screen.innerHTML,original,'inactive PE render must never overwrite the core app screen');
assert.equal(screen.classList.contains('pe-active'),false,'inactive PE render releases PE-only styling');

active=true;
assert.equal(ui.render(),true,'PE render owns the screen when the PE tab is active');
assert.notEqual(screen.innerHTML,original,'active PE render replaces the screen with the PE surface');
assert.equal(screen.classList.contains('pe-active'),true,'active PE render applies PE styling');

active=false;
screen.innerHTML='<section data-screen="business">BUSINESS CORE</section>';
assert.equal(ui.render(),false,'leaving PE returns ownership to the core app');
assert.match(screen.innerHTML,/BUSINESS CORE/,'returning to a normal tab preserves the newly rendered core screen');
assert.equal(screen.classList.contains('pe-active'),false,'PE styling is removed after leaving the PE tab');

console.log('PE UI screen ownership regression passed');
