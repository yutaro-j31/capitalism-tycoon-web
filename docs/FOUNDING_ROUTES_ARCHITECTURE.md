# 創業ルート統合とロード境界

今回の変更では既存の同期 script graph を全面バンドル化しない。`founding-routes-integration.js` は既存 Engine / market / finance / UI enhancer の上に置く additive integration layer とし、旧セーブへ遅延デフォルトを注入する。

## 論理グループ

1. **起動・保存・経済・会計エンジン** — `runtime.js`, `engine.js`, `finance.js`, save-storage 系, deterministic-economic-foundation。
2. **ラーメン店・市場・供給・人材・週次レポート** — `market.js`, `supply.js`, `workforce.js`, competitor 系、および店舗コンセプト/看板方針/店長委任を接続する `founding-routes-integration.js`。
3. **初期から利用可能な個人/会社の上場株投資** — engine の market state と主体別 holdings/cash、`founding-routes-integration.js` の成行/指値・流動性/スプレッド層。
4. **オフィス契約後の VC・資本政策・M&A・子会社** — startup/MA modules、ma-deal-room、ma-integration、capital allocation 系。入口の capability gate は `hasHeadOffice`。
5. **多店舗・ブランド・本部・製麺/セントラルキッチン・上場** — expansion、supply、franchise、vertical integration、IPO / shareholder 系。既存の中後半システムを再利用する。

## 保存互換

新規キーは `restaurantDesignByStoreID`, `storeManagersByStoreID`, `storeDelegationByStoreID`, `stockOrders`, `personalInvestmentLedger`, `investmentProfile`, `foundingRoute`, `capitalMarketsUnlocked`, `foundingMilestones`。欠損時のみデフォルトを補うため、既存 `saveVersion` を巻き戻したり既存配列/台帳を置換しない。

## 会計境界

会社株式は `companyCash/companyStocks` と finance ledger、個人株式は `personalCash/personalStocks/personalInvestmentLedger` を使用する。個人→会社の資金移動は `transferFounderFunds()` の増資または株主貸付だけを許可する。店舗コンセプト変更費は会社の広告費として記録する。

## 解放境界

上場株の詳細売買は開始時から会社/個人とも利用可能。VC・M&A候補生成・子会社化は最小オフィス契約を capability gate とする。自社株買いなど既存の上場前提機能は引き続き `publicCompany` を必要とする。店舗数や営業利益を VC/M&A の解放条件にはしない。
