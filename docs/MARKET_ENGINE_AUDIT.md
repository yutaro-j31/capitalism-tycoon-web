# MARKET_ENGINE_AUDIT

## コード上で確認した現行売上計算

対象ファイルは `js/engine.js`。週次処理は `TycoonEngine.prototype.advanceWeek` で、`updateMacro`、株式市場、物件、スタートアップ、競合、施策、商品、海外、子会社、FC、個人資産の更新後に店舗ループを実行していた。

現行式は、営業中店舗ごとに `business.demand * pref.traffic * area.traffic * economy * season * fit(business, area) * (1 + quality/100) * (1 + brand/90) * (1 + dx/140) * (1 - localCompetition * .55) * rand(.88, 1.14)` を需要とし、部門効果、営業時間、マクロ危機を乗算していた。売上は `demand * business.price * inflation`、変動費は `demand * business.unitCost * inflation * efficiency補正 / operations部門補正`、固定費は `business.fixedCost + pref.rent + business.wage` に営業時間、インフレ、危機コストを掛け、修繕費は `max(0, 100 - store.condition) * 650`。

入力項目は store.businessID/prefID/status/operatingHours/condition、business.price/unitCost/demand/quality/brand/efficiency/dx/fixedCost/wage、pref.traffic/rent/areaID、area.traffic/competition/ramenFit/cafeFit/conveniFit、economy/season/inflation/macroCrisis、departments/departmentStaff/executives、competitors。出力は `store.lastSales`、`store.lastProfit`、`store.condition`、週次 `sales`、`expenses`、`lastReport`、`reports`、`companyCash`、履歴。

乱数呼出順は店舗ループ内で需要 `rand(.88,1.14)`、状態劣化 `rand(.1,1)` を店舗ごとに消費する。競合処理は `competitorPressure(areaID,businessID)` が `areaID === areaID && businessID === businessID` のANDで集計し、別途 `updateCompetitors` が現金、品質、ブランド、出店に乱数を使う。市場シェアは拡張側 `updateSupplyChainWeekly` が `business.demand * stores.length * 1.8` を分母にしていた。

現行の複数店舗処理は各店舗が同じ需要式を個別に持つため、同一市場の2店舗目は市場需要を複製する。capacity相当の保存項目は店舗標準にはなく、営業時間、状態、業種需要、交通量が能力に近い。地域市場識別は `store.prefID` と `pref.areaID`。

## Phase 1Aで置き換える範囲

`businessID === 'ramen'` かつ営業中店舗だけを `js/market.js` の市場グループ計算に置き換える。対象外業種は旧店舗ループをそのまま通し、既存の売上、原価、利益、乱数消費を維持する。対象業種でも固定費、修繕費、店舗状態劣化は既存処理を維持し、販売数量、売上、変動費、限界利益、市場シェア、capacity、セグメント配分だけを市場結果から適用する。

## 乱数互換性の修正

対象店舗では市場需要を決定論的に計算するが、旧店舗計算で存在した需要用 `rand(.88, 1.14)` を店舗ループ内で消費する。これは株価、競合、VC、M&A、子会社など後続処理の乱数列を維持するためで、売上値には使用しない。店舗状態低下用 `rand(.1, 1)` は従来通り直後に実行する。
