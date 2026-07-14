# MARKET_ENGINE_DESIGN

Phase 1Aは新規ゲームの標準選択 `selectedBusiness: ramen` に基づき、対象業種をラーメンに限定する。市場単位は `businessID + prefID`。競合は `businessID` 一致かつ `prefID` から解決した `areaID` 一致のAND条件で抽出する。

`js/market.js` はclassic scriptとして内部レジストリ `__capitalismTycoonModules.market` に登録する。UI描画は `js/app.js` の事業タブだけで行う。

顧客セグメントは価格重視、日常利用、味・品質重視、利便性重視、ブランド・流行重視の5種類。marketWeight合計は1で、感度は全て異なる。購入見送りをsoftmax参加者に含め、競合不在時も市場平均オファーを1件入れる。

capacity未設定は0ではなく自動導出。明示的 `capacity: 0` は販売停止。自動導出は `business.demand`、`operatingHours`、`store.level`、`condition`、`pref.traffic`、`business.efficiency` から決定論的に計算する。
