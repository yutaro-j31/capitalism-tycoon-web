# ステージ1 詳細設計 — `run-all-shard.js` への並列実行の opt-in 接続（シャードJのみ）

- 状態: **設計と回帰テストの準備のみ。本番ランナー・ワークフローへの接続はしていない**（試作は別ブランチ `ci/stage1-optin-prototype`、PRなし）。
- 前提: PR #1158（段階0）はマージ済み。PR #1172（`status===null` の誤判定の修正）は未マージで、Owner承認待ち。ステージ1は #1172 の後に載せる。

## 1. 要件との対応

| 要件 | 設計 |
|---|---|
| 既定値は並列度1 | `TEST_SHARD_PARALLELISM` が未設定・空・`1`・不正値（`0`、`abc`、`-3`、`2.5`）なら、従来の直列コードをそのまま実行（不正値は stderr に `::warning::` を出して直列） |
| 既定動作・ログ・件数・契約を維持 | 並列でない経路のコードは1行も変えない。`contract` モード（`TEST_SHARD_CONTRACT=1`）は変数を無視。試作で、A・B・J の contract モード出力が試作版と基準版でバイト一致、`TEST_SHARD_PARALLELISM` を `''`/`1`/`abc`/`0`/`4` にしても J の出力が同一であることを確認済み |
| Jのみ | `scripts/parallel-shard-runner.config.json` の `parallelEnabledShards: ["J"]` に載る shard だけが並列になる。他の shard に変数が付いても警告のうえ直列 |
| タイムアウト・異常終了・子プロセス残留 | 段階0のランナーが担当。テスト単位（既定1500秒）と実行全体（既定1680秒＜ジョブの30分）のタイムアウト、プロセスグループごとの終了、SIGINT/SIGTERM（130/143）、シグナル死・出力超過・起動失敗は失敗扱い。回帰テストで残留なしを確認 |
| 逐次への即時ロールバック | 変数を外す／`1` にするだけで直列に戻る。ワークフローでは**リポジトリ変数** `TEST_SHARD_PARALLELISM_J` を介して有効化するので、ロールバックは変数を削除するだけ（コミット・PR不要、次の実行から有効） |
| `canonical-test-shard-summary` を維持 | 形式は同一。`executed` = 完了したコマンド数（成功＋失敗）、`seen` = 従来どおり（全ラベル）、`total` = 各テストの実行時間の合計。`exit` ハンドラで従来どおり最後に出す。並列時は直前に別行 `parallel-shard-summary:` を追加（並列度、件数、wall、使用中ピークメモリ、システムCPU、ランナー自身のCPU） |
| 直列必須テストの隔離 | 設定ファイルの `serial`（A・G・H に定義済み、J は空）。直列グループは他のコマンドと重ならず最初に1本ずつ実行 |
| CIランナーのCPU・メモリの実測 | §5 |

## 2. 変更するファイルと競合リスク

| ファイル | 変更 | 他のPRとの競合リスク |
|---|---|---|
| `tests/run-all-shard.js` | 約 +20 行: 並列度の解釈、並列時の記録スタブ、末尾の分岐。既定経路は不変 | 低: Aは通常このファイルを編集しない。#1172 も同ファイルの1行（`runRegisteredNodeTest` の条件）を変更するため、ステージ1は #1172 のマージ後に作る |
| `scripts/parallel-shard-runner.js` | `parseParallelism`、`runShard` を追加（既存関数は不変） | 低: 私の新規ファイル |
| `scripts/parallel-shard-runner.config.json` | `parallelEnabledShards`、`timings`（J） | 低 |
| `tests/shard-parallel-optin-test.js`（新規） | 回帰テスト（§4） | `tests/run-all.js` に1行登録。Aの挿入位置（98行目以降）と離れている |
| `.github/workflows/test.yml`（**ステージ2**、別PR・別承認） | §3 | 中: 共有ファイル。他のPRが `test.yml` を編集していないか直前に確認。`tests/shard-matrix-contract.js`・`tests/workflow-path-filter-contract-test.js` を通す |

`tests/run-all.js` のロジックは変更しない（登録行のみ）。`tests/run-all-shards.json`・`tests/test-execution-registry.json` は変更しない。

## 3. Jの本番パイロットの実行方法（ステージ2、承認後）

1. **ワークフロー変更PR（別承認）**: `test-shards` ジョブの実行ステップに環境変数を追加。有効化はリポジトリ変数で行うので、**マージ時点では並列度は1のまま**（挙動不変）。
   ```yaml
   env:
     TEST_SHARD: ${{ matrix.shard }}
     TEST_SHARD_PARALLELISM: ${{ matrix.shard == 'J' && (vars.TEST_SHARD_PARALLELISM_J || '1') || '1' }}
     TEST_SHARD_PARALLEL_REPORT: artifacts/shard-parallel/${{ matrix.shard }}.json
   ```
   併せて、J のときだけ実行する2ステップを追加: ① 実行前に `nproc`・`free -m`・`/proc/cpuinfo` のモデル名・`/sys/fs/cgroup/cpu.max` を出力（§5）、② `actions/upload-artifact`（`if: always() && matrix.shard == 'J'`）で報告JSONを保存。
2. **有効化（Ownerの操作）**: リポジトリ変数 `TEST_SHARD_PARALLELISM_J = 2` を設定（まず2で CI のコア数・安定性を確認）→ 問題なければ `4`。
3. **観察期間**: 各PR実行ごとに `scripts/ci-metrics.js` でJの実行時間・待ち時間、報告JSONでメモリ・CPUを記録。**合格基準**（案）: ① 10回連続で全10本が成功し、`canonical-test-shard-summary` の `executed`・`seen` が直列と一致、② Jの実行時間の中央値が12分以下（直列 約26分）、③ 使用中ピークメモリがランナーの物理メモリの50%以下、④ `leftoverProcesses` と再実行に起因する失敗が0、⑤ タイムアウト発動0。
4. **ロールバック**: リポジトリ変数を削除（または `1`）。次の実行から直列。コード側の撤回は `test.yml` の環境変数行の revert。
5. **拡大**: J の基準達成後に、同じ手順でシャードを1つずつ追加（`parallelEnabledShards` への追加は別PR、`serial` の確認つき）。

## 4. 準備した回帰テスト（`tests/shard-parallel-optin-test.js`、試作ブランチ、約40秒）

本番の `run-all.js`・`run-all-shard.js`・`run-all-shards.json` を無改造で一時ディレクトリにコピーし、担当テストをスタブにして実行する。

| # | 検証 |
|---|---|
| 1 | 既定（未設定・空・`1`）は直列で、出力（時間を正規化）が一致。不正値（`0`・`abc`・`-3`・`2.5`）も直列で警告つき |
| 2 | contract モードは変数を無視（出力一致、`executed=0`） |
| 3 | 有効化されていない shard（B）に変数を付けても直列＋警告、`parallel-shard-summary` なし |
| 4 | 並列時: 同じ `seen`、同じ10ラベルの timing 通知、`executed=10`、`[run-all node …]`／最終の成功行が出ない、`parallel-shard-summary` に件数・メモリ・CPU、報告JSON、`canonical-test-shard-summary` が最後 |
| 5 | 失敗: 並列の終了コードは失敗テストのもの。出力を保持。実行中の別テストを終了し残留なし |
| 6 | SIGKILL死 → 失敗。テスト単位のタイムアウト → 失敗＋残留なし |
| 7 | 直列グループの隔離（ロックファイル）＋負の対照（グループなしでは衝突を検出） |
| 8 | ランナーへの SIGTERM → exit 143、テストプロセスの残留なし |

**発見（既存の挙動）**: 直列ランナーは最初の失敗で `run-all.js` の途中で終了するため、`exit` ハンドラが「Configured shard entries not found in run-all.js …」を出して終了コードを 1 に上書きする（失敗テストの終了コードは失われる）。並列実行は全ラベルを見終わるため、失敗テストの終了コードをそのまま返す。ログ上は誤解を招く行が出なくなる。

## 5. CIランナーの CPU・メモリの実測方法

- **ランナーの仕様**: 実行前ステップで `nproc`、`free -m`、`grep -m1 'model name' /proc/cpuinfo`、`cat /sys/fs/cgroup/cpu.max`、`df -h .` を出力（J のみ、数秒）。コア数・メモリの前提（4 vCPU / 16GB）を検証する。
- **実行中の使用量**: 並列実行器が 250ms ごとに `/proc` を読み、各テストのプロセスグループの合計RSS・CPU時間、システム全体のCPU使用率、`MemTotal − 最小 MemAvailable`（使用中ピーク）と開始時からの増加分を記録。`parallel-shard-summary` 行と報告JSON（アーティファクト）に出力。
- **ランナー自身のコスト**: 報告に `runnerCpuSeconds`（ローカルで 502秒の実行に対し約4秒＝約0.2%）。
- **判定**: 初回実行で「コア数が想定と異なる」場合は有効化を中止する（変数を削除）。

## 6. ゲート判定（本番接続に進めるか）

| 条件 | 状態 |
|---|---|
| 既定経路が不変 | OK（contract モード出力がバイト一致。実走の直列ログは回帰テスト1で確認） |
| 並列出力が直列と一致 | OK（段階0でJ、8回、全テストの stdout/stderr ハッシュ一致）。試作のJ実走（本番の `run-all-shard.js` 経由、並列度4）: exit 0、`executed=10 seen=614`（contract モードの `seen` と一致）、10本成功、wall 672秒、使用中ピークメモリ 2710MB、システムCPU 91%、ランナー自身のCPU 7.3秒。このときのホストは単体テストが 65秒→101.7秒（約1.56倍遅い）になっており、wall の絶対値は以前の実測と比べられない |
| 失敗・タイムアウト・中断・残留 | OK（実在のJコマンドと回帰テスト） |
| ロールバック | OK（リポジトリ変数、コミット不要） |
| `status===null` の誤判定（#1171/#1172） | **未解決**: 並列化の前に #1172 を入れるか、並列実行器の厳格な扱い（失敗扱い）を直列より先行させることを Owner が了承するか |
| CIランナーのコア数・メモリ | **未確認**（ステージ2の最初のステップで確認） |
| #1172 のCI | PENDING |

**判定: ステージ1のPR（コード、既定動作不変）は作成してよい状態。ただし #1172 のマージ後が望ましい。ステージ2（`test.yml` 変更と有効化）は個別承認。**

## 7. ステージ2の設計（GitHub Actions での J パイロット。ワークフロー変更・変数設定・有効化は未許可）

### 7.1 ワークフロー変更案（`.github/workflows/test.yml`、`test-shards` ジョブのみ。ローカルで契約テストに通ることを確認済み）

```yaml
      - name: Record runner resources (shard J parallel pilot)
        if: matrix.shard == 'J'
        run: |
          nproc
          free -m
          grep -m1 'model name' /proc/cpuinfo
          cat /sys/fs/cgroup/cpu.max 2>/dev/null || true
          cat /sys/fs/cgroup/memory.max 2>/dev/null || true
      - name: Run canonical test shard ${{ matrix.shard }}
        env:
          TEST_SHARD: ${{ matrix.shard }}
          # Parallel execution is off unless the repository variable TEST_SHARD_PARALLELISM_J is set; only shard J can use it.
          TEST_SHARD_PARALLELISM: ${{ matrix.shard == 'J' && (vars.TEST_SHARD_PARALLELISM_J || '1') || '1' }}
          TEST_SHARD_PARALLEL_REPORT: artifacts/shard-parallel/${{ matrix.shard }}.json
        run: node tests/run-all-shard.js
      - name: Upload parallel shard report
        if: always() && matrix.shard == 'J' && vars.TEST_SHARD_PARALLELISM_J != ''
        uses: actions/upload-artifact@v4
        with:
          name: shard-parallel-report-${{ matrix.shard }}-${{ github.run_id }}
          path: artifacts/shard-parallel
          if-no-files-found: ignore
          retention-days: 14
```

- マージ時点では変数が未設定なので、**全シャードの挙動は現行と同一**（J のリソース出力ステップが数秒増えるだけ）。
- ジョブの `timeout-minutes: 30` は変更しない。並列実行の全体タイムアウト（既定1680秒）がそれより先に診断を出す。タイムアウト値の延長はしない。
- ローカルでの確認: `shard-matrix-contract`、`workflow-path-filter-contract-test`、`workflow-browser-timeout-contract`、`iphone-webkit-smoke-contract-test` が通り、YAML が解釈できる。`ci-hygiene.yml` は `test.yml` の変更で動くパスフィルタを持つ（既存の挙動）。
- ステージ2のPR作成前に、`test.yml` を変更中の他のPRがないこと、最新mainに追従していることを再確認する。

### 7.2 並列度2から始める手順

1. （Owner）リポジトリ変数 `TEST_SHARD_PARALLELISM_J = 2` を設定。以後のPR実行・main push実行の J が並列度2になる。
2. 最初の1回で CI ランナーの実際のコア数・メモリ・モデル名（リソース出力ステップ）を確認する。**コア数が4未満、またはメモリが想定（16GB）の半分以下なら、変数を削除して中止**する。
3. 10回以上のPR実行（main push実行は別集計）で下記の指標を集める。

### 7.3 並列度4へ移行する条件（すべて満たすこと）

- 並列度2で10回連続成功。各回で `canonical-test-shard-summary` の `executed=10` と `seen` が直列の基準値と一致、`parallel-shard-summary` の `passed=10 failed=0 aborted=0 notStarted=0`。
- J の実行時間の中央値が、直列基準（直近120件で 25.9分）に対して 14分以下（ローカルの並列度2の比 約1.8倍からの推定: 約14分）。
- `leftoverProcesses` が0、テスト単位のタイムアウト発動0。
- 使用中ピークメモリが `MemTotal` の50%以下、`nproc` が4以上。
- システムCPU使用率が40%以上（並列度2でコアが実際に使われている証拠）。
- その後、変数を `4` にし、さらに10回同じ条件（J の中央値 10分以下を目標、メモリ50%以下）で確認する。

### 7.4 計測する指標と方法

| 指標 | 取得元 |
|---|---|
| ランナーのコア数・メモリ・モデル・cgroup上限 | リソース出力ステップのログ |
| J の実行時間、開始待ち | `node scripts/ci-metrics.js`（`test-shard-J` の queue / execution）。変数設定前の履歴を基準にする |
| 他シャードに対する J の相対値（ランナーの速度変動の対照） | 同じ run の他シャードの実行時間との比を、変数設定の前後で比較 |
| CPU・ピークメモリ・ランナー自身のCPU・件数・各テストの時間 | アーティファクト `shard-parallel-report-J-<run_id>`（`parallel-shard-summary` 行にも出る） |
| 実行件数・失敗率 | `canonical-test-shard-summary` の `executed`/`seen`、run の結論 |
| 逐次との速度比較 | 変数設定前の履歴（n=115）と、設定後の10回以上。さらに、設定後でも変数を一時的に `1` に戻した run を数回挟んで同日比較する |

### 7.5 即時ロールバック

- 変数 `TEST_SHARD_PARALLELISM_J` を削除（または `1`）→ 次の実行から直列。コミット・PR不要。実行中の run には影響しない。
- 次の場合は**直ちにロールバック**し原因を調べる: `executed`/`seen` が基準と不一致、`leftoverProcesses` が true、テスト単位または全体のタイムアウト、メモリ使用が50%超、J 以外のシャードの挙動変化、原因不明の失敗。
- コード側の撤回は `test.yml` の追加行の revert（変数なしでは何も変わらないので、緊急性は低い）。

### 7.6 リスクと対処

| リスク | 対処 |
|---|---|
| ランナーが想定より遅い・コア数が少ない | リソース出力で最初の1回に検出。中止条件を設定 |
| 並列実行で初めて顕在化するテスト間干渉 | J は監査で書き込みが `*_PARITY_OUTPUT` 環境変数ゲートのみ。直列グループ機構あり。不一致時は即ロールバック |
| 失敗時の診断ログの差 | 並列時は `::error` が登録名ではなくファイルパス／npmスクリプト名になる。失敗テストの出力は保持される |
| ホスト速度の変動で時間比較がぶれる | 他シャードとの相対値、設定前後の n 比較、`1` に戻した同日 run |
