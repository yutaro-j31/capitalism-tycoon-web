# ゲームデザインの方向性
- Capitalism（Capitalism II / Lab）と Coffee Inc 2 を合わせた
  経営シミュレーションとして開発している
- 創業経路は1本に固定しない。少なくとも次の2ルートを正式なゲームデザインとして許容する。
  1. **店舗経営ルート**: ラーメン店などの実業から創業し、店舗運営を深めながら本社・本部を設立し、段階的に多角化する
  2. **投資会社ルート**: 店舗を1店舗も保有しない状態から、会社資金を用いた株式投資・資本配分を中核事業として開始し、後から本社機能・他事業・M&A等へ拡張できる
- 「ラーメン1店舗を持っていること」を全プレイヤー共通の進行前提にしない。
  投資会社ルートを成立させるため、投資会社として必要な本社/投資機能の解放条件に
  `minStores > 0` を必須条件として固定しない。店舗ゼロでも、投資会社として妥当な
  コスト・資本・信用・進行条件を満たせば会社側の投資機能へ到達可能にする
- ただし複数ルートを許容することは「全業種・全機能を最初から開放する」ことを意味しない。
  各ルートには段階的アンロックを維持し、そのルートの中核プレイに必要な機能だけを
  早期に利用可能にする。店舗経営ルートでは市場・供給・労働力・店舗運営、
  投資会社ルートでは会社資金による投資・資本配分・リスク管理を中核にする
- 創業ルートの実装で、旧PR #391 の巨大な `founding-routes-integration.js` や
  `foundingRoute` state をそのまま復活させない。現在の state/API/unlock/progression を再監査し、
  既存機能を活かした最小vertical sliceで実装する。明示的なroute stateが本当に必要かは
  capability/unlock条件から導出できないかを先に検討する
- 会社側の投資と個人投資は別物として扱う。投資会社ルートで利用するのは会社資金・
  会社保有株式・会社ledgerであり、個人資金や個人保有株式を暗黙に混ぜない
- market.js / supply.js / workforce.js の TARGET_BUSINESS_IDS が現在 ramen のみなのは、
  店舗オペレーション詳細化がramenから始まっているための意図的な状態であり、
  投資会社ルートを禁止する根拠にはしない。店舗業種を増やすときは
  「全業種に一括で広げる」のではなく、アンロック順に1業種ずつ広げ、
  そのたびに決定論の指紋（transaction-baseline / market-calibration）を更新する
- 現状の実装比重は金融・M&A・不動産・ガバナンスに厚く、
  事業オペレーション（市場・供給・労働力・店舗運営）が薄い。
  機能追加の判断に迷ったらオペレーション側を優先する。
  ただし、正式な創業ルートを成立させるために必要な最小限の金融/進行機能は例外とする
- 同様に会社側の機能は厚く個人側は薄い（不動産は会社46モジュールに対し
  個人は売買のみ、買収後の経営は会社PMI多数に対し個人PEは施策1種のみ）。
  個人側を作るときは会社側の既存モデルを流用できないか先に確認する。
  ただし「会社資産と個人資産の分離」は不変条件なので、共有するのは
  計算ロジックだけにし、資産・現金の帰属は必ず分ける
- オーナーが Manus や ChatGPT で考えた新要素を持ち込む運用がある。
  提案を受けたら docs/feature-requests.md へ追記し、着手前に必ず
  「現状どこまで実装済みか」を調べてから実装方針を立てる
  （既存機能を新規実装として作り直す事故を防ぐため）
- 2026-08時点の開発方針は「約30業種を均等に薄く広げる」から
  「5本柱（ramen / conveni / gym / productVentures=IT企業 / realEstateAgency）を
  深掘りする」へ転換した。新規出店UIも主力5業種へ絞る。非主力業種は
  旧save/data互換のため削除しない。機能追加の優先度に迷ったら、新しい業種を
  増やすより5本柱のどれかを深掘りする方を優先する
  （店舗経営ルート・投資会社ルートという2ルート方針とは別軸で、
  店舗経営ルート側の「どの業種を深く作るか」を絞り込む方針）
- 5本柱の深掘りでも「新しいボタン・新しい巨大systemを増やす」より
  「既存の行動や既存systemに、意味のあるトレードオフを追加する」ことを優先する
  （例: gymの会員プラン戦略・混雑・退会理由内訳は既存ボタン（品質投資/改装/
  効率化/設備強化）だけで完結させ、新規ボタンを増やしていない）
- workforce詳細店舗モデル（TARGET_BUSINESS_IDS）は当面ramen限定のまま維持する。
  gym trainer等の店舗別人員拡張は、既存モデルへ雑に給与systemを足すのではなく、
  将来workforce正式拡張が必要になった時点で別PRとして扱う
- 5本柱の進捗管理は docs/gameplay-systems-roadmap.md の「5本柱の深掘り状況」節で行う。
  docs/DEVELOPMENT_ROADMAP.md は2026-07時点の旧計画（saveVersion 8時代の
  Phase 0〜9構想）で退役済み。現状の参照先ではない

# UIリスキン（D UI shell拡張）の方針
- D UI shell（js/d-ui-shell.js / js/d-ui-context-tabs.js）を全画面共通の
  最終的な見た目として採用し、画面単位で1PRずつ拡張する
  （新しいデザイン言語を発明しない。参考にした他社ゲームの実際の
  イラスト・アセットはトレース・複製しない。真似るのはレイアウト・
  操作の流儀だけで、絵はすべてオリジナルにする）
- 新しい見た目のCSSは css/d-ui-*.css の新規または既存ファイルにだけ書く。
  css/app.css は触らない（tests/fixtures/extracted-css-baseline.css と
  バイト一致必須）。例外は既存の --accent/--good/--warn/--danger 未定義変数の修正のみ
- external enhancer registrations は79/79で上限に到達済み
  （tests/startup-runtime-budget-test.js）。むやみに新しい registerUIEnhancer() を
  増やさない。既存の 'd-ui-shell'/'d-ui-context-tabs' フックの enhance() を拡張するか、
  マーカー選択・ドリルダウンのような動的な後処理が不要な画面は
  app.js側のテンプレート文字列に d- プレフィックスのクラスを直接足すだけで
  リスキンする（新規JSエンハンサーなし）
- 進捗・技術的制約・Phase順序は docs/ui-redesign-roadmap.md で管理する

# 創業ルート実装時の必須検証
- 店舗経営ルートの既存到達性を壊さない。通常難易度で店舗創業から本社・多角化・IPOへ
  到達できる既存の進行テストを維持する
- 投資会社ルートは**店舗0件のまま開始・継続できること**をfocused/reachability testで証明する
- 投資会社ルートで会社株式投資を行う場合、companyCash / companyStocks / finance ledgerだけが
  動き、personalCash / personalStocksへ副作用がないことを検証する
- 投資会社ルートの開始条件を緩和しても、全業種・M&A・不動産・ガバナンス等が
  無条件に初期解放されないことをnegative testで確認する
- 旧saveでは新しい創業ルート情報が存在しなくても安全に読み込めること。
  saveVersionは9のまま維持する
- 2ルートを同じseed/stateから検証する場合も不要なRNG消費を増やさず、決定論を維持する

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
- map-critical asset（js/map-phase2-canvas.js / js/d-ui-shell.js /
  js/iphone-playtest-fixes.js / css/d-ui-mobile-company.css /
  css/iphone-playtest-fixes.css / d-ui-mobile-company.css が@importする
  map系CSS / prototypes/*.js / sprites.json）を変更したら、同じ作業内で
  `node scripts/stamp-asset-revision.js` を実行して `?rev=` を打ち直す。
  revisionはこれら資産の内容ハッシュ（Date.now/Math.random/commit SHAは禁止）で、
  tests/static-asset-cache-coherence-test.js が打ち直し忘れを赤で検出する
- production mapのmarkerは「その建物を指す」ことが最優先。marker位置を動かす
  処理（decluttering / edge clamp / chrome回避）を足すときは必ず
  MAX_ANCHOR_OFFSET（js/map-phase2-canvas.js）以内に収め、最終位置には
  capToAnchor() を通す。実測でこの上限が無いと最大334px（canvas幅の64%）
  ずれ、画面外の建物のmarkerが画面内へclampされる事故が起きた。
  tests/map-marker-anchor-integrity-test.js が上限違反を赤で検出する
- production mapのmarkerは「その建物であり得る」ことも守る。配置候補は
  district zone ではなく、そのタイルに実際に置かれた**sprite category**
  （建物が無いタイルは open space の種別）で選ぶ。許可表は
  js/map-phase2-canvas.js の KIND_SURFACES / PROPERTY_KIND_SURFACES で、
  列挙されていない surface は禁止（civic / landmark / 緑地 / 看板 /
  footprint予約タイルにmarkerは載らない）。zone で選ぶと
  ROLE_CATEGORY のクロスオーバー（commercial zoneのX infillが
  residential.low、cbd zoneのX infillが commercial.small）と
  open space が混ざり、実測でtenantの33%が建物の無い区画・18%が住宅に載った。
  1 sprite だけ例外にしたいときは SPRITE_SURFACE_OVERRIDES を使う
  （新しいcategoryを増やさない）。
  tests/map-marker-building-affinity-test.js が許可表と実配置の両方を検証する
- marker の見た目サイズとタップ領域は別物として扱う。clip-path はヒット
  テストにも効くので、pinの形は .d-map-marker:before に描き、button 自体は
  clip-path:none の44px以上の矩形のまま残す（両方を1つのboxにすると
  「見た目を小さくする」と「44pxを確保する」が両立しない）
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
- canonical suite は4シャード並列・timeout 15分。**ランごとの振れ幅が大きく、
  シャード間の差より大きい**。連続4ランの実測（2026-08-18）は
  A 10分16秒〜12分11秒 / B 9分00秒〜14分07秒 / C 10分32秒〜13分26秒 /
  D 7分42秒〜13分48秒 で、Dは中身を一切変えていないのに6分以上揺れた。
  最悪ケースの余裕は53秒しかない。したがって
  **1回の測定だけを見て「このシャードは軽い/重い」と判断しない**。
  新規テストを足す前に直近の複数ランを見て、判断が割れるなら分散させる。
  「最長はC」のような固定的な記述は当てにならない（実際その記述が古くなっていた）
- CIの所要時間を読むときは、runnerの起動待ち（created_at→started_at、実測で最大
  7分）とstepの実行時間を混同しない。timeout 15分がかかるのは後者だけなので、
  「runが20分かかった」ことと「timeoutに近い」ことは別の話
- CIワークフローが手前のステップでずっと落ちていると、その後のステップは
  何週間もskippedのまま実行されず、奥に埋まった別の回帰が誰にも気づかれない。
  「直近の失敗ログ」だけを見て原因を1つに決め打ちしない。1つ直すたびに
  ジョブのstep一覧を見て、次のstepが新しく走り始めていないか確認する
- push トリガーに paths: フィルタがあるworkflowは、フィルタ対象外のファイルを
  何回直してもCI上で一切発火しない。赤いworkflowを直したら
  workflow_dispatch で対象ブランチに対して手動発火し、実際に直ったか確認する
- `npx playwright install --with-deps webkit` は**時々ダウンロードのまま固まる**。
  通常1分20秒で終わるところが、2026-08-19の午前だけで4回ハングした
  （M&A Integration ×2 / M&A Deal Room ×1 ＋ 1件は約2時間居座り）。
  同じジョブを**変更なしで再実行すれば毎回成功する**ので、原因はコードではなく取得側。
  ジョブに timeout-minutes が無いとGitHub既定の6時間ランナーを占有し続け、
  「まだインストール中」と「詰んでいる」の区別がつかない。
  ブラウザを入れるジョブには必ず job-level timeout-minutes を付ける
  （`tests/workflow-browser-timeout-contract.js` が強制する）。
  なお `ma-integration.yml` のWebKitステップは `if: github.event_name != 'pull_request'`
  で**PRではスキップされ push/schedule でしか走らない**。PRが緑でもmainで固まりうるので、
  この種のハングをPRのCIだけで判断しない
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
