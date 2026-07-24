'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, readIndex } = require('./harness');

const html = readIndex();
const css = fs.readFileSync(path.join(ROOT, 'css', 'app.css'), 'utf8');

function metaTag(name) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(match => match[0])
    .find(tag => new RegExp(`\\bname=(['"])${name}\\1`, 'i').test(tag));
}

function minimumPixelHeight(selectorPattern, label) {
  const rules = [...css.matchAll(new RegExp(`${selectorPattern}\\{([^}]*)\\}`, 'g'))];
  assert.ok(rules.length > 0, `${label} rule is required`);
  const declaration = rules
    .map(rule => rule[1].match(/(?:^|;)min-height:(\d+(?:\.\d+)?)px(?:;|$)/))
    .find(Boolean);
  assert.ok(declaration, `${label} must define a pixel min-height`);
  return Number(declaration[1]);
}

const viewport = metaTag('viewport');
assert.ok(viewport, 'viewport meta tag is required');
for (const token of ['width=device-width', 'initial-scale=1', 'viewport-fit=cover']) {
  assert.ok(viewport.includes(token), `viewport meta tag must include ${token}`);
}

assert.match(html, /<meta\b[^>]*charset=(['"])?utf-8\1?[^>]*>/i, 'UTF-8 charset meta tag is required');
assert.ok(metaTag('theme-color'), 'theme-color meta tag is required');
assert.match(css, /body\{[^}]*padding-bottom:calc\([^)]*env\(safe-area-inset-bottom\)/, 'body must reserve the bottom safe area');
assert.match(css, /safe-area-inset-left/, 'horizontal layout must account for the left safe area');
assert.match(css, /safe-area-inset-right/, 'horizontal layout must account for the right safe area');
assert.match(css, /button\{[^}]*touch-action:manipulation/, 'buttons must opt into direct touch manipulation');
assert.ok(minimumPixelHeight('\\.btn', 'primary button') >= 42, 'primary button contract must keep a mobile-sized touch target');
assert.ok(minimumPixelHeight('input,select', 'form controls') >= 43, 'form controls must keep a mobile-sized touch target');
assert.match(css, /\.tabs\{[^}]*overflow-x:auto/, 'bottom navigation must remain horizontally reachable');
assert.match(css, /\.modal\{[^}]*max-height:86vh;overflow:auto/, 'modals must remain scrollable inside the viewport');
assert.match(css, /\.setup-shell\{[^}]*min-height:100vh/, 'first-run setup must fill the viewport');
assert.match(css, /@media\(max-width:720px\)/, 'the compact mobile breakpoint is required');
assert.match(css, /@media\(max-width:720px\)\{[^}]*body\{[^}]*safe-area-inset-bottom/, 'mobile layout must preserve bottom safe-area spacing');

console.log('mobile release contract passed');
