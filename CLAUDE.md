# 絶対に守る不変条件
- SAVE_KEY=capitalism_tycoon_web_v1 と saveVersion=9 を変更しない
- 既存セーブ互換・決定論・会計整合性・会社資産と個人資産の分離を維持
- テストを通すために本番挙動を変えない。テストを削除しない。
  timeout-minutes を延長しない。アサーションを緩めない
- 新規JSファイルを足したら index.html への追加と
  tests/fixtures/module-load-order.json の更新を同じ作業内で行う
- production起動経路の MutationObserver は0本を維持（registerUIEnhancer を使う。
  new MutationObserver と new env.MutationObserver の両方をgrepする）
- external enhancer registrations の上限は79（startup-runtime-budget テスト）
- CI実行中に追加pushをしない
- 撤去作業は着手前に全箇所を grep する
- 1機能1PR。ブランチ名は feat/ fix/ ci/ refactor/ docs/ のいずれか

# 既知の落とし穴
- テストで random:()=>0.42 のような固定乱数を使うと uuid() が全部同じ値になり、
  テナント376件のIDが1個に潰れる。決定論的LCGを使う
- css-extraction-test.js は css/app.css と
  tests/fixtures/extracted-css-baseline.css のバイト完全一致を要求する
- 競合を増やすと tests/fixtures/transaction-baseline-v1.json の randomCalls がずれる。
  会計・現金・取引数まで変わっていたらそれは指紋更新ではなくバグ
- market-calibration は tokyo と osaka を使う。その2市場に競合を足すと赤くなる
- シャード割り当ては tests/run-all-shards.json。B/C/Dに明示割り当てしない限り
  シャードAに落ちるので、新規テストは軽いシャードへ明示割り当てする
- tests/product-recall-reachability-runner.js は run-all.js ではなく
  run-all-shard.js 内の runRegisteredNodeTest() で登録されている
- iOS Safari はDOM未接続の a への click() と download 属性を無視する
- canonical suite は4シャード並列・timeout 15分。最長Cが12分45秒で余裕は約2分15秒

# 検証手順
単体テスト → 208週到達テスト → 発生率検証 →
負のテスト（意図的に壊して赤くなることを2〜3パターン確認）→ 変更ファイル関連の個別テスト。
npm test 全体は1時間級なので完走させない。最終判断はCIに委ねる。
