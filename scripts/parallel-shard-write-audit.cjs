'use strict';

// Optional Node API observation only. Not a sandbox or a production runner hook.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const cp = require('node:child_process');
const { promisify } = require('node:util');

function install(directory) {
  const marker = Symbol.for('parallel-shard-write-audit.installed');
  if (globalThis[marker]) return;
  globalThis[marker] = true;
  const open = fs.openSync, write = fs.writeSync, close = fs.closeSync;
  fs.mkdirSync(directory, { recursive: true });
  const output = path.join(directory, `${process.pid}.jsonl`);
  function record(operation, target, destination) {
    const event = { pid: process.pid, cwd: process.cwd(), operation, target: typeof target === 'number' ? target : String(target ?? '') };
    if (destination !== undefined) event.destination = String(destination);
    // Use captured native descriptor calls: observing our own log would recurse.
    const fd = open(output, 'a');
    try {
      const bytes = Buffer.from(JSON.stringify(event) + '\n');
      for (let offset = 0; offset < bytes.length;) {
        const count = write(fd, bytes, offset, bytes.length - offset);
        if (count <= 0) throw new Error('write audit could not retain a complete event');
        offset += count;
      }
    } finally { close(fd); }
  }
  function wrap(object, key, observe) {
    const original = object[key];
    if (typeof original !== 'function') return;
    const replacement = function(...args) { observe(args); return Reflect.apply(original, this, args); };
    // Preserve promisified fs descriptor result shapes and custom implementations.
    for (const symbol of Object.getOwnPropertySymbols(original)) {
      const descriptor = Object.getOwnPropertyDescriptor(original, symbol);
      if (symbol === promisify.custom && typeof descriptor.value === 'function') {
        const custom = descriptor.value;
        descriptor.value = function(...args) { observe(args); return Reflect.apply(custom, this, args); };
      }
      Object.defineProperty(replacement, symbol, descriptor);
    }
    object[key] = replacement;
  }
  const mutations = ['writeFile', 'appendFile', 'createWriteStream', 'rename', 'copyFile', 'cp', 'unlink', 'rm',
    'rmdir', 'mkdir', 'truncate', 'ftruncate', 'write', 'writev', 'link', 'symlink', 'chmod', 'fchmod',
    'chown', 'fchown', 'lchown', 'utimes', 'futimes', 'lutimes', 'mkdtemp'];
  const writes = flags => typeof flags === 'number'
    ? Boolean(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND))
    : /[wa+]/.test(String(flags ?? 'r'));
  const dualPaths = new Set(['rename', 'copyFile', 'cp', 'link', 'symlink']);
  for (const name of mutations) {
    for (const key of [name, `${name}Sync`]) wrap(fs, key, args => record(`fs.${key}`, args[0], dualPaths.has(name) ? args[1] : undefined));
    wrap(fs.promises, name, args => record(`fs.promises.${name}`, args[0], dualPaths.has(name) ? args[1] : undefined));
  }
  for (const key of ['open', 'openSync']) wrap(fs, key, args => { if (writes(args[1])) record(`fs.${key}`, args[0]); });
  const promiseOpen = fs.promises.open;
  fs.promises.open = async function(...args) {
    if (writes(args[1])) record('fs.promises.open', args[0]);
    const handle = await Reflect.apply(promiseOpen, this, args);
    for (const name of ['write', 'writev', 'writeFile', 'appendFile', 'truncate', 'chmod', 'chown', 'utimes', 'createWriteStream'])
      wrap(handle, name, () => record(`FileHandle.${name}`, args[0]));
    return handle;
  };
  wrap(net.Server.prototype, 'listen', args => record('net.listen', typeof args[0] === 'object' ? args[0]?.port ?? args[0]?.path : args[0]));
  wrap(process, 'chdir', args => record('process.chdir', args[0]));
  // Subprocesses can bypass Node fs hooks. Record the executable, not payloads or environment.
  for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'])
    wrap(cp, name, args => record(`child_process.${name}`, name.startsWith('exec') && !name.startsWith('execFile') ? '[shell command omitted]' : args[0]));
  record('initialized', 'node-api-audit-v1');
}

if (process.env.PSR_WRITE_AUDIT_DIR) install(path.resolve(process.env.PSR_WRITE_AUDIT_DIR));
module.exports = { install };
