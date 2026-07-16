'use strict';

const assert = require('node:assert/strict');
const { URL } = require('node:url');
const { readIndex, extractScripts, loadGame } = require('./harness');

async function main() {
  const index = readIndex();
  const moduleScript = extractScripts(index).find(script => script.src === './js/release-diagnostics-ui.js');
  assert.ok(moduleScript, 'release diagnostics module must be loaded from index.html');
  assert.match(moduleScript.code, /data-release-diagnostics-card/);
  assert.match(moduleScript.code, /最新版で再起動/);
  assert.match(moduleScript.code, /診断情報をコピー/);
  assert.doesNotMatch(moduleScript.code, /localStorage\.setItem|localStorage\.removeItem|localStorage\.clear/,
    'diagnostics UI must never mutate save storage');

  const { modules } = loadGame();
  const diagnostics = modules.releaseDiagnosticsUI;
  assert.ok(diagnostics?.__installed, 'release diagnostics module must install');
  for (const name of [
    'diagnosticSnapshot','renderKey','renderCard','latestLaunchUrl','diagnosticText',
    'copyText','settingsVisible','enhance','handleClick','install'
  ]) assert.equal(typeof diagnostics[name], 'function', `${name} export missing`);

  assert.equal(diagnostics.VERSION, '2.0.0-rc.1');
  assert.equal(diagnostics.SAVE_KEY, 'capitalism_tycoon_web_v1');
  assert.equal(diagnostics.SAVE_VERSION, 9);
  assert.equal(diagnostics.SAFE_ENTRY, 'play.html');

  let reads = 0;
  const env = {
    location: {
      href: 'https://yutaro-j31.github.io/capitalism-tycoon-web/play.html?reload=test',
      pathname: '/capitalism-tycoon-web/play.html'
    },
    navigator: { userAgent: 'iPhone <WebKit>', onLine: true },
    localStorage: {
      getItem(key) {
        reads++;
        assert.equal(key, diagnostics.SAVE_KEY);
        return JSON.stringify({ week: 27, companyCash: 123456789, privateNote: 'not for diagnostics' });
      }
    }
  };

  const snapshot = diagnostics.diagnosticSnapshot(env);
  assert.equal(reads, 1);
  assert.equal(snapshot.gameVersion, '2.0.0-rc.1');
  assert.equal(snapshot.saveVersion, 9);
  assert.equal(snapshot.entrypoint, 'play.html');
  assert.equal(snapshot.launchMode, '最新版起動');
  assert.equal(snapshot.week, 27);
  assert.equal(snapshot.saveReadable, true);
  assert.equal(snapshot.online, true);
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'companyCash'), false,
    'diagnostics must not expose game finances');

  const html = diagnostics.renderCard(snapshot);
  assert.match(html, /起動・診断情報/);
  assert.match(html, /第27週/);
  assert.match(html, /最新版起動/);
  assert.ok(!html.includes('<WebKit>'), 'diagnostics HTML must not expose unescaped support data');

  const firstKey = diagnostics.renderKey(snapshot);
  const secondKey = diagnostics.renderKey({ ...snapshot });
  assert.equal(firstKey, secondKey, 'same diagnostics must have a stable render key');
  assert.notEqual(firstKey, diagnostics.renderKey({ ...snapshot, week: 28 }));

  const launch = diagnostics.latestLaunchUrl({
    location: { href: 'https://yutaro-j31.github.io/capitalism-tycoon-web/index.html?stale=1#old' },
    URL
  });
  const parsedLaunch = new URL(launch);
  assert.equal(parsedLaunch.pathname, '/capitalism-tycoon-web/play.html');
  assert.equal(parsedLaunch.searchParams.has('stale'), false);
  assert.equal(parsedLaunch.hash, '');
  assert.ok(parsedLaunch.searchParams.get('reload'));

  let copied = '';
  const copyEnv = { navigator: { clipboard: { async writeText(value) { copied = value; } } } };
  assert.equal(await diagnostics.copyText('diagnostic payload', copyEnv), true);
  assert.equal(copied, 'diagnostic payload');

  const text = diagnostics.diagnosticText(env);
  const parsedText = JSON.parse(text);
  assert.equal(parsedText.week, 27);
  assert.equal(typeof parsedText.generatedAt, 'string');
  assert.equal(Object.prototype.hasOwnProperty.call(parsedText, 'companyCash'), false);
  assert.equal(text.includes('privateNote'), false);

  assert.equal(diagnostics.settingsVisible({ querySelector: selector => selector === 'button[data-action="save-now"]' ? {} : null }), true);
  assert.equal(diagnostics.settingsVisible({ querySelector: () => null }), false);

  const broken = diagnostics.diagnosticSnapshot({
    location: { pathname: '/capitalism-tycoon-web/index.html' },
    navigator: { userAgent: 'test', onLine: false },
    localStorage: { getItem() { throw new Error('storage blocked'); } }
  });
  assert.equal(broken.launchMode, '通常起動');
  assert.equal(broken.online, false);
  assert.equal(broken.saveReadable, false);
  assert.equal(broken.week, null);

  console.log('release diagnostics UI tests passed');
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
