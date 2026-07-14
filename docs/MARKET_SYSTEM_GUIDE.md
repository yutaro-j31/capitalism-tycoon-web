# MARKET_SYSTEM_GUIDE

- 対象業種: `ramen`（ラーメン）。新規ゲームの標準 `selectedBusiness`。
- 対象外業種: cafe、conveni、その他全業種。旧売上式を維持。
- ローカル市場単位: `businessID + prefID`。
- 顧客セグメント: 価格重視、日常利用、味・品質重視、利便性重視、ブランド・流行重視。
- 市場規模: 業種需要、都道府県交通量、エリア交通量、景気、季節、ラーメン適性、マクロ危機から市場ごとに1回算出。
- 価格弾力性: 競合平均価格に対する相対価格を顧客効用に反映。
- 市場シェア: セグメント別softmaxで自社、競合、購入見送りへ配分し、capacity制約後の販売数量を潜在需要で割る。
- 競合抽出条件: `businessID` 一致 AND `areaID` 一致。
- カニバリゼーション: 同一市場の自社店舗を同時に比較し、同じ市場潜在需要を奪い合う。
- capacity未設定: 0補完禁止。`effectiveCapacity` で自動導出。
- 販売能力制約: `unitsSold = min(potentialDemand, effectiveCapacity)`。
- 店舗別採算: 売上、変動費、限界利益、限界利益率、潜在需要、稼働率、lostDemandを保存。
- 事業市場シェア: 全対象店舗unitsSold ÷ 重複なしローカル市場marketPotential合計。
- 週次処理順: 市場一括計算 → 店舗ループ適用 → 集計 → normalize/save/emit/render。
- セーブ項目: `marketResultsByStoreID`、`marketResultsByBusinessID`、`lastMarketCalculationCount`、店舗 `marketResult`。
- v3→v4: 市場結果コンテナを追加し、capacityは補完しない。
- 対象業種追加: `TARGET_BUSINESS_IDS` にIDを追加し、基準価格とセグメント妥当性をテストする。
- バランス調整: 通常ケースは旧式±10%目標。極端価格、原価割れ、capacity不足は意図的差分として扱う。
