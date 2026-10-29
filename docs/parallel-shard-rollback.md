# シャードJ・C・E 並列実行パイロット — 有効化とロールバック手順（Stage 2A / Stage 3）

状態（2026-10-29、main `e731bacb` の Test #4304 のログ）: **J は2並列、C は直列**。E の opt-in 対応は PR #1203 でマージ保留。以下の E の説明はその PR の実装であり、main での有効化を意味しない。変数未設定のシャードは直列で動く。J の4並列化は未承認。C の2並列実証と10回以上の安定性確認後に E のマージ判断を Owner に提出し、E の本番変数設定はさらに別の Owner 判断とする。設計の背景は `docs/parallel-shard-stage1-design.md`（Stage 1 時点の履歴。現在の許可範囲は本書と Owner 指示を優先）。

## 仕組み
- `.github/workflows/test.yml` の `test-shards` が `TEST_SHARD_PARALLELISM` を `matrix.shard == 'J' && (vars.TEST_SHARD_PARALLELISM_J || '1') || matrix.shard == 'C' && (vars.TEST_SHARD_PARALLELISM_C || '1') || matrix.shard == 'E' && (vars.TEST_SHARD_PARALLELISM_E || '1') || '1'` で渡す。J・C・E 以外は常に `1`。
- `tests/run-all-shard.js` は値が `2` 以上で、かつ `scripts/parallel-shard-runner.config.json` の `parallelEnabledShards` に載るシャードだけ並列実行する（それ以外は警告つきで直列）。
- J・C・E では毎回、実行前に `nproc`・`free -m`・CPUモデル・cgroup の `cpu.max`/`memory.max` をログに出す（数秒）。
- 変数が設定されているときだけ、並列実行の報告JSON（`shard-parallel-report-<J|C|E>-<run_id>`、14日保持）をアーティファクトに保存する。

## 有効化（Owner の判断後）
1. Settings → Secrets and variables → Actions → Variables で Owner が `TEST_SHARD_PARALLELISM_C = 2` を設定する。J は `2` を維持。E は別承認まで設定しない。変更時刻を記録し、その後に作成された新規 run のみを実証対象にする。変更前の run の再実行は数えない。変数変更の権限がないエージェントは Owner に依頼する。
2. C の実行ログの `TEST_SHARD_PARALLELISM: 2` と `parallel-shard-summary: shard=C concurrency=2` を確認する。アップロードステップだけでは有効化を判定しない。実リソース（`nproc`、CPUモデル、物理メモリ、cgroup上限）を記録し、想定（4 vCPU / 約16GB）を下回る場合はロールバックする。
3. C は `enumerated=25 passed=25 failed=0 aborted=0 notStarted=0`、canonical `executed=25`、同一コミットの contract モードと `seen` が一致すること。列挙コマンド一覧と SHA256 digest も同一コミットで照合する。J は2並列を維持し、他シャードの契約と必須CI・集約Testも成功すること。
4. SIGKILL・OOM・ENOBUFS・タイムアウトは失敗。報告 JSON の全結果で `leftoverProcesses=false`、ピーク使用メモリは物理メモリの50%以下とする。JSONを取得できない場合、ログで確認できた範囲と残留プロセス等の未確認項目を分けて記録し、完全PASSとはしない。
5. 10回以上の本番実測を PR / main push 別に記録する。SHA・run/job ID・日時・CPUモデル/nproc・物理メモリ・件数・wall・テスト時間合計・CPU・ピークメモリ・キュー待ち・他シャード時間・全体クリティカルパスを保存する。キャンセルは成功/失敗と分離し、10回の成功に含めない。同一runのテスト時間合計/wallを、直列実測との速度比として扱わない。

## ロールバック
- C の異常時は Owner に `TEST_SHARD_PARALLELISM_C = 1`（または削除）を依頼する。J の `2` は維持。各変数は独立で、コミット・PR は不要。変更後の新規 run の実ログで直列復帰を確認し、既存 run が切り替わったとはみなさない。E 有効化後も E だけ同様にロールバックする。
- 即時ロールバックの条件: `executed`/`seen` の不一致、残留プロセス、テスト単位または全体のタイムアウト、メモリ使用が `MemTotal` の50%超、対象外シャードの挙動変化、原因不明の失敗。
- コード側の撤回: この PR の revert。変数が未設定の間は何も変わらないため緊急性は低い。

## 検証（変数なし／ありで確認する項目）
- `node tests/shard-parallel-workflow-contract-test.js`: 変数未設定で全シャードが `1` に解決され、必須ゲート（`needs`、`timeout-minutes: 40`、matrix、集約 `test`）が不変であること。
- `node tests/shard-parallel-optin-test.js`: 異常終了・タイムアウト・プロセス残留・件数一致の回帰テスト。
