const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const BIDI = /[\u202A-\u202E\u2066-\u2069]/;

function readIndex() { return fs.readFileSync(INDEX, 'utf8'); }
function lineOf(text, index) { return text.slice(0, index).split(/\r?\n/).length; }
function parseAttrs(attrs = '') {
  const out = {};
  const re = /([:\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(attrs))) out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  return out;
}
function resolveLocalScript(src) {
  if (!src) throw new Error('script src is empty');
  if (/^(?:https?:)?\/\//i.test(src)) throw new Error(`external script is not supported in tests: ${src}`);
  if (src.startsWith('/')) throw new Error(`root-absolute script path is not valid for GitHub Pages project sites: ${src}`);
  const normalized = path.normalize(src.split(/[?#]/)[0]);
  const file = path.resolve(ROOT, normalized);
  if (!file.startsWith(ROOT + path.sep)) throw new Error(`script src escapes repository root: ${src}`);
  if (!fs.existsSync(file)) throw new Error(`script src not found: ${src}`);
  return file;
}
function extractScripts(html = readIndex()) {
  const scripts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const parsedAttrs = parseAttrs(attrs);
    const startLine = lineOf(html, m.index);
    if (parsedAttrs.src !== undefined) {
      const file = resolveLocalScript(parsedAttrs.src);
      scripts.push({ attrs, parsedAttrs, src: parsedAttrs.src, file, code: fs.readFileSync(file, 'utf8'), startLine });
    } else {
      scripts.push({ attrs, parsedAttrs, code: m[2], startLine });
    }
  }
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
function createBrowserContext(options = {}) {
  const random = options.random || Math.random;
  const storage = new Map(Object.entries(options.localStorageInitial || {}));
  const storageHistory = { getItem: [], setItem: [], removeItem: [] };
  const nodes = new Map([['app', makeElement('app')], ['toast-root', makeElement('toast-root')], ['modal-root', makeElement('modal-root')]]);
  const document = {
    documentElement: makeElement('html'), body: makeElement('body'),
    getElementById(id){ if (!nodes.has(id)) nodes.set(id, makeElement(id)); return nodes.get(id); },
    querySelector(sel){ return sel.startsWith('#') ? this.getElementById(sel.slice(1)) : makeElement(sel); },
    querySelectorAll(){ return []; }, createElement(tag){ return makeElement(tag); }, addEventListener(){}, removeEventListener(){}
  };
  class StorageStub { getItem(k){ storageHistory.getItem.push({key:k}); return storage.has(k) ? storage.get(k) : null; } setItem(k,v){ const value = String(v); storageHistory.setItem.push({key:k, value}); storage.set(k, value); } removeItem(k){ storageHistory.removeItem.push({key:k}); storage.delete(k); } clear(){ for (const key of [...storage.keys()]) this.removeItem(key); } }
  class URLStub extends URL {}
  URLStub.createObjectURL = () => 'blob:test';
  URLStub.revokeObjectURL = () => {};
  const context = { console, document, window: null, globalThis: null, localStorage: new StorageStub(), sessionStorage: new StorageStub(), __localStorageData: storage, __localStorageHistory: storageHistory,
    navigator: { userAgent: 'node-test' }, location: { href: 'http://localhost/' }, crypto: { randomUUID: () => `test-${random().toString(16).slice(2)}` },
    Blob: class Blob { constructor(parts, opts){ this.parts = parts; this.type = opts?.type || ''; } async text(){ return this.parts.join(''); } },
    URL: URLStub, FormData: class { constructor(){ } entries(){ return []; } },
    EventTarget, Event, CustomEvent: global.CustomEvent || class CustomEvent extends Event { constructor(type, init={}){ super(type); this.detail = init.detail; } },
    setTimeout, clearTimeout, requestAnimationFrame: cb => setTimeout(cb, 0), getComputedStyle: () => ({ getPropertyValue: () => '#efb85b' }), confirm: () => true, alert(){}, addEventListener(){}, removeEventListener(){}
  };
  if (options.random) {
    context.Math = Object.create(Math);
    context.Math.random = random;
  }
  context.window = context; context.globalThis = context;
  return vm.createContext(context);
}
function loadGame(options = {}) {
  return loadGameFromHtml(readIndex(), options);
}
function loadGameFromHtml(html, options = {}) {
  const scripts = extractScripts(html);
  let code = scripts.map(s => s.code).join('\n');
  code = code.replace('const engine = TycoonEngine.load();', 'const engine = globalThis.__ct_engine = TycoonEngine.load();');
  const ctx = createBrowserContext(options);
  vm.runInContext(code, ctx, { filename: 'index.html' });
  return { ctx, modules: ctx.__capitalismTycoonModules, engineModule: ctx.__capitalismTycoonModules.engine };
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
module.exports = { ROOT, INDEX, BIDI, readIndex, parseAttrs, extractScripts, extractEventHandlers, createBrowserContext, loadGame, loadGameFromHtml, findStateIssues };
