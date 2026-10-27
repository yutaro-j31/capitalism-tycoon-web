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
