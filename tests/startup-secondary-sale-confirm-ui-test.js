'use strict';

// Priority 5 of the post-#439 audit: sellStartupSecondary() sold the entire position on a
// single click with no proceeds/discount shown beforehand and no way to back out. This wires
// the existing confirmModal() helper (already used for other irreversible actions such as
// 'reset-game'/'company-buyout') in front of the sale, using the new read-only
// previewStartupSecondarySale() (js/expansion.js, covered by
// tests/startup-secondary-sale-test.js) to show the exact proceeds/discount in the
// confirmation text before the real, still-irreversible sale executes.
//
// The test harness's DOM stub does not implement real event dispatch on individual elements
// (makeElement()'s addEventListener is a no-op; only document-level __dispatchTestEvent
// works), so -- matching this repository's existing UI test convention (e.g.
// founding-tutorial-ui-test.js) -- this is verified via static source assertions plus
// rendered-HTML content checks, not simulated clicks.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGame } = require('./harness');
const app = fs.readFileSync('js/app.js', 'utf8');

// 1. The startup-card buttons must dispatch the confirm-wrapping action, not the direct
// mutating action, for both company and personal accounts.
assert.match(app, /btn\('会社持分をセカンダリー売却','sell-startup-secondary-confirm'/, '会社持分ボタンは確認フローを経由する');
assert.match(app, /btn\('個人持分をセカンダリー売却','sell-startup-secondary-confirm'/, '個人持分ボタンは確認フローを経由する');
assert.doesNotMatch(app, /btn\('会社持分をセカンダリー売却','sell-startup-secondary',/, '会社持分ボタンが直接売却アクションを呼ばない');
assert.doesNotMatch(app, /btn\('個人持分をセカンダリー売却','sell-startup-secondary',/, '個人持分ボタンが直接売却アクションを呼ばない');

// 2. The confirm case must compute the preview and hand off to confirmModal without itself
// mutating any state (no direct call to engine.sellStartupSecondary in that case body).
{
  const match = app.match(/case 'sell-startup-secondary-confirm':\{[\s\S]*?\}case 'sell-startup-secondary':/);
  assert.ok(match, 'sell-startup-secondary-confirm ケースが存在する');
  const body = match[0];
  assert.match(body, /engine\.previewStartupSecondarySale\(id,kind\)/, '確認前に読み取り専用のpreviewを使う');
  assert.match(body, /confirmModal\(/, 'confirmModalで確認ダイアログを開く');
  assert.doesNotMatch(body, /engine\.sellStartupSecondary\(/, '確認ダイアログを開くだけの段階ではまだ売却を実行しない（previewのみ）');
}

// 3. The confirmed case executes the real (still irreversible) sale and closes the modal.
{
  const match = app.match(/case 'sell-startup-secondary':engine\.sellStartupSecondary\(id,kind\);closeModal\(\);break;/);
  assert.ok(match, '確認後の実売却ケースがsellStartupSecondaryを呼びモーダルを閉じる');
}

// 4. Rendered venture screen: a startup owned by the company must render a button whose
// data-action is the confirm-wrapping action (not the direct one), proving the source-level
// assertions above actually reach the DOM output for a real game state.
{
  const { modules, ctx } = loadGame({ random: () => 0.37 });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  ctx.__ct_ui.showSetup = false;
  const s = engine.g.startups[0];
  s.ownedCompany = .1;
  engine.g.selectedTab = 'venture';
  engine.emit();
  const rendered = ctx.document.getElementById('app').innerHTML;
  assert.match(rendered, /data-action="sell-startup-secondary-confirm"/, 'レンダリングされたボタンが確認フローのアクションを持つ');
  assert.doesNotMatch(rendered, /data-action="sell-startup-secondary"/, 'レンダリングされたボタンは直接売却アクションを持たない');
  void modules;
}

// 5. Static source scan: no new MutationObserver introduced by this feature.
{
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(app), 'app.jsに新しいMutationObserverを追加していない');
}

console.log('Startup secondary sale confirm UI tests passed');
