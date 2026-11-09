#!/usr/bin/env node
'use strict';

/**
 * Assembles the game snapshot that the iOS shell (ios/App) bundles.
 *
 *   node scripts/build-ios-web-bundle.js [outputDirectory]   (default: ios/build)
 *
 * Output: <outputDirectory>/web/ — index.html, js/, css/, assets/, prototypes/
 *
 * The game files are copied byte-for-byte; nothing is transformed. The script
 * fails when a file the game loads at startup or lazily is missing from the
 * snapshot, so a broken app bundle cannot be produced silently.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

/** Game files and directories that make up the runtime, relative to the repo root. */
const WEB_ENTRIES = ['index.html', 'css', 'js', 'assets', 'prototypes'];

function stripQuery(reference) {
  return reference.replace(/[?#].*$/, '');
}

/** Every `src="…"` / `href="…"` that index.html loads from the repo itself. */
function indexReferences(html) {
  const references = new Set();
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const value = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('#')) continue;
    references.add(path.posix.normalize(stripQuery(value)));
  }
  return [...references].sort();
}

/**
 * Relative asset paths that production JS loads after startup (map sprites,
 * the lazy map prototypes, the vendored three.js). Only string literals that
 * name a concrete file or directory under a runtime directory are collected.
 */
function lazyReferences(jsDirectory) {
  const references = new Set();
  // A complete quoted literal only: prose in comments that merely starts with a
  // quote ("assets/prototypes still loading") must not count as a file reference.
  const pattern = /(['"`])(?:\.\/)?((?:assets|prototypes|js|css)\/[A-Za-z0-9_./-]+)(?:\?[A-Za-z0-9=&_.-]*)?\1/g;
  for (const name of fs.readdirSync(jsDirectory).sort()) {
    if (!name.endsWith('.js')) continue;
    const source = fs.readFileSync(path.join(jsDirectory, name), 'utf8');
    for (const match of source.matchAll(pattern)) references.add(path.posix.normalize(match[2]));
  }
  return [...references].sort();
}

function sourceCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return 'unknown';
  }
}

function build(outputDirectory) {
  const webDirectory = path.join(outputDirectory, 'web');
  fs.rmSync(webDirectory, { recursive: true, force: true });
  fs.mkdirSync(webDirectory, { recursive: true });

  for (const entry of WEB_ENTRIES) {
    const from = path.join(ROOT, entry);
    if (!fs.existsSync(from)) throw new Error(`runtime entry is missing from the repository: ${entry}`);
    fs.cpSync(from, path.join(webDirectory, entry), { recursive: true });
  }

  const html = fs.readFileSync(path.join(webDirectory, 'index.html'), 'utf8');
  const missing = [];
  const startup = indexReferences(html);
  const lazy = lazyReferences(path.join(webDirectory, 'js'));
  for (const reference of [...startup, ...lazy]) {
    if (!fs.existsSync(path.join(webDirectory, reference))) missing.push(reference);
  }
  if (missing.length) throw new Error(`files the game loads are missing from the package: ${missing.join(', ')}`);

  const info = { sourceCommit: sourceCommit(), startupFiles: startup.length, lazyReferences: lazy.length };
  fs.writeFileSync(path.join(webDirectory, 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`);
  return { webDirectory, startup, lazy, info };
}

module.exports = { build, indexReferences, lazyReferences, WEB_ENTRIES };

if (require.main === module) {
  const outputDirectory = path.resolve(process.argv[2] || path.join(ROOT, 'ios', 'build'));
  const result = build(outputDirectory);
  console.log(`built ${result.webDirectory}`);
  console.log(`  startup files: ${result.startup.length}, lazy references: ${result.lazy.length}`);
  console.log(`  source commit: ${result.info.sourceCommit}`);
}
