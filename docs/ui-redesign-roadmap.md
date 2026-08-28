# UIリスキン（D UI shell拡張）ロードマップ

CI2（Coffee Inc 2）風の見た目・UXを目指すUIリスキンの計画・進捗を記録するファイル。
ChatGPT/Codex等、Claude Code以外のツールで作業を引き継ぐ場合もこのファイルを参照する。
方針そのものはCLAUDE.mdの「UIリスキン（D UI shell拡張）の方針」節を参照。

## 背景

オーナーからのフィードバック: これまでゲームの基盤（経営シミュレーションの機能面）を
厚く作り込んできたが、実際にプレイすると「プレイしづらい」。CI2のスクリーンショットを
確認したところ、CI2は「1施設に集中したドリルダウン画面」「大きな数字表示」「アイコンだけの
下部ナビ」「ダークで統一感のある配色」という明確なUX構造を持ち、これがプレイしやすさの
正体だと考えられる。見た目とUXの両方を真似たいとの要望。

**重要な事前調査結果**: このゲームには既に `js/d-ui-shell.js` / `js/d-ui-context-tabs.js` という
「D UIシェル」が存在し、これは**現在デフォルトで全プレイヤーに表示されている本番UI**である。
ダークネイビー×ゴールドの配色、KPIタイル、アイコンだけの下部ナビ・サイドバー、マップ画面の
建物マーカー→ドリルダウン、店舗詳細の4タブ切替、ニュース画面の6タブ切替まで、CI2的な方向性は
既に一部実装・本番投入済み（`docs/phase-7a1-d-ui-shell.md`, `docs/phase-7a2-reference-fidelity.md`参照）。

未着手なのは全19タブ中「map・store詳細・news」の3箇所のみで、事業・本社・銀行・株式・M&A・
戦略などの残り約16タブは旧来の`.card`/`.kpi-grid`の密なテキストグリッドのまま。
「プレイしづらい」の正体はおそらくこの一貫性の欠如（一部だけ綺麗、大半は旧UI）である。
したがって新しいデザイン言語を発明するのではなく、**既に本番稼働・テスト済みのD UIパターンを
残り全画面へ画面単位で拡張していく**のが最短距離であり、本計画の中核方針。

**著作権上の制約**: CI2の実際のイラスト・アセット（街並み・建物内観・キャラクター）は
模写・トレースしない。真似るのはレイアウト・操作の流儀（構造・配色トークン・情報密度）
のみで、絵柄はすべてオリジナルとする。

## 技術的な制約（調査で確定した事実）

1. **UIエンハンサー登録数が79/79で余裕ゼロ**（`tests/startup-runtime-budget-test.js`の
   `LIMITS.externalEnhancerRegistrations=79`）。新しい`registerUIEnhancer()`呼び出しを
   気軽に増やせない。動的な後処理（マーカー選択など）が不要な画面は、JSエンハンサーを
   増やさず、app.js側のテンプレート文字列に`d-`プレフィックスのクラスを直接足すだけで
   リスキンする（CSSのみで完結）。
2. **`css/app.css`はバイト完全一致テスト**（`tests/css-extraction-test.js` /
   `tests/business-screen-tap-target-test.js`が`tests/fixtures/extracted-css-baseline.css`と
   比較）で固定されている。新しい見た目のCSSは既存の`css/d-ui-*.css`系ファイル
   （`css/d-ui.css`が`:root`トークンを持ち、`css/d-ui-mobile-company.css`が`@import`で
   他ファイルを束ねる既存パターン）に追加し、`css/app.css`は一切変更しない。
3. **MutationObserver 0本を維持**。動的処理は既存の`uiEnhancerRegistry`経由のみ、
   タイマー・observer類は禁止（`tests/d-ui-shell-test.js`が静的にgrep検証）。
4. 新規JSファイルは`index.html`と`tests/fixtures/module-load-order.json`の両方に
   同じ位置で登録が必要。
5. `js/app.js`はDOM依存のためNode単体テストで直接実行できない。既存パターン
   （`tests/store-comparison-table-test.js`等）と同じく、ソースをテキストとして読み、
   正規表現で該当関数を抽出し、期待するクラス名・既存フィールド参照を静的にassertする
   方式でテストする。実際の描画確認はPlaywrightのスクラッチスクリプト（常設テスト化しない）で行う。
6. 一部の既存テスト（`tests/business-portfolio-focus-test.js`等）は「関数内で使われる
   `class="..."`が全て`css/app.css`に存在すること」を検証しており、新しい`d-`クラスを
   導入するとこのチェックに引っかかる。このチェックを`css/d-ui-*.css`も見るように
   意図的に拡張する（既存の安全網の対象範囲を、map/newsで既に確立されている
   「2ファイル構成」に合わせて広げるだけ）。

## 推奨アプローチ：画面単位の段階的PR

1機能1PRの原則に倣い、画面（タブ）単位で1PRずつD UIパターンへ拡張する。
各PRは「見た目だけを変えるプレゼンテーション層の変更」に限定し、
`engine.js`/`market.js`/`finance.js`等の計算ロジックには一切触れない。

## Phase進捗

- [x] 前準備: CLAUDE.mdへの方針追加、本ファイルの新規作成
- [x] Phase 1: マップ画面の密度強化（`js/d-ui-shell.js`の`renderMapWorkspace()`の
      建物ブロック描画部分をアイソメトリック立方体（屋根/左面/右面の3ポリゴン）に強化。
      窓の帯・ゾーン別色相・橋・公園の木を追加。マーカー配置ロジック・ドリルダウンは無変更）
- [ ] Phase 2: 事業（business）画面のD UIリスキン（`js/app.js`の`businessFullCard()`等に
      アイコン＋週次利益の大きな数字表示のヒーロー、金色グラデーション枠を追加）
- [ ] Phase 3以降: office（本社）→ bank（銀行）→ market（株式）→ 残りの画面
      （venture/M&A/overseas/assets/report/founder/strategy/media/legacy/missions/rivals/settings）
      をプレイテストしながら優先度を判断

各PhaseはPhase 1・2と同じ型（新規`css/d-ui-<screen>.css`・既存クラス存在チェックの拡張・
静的アサーションテスト・Playwrightスクラッチ確認・負のテスト2パターン）を反復する。

## 別枠の軽微な発見（本計画のスコープ外、将来の小さなクリーンアップ候補）

- `css/app.css`の`--accent`/`--good`/`--warn`/`--danger`が`:root`で未定義のまま
  4箇所で参照されている（無効値になっている）
- `tests/d-ui-shell-test.js` / `tests/d-ui-context-tabs-test.js` /
  `tests/d-ui-reference-fidelity-test.js`がどのシャード（B〜H）にも明示登録されておらず、
  暗黙のシャードAに落ちている
