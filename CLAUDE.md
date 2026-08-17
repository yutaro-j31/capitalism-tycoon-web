# ゲームデザインの方向性
- Capitalism（Capitalism II / Lab）と Coffee Inc 2 を合わせた
  経営シミュレーションとして開発している
- プレイヤーの進行は「ラーメン屋1店舗で創業 → 本社・本部を設立 →
  多角経営として他業種へ進出」。他業種は最初から全部開いているのではなく、
  本社機能の獲得を経て段階的に開放される想定
- そのため market.js / supply.js / workforce.js の
  TARGET_BUSINESS_IDS が現在 ramen のみなのは未完成ではなく、
  この進行に沿った意図的な状態。業種を増やすときは
  「全業種に一括で広げる」のではなく、アンロック順に1業種ずつ広げ、
  そのたびに決定論の指紋（transaction-baseline / market-calibration）を
  更新する
- 現状の実装比重は金融・M&A・不動産・ガバナンスに厚く、
  事業オペレーション（市場・供給・労働力・店舗運営）が薄い。
  機能追加の判断に迷ったらオペレーション側を優先する
- 同様に会社側の機能は厚く個人側は薄い（不動産は会社46モジュールに対し
  個人は売買のみ、買収後の経営は会社PMI多数に対し個人PEは施策1種のみ）。
  個人側を作るときは会社側の既存モデルを流用できないか先に確認する。
  ただし「会社資産と個人資産の分離」は不変条件なので、共有するのは
  計算ロジックだけにし、資産・現金の帰属は必ず分ける
- オーナーが Manus や ChatGPT で考えた新要素を持ち込む運用がある。
  提案を受けたら docs/feature-requests.md へ追記し、着手前に必ず
  「現状どこまで実装済みか」を調べてから実装方針を立てる
  （既存機能を新規実装として作り直す事故を防ぐため）

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
- CIワークフローが手前のステップでずっと落ちていると、その後のステップは
  何週間もskippedのまま実行されず、奥に埋まった別の回帰が誰にも気づかれない。
  「直近の失敗ログ」だけを見て原因を1つに決め打ちしない。1つ直すたびに
  ジョブのstep一覧を見て、次のstepが新しく走り始めていないか確認する
- push トリガーに paths: フィルタがあるworkflowは、フィルタ対象外のファイルを
  何回直してもCI上で一切発火しない。赤いworkflowを直したら
  workflow_dispatch で対象ブランチに対して手動発火し、実際に直ったか確認する
- play.html は index.html への location.replace リダイレクトのみ（document.write
  もfetchも使わない、iOS Safariでの不安定を避けるため）。「play.htmlのURLに
  留まる」「スクリプトごとに?launch=トークンが付く」という前提のコードは古い。
  Cache-bust の合図が必要な場合は search に v= があるかで判定する
  （pathnameがplay.htmlのままになることは実行時には起きない）
- ローカルの `main` ブランチは自動で最新化されない。`git checkout main` は
  fetchしても更新しないので、他ブランチで作業した直後に main へ戻ると
  作業ディレクトリのファイルが古い内容に巻き戻る。ブランチを跨ぐ前に必ず
  `git fetch origin <branch> && git merge --ff-only origin/<branch>` で
  ローカルブランチ自体を進めてから checkout する

# 検証手順
単体テスト → 208週到達テスト → 発生率検証 →
負のテスト（意図的に壊して赤くなることを2〜3パターン確認）→ 変更ファイル関連の個別テスト。
npm test 全体は1時間級なので完走させない。最終判断はCIに委ねる。
