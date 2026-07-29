# 16. 株式市場・IPO・配当・希薄化システム

## 1. 目的

本章は、未上場会社から上場会社への移行、株式価値の形成、株主構成、増資、配当、自社株買い、希薄化、株価変動、上場維持を一貫したルールで定義する。

株式市場は単なるスコア表示ではなく、会社の会計、資金調達、経営権、個人資産、M&A、役員報酬、長期目標に接続する中核システムとする。

## 2. 設計原則

1. 株式価値は会社の業績、財務、成長性、リスクから導く。
2. 発行済株式数と持株比率は全取引後に必ず整合する。
3. 増資は会社に資金を入れ、既存株主を希薄化させる。
4. 株式売買は売り手と買い手の資産を移転するだけで、会社資金を増やさない。
5. 配当は会社現金を減らし、株主の個人または法人現金を増やす。
6. 株価計算と株式取引は管理された乱数を使用し、同一シードでは再現可能とする。
7. IPO後も会計整合性、情報開示、上場維持条件を満たす必要がある。

## 3. 株式データモデル

最低限、以下を保持する。

```ts
interface EquityState {
  companyId: string;
  listingStatus: 'private' | 'preparing' | 'listed' | 'suspended' | 'delisted';
  authorizedShares: number;
  issuedShares: number;
  treasuryShares: number;
  freeFloatShares: number;
  sharePrice: number;
  marketCapitalization: number;
  shareholders: ShareholderPosition[];
  dividendPolicy: DividendPolicy;
  ipoRecord?: IPORecord;
  corporateActions: CorporateActionRecord[];
}
```

```ts
interface ShareholderPosition {
  holderId: string;
  holderType: 'player' | 'company' | 'founder' | 'employee' | 'vc' | 'market' | 'treasury';
  shares: number;
  acquisitionCost: number;
  votingClass: 'common' | 'nonVoting' | 'preferred';
  lockupUntilWeek?: number;
}
```

## 4. 株式数の不変条件

常に以下を満たす。

```text
issuedShares = Σ shareholder.shares
freeFloatShares <= issuedShares - treasuryShares
marketCapitalization = sharePrice × (issuedShares - treasuryShares)
```

株式分割や併合後も、端数処理を除き企業価値が不自然に変化してはならない。

## 5. 未上場会社の株式価値

未上場会社では市場価格ではなく推定株式価値を用いる。

```text
EnterpriseValue
= NormalizedEBITDA × SectorMultiple
+ GrowthPremium
- RiskDiscount

EquityValue
= EnterpriseValue
+ CashAndCashEquivalents
- InterestBearingDebt
- PreferredLiquidationPreference

EstimatedSharePrice
= EquityValue / FullyDilutedShares
```

赤字企業では、売上倍率、粗利益倍率、保有資産、将来キャッシュフローを補助指標として使用する。

## 6. IPO準備条件

IPO申請には最低限、以下を要求する。

- 一定期間の営業実績
- 監査可能な財務データ
- 債務超過でないこと
- 継続企業としての資金余力
- 取締役会と内部統制の整備
- 一定水準以上の企業価値
- 上場後に必要な流通株式比率
- 重大な未解決不祥事がないこと

条件値はゲームバランス設定から変更可能にする。

## 7. IPOプロセス

IPOは以下の段階で進む。

1. 上場方針決定
2. 主幹事・監査・法務準備
3. 財務・内部統制審査
4. 想定発行価格レンジ算出
5. 売出株と公募増資の構成決定
6. 需要調査
7. 公開価格決定
8. 新株発行と既存株売出し
9. 上場初日
10. ロックアップ期間

公募増資分だけが会社現金に流入し、既存株売出し分は売却株主へ流入する。

## 8. IPO価格

```text
ReferenceEquityValue
= WeightedAverage(
  DCFValue,
  ComparableValue,
  EarningsValue,
  AssetValue
)

OfferPrice
= ReferenceEquityValue / PostMoneyShares
× MarketSentimentModifier
× DemandModifier
× IPODiscount
```

過熱相場では初値上昇余地が増えるが、その後の価格変動も大きくする。

## 9. 上場後の株価形成

週次株価は以下の要素から形成する。

- 実績利益と市場予想との差
- 売上・利益成長率
- 営業利益率、ROE、FCF
- 財務レバレッジ
- 景気・金利・業種センチメント
- 配当、自社株買い、増資
- 不祥事、訴訟、事故
- M&A、事業売却、新規事業
- 流動性と需給

```text
FundamentalReturn
= EarningsSurpriseWeight
+ GrowthRevisionWeight
+ MarginRevisionWeight
+ BalanceSheetWeight

WeeklyReturn
= clamp(
  FundamentalReturn
  + MarketReturn
  + SectorReturn
  + CorporateActionReturn
  + LiquidityNoise,
  MinWeeklyReturn,
  MaxWeeklyReturn
)
```

ノイズは管理乱数を使う。

## 10. 株式売買

株式売買では以下を同時処理する。

- 買い手現金減少
- 売り手現金増加
- 買い手保有株増加
- 売り手保有株減少
- 取得原価更新
- 実現損益記録
- 手数料と税の記録

会社が新株を発行しない限り、売買代金は会社へ入らない。

## 11. 配当

配当可能額は、現金残高、利益剰余金、債務契約、運転資金、安全余力から算出する。

```text
MaximumDividend
= min(
  DistributableRetainedEarnings,
  Cash - MinimumOperatingCash,
  CovenantAllowedAmount
)
```

配当実行時は以下を処理する。

```text
会社: 現金減少 / 利益剰余金減少
株主: 現金増加 / 配当収入計上
```

無理な配当によって支払不能となる場合は警告または実行禁止とする。

## 12. 増資と希薄化

```text
NewShares = RaisedCapital / IssuePrice
PostMoneyShares = PreMoneyShares + NewShares
ExistingHolderRatioAfter
= ExistingShares / PostMoneyShares
```

増資後、会社現金、資本金・資本剰余金、株主構成、完全希薄化後株式数を更新する。

既存株主に優先引受権がある場合は、行使・不行使を選択できる。

## 13. ストックオプション

ストックオプションは潜在株式として管理する。

- 付与数
- 行使価格
- 権利確定条件
- 退職時処理
- 行使期間
- 完全希薄化後株式数への反映

費用認識を行う場合は人件費または株式報酬費用として会計処理する。

## 14. 自社株買い

会社は余剰資金を使って市場から株式を取得できる。

自社株買い実行時:

- 会社現金減少
- 自己株式増加
- 流通株式数減少
- 1株当たり利益が変化
- 財務安全性が低下する可能性

自己株式を消却する場合は発行済株式数も減少する。

## 15. 株式分割・併合

分割・併合は、株数と株価を逆方向に調整する。

```text
NewShares = OldShares × SplitRatio
NewPrice = OldPrice / SplitRatio
```

時価総額と持株比率は原則として不変とする。

## 16. 上場維持・上場廃止

上場維持条件には以下を含める。

- 最低時価総額
- 流通株式比率
- 株主数
- 財務報告提出
- 債務超過継続期間
- 重大な不正・監査拒否

違反時は警告、監理、売買停止、上場廃止の段階を経る。

## 17. プレイヤー資産との接続

プレイヤーが保有する自社株は個人資産であり、会社資産ではない。

創業者が株式を売却した場合、売却代金は個人現金となる。会社資金として使うには、出資または貸付として別取引を行う。

## 18. テスト要件

- 発行済株式数と株主保有株式数が一致する
- IPO公募資金だけが会社へ入る
- 売出代金が売却株主へ入る
- 増資後の持株比率が正しい
- 配当総額と株主受取総額が一致する
- 株式分割前後で時価総額が保たれる
- 自社株買い後の流通株式数が正しい
- 同一シードで株価系列が再現される
- 1,200週後も株式数に負数・NaN・不整合がない
