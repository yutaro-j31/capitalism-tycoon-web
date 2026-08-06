// Browser boot diagnostics. Active only when ?boot-diagnostics=observe|force is present.
(function () {
  'use strict';

  function queryValue(name) {
    const search = String(globalThis.location?.search || '').replace(/^\?/, '');
    if (!search) return '';
    for (const entry of search.split('&')) {
      const [rawKey, ...rawValue] = entry.split('=');
      try {
        if (decodeURIComponent(rawKey || '') === name) return decodeURIComponent(rawValue.join('=') || '');
      } catch (_) {}
    }
    return '';
  }

  const requestedMode = queryValue('boot-diagnostics');
  // Canonical Node tests execute every index script without a real browser. Inert
  // mode must not install clocks, wrappers or globals in that environment.
  if (!requestedMode) return;

  const mode = requestedMode === 'force' ? 'force' : 'observe';
  const threshold = Math.max(100, Number(queryValue('observer-threshold')) || 10000);
  const probeID = queryValue('probe');
  const pulseURL = probeID ? `/__boot-diagnostics/pulse?probe=${encodeURIComponent(probeID)}` : '';
  const startedAt = Date.now();
  const nativeMutationObserver = globalThis.MutationObserver;
  const nativeQueueMicrotask = typeof globalThis.queueMicrotask === 'function'
    ? globalThis.queueMicrotask.bind(globalThis)
    : callback => Promise.resolve().then(callback);
  const observers = new Set();
  let activeOwner = '';
  let forced = false;
  let publishTimer = null;
  let lastPulseBucket = -1;

  const metrics = {
    version: 2,
    enabled: true,
    mode,
    threshold,
    probeID,
    startedAt: new Date(startedAt).toISOString(),
    updatedAt: new Date(startedAt).toISOString(),
    elapsedMs: 0,
    stage: 'diagnostics-initialized',
    readyState: globalThis.document?.readyState || 'unavailable',
    observerRegistrations: 0,
    observerCallbacks: 0,
    mutationRecords: 0,
    callbacksWhileSetupVisible: 0,
    microtasksScheduled: 0,
    microtasksRun: 0,
    droppedMicrotasks: 0,
    forceDisconnected: false,
    forceDisconnectedAtCount: null,
    firstAnimationFrameAtMs: null,
    domContentLoadedAtMs: null,
    loadAtMs: null,
    byOwner: Object.create(null),
    timeline: []
  };

  const combinedActivity = () => metrics.observerCallbacks + metrics.microtasksScheduled + metrics.microtasksRun;

  function clip(value, max = 220) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function scriptOwner() {
    const current = globalThis.document?.currentScript;
    if (current) {
      const source = current.getAttribute?.('src');
      if (source) return source.replace(/^.*\/js\//, 'js/');
      for (const attr of current.attributes || []) {
        if (attr.name.startsWith('data-')) return `inline:${attr.name}`;
      }
      return 'inline-script';
    }
    if (activeOwner) return activeOwner;
    try {
      const stack = String(new Error().stack || '');
      const match = stack.match(/(?:https?:\/\/[^)\s]+\/)?(js\/[^):\s?]+)/);
      if (match) return match[1];
    } catch (_) {}
    return 'unknown';
  }

  function ownerRow(owner) {
    const key = clip(owner || 'unknown', 180) || 'unknown';
    if (!metrics.byOwner[key]) {
      metrics.byOwner[key] = {
        observerRegistrations: 0,
        observerCallbacks: 0,
        mutationRecords: 0,
        microtasksScheduled: 0,
        microtasksRun: 0,
        droppedMicrotasks: 0
      };
    }
    return metrics.byOwner[key];
  }

  function timeline(type, owner = '') {
    if (metrics.timeline.length >= 160) return;
    metrics.timeline.push({ atMs: Date.now() - startedAt, type: clip(type, 80), owner: clip(owner, 180) });
  }

  function compactSnapshot(reason) {
    metrics.updatedAt = new Date().toISOString();
    metrics.elapsedMs = Date.now() - startedAt;
    metrics.readyState = globalThis.document?.readyState || 'unavailable';
    if (reason) metrics.stage = reason;
    const owners = Object.entries(metrics.byOwner)
      .map(([owner, values]) => ({ owner, ...values }))
      .sort((a, b) =>
        b.observerCallbacks - a.observerCallbacks ||
        b.microtasksScheduled - a.microtasksScheduled ||
        b.mutationRecords - a.mutationRecords
      );
    return {
      ...metrics,
      combinedActivity: combinedActivity(),
      byOwner: undefined,
      topOwners: owners.slice(0, 30),
      ownerCount: owners.length
    };
  }

  function publishPulse(value, force = false) {
    if (!pulseURL || typeof globalThis.navigator?.sendBeacon !== 'function') return;
    const bucket = Math.floor((value.combinedActivity || 0) / 100);
    if (!force && bucket === lastPulseBucket) return;
    lastPulseBucket = bucket;
    try {
      globalThis.navigator.sendBeacon(pulseURL, JSON.stringify(value));
    } catch (_) {}
  }

  function snapshot(reason, pulse = false) {
    const value = compactSnapshot(reason);
    globalThis.__capitalismTycoonBootDiagnostics = value;
    if (pulse) publishPulse(value, reason === 'observer-threshold-disconnected');
    return value;
  }

  function forceDisconnect(reason) {
    if (forced || mode !== 'force') return false;
    forced = true;
    for (const observer of observers) {
      try { observer.disconnect(); } catch (_) {}
    }
    metrics.forceDisconnected = true;
    metrics.forceDisconnectedAtCount = combinedActivity();
    timeline(`force-disconnect:${reason}`);
    snapshot('observer-threshold-disconnected', true);
    return true;
  }

  function enforceThreshold(reason) {
    if (combinedActivity() >= threshold) forceDisconnect(reason);
  }

  function mark(stage) {
    timeline(stage);
    return snapshot(stage, true);
  }

  Object.defineProperty(globalThis, '__capitalismTycoonMarkBootStage', { configurable: true, value: mark });
  snapshot('diagnostics-initialized', true);

  if (typeof nativeMutationObserver === 'function') {
    function DiagnosticMutationObserver(callback) {
      if (!(this instanceof DiagnosticMutationObserver)) {
        throw new TypeError("Failed to construct 'MutationObserver': Please use the 'new' operator.");
      }
      const owner = scriptOwner();
      metrics.observerRegistrations += 1;
      ownerRow(owner).observerRegistrations += 1;
      timeline('observer-register', owner);
      const observer = new nativeMutationObserver((records, nativeObserver) => {
        if (forced) return;
        metrics.observerCallbacks += 1;
        metrics.mutationRecords += records?.length || 0;
        if (globalThis.document?.getElementById?.('setup-form')) metrics.callbacksWhileSetupVisible += 1;
        const row = ownerRow(owner);
        row.observerCallbacks += 1;
        row.mutationRecords += records?.length || 0;
        enforceThreshold('observer-callback');
        if (forced) return;
        const previousOwner = activeOwner;
        activeOwner = owner;
        try {
          callback(records, nativeObserver);
        } finally {
          activeOwner = previousOwner;
          if (combinedActivity() % 100 < 3) snapshot('observer-callbacks-running', true);
          enforceThreshold('observer-callback-complete');
        }
      });
      observers.add(observer);
      return observer;
    }
    DiagnosticMutationObserver.prototype = nativeMutationObserver.prototype;
    try { Object.setPrototypeOf(DiagnosticMutationObserver, nativeMutationObserver); } catch (_) {}
    globalThis.MutationObserver = DiagnosticMutationObserver;
  }

  globalThis.queueMicrotask = function diagnosticQueueMicrotask(callback) {
    const owner = scriptOwner();
    metrics.microtasksScheduled += 1;
    ownerRow(owner).microtasksScheduled += 1;
    enforceThreshold('microtask-scheduled');
    if (forced) {
      metrics.droppedMicrotasks += 1;
      ownerRow(owner).droppedMicrotasks += 1;
      return;
    }
    if (combinedActivity() % 100 < 3) snapshot('microtasks-running', true);
    return nativeQueueMicrotask(() => {
      if (forced) {
        metrics.droppedMicrotasks += 1;
        ownerRow(owner).droppedMicrotasks += 1;
        return;
      }
      metrics.microtasksRun += 1;
      ownerRow(owner).microtasksRun += 1;
      enforceThreshold('microtask-run');
      if (forced) return;
      const previousOwner = activeOwner;
      activeOwner = owner;
      try {
        return callback();
      } finally {
        activeOwner = previousOwner;
        enforceThreshold('microtask-complete');
      }
    });
  };

  globalThis.document?.addEventListener?.('DOMContentLoaded', () => {
    metrics.domContentLoadedAtMs = Date.now() - startedAt;
    mark('dom-content-loaded');
  }, { once: true });

  globalThis.addEventListener?.('load', () => {
    metrics.loadAtMs = Date.now() - startedAt;
    mark('window-loaded');
  }, { once: true });

  if (typeof globalThis.requestAnimationFrame === 'function') {
    globalThis.requestAnimationFrame(() => {
      metrics.firstAnimationFrameAtMs = Date.now() - startedAt;
      mark('first-animation-frame');
    });
  }

  publishTimer = globalThis.setInterval?.(() => snapshot('interval-snapshot', true), 500) || null;
  globalThis.setTimeout?.(() => {
    if (publishTimer && metrics.loadAtMs !== null) {
      globalThis.clearInterval?.(publishTimer);
      publishTimer = null;
    }
    snapshot(metrics.loadAtMs === null ? 'ten-second-snapshot' : 'stable', true);
  }, 10000);
})();
