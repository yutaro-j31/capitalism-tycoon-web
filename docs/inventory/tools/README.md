# tools/ — 棚卸しの再現用スクリプト

`docs/inventory/*.md` の数値は、ここにあるスクリプトで再現できる（Chromium + Playwright が必要。`require('playwright')` が通ること）。**ゲームのコードには一切触れず**、`index.html` を起動して計測するだけ。出力は `INVENTORY_WORK`（既定 `./work`）に置く。リポジトリ直下で実行する。

```sh
mkdir -p work && python3 -m http.server 8123 &      # 計測対象の配信（リポジトリ直下）
export INVENTORY_WORK=work NODE_PATH=$(npm root -g)
# 1) 実起動の計測（モジュール呼出・Engine差替の実行回数・UI enhancer・DOM属性・g の読み書き）
TRACE_G=1 node docs/inventory/tools/harness.js default 156 work/D156.json     # 既定UI 156週
TRACE_G=1 node docs/inventory/tools/harness.js ui3 52 work/U52.json           # ?ui=3 52週
ENRICH=1  node docs/inventory/tools/harness.js default 60 work/R60.json       # 資産を持たせた状態
ENRICH=1  node docs/inventory/tools/harness.js default 80 work/R80.json
ENRICH=1  node docs/inventory/tools/harness.js ui3 30 work/RU30.json
          node docs/inventory/tools/harness.js default 30 work/P30.json
# 2) 全ボタン押下（タブごとに分割して並列実行できる。出力は追記式 jsonl）
node docs/inventory/tools/crawl.js default work/crawl_d1.jsonl 30 home,map,business,office,market,venture
node docs/inventory/tools/crawl.js default work/crawl_d2.jsonl 30 ma,overseas,assets,bank,report,founder
node docs/inventory/tools/crawl.js default work/crawl_d3.jsonl 30 strategy,media,legacy,missions,rivals,news,settings
node docs/inventory/tools/crawl.js ui3 work/crawl_u1.jsonl 30 home,map,business,office,market,venture,ma,overseas,assets,bank
node docs/inventory/tools/crawl.js ui3 work/crawl_u2.jsonl 30 report,founder,strategy,media,legacy,missions,rivals,news,settings
# 3) 集計
python3 docs/inventory/tools/build_aux.py
python3 docs/inventory/tools/fields_static.py D156.json
python3 docs/inventory/tools/fields_classify.py >/dev/null
python3 docs/inventory/tools/mods_analyze.py D156.json U52.json R60.json R80.json RU30.json P30.json
python3 docs/inventory/tools/mods_final_pre.py
python3 docs/inventory/tools/gen_features.py && python3 docs/inventory/tools/emit_features.py
python3 docs/inventory/tools/emit_fields.py && python3 docs/inventory/tools/fields_delcand.py
python3 docs/inventory/tools/emit_ui.py && python3 docs/inventory/tools/gen_spec.py && python3 docs/inventory/tools/emit_readme.py
```

注意:
- `gen_features.py` / `emit_fields.py` / `gen_spec.py` には、人が根拠を読んで下した判断（モジュールごとの「値だけ」「不明」の理由、矛盾 C1〜C14 の文面）がコードとして埋め込まれている。再実行すると同じ文章が出るが、コード側が変わったら判断の見直しが要る。
- `fields_static.py` は引数にファイル名（`D156.json`）を取るが `fields_classify.py` は `work/` の固定ファイル名を読む。
- 計測は「新規ゲーム・シナリオ free・難易度 normal」の1シードのみ。`harness.js` の `ENRICH` は会計の整合を崩さないよう `contributeFounderCapital` で資金を注入する（`companyCash` の直接書換は週送りの貸借一致検査で失敗する）。
