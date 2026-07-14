# MARKET_ENGINE_DESIGN

Phase 1Aは新規ゲームの標準選択 `selectedBusiness: ramen` に基づき、対象業種をラーメンに限定する。市場単位は `businessID + prefID`。競合は `businessID` 一致かつ `prefID` から解決した `areaID` 一致のAND条件で抽出する。

`js/market.js` はclassic scriptとして内部レジストリ `__capitalismTycoonModules.market` に登録する。UI描画は `js/app.js` の事業タブだけで行う。

顧客セグメントは価格重視、日常利用、味・品質重視、利便性重視、ブランド・流行重視の5種類。marketWeight合計は1で、感度は全て異なる。購入見送りをsoftmax参加者に含め、競合不在時も市場平均オファーを1件入れる。

capacity未設定は0ではなく自動導出。明示的 `capacity: 0` は販売停止。自動導出は `business.demand`、`operatingHours`、`store.level`、`condition`、`pref.traffic`、`business.efficiency` から決定論的に計算する。

## Merge前修正

プレイヤー店舗だけに無条件効用ボーナスを与える処理は削除した。プレイヤーと競合の差は、価格、品質、ブランド、利便性、サービス、新規性、顧客満足度、リピート率のみで生じる。

購入見送りは店舗配列の先頭ではなく、競合平均価格と明示的なラーメン基準価格920円を使って計算するため、stores配列の順序に依存しない。

週次処理では、市場計算前に今週openingWeekへ到達したpreparing店舗をopenへ変更する。これにより開店初週から市場計算に参加し、開店ニュースは1回だけ発行される。

Phase 1A対象店舗でも旧式と同じ位置で需要用 `rand(.88, 1.14)` を1回消費する。この値は市場計算には使わず、以降の株価、競合、VC、M&A等の乱数列互換性を保つための互換スロットである。その直後、従来通り店舗状態低下用 `rand(.1, 1)` を消費する。
