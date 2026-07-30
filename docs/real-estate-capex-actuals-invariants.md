# Real Estate CAPEX Actuals Invariants

- 既存の `real-estate-development.js` だけが工事支払と資産計上を行う。
- 実績管理は現金、利益、負債、帳簿価額、物件状態を変更しない。
- 会社工事は会社現金、個人工事は個人現金だけを参照する。
- 進捗は `paidCost / totalCost`、残工事費は `totalCost - paidCost` から決定論的に算出する。
- 資金不足停止は既存project statusを正として表示する。
- 完成後の予測差は着手時ROI履歴と現在市場賃料を比較する。
- 同一週は一度だけ記録し、履歴は260件を上限とする。
- `Math.random` と `Date.now` を使用しない。
- SAVE_KEYと実効saveVersionを変更しない。
- production loaderはlaunch tokenを継承し、読込失敗時はfail-closedフラグを立てる。
