# 19. 不動産・銀行・担保・返済システム

## 1. 目的

本章は、店舗物件・本社・投資用不動産の取得、賃借、売却、評価、収益、修繕、銀行借入、担保、財務制限条項、返済、借換え、債務不履行を定義する。

## 2. 基本原則

- 不動産所有者、利用者、借入主体、担保提供者を明確に分離する。
- 会社保有不動産と個人保有不動産を混同しない。
- 借入金の入金、元本返済、利息支払を別取引として記録する。
- 担保価値は市場価格と同一ではなく、掛目を適用する。
- 不動産価格、賃料、金利は景気・地域・用途・物件状態に連動する。

## 3. 不動産区分

- 店舗用物件
- 本社・事務所
- 倉庫・物流施設
- 工場・セントラルキッチン
- 投資用住宅
- 投資用商業施設
- 土地

## 4. データモデル

```ts
interface RealEstateAsset {
  id: string;
  ownerId: string;
  ownerType: 'player' | 'company' | 'subsidiary' | 'external';
  propertyType: string;
  regionId: string;
  acquisitionCost: number;
  bookValue: number;
  marketValue: number;
  landValue: number;
  buildingValue: number;
  condition: number;
  occupancyRate: number;
  weeklyRentIncome: number;
  weeklyOperatingCost: number;
  collateralLoanIds: string[];
}
```

## 5. 購入と賃借

物件利用方式は購入または賃借から選択する。

購入:

- 初期資金負担が大きい
- 資産計上する
- 減価償却が発生する
- 担保利用できる
- 価格変動リスクを負う

賃借:

- 保証金、初期費用、定期賃料が発生する
- 原則として所有権を持たない
- 契約更新、退去、賃料改定リスクがある

## 6. 不動産価値

```text
MarketValue
= BaseRegionalValue
× PropertyTypeModifier
× LocationModifier
× ConditionModifier
× OccupancyModifier
× MarketCycleModifier
```

投資用物件では収益還元価値も使う。

```text
NOI = RentIncome - PropertyOperatingExpenses
IncomeValue = NOI / CapitalizationRate
```

最終市場価値は取引事例価値と収益還元価値の加重平均とする。

## 7. 賃料

賃料は以下で変動する。

- 地域需要
- 物件用途
- 景気
- 空室率
- 物件状態
- 契約期間
- インフレ

店舗賃料は店舗PLへ、投資用物件収益は所有主体の不動産収益へ計上する。

## 8. 修繕・設備投資

物件状態は時間経過と使用負荷で悪化する。

- 小修繕は費用処理
- 耐用年数を延長する大規模改修は資産計上
- 修繕不足は来客、賃料、衛生、事故確率へ悪影響

## 9. 減価償却

土地は原則として償却しない。建物・設備は耐用年数に基づき償却する。

```text
WeeklyDepreciation
= DepreciableBasis / UsefulLifeWeeks
```

売却時には帳簿価額と売却価格との差を売却損益として認識する。

## 10. 銀行借入データ

```ts
interface LoanContract {
  id: string;
  borrowerId: string;
  lenderId: string;
  principal: number;
  outstandingPrincipal: number;
  interestType: 'fixed' | 'floating';
  annualInterestRate: number;
  maturityWeek: number;
  repaymentType: 'amortizing' | 'bullet' | 'revolving';
  collateralIds: string[];
  covenants: Covenant[];
  status: 'active' | 'warning' | 'default' | 'restructured' | 'repaid';
}
```

## 11. 融資審査

銀行は以下を評価する。

- 営業CF
- EBITDA
- 利息負担能力
- 自己資本比率
- 借入総額
- 担保価値
- 返済実績
- 事業安定性
- 景気・業種リスク
- 経営者信用

```text
DebtServiceCapacity
= SustainableOperatingCashFlow / AnnualDebtService
```

## 12. 金利

```text
LoanRate
= BasePolicyLinkedRate
+ BorrowerCreditSpread
+ TermPremium
+ CollateralAdjustment
+ MarketLiquidityAdjustment
```

変動金利は参照金利変更時に再計算する。

## 13. 返済方式

### 元利均等または元金均等

各期に元本と利息を支払う。

### 期限一括

期中は利息のみ、満期に元本全額を返済する。

### 当座・リボルビング

限度額内で借入と返済を繰り返す。

## 14. 会計処理

借入時:

```text
借方 現金 / 貸方 借入金
```

利息支払:

```text
借方 支払利息 / 貸方 現金
```

元本返済:

```text
借方 借入金 / 貸方 現金
```

元本返済を費用として扱わない。

## 15. 担保

```text
EligibleCollateralValue
= MarketValue × CollateralHaircut

LoanToValue
= OutstandingPrincipal / EligibleCollateralValue
```

同一資産への二重担保は、順位と既存担保余力を明示的に管理しない限り禁止する。

## 16. 財務制限条項

例:

- 最低自己資本比率
- 最大Debt/EBITDA
- 最低利息カバレッジ
- 最低現金残高
- 追加借入制限
- 配当制限
- 担保処分制限

違反時は警告、金利上乗せ、期限前返済請求、再交渉へ進む。

## 17. 借換え

借換えでは新規借入で既存借入を返済する。

- 手数料
- 金利差
- 期間延長
- 担保変更
- 財務制限変更
- 期限集中リスク

を比較する。

## 18. 債務不履行

以下でデフォルト判定する。

- 支払期日に現金不足
- 財務制限違反の未解消
- 虚偽報告
- 担保無断処分
- 破産・清算

処理段階:

1. 支払警告
2. 猶予・条件変更交渉
3. 金利上乗せ
4. 担保実行
5. 事業再生または倒産

## 19. 担保実行

担保実行時は、物件所有権移転または強制売却を行う。売却代金は以下の順位で配分する。

1. 処分費用
2. 先順位担保債権
3. 後順位担保債権
4. 残余を所有者へ返還

不足額は無担保債務として残る場合がある。

## 20. 個人保証

個人保証を設定した会社借入では、会社が返済不能になった場合に限り個人資産へ請求が及ぶ。

保証の有無を暗黙にせず、契約として明示する。

## 21. テスト要件

- 借入時の現金増加と負債増加が一致する
- 元本返済が費用計上されない
- 利息だけがPLへ計上される
- 不動産売却時の帳簿除却と損益が正しい
- 担保掛目とLTVが正しい
- 二重担保が不正に作成されない
- 財務制限違反が決定論的に検出される
- 個人保証なしで会社債務が個人資産へ移らない
- 1,200週後も負債残高、担保参照、物件所有者が整合する
