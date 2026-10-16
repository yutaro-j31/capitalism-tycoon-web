# Capitalism Tycoon Web — Economic Engine Independent Architecture & Integrity Audit

- **監査者:** Claude Code（クラウドセッション。ChatGPT Work の実装とは独立）
- **監査日:** 2026-10-10
- **監査時点 main:** fbfdccdbdbee8f98aa7d6cbef3ec7e411e48ddc7
- **原典:** Owner が2026-10-10にChatGPTへ提出した Claude Code の日本語独立監査報告
- **本記録者:** ChatGPT（原典を整理してGitHubに永続記録）
- **変更権限:** このPRは監査文書のみ。本番修正、権限移行、CI/test変更、診断PRのマージを含まない
- **証拠の区別:** 下記「Claude Code実測」はClaude Codeが実施・報告した検証。「GitHub追補」は文書登録前にChatGPTが独立に確認した公開GitHubの状態。その他の提案はまだ未承認。

> **判定境界:** 監査報告書の保存は、監査結果のOwner承認、問題の重大度確定、本番修正承認、P3-4 Gate PASSまたはAuthority Cutover承認を意味しない。GitHub最新mainとPR/Issueを作業ごとに再確認すること。

## A. Executive Summary

| 対象 | Claude Codeの監査判定 | 解釈 |
| --- | --- | --- |
| 本番Gate / P3-4再開 | **BLOCKED** | main上のP3-4-007と別件PE Exitの保存原子性P1、Track A writer閉鎖とadoption契約が未完了 |
| 既存runTransaction + #915 checkpoint + Strangler | **PASS WITH CHANGES** | 参加しているwriterには有効。問題の中心は「参加がopt-in」で経路ごとに回避できる設計 |
| P3-4-007 correction | #937でNode probe GREEN（監査時HEAD 5a7ee98） | mainではRED。保存原子性の修正方向は最小runTransactionラップを推奨。ただし監査時のCIは赤で本番Gate PASSではない |
| 推奨開発方式 | **軽量Strangler** | 既存共通transaction/checkpointを再利用。入口のCommand boundary、静的ratchet、共有Fault Harnessを段階的に検討。ゲーム/エンジン全体の書き直しは推奨しない |

### 実測と提案を分けたポイント

1. **Claude Code実測:** stockSplitはmainでsave=falseでもtrueを返し、株数・価格・履歴がliveに残り、その後の健全な保存でdurableに取り込まれる。#937の監査時HEADでは同じ障害がrollbackされる。
2. **Claude Code実測:** Nodeのfake-IDB上での正常/障害probe、永久Nodeテストと関連回帰のPASS。ローカルWebKitは実施せず、ブラウザ結果はGitHub Actions記録の確認。
3. **Claude Code実測:** 新たな株式分割の経済異常候補は配当単価と株価下限。保存原子性のP1とは**別件**であり、新規Owner判断前の本番修正を禁止する。
4. **設計提案:** 各経済writerを無制限に個別修正し続けるのではなく、実際の経済効果/commit owner単位で整理し、共通Command境界・Fault Harness・追加writer検知ratchetを導入する。
5. **留保:** 既存の277候補や55件キーワード抽出は、経済writer確定数でもP3-4 Gate分母でもない。

## B. Verified Repository State（監査時点と追補）

### Claude Code監査時点

- origin/main: fbfdccdbdbee8f98aa7d6cbef3ec7e411e48ddc7
- Open PR: #937（P3-4-007、本番修正）、#936（AI共通運用方針、docs）、#935（PE Exit診断Draft、**マージ禁止**）
- Claude Codeの作業ツリー変更は0件。一時worktree 2件とリポジトリ外diagnosticを利用し、監査後に一時worktree削除。push/issue書込/本番変更なし。
- #937監査HEADは5a7ee981fa9de9f19764776e01cc05921044c543、当時のTest run 38012999281はrelease-readiness失敗、M&A run 38012999280はdeal-room 15分timeoutでcancelled、Strategy run 38012999295成功。NodeやWebKitの個別PASSとPR全体Gate PASSは区別。

### GitHub追補（監査報告受領後、ChatGPTが独立に確認）

- **#937現行HEADは d6b2821f8f08f16d240e4567d65f90bc28ba2131 に更新済み。** Claude Codeが報告した旧HEADのCI失敗はそのまま現行HEADの判定に転用しない。
- 更新内容: workflow path-filter期待3パス追加済み。stock-split WebKitの36ケースを、既存deal-roomと切り離した **stock-split-atomicity** 独立15分ジョブへ移行（同じM&A workflow内、既存deal-room本体は維持、timeout値の引上げなし）。#937以外の本番コードは未修正。
- 最新HEADのGitHub Actions: Test 38021135065、Strategy 38021135055、M&A 38021135148。**追補確認時点では実行中でありGate PASSを主張しない。** 現在の結果は必ず再確認。
- Workによる別系統のread-only再分類: **P3-4 Track Aは19 source-backed operation/replacement/capability groups**（main: VERIFIED 6 / SUSPECT 4 / UNTESTED 6 / BLOCKED 3）。これも**全経路の完全性証明ではない**。#922の [6092171008](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/922#issuecomment-6092171008) と [6092183010](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/922#issuecomment-6092183010) を参照。「55キーワード候補」はClaude Codeの抽出であり、この19グループと異なる集計単位。

GitHub refs: [#937](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/937), [#936](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/936), [#935](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/935), [#909](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/909), [#922](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/922).

## C. P3-4-007 — stockSplit Save Atomicity

### 根本原因・実行経路（Claude Code独立検証）

- mainの js/expansion.js:381–386 の最終インストール済 stockSplit が経済状態（sharesOut/founderShares/treasuryBuybackShares、口座別lot、株価・平均原価・分割履歴）を直接更新してから this.save() を呼び、戻り値を検査せずtrueを返す。
- UI: js/app.jsの stock-split ボタン → click delegation → action → app.js:920 engine.stockSplit(id,2)。Claude Codeの検索ではstockSplitを覆う別のインストール済wrapperを確認していない。
- 実測saveスタック: pmi-long-run-guard.save → pmi-100-day-plan.save → save-storage.save → saveWithAdapter → writeCandidates。先にインストールされたsave-wrapperの一部はsave-storage側の上書きにより最終chainでは実行されない可能性あり（構造上の脆弱性候補、重大度未確定）。
- #915 checkpointは保存側mirror/cache/pendingを戻せても、transaction外で変更したlive stateは戻せない。次の正常保存が失敗した操作を永続化する。
- runTransactionの最外層はJSON snapshot、top-level reference retention、checkpointSaveStorage、deferred save、単一commit、false/例外時rollbackを持ち、参加writerはこの失敗モードを防げる。

### 独立Node実測（fake IDB）

| ケース | main | #937監査時HEAD 5a7ee98 |
| --- | --- | --- |
| stub save=false（自社・外部） | true + live残留 + 次回保存でdurable化 | false、live/durable復元 |
| localStorage SecurityError | 同上/RED | GREEN |
| IDB writeSync=false | 同上/RED | GREEN |
| save受入後にemit('saved')のstubがthrow | live/durableが確定したまま/RED | rollback/GREEN |
| **実際のEventTarget listener**がthrow | 発火元には同期例外として伝播しない。確定済取引はcommitのまま | 同じ。防御的stubのthrowと区別 |
| 正常系 | true、保存後freshに分割反映、finance.validate成功 | 同じ |

- 独立 probe: split-probe.cjs（リポジトリ外）。販売中の本番index/harness、既存fake-IDB fixture、上場済み発行2,000,000株/創業者1,200,000株/自己株50,000株、個人自社株と会社・個人の外部株保有。
- #937永久Node: tests/stock-split-save-atomicity-test.js exit 0、49 PASS行、監査計測132秒。mainへ同じ回帰を適用すると 'failed split must return false' にてRED。
- 関連 stock-split-price-history、stock-sale、founder-share-sale、transaction、save-v9/save-compat、週次等の実施Nodeはexit 0。
- #937の健康時のnotify→saved→change、保存1回、RNG、会計・会社/個人分離、歴史記録parityは監査報告上同一。

### 最小修正評価

**Claude Code推奨案A:** stockSplit本体を既存runTransactionで完全に覆い、末尾の直接save/emitを除いて共通commitへ委譲。#937の実装方針に一致。財務・価格・数量・PR #921の履歴調整・旧セーブ・RNG挙動を変えない。

代替B: 株式系の共通Commandへ統合（中規模、長期的には有益だが、このP1の最小修正と混ぜない）。
代替C: 株式システム全面実装し直し（移行・再証明範囲が大きく非推奨）。

監査時の旧HEADで確認したCI不足:
1. workflow path-filter-contractの3パス登録漏れ（新Node/WebKit/fixture） → **現行HEADで修正済み**。
2. deal-room 15分budget超過（既存#934で13分54秒、splitブラウザ追加時に超過） → **現行HEADで新split WebKit独立ジョブ設置済み、最終head CI判定待ち**。

追加検証提案: ratio=2.5/Infinity等の異常比率の振る舞いを、既存仕様と切り分けて検討。仕様を無断で変更しない。

## D. 株式分割の新たな経済欠陥候補（独立Owner判断待ち）

### STOCK-SPLIT-DPS-001（Claude Code Node再現報告）

- stockSplitが銘柄 s.dividendPerShare と自社 g.dividendPerShare を分割比率で調整しない。
- engine.jsの週次配当は qty × dividendPerShare（またはprice × dividendYieldから算出）を使用。
- FOOD会社保有10,000株の四半期配当が **260,000 → 520,000円** に倍増する例をNode再現したと報告。分割により株数だけ倍増、評価額は14,500,000円で不変。自社では配当支出も倍増しうる。
- **会計/ゲームルールの重大性は要判断。** この記録だけでP1確定または修正承認とはしない。

### STOCK-SPLIT-PRICE-FLOOR-001（Claude Code Node再現報告）

- 繰り返し分割により価格が10円未満になった後、updateMarketのMath.max(10,...)が翌週の最低価格を適用し、株数が増えたまま価値を押し上げる可能性。
- volatility=0、trend=0、8回分割後、評価額 **1,450,000 → 2,560,000円（約1.766倍）** をNode再現したと報告。
- どこまでプレイヤーが意図的に誘発できるか、週次経路や実際の株価制限の仕様を再検証する必要がある。

### ゲーム仕様の論点

- 他社上場銘柄をプレイヤーが任意に2分割できるUI仕様が現存すると指摘。権限/意思決定として意図したゲーム仕様かOwner判断が必要。
- 上の二件は **stockSplitの保存原子性P3-4-007とは別concern**。#937に無断追加しない。修正は別PR/別Owner承認、再現・既存仕様・会計/価格ルールの確定後。

## E. Structural Root Cause Analysis

### Claude Codeの根拠・規模

- 最終prototypeメソッド: headlessロードで613（WorkがDOMContentLoaded後に617と報告。読込境界差あり）。
- runTransactionの字句出現は最終prototype 118メソッド、save()の呼び出しはjs全体で約211箇所、戻り値検査は約3箇所（**粗い静的計数であり保証値ではない**）。
- app.jsだけでengine.save()直接呼び出し19箇所、UI/adapter系15ファイルに直接save経路を発見と報告。
- app.js:903 の workforce-invest における UI直接の companyCash減額 + finance.event + engine.save を静的確認（動的fault未検証）。
- pe-ui-adapter.js:401 の saveSuccessful はsaveの結果を検査せずtrueを返す。PE Exitの直接helperルートは#935で再現済み。
- shareholder-activism.jsのacceptがbuyback取引確定後にcampaign状態を変更する可能性、completion.jsのfoundNewCompanyAfterBuyoutがthis.gを再創業stateに交換後saveの戻り値を検査しない経路を指摘（静的のみ、未P1確定）。
- 「save()のboolean戻り値を無視している」こと自体だけで全件P1とみなすのではなく、経済副作用と保存責任/外側transaction、到達可能性を区別する。

### 共通transactionの強みと検証を要する弱み

| 項目 | Claude Codeの結論 | 今後の扱い |
| --- | --- | --- |
| 非参加が既定 | 最も大きな構造的原因。取引入口とUI helperのbypassが残る | ファミリー単位で入口統一を提案 |
| 最外層commit、deferred save、rollback、#915 checkpoint | 既知の参加writerに対して概ね機能 | 既存資産として再利用 |
| **nested transactionに個別savepointなし** | 内側falseで変更が残っても外側true commitならその変更が残る実測 | 現行仕様/呼出し契約を明示。実被害経路を確認する前に共通基盤を勝手に変更しない |
| transaction内 emit('change') の先行発火 | 未確定UI描画が可能（設計懸念） | イベント順序の正常系parityを証明した独立提案に限る |
| rollback後notifyトースト | stateのnewsから消えても表示は残りうる | 低優先。UI仕様との整合 |
| this.gの全交換時のidentity | 元の参照まで戻らない可能性 | restore/replaceで動的検証が必要 |
| JSON.stringify snapshot | 1コマンドあたり大規模stateシリアライズ | iPhone実測による性能Gateが必要 |
| IDB非同期put | 同期的受入と非同期durableの分界 | 今回の主因ではない。既存限界を保持 |

> **重要:** 「Command境界で全メソッドを自動的にrunTransaction化する」ことは、この報告で承認済みではない。nested falseの意味、失敗時の例外、イベント/ネットワーク順序、UI/週次parity、実際のcommit所有者を先に確定する。

## F. Writer Coverage（277件の意味、Track A/B）

### Claude Codeによる#935 JSONとの照合（ヒューリスティック）

| 区分 | 件数 | 注意 |
| --- | ---: | --- |
| 監査候補 | 277 | 経済writer確定数ではない |
| prototypeに存在しないroute/adapter名 | 4 | wrapperや入口を含む |
| 最終メソッドがrunTransactionを字句上含む | 109 | UNTESTED100、VERIFIED9。**文字列出現だけでは実際の包摂を証明しない** |
| runTransactionを字句上含まない | 164 | 設定/UI操作も混在 |
| 直接資産フィールドを書くヒューリスティック | 113 | 静的な短い追跡 |
| helper委譲で静的分類困難 | 51 | 中には重要な経済writerが含まれる |

- 109+164+4=277は候補分類である。純粋なUI/設定操作・同じ取引のwrapper/aliasは専用writerとして重複計上しない。
- 静的推定から「残りwriterをすべて数秒/件で確認できる」と断定しない。save拒否/非同期IDBの重要経路には実際のbrowser fault testが必要。
- Claude Codeの **Track A 55キーワード候補**（VERIFIED8 / tx済みUNTESTED20 / txなしUNTESTED16 / SUSPECT8 / BLOCKED3）も確定したissuer-family全経路数ではない。
- Workが#922に記録した **Track A 19 source-backedグループ**（main VERIFIED6/SUSPECT4/UNTESTED6/BLOCKED3）はグループ単位の別集計である。どちらも完全なwriter certificateではない。

### Track A（P3-4初回issuer family）の到達範囲

player-companyの単一普通株について:
- opening/configure/reset、買付/売却、split、founder secondary、投資家募集、IPO、buyback
- M&A share-swapとfinanced acquisitionによるstate replacement、crisis資金注入、turnaround fundと週次ratchet
- marginの個人own-share raw/helper、recovery/MBO、competitor ownership ratio/defense（beneficial ownershipと混同しない）
- load/import/export/save-v9 compaction、shadow/replaceState、再創業と世代/holder identity
- UI内部直接writer、別名/エクスポート/helper、module load orderも漏らさない

**完了条件:** 有効化対象issuerの更新/置換/rollback経路を漏れなく閉鎖し、唯一のauthority、old-save、idempotency、異常値・失敗経路、fresh hydration、正常系parity、WebKit/CIを実証する。

### Track B

PE/VC（対象issuerに触れないもの）、不動産、融資・債券、店舗、人事等は後続Phaseの監査として保持。**PE Exitの既知P1はTrack Bであっても独立した本番安全阻害条件であり放置しない。**

未解決: module exports/inline/aliases/transitive helperの全追跡、financed M&A実IDB fault matrix、PE Exit利益/carryケース、shareholder activism accept動的検証、物理iPhoneなど。

## G. Architecture Alternatives / 推奨設計

| 案 | Claude Codeの評価 | 制限 |
| --- | --- | --- |
| 1 個別writerにrunTransactionを順次追加 | 保存互換は維持しやすいがopt-in設計は残り、CIコストが増える | 根本予防が弱い |
| **2 既存Economic Coreに薄いCommand境界を段階的追加** | **推奨**。既存transaction/#915/ledger/fixture/Acceptanceを再利用できる | allowlist・週次・nested false・save/event parityを証明する必要 |
| 3 全面書き直し | 高リスク。3.5MB程度のjs/多数テストの再証明が必要 | 正式Roadmap§9の段階移行方針に反する |

Claude Codeのラフ見積もり（**実測された工数ではない**）: 個別修正60〜100超のPR相当、軽量段階化20〜30PR相当、全面書き直しは不定。これは数値確約や正式見積もりとして扱わず、Track A実測グループ/CI時間/差分で再較正する。

### 提案する移行構造（未承認）

1. UI/API/週次 → issuer-family別 Command 境界（必要な公開経路のみ）
2. 各writer既存validationと経済計算を原則維持
3. 既存runTransaction/#915 checkpointを実際の最外commitとする
4. 既存finance ledger + save-v9 projection + iPhone UIを維持
5. 外部adapter/helperの直接writerを段階的に廃止/制限

提案コンポーネント:
- js/economic-command-boundary.js（新規候補）: 選択的allowlist。**空リストでの無動作導入から開始し、機能/issuerごとに検証。**
- Test-only ratchet: transaction外save呼出しとUI直接経済フィールド代入の「増加」を検出。単純な文字列計数を完全証明と混同しない。
- 共通Fault Harness: 既存pe-fund-acquisition-faults、fixtureとfresh hydrated browser oracleを整理。Node全障害、WebKitは根拠のある代表ケースで境界を検証。ただし既存固有の高リスクケースを削除しない。
- runTransactionのemit遅延/nested savepoint: 別の共通基盤仕様変更。**Owner承認、既存正常系のイベント順序/週次/IDBテスト、iPhone性能実測が必要**。自動導入を承認しない。

## H. Owner五段階方針と具体的なPR案（未承認部分は明示）

**既存Owner優先順位を維持**:
1. P3-4-007保存P1を最優先に解消（#937のCI/Gate/承認マージ）
2. Writer Matrixをread-onlyで並行監査（Track A優先、Track B維持）
3. 監査後に共通Fault Harness
4. 限定的自動修正/マージは明示Owner承認後のみ
5. Phase 4+は依存関係/Acceptance設計のみ先行（余力）

| タスク | 推奨AI | 承認・完了条件 |
| --- | --- | --- |
| #937現行HEADのCIと独立差分監査 | **Work** | 最新テスト・M&A旧job＋split新jobの全適用PASS、SKIPはPASSに含めず、明示的マージ承認 |
| 株式分割の配当単価/価格下限/他社split UI仕様 | **通常ChatGPT（Owner判断）** | 追加診断、仕様・重大度・最小個別PRの承認。#937に混ぜない |
| Track A 19グループのclosureと残存経路 | **Work（runtime監査）＋通常ChatGPT（Gate設計）** | 更新・置換経路全体の証拠を埋める。read-only、新P0/P1を無断修正しない |
| PE Exit両経路P1 | **Work（個別承認後）** | #935の診断専用PRをマージせず、独立本番修正+Node/実WebKit+parity |
| Fault Harnessの最小test-only extraction | **Work（承認後）** | 既存case数/可達性/assertions/CI登録を弱めない |
| Static ratchet baseline | **Work（提案→承認後）** | 有効な既存入口を偽陽性で遮断せず、追加writer防止 |
| runTransactionのsavepoint/event変更 | **通常ChatGPT設計→Owner承認→Work** | 共通基盤への影響/旧挙動/決定論/性能の独立Gateが必要 |
| 空allowlist Command境界とissuer別adoption | **Work（sliceごとの承認後）** | Scopeと承認条件に一致、段階的cutover。Phase9/10/13/14の先行authorityは禁止 |
| Phase 4+の依存・Acceptance草案 | **通常ChatGPT** | read-only、正式順序を越えない |

Claude Codeの追加順序変更提案（**Owner未承認**）: 独立CIジョブ分割を先に設置する、監査と平行してratchetを前倒す、自動修正をallowlist登録に限定する。#937の最新HEADではCIジョブ分割が既に作業済みのため、古い提案を重複実装しない。

## I. Remaining P0/P1 / 確認限界

| 発見 | 証拠クラス | 現状態 |
| --- | --- | --- |
| P3-4-007 stockSplit save-failure P1 | Claude独立Node main RED・#937旧HEAD GREEN。WorkのPR Node/実WebKit記録あり | **mainでは未解決**、#937最新CI/マージ待ち |
| PE-PORTFOLIO-EXIT-ATOMICITY-001 P1 | Claude Nodeで#935 probeをmain上RED、WorkのNode/実WebKit RED記録あり | **Owner本番是正承認待ち**、診断Draft #935マージ禁止 |
| STOCK-SPLIT-DPS-001 | Claude Node数値再現報告 | 新候補、重大度・配当仕様・修正権限未確定 |
| STOCK-SPLIT-PRICE-FLOOR-001 | Claude Node数値再現報告 | 新候補、重大度・下限価格仕様・修正権限未確定 |
| nested false savepoint | Claude Nodeモデルで再現 | 共通transaction設計懸念。具体的な有害caller未確定 |
| shareholder activismのpartial commit | 静的指摘 | 動的診断未了 |
| UI直接writer / 再創業保存境界 | 静的指摘 | 動的診断未了 |
| 旧save-wrapperの無効化 | Claudeスタックトレース報告 | 現在のユーザー影響・重大度未確定 |
| #937 WebKit/physical iPhone | ClaudeローカルWebKit未実施、GitHub CIの実行証拠のみ | 実機未実施。現HEADのCI判定は別途確認 |
| P3-4全経路 | 未閉鎖 | Track Aグループの安全証明不足。Authority Cutover STOPPED |

**未実施をPASSとしない。** 特にSource regex/字句中のrunTransactionと本当に保護されたcommit境界を同一視しない。

## J. Final Verdict / 次の担当

1. **P3-4-007:** #937の最小runTransaction correctionを維持。最新HEADの全適用CI/証拠/OwnerマージGateを通す。
2. **277候補:** 全件を1件1PRで深堀りするのは不合理。Track Aは経済効果・authoritative commit owner単位で閉鎖し、Track Bは将来も管理する。
3. **全面書き直し:** 推奨しない。正式Roadmap§9のStranglerを維持。
4. **既存資産:** runTransaction、#915 checkpoint、save-v9、Phase 0.5/1/2 Ledger/Acceptanceを再利用。
5. **再開条件:** #937是正Gate、PE Exit別件Owner承認/是正、splitの配当・価格floorの仕様判断、Track A全更新/置換のclosure、単一authorityとP3-4 adoption契約のOwner Gate。
6. **順序:** 既存Owner五段階優先を維持。共通Command/rachet/runTransaction意味変更は別concern・別Gate。
7. **推奨AI:** **Work**は実装/CI/ブラウザfault/PR修正、**通常ChatGPT**は設計/Owner判断/独立Gate、**Claude Code**は別系統のread-only監査と独立probeに適する。

### 監査者の操作・未検証

- Claude Codeはmain/#937の一時worktreeを作りNode診断/関連回帰を実行し、監査後削除。リポジトリにはpush/コミット/PR・Issueコメントなし。
- ローカルWebKitはバイナリ不在で未実施。GitHub WebKitのPASSはCIログ閲覧に基づく。
- 物理iPhone未実施、利益/carryありPE Exit未検証、financed-M&A real IDB専用fault未検証、全モジュールexports/inline直接writerの完全閉鎖未実施。
- Claude Codeは#909本文の全69,410文字、Issue #909の全61コメントおよび#922の全51コメントを網羅的に読んでおらず、最新関連範囲を優先調査したと明記している。

### 記録上の独立性

この報告の主張は原典であるClaude Codeの監査結果として保存するもので、GitHubへの転記者が全診断・環境を独立再実行したものではない。追補に明記したGitHub状態のみ転記者が独立確認した。新たなP0/P1の最終分類や変更承認は別のOwner/Gate判断が必要。
