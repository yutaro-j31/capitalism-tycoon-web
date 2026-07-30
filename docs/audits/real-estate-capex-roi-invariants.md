# Real Estate Capex ROI Invariants

- 改修・再開発の見積前提は既存 `real-estate-development.js` と一致させる。
- 改修は物件価値の8%、8週、価値回収70%、状態+0.15。
- 再開発は物件価値の35%、26週、価値回収92%、状態+0.20。
- 市場賃料予測は `realEstateRentPricing.marketRent` を利用する。
- ROI分析は現金、利益、負債、帳簿価額、物件状態を変更しない。
- 会社所有と個人所有はownerフィルタで分離する。
- 同一週の分析履歴は一度だけ記録する。
- 履歴は260件を上限とする。
- `Math.random` と `Date.now` を使用しない。
- SAVE_KEYと実効saveVersionを変更しない。