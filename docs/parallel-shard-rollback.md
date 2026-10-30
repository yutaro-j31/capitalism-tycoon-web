# シャードJ・C 並列実行パイロット — 有効化とロールバック手順（Stage 2A / Stage 3）

状態: **ワークフローは接続済みだが、並列化は無効**。リポジトリ変数 `TEST_SHARD_PARALLELISM_J` / `TEST_SHARD_PARALLELISM_C` が未設定の間、全シャード（J・C を含む）は従来どおり直列で動く（J は Owner が `2` に設定済み。C は Stage 3 で追加、設定は Owner の別承認後）。設計の背景は `docs/parallel-shard-stage1-design.md`。

## 仕組み
- `.github/workflows/test.yml` の `test-shards` が `TEST_SHARD_PARALLELISM` を `matrix.shard == 'J' && (vars.TEST_SHARD_PARALLELISM_J || '1') || matrix.shard == 'C' && (vars.TEST_SHARD_PARALLELISM_C || '1') || '1'` で渡す。J・C 以外は常に `1`。
- `tests/run-all-shard.js` は値が `2` 以上で、かつ `scripts/parallel-shard-runner.config.json` の `parallelEnabledShards` に載るシャードだけ並列実行する（それ以外は警告つきで直列）。
- J・C では毎回、実行前に `nproc`・`free -m`・CPUモデル・cgroup の `cpu.max`/`memory.max` をログに出す（数秒）。
- 変数が設定されているときだけ、並列実行の報告JSON（`shard-parallel-report-<J|C>-<run_id>`、14日保持）をアーティファクトに保存する。

## 有効化（Owner の判断後）
1. Settings → Secrets and variables → Actions → Variables で `TEST_SHARD_PARALLELISM_J = 2`（C は `TEST_SHARD_PARALLELISM_C = 2`）を作成。変数設定後に作成された run だけが対象（run 作成時点の値で固定）。
2. 最初の J（C）の実行で、リソース出力の `nproc` とメモリを確認する。想定（4 vCPU / 約16GB）を下回る場合は直ちに下記のロールバックを行う。
3. 判定指標: `canonical-test-shard-summary` の `executed`/`seen` が直列と一致、`parallel-shard-summary` の `failed=0 aborted=0 notStarted=0`、`leftoverProcesses` なし。

## ロールバック
- 変数 `TEST_SHARD_PARALLELISM_J`（または `_C`）を削除（または `1` に設定）。J と C は独立にロールバックできる。次に開始する実行から直列に戻る。コミット・PR は不要。実行中の run には影響しない。
- 即時ロールバックの条件: `executed`/`seen` の不一致、残留プロセス、テスト単位または全体のタイムアウト、メモリ使用が `MemTotal` の50%超、対象外シャードの挙動変化、原因不明の失敗。
- コード側の撤回: この PR の revert。変数が未設定の間は何も変わらないため緊急性は低い。

## 検証（変数なし／ありで確認する項目）
- `node tests/shard-parallel-workflow-contract-test.js`: 変数未設定で全シャードが `1` に解決され、必須ゲート（`needs`、`timeout-minutes: 40`、matrix、集約 `test`）が不変であること。
- `node tests/shard-parallel-optin-test.js`: 異常終了・タイムアウト・プロセス残留・件数一致の回帰テスト。
