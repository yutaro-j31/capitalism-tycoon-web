'use strict';
// Test-time runtime guard for root cash writes (Track B1, Owner decision 2026-10-20).
// Every assignment to state.companyCash / state.personalCash on an engine's root state is
// attributed to the production function that made it, from the stack trace. The fields become
// enumerable accessors on the live root, so JSON, structuredClone and saves see plain values.
const FIELDS = ['companyCash', 'personalCash'];
// runTransaction and the wrappers other modules install around it never write cash themselves.
const TRANSPARENT = /(^|\.)runTransaction$/;

function frameSource(scriptMap, line) {
  let file = '(unknown)';
  for (const row of scriptMap) { if (row.line <= line) file = row.file; else break; }
  return file;
}

function installCashWriteGuard(loaded) {
  const writes = new Map();
  const scriptMap = loaded.scriptMap || [];
  function attribute() {
    const saved = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, frames) => frames;
    const frames = new Error().stack;
    Error.prepareStackTrace = saved;
    let site = null;
    for (const frame of frames) {
      if (frame.getFileName() !== 'index.html') continue;
      const file = frameSource(scriptMap, frame.getLineNumber());
      const fn = frame.getFunctionName() || frame.getMethodName() || '';
      if (!site) {
        site = `${file}#${fn || '(anonymous)'}`;
        if (fn) return site;
        continue;
      }
      // An anonymous writer (typically a runTransaction callback) is named by the
      // nearest enclosing production function, so different actions stay distinct.
      if (fn && !TRANSPARENT.test(fn)) return `${site}<${file}#${fn}`;
    }
    return site || '(test)';
  }
  const ours = new WeakSet();
  // Re-installed whenever a field is no longer our accessor (delete + Object.assign replaces it).
  function guardRoot(state) {
    if (!state || typeof state !== 'object') return state;
    for (const field of FIELDS) {
      const d = Object.getOwnPropertyDescriptor(state, field);
      if (!d || (d.get && ours.has(d.get))) continue; // absent fields are left alone
      let value = state[field];
      const get = () => value;
      ours.add(get);
      Object.defineProperty(state, field, {
        enumerable: true, configurable: true,
        get,
        set(next) { const site = attribute(); writes.set(site, (writes.get(site) || 0) + 1); value = next; }
      });
    }
    return state;
  }
  const proto = loaded.engineModule.TycoonEngine.prototype;
  const slot = Symbol('g');
  Object.defineProperty(proto, 'g', {
    configurable: true,
    get() { return guardRoot(this[slot]); },
    set(next) { this[slot] = guardRoot(next); }
  });
  return { writes, guardRoot };
}
module.exports = { installCashWriteGuard };
