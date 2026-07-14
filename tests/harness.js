const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const BIDI = /[\u202A-\u202E\u2066-\u2069]/;

function readIndex() { return fs.readFileSync(INDEX, 'utf8'); }
function lineOf(text, index) { return text.slice(0, index).split(/\r?\n/).length; }
function extractScripts(html = readIndex()) {
  const scripts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) scripts.push({ attrs: m[1], code: m[2], startLine: lineOf(html, m.index) });
  return scripts;
}
function extractEventHandlers(html = readIndex()) {
  const handlers = [];
  const re = /\s(on[a-z]+)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(html))) handlers.push({ name: m[1], code: m[3] ?? m[4] ?? '', line: lineOf(html, m.index) });
  return handlers;
}
function makeElement(id = '') {
  const el = {
    id, children: [], style: {}, dataset: {}, className: '', innerHTML: '', textContent: '', value: '', checked: false,
    classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
    appendChild(child){ this.children.push(child); return child; },
    remove(){}, addEventListener(){}, removeEventListener(){}, closest(){ return null; }, querySelector(){ return null; }, querySelectorAll(){ return []; },
    setAttribute(k, v){ this[k] = v; }, getAttribute(k){ return this[k] ?? null; }, click(){}, select(){},
    getContext(){ return { scale(){}, clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fillRect(){}, fillText(){}, createLinearGradient(){ return { addColorStop(){} }; } }; },
    toDataURL(){ return 'data:image/png;base64,'; }
  };
  return el;
}
function createBrowserContext() {
  const storage = new Map();
  const nodes = new Map([['app', makeElement('app')], ['toast-root', makeElement('toast-root')], ['modal-root', makeElement('modal-root')]]);
  const document = {
    documentElement: makeElement('html'), body: makeElement('body'),
    getElementById(id){ if (!nodes.has(id)) nodes.set(id, makeElement(id)); return nodes.get(id); },
    querySelector(sel){ return sel.startsWith('#') ? this.getElementById(sel.slice(1)) : makeElement(sel); },
    querySelectorAll(){ return []; }, createElement(tag){ return makeElement(tag); }, addEventListener(){}, removeEventListener(){}
  };
  class StorageStub { getItem(k){ return storage.has(k) ? storage.get(k) : null; } setItem(k,v){ storage.set(k, String(v)); } removeItem(k){ storage.delete(k); } clear(){ storage.clear(); } }
  const context = { console, document, window: null, globalThis: null, localStorage: new StorageStub(), sessionStorage: new StorageStub(),
    navigator: { userAgent: 'node-test' }, location: { href: 'http://localhost/' }, crypto: { randomUUID: () => `test-${Math.random().toString(16).slice(2)}` },
    Blob: class Blob { constructor(parts, opts){ this.parts = parts; this.type = opts?.type || ''; } async text(){ return this.parts.join(''); } },
    URL: { createObjectURL(){ return 'blob:test'; }, revokeObjectURL(){} }, FormData: class { constructor(){ } entries(){ return []; } },
    EventTarget, Event, CustomEvent: global.CustomEvent || class CustomEvent extends Event { constructor(type, init={}){ super(type); this.detail = init.detail; } },
    setTimeout, clearTimeout, requestAnimationFrame: cb => setTimeout(cb, 0), getComputedStyle: () => ({ getPropertyValue: () => '#efb85b' }), confirm: () => true, alert(){}, addEventListener(){}, removeEventListener(){}
  };
  context.window = context; context.globalThis = context;
  return vm.createContext(context);
}
function loadGame() {
  let code = extractScripts().map(s => s.code).join('\n');
  code = code.replace('const __modules = Object.create(null);', 'const __modules = globalThis.__ct_modules = Object.create(null);');
  const ctx = createBrowserContext();
  vm.runInContext(code, ctx, { filename: 'index.html' });
  return { ctx, modules: ctx.__ct_modules, engineModule: ctx.__ct_modules.engine };
}
function assertFinite(value, path, errors) { if (typeof value === 'number' && !Number.isFinite(value)) errors.push(`${path}: non-finite ${value}`); }
function findStateIssues(value, base = 'g', errors = [], seen = new WeakSet()) {
  if (value && typeof value === 'object') {
    if (seen.has(value)) { errors.push(`${base}: circular reference`); return errors; }
    seen.add(value);
    for (const [k, v] of Object.entries(value)) {
      const p = Array.isArray(value) ? `${base}[${k}]` : `${base}.${k}`;
      if (typeof v === 'number') assertFinite(v, p, errors);
      if ((/qty|shares|inventory|stock/i.test(k) || /inventoryByBusinessID/.test(base)) && v === null) errors.push(`${p}: null where numeric value is expected`);
      if ((/qty|shares|inventory|stock/i.test(k) || /inventoryByBusinessID/.test(base)) && typeof v === 'number' && v < 0) errors.push(`${p}: negative quantity/inventory/share value`);
      if ((/(ratio|ownership|Rate)$/i.test(k)) && typeof v === 'number' && (v < 0 || v > 1.5)) errors.push(`${p}: suspicious ratio ${v}`);
      if (v && typeof v === 'object') findStateIssues(v, p, errors, seen);
    }
  }
  return errors;
}
module.exports = { ROOT, INDEX, BIDI, readIndex, extractScripts, extractEventHandlers, loadGame, findStateIssues };
