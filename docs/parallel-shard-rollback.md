# シャードJ・C・E・L 並列実行パイロット — 有効化とロールバック手順（Stage 2A / Stage 3）

状態（2026-11-03 更新）: **J と C は2並列で本番運用中**（J は 2026-10-28 08:22 UTC、C は 2026-10-29 06:45 UTC に Owner が変数を設定。C は設定後 201 run で C ジョブ全て成功、中央値 14.4 分）。E の opt-in 対応は PR #1203 で、Owner の承認を得てマージ・有効化を進める（E の変数設定は Owner 判断）。変数未設定のシャードは直列で動く。J の4並列化は未承認。設計の背景は `docs/parallel-shard-stage1-design.md`（Stage 1 時点の履歴。現在の許可範囲は本書と Owner 指示を優先）。

## 仕組み
- `.github/workflows/test.yml` の `test-shards` が `TEST_SHARD_PARALLELISM` を `matrix.shard == 'J' && (vars.TEST_SHARD_PARALLELISM_J || '1') || matrix.shard == 'C' && (vars.TEST_SHARD_PARALLELISM_C || '1') || matrix.shard == 'E' && (vars.TEST_SHARD_PARALLELISM_E || '1') || matrix.shard == 'L' && (vars.TEST_SHARD_PARALLELISM_L || '1') || '1'` で渡す。J・C・E・L 以外は常に `1`。
- `tests/run-all-shard.js` は値が `2` 以上で、かつ `scripts/parallel-shard-runner.config.json` の `parallelEnabledShards` に載るシャードだけ並列実行する（それ以外は警告つきで直列）。
- J・C・E・L では毎回、実行前に `nproc`・`free -m`・CPUモデル・cgroup の `cpu.max`/`memory.max` をログに出す（数秒）。
- 変数が設定されているときだけ、並列実行の報告JSON（`shard-parallel-report-<J|C|E>-<run_id>`、14日保持）をアーティファクトに保存する。

## 有効化（Owner の判断後）
1. Settings → Secrets and variables → Actions → Variables で Owner が対象シャードの変数を設定する（C は設定済み。J は `2` を維持。E は PR #1203 のマージ後、`TEST_SHARD_PARALLELISM_E = 2`）。変更時刻を記録し、その後に作成された新規 run のみを実証対象にする。変更前の run の再実行は数えない。変数変更の権限がないエージェントは Owner に依頼する。
2. 対象シャードの実行ログの `TEST_SHARD_PARALLELISM: 2` と `parallel-shard-summary: shard=<C|E> concurrency=2` を確認する。アップロードステップだけでは有効化を判定しない。実リソース（`nproc`、CPUモデル、物理メモリ、cgroup上限）を記録し、想定（4 vCPU / 約16GB）を下回る場合はロールバックする。
3. C は `enumerated=25 passed=25 failed=0 aborted=0 notStarted=0`、canonical `executed=25`（E は 33/33/0/0/0、`executed=33`）、同一コミットの contract モードと `seen` が一致すること。列挙コマンド一覧と SHA256 digest も同一コミットで照合する。J は2並列を維持し、他シャードの契約と必須CI・集約Testも成功すること。
4. SIGKILL・OOM・ENOBUFS・タイムアウトは失敗。報告 JSON の全結果で `leftoverProcesses=false`、ピーク使用メモリは物理メモリの50%以下とする。JSONを取得できない場合、ログで確認できた範囲と残留プロセス等の未確認項目を分けて記録し、完全PASSとはしない。
5. 10回以上の本番実測を PR / main push 別に記録する。SHA・run/job ID・日時・CPUモデル/nproc・物理メモリ・件数・wall・テスト時間合計・CPU・ピークメモリ・キュー待ち・他シャード時間・全体クリティカルパスを保存する。キャンセルは成功/失敗と分離し、10回の成功に含めない。同一runのテスト時間合計/wallを、直列実測との速度比として扱わない。

## ロールバック
- 異常が出たシャードの変数（`TEST_SHARD_PARALLELISM_J` / `_C` / `_E` / `_L`）を、Owner が `1` に設定または削除する（私は変数を変更できない）。J・C・E は独立にロールバックでき、他のシャードの変数は維持する。コミット・PR は不要。変更後に作成された新規 run の実ログ（`TEST_SHARD_PARALLELISM: 1`、`parallel-shard-summary` なし）で直列復帰を確認し、既存 run が切り替わったとはみなさない。
- 即時ロールバックの条件: `executed`/`seen` の不一致、残留プロセス、テスト単位または全体のタイムアウト、メモリ使用が `MemTotal` の50%超、対象外シャードの挙動変化、原因不明の失敗。
- コード側の撤回: 各 opt-in PR（#1174 / #1179 / #1200 / #1203）の revert。変数が未設定の間は何も変わらないため緊急性は低い。

## 検証（変数なし／ありで確認する項目）
- `node tests/shard-parallel-workflow-contract-test.js`: 変数未設定で全シャードが `1` に解決され、必須ゲート（`needs`、`timeout-minutes: 40`、matrix、集約 `test`）が不変であること。
- `node tests/shard-parallel-optin-test.js`: 異常終了・タイムアウト・プロセス残留・件数一致の回帰テスト。
