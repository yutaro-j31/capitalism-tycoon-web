# 18. M&A・子会社・買収後統合システム

## 1. 目的

本章は、企業・事業・店舗群の買収、売却、合併、子会社化、持分取得、買収資金、価格交渉、デューデリジェンス、のれん、非支配株主持分、買収後統合を定義する。

## 2. 基本原則

- 買収価格と企業価値、株式価値、引受債務を区別する。
- 会社資金による買収と個人資金による投資を混同しない。
- 買収対象の資産・負債・契約・従業員・店舗を一貫して移転する。
- 100%未満の取得では非支配株主と持分比率を保持する。
- 買収効果は即時に完全発現せず、統合期間と失敗リスクを持つ。

## 3. 取引類型

- 株式取得
- 事業譲渡
- 店舗群取得
- 合併
- 株式交換
- 少数持分投資
- 経営権取得
- 子会社売却
- スピンオフ

取引類型ごとに移転対象と会計処理を変える。

## 4. M&Aデータ

```ts
interface MADeal {
  id: string;
  buyerCompanyId: string;
  targetCompanyId?: string;
  dealType: string;
  ownershipAcquired: number;
  status: 'screening' | 'negotiating' | 'dueDiligence' | 'signed' | 'closing' | 'integrating' | 'completed' | 'failed';
  enterpriseValue: number;
  equityPurchasePrice: number;
  assumedDebt: number;
  cashAcquired: number;
  consideration: DealConsideration;
  synergies: SynergyPlan;
  risks: DealRisk[];
  closingWeek?: number;
}
```

## 5. 買収候補探索

候補は以下の観点で評価する。

- 地域補完
- 顧客層補完
- ブランド
- 商品・技術
- 店舗網
- 人材
- 調達力
- 財務改善余地
- 競合排除
- IPO前成長

スクリーニング段階では完全情報を表示せず、調査により精度を上げる。

## 6. 企業価値

```text
StandaloneEV
= WeightedAverage(
  EBITDA × Multiple,
  Revenue × Multiple,
  DCF,
  AssetValue
)

StrategicValue
= StandaloneEV
+ RealizableSynergyValue
- IntegrationCost
- RiskAdjustment
```

株式取得価格は以下で求める。

```text
EquityPurchasePrice
= EnterpriseValue
+ CashAcquired
- DebtAssumed
- OtherDebtLikeItems
± WorkingCapitalAdjustment
```

## 7. プレミアム

支配権取得ではコントロールプレミアムが必要となる場合がある。

プレミアムは以下で変動する。

- 対象会社の成長性
- 競合入札
- 売却意欲
- 創業者持分
- 資金繰り
- 市場環境
- 買い手とのシナジー

## 8. デューデリジェンス

調査領域:

- 財務
- 税務
- 法務
- 労務
- 店舗・設備
- 商品・在庫
- IT・セーブデータ上の参照整合性
- 契約
- 環境・衛生
- 不正・訴訟

調査費用と期間を要し、能力の高い本社部門ほど隠れた問題を発見しやすい。

## 9. 発見事項

発見事項は以下へ反映する。

- 価格減額
- 表明保証
- 補償上限
- クロージング条件
- 取引中止
- 統合予算
- 将来の偶発債務

## 10. 買収資金

資金源:

- 手元現金
- 銀行借入
- 社債
- 増資
- 株式対価
- 売主ローン
- アーンアウト

資金源ごとに希薄化、利息、返済、財務制限を反映する。

## 11. 株式対価

株式対価では買い手が新株を発行し、売り手株主へ渡す。

```text
NewBuyerShares
= EquityConsideration / BuyerReferenceSharePrice
```

買い手既存株主は希薄化する。

## 12. クロージング

クロージング時は原子的に以下を処理する。

1. 対価支払
2. 株式または事業所有権移転
3. 対象会社現金・債務認識
4. 子会社関係作成
5. 役員・従業員・店舗参照更新
6. のれん等の認識
7. 取引ログ保存
8. セーブ確定

途中失敗時は全体をロールバックする。

## 13. 取得会計

```text
Goodwill
= ConsiderationTransferred
+ FairValueOfNonControllingInterest
+ FairValueOfPreviouslyHeldInterest
- FairValueOfIdentifiableNetAssets
```

識別可能資産・負債を公正価値で認識し、残額をのれんとする。

のれんは将来の減損判定対象となる。

## 14. 非支配株主持分

100%未満取得の場合:

- 子会社の全資産・負債を連結
- 親会社帰属利益と非支配株主帰属利益を分離
- 配当を持分比率で配分
- 追加取得・一部売却で持分を更新

## 15. 買収後統合

統合領域:

- 経営体制
- 会計
- 人事制度
- 店舗運営
- 商品・ブランド
- 調達
- IT
- 本社機能
- 借入・資金管理

統合方法は完全統合、部分統合、独立運営から選択する。

## 16. シナジー

```text
RealizedSynergy
= PlannedSynergy
× IntegrationProgress
× ExecutionQuality
× CultureCompatibility
```

シナジー区分:

- 売上シナジー
- 原価低減
- 本社費削減
- 調達改善
- 設備共用
- 資金調達改善

シナジーには達成期間、実行費用、失敗確率を設定する。

## 17. 統合リスク

- 主要人材退職
- 顧客離反
- ブランド毀損
- システム障害
- 会計不整合
- 店舗重複
- 文化衝突
- 想定外債務
- 過大なのれん

買収後の短期利益だけで成功判定を行わない。

## 18. 事業売却

売却時は以下を処理する。

- 対象資産・負債の除却
- 売却対価受領
- 売却損益
- 従業員・店舗・契約移転
- 子会社持分減少
- 非支配株主持分調整

売却対象の参照が残らないことを検証する。

## 19. AI企業のM&A

AI企業も同じ価格、資金、会計、統合ルールを使う。

AIは将来情報を参照せず、公開情報と調査結果だけで判断する。

## 20. テスト要件

- EVから株式取得価格への変換が正しい
- 対価支払額と売り手受取額が一致する
- 買収後の所有比率が正しい
- 100%未満取得で非支配持分が残る
- 取得資産・負債・のれんの合計が整合する
- クロージング途中失敗時にロールバックされる
- 売却後に孤立参照が残らない
- 同一シードで交渉結果と統合イベントが再現される
- 1,200週回帰で子会社循環参照や二重所有が発生しない
