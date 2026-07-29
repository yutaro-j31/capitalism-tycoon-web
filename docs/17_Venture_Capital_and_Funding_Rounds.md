# 17. ベンチャーキャピタル・資金調達ラウンド

## 1. 目的

本章は、Seed、Series A、B、C以降の資金調達、企業価値評価、投資家選定、優先株、希薄化、投資家権利、資金使途、次回調達、IPO・M&AによるExitを定義する。

## 2. 基本原則

- 調達は会社資金を増加させる一方、既存株主を希薄化させる。
- バリュエーションは成長性だけでなく、赤字幅、資金余力、実行力、景気、調達環境を反映する。
- 投資家は資金だけでなく、支援能力、要求権利、Exit期間を持つ。
- ラウンド条件は株主構成、取締役会、将来のIPO・M&Aへ継続的に影響する。

## 3. ラウンド区分

| ラウンド | 主目的 | 主な評価軸 |
|---|---|---|
| Pre-Seed | 仮説検証 | 創業者能力、初期アイデア |
| Seed | 初期事業化 | 顧客反応、商品品質、初期売上 |
| Series A | 再現性確立 | 成長率、ユニットエコノミクス |
| Series B | 規模拡大 | 市場占有率、組織能力、粗利益 |
| Series C+ | 全国・海外展開 | FCF見通し、IPO可能性、競争優位 |

## 4. 調達データ

```ts
interface FundingRound {
  id: string;
  companyId: string;
  roundType: string;
  status: 'planned' | 'marketing' | 'termSheet' | 'closed' | 'failed';
  preMoneyValuation: number;
  targetAmount: number;
  raisedAmount: number;
  issuePrice: number;
  newShares: number;
  investors: FundingInvestor[];
  preferredTerms: PreferredTerms;
  useOfFunds: UseOfFundsPlan;
  closedWeek?: number;
}
```

## 5. 企業価値評価

```text
PreMoneyValue
= BaseMetricValue
× GrowthModifier
× UnitEconomicsModifier
× TeamModifier
× MarketModifier
× FundingEnvironmentModifier
- ExecutionRiskDiscount
```

BaseMetricValueは企業段階に応じて切り替える。

- 初期: 売上、顧客数、店舗数、ブランド評価
- 成長期: ARR相当売上、粗利益、成長率、同店売上
- 成熟期: EBITDA、FCF、ROIC

## 6. 投資家タイプ

- エンジェル
- 独立系VC
- 金融系VC
- 事業会社CVC
- 政府系ファンド
- PEファンド
- 戦略投資家

各投資家は以下の特性を持つ。

```text
capitalCapacity
riskTolerance
sectorPreference
supportCapability
boardDemand
ownershipTarget
exitHorizon
reputation
```

## 7. タームシート

主な条件:

- 投資額
- Pre-money / Post-money valuation
- 株式種類
- 清算優先権
- 希薄化防止条項
- 取締役指名権
- 拒否権
- 情報権
- 創業者株式のロックアップ
- Exit期限

条件が厳しいほど調達成功率は上がる場合があるが、経営自由度は低下する。

## 8. 希薄化

```text
PostMoneyValuation = PreMoneyValuation + RaisedAmount
InvestorOwnership = RaisedAmount / PostMoneyValuation
NewShares = RaisedAmount / IssuePrice
```

複数投資家が参加する場合、投資額に比例して株式を配分する。

## 9. 優先株

優先株には以下を設定できる。

- 1倍または複数倍の清算優先
- 参加型 / 非参加型
- 普通株転換
- 配当優先
- 希薄化防止

Exit時の分配は、優先権を先に処理したうえで普通株へ配分する。

## 10. 資金使途

調達資金は用途別予算として追跡する。

- 新規出店
- 採用
- 商品開発
- 広告
- 本社整備
- 海外展開
- M&A
- 運転資金

計画外利用が多い場合、投資家信頼と次回調達条件が悪化する。

## 11. ランウェイ

```text
MonthlyNetBurn = MonthlyCashOutflow - MonthlyCashInflow
RunwayMonths = AvailableCash / max(MonthlyNetBurn, MinimumBurn)
```

ランウェイが短い状態では、低い評価額や厳しい条件を受け入れやすくなる。

## 12. ダウンラウンド

前回より低い評価額で調達する場合:

- 既存株主の希薄化拡大
- 投資家信頼低下
- 従業員士気低下
- 希薄化防止条項発動
- IPO難易度上昇

ただし、倒産回避の合理的選択となることがある。

## 13. VC投資事業

プレイヤーがVCとして投資する場合、投資先ごとに以下を管理する。

- 投資時評価額
- 保有株式
- 優先権
- 追加投資余力
- 支援施策
- 評価損益
- Exit見込み

ポートフォリオ全体ではIRR、回収倍率、失敗率、未実現価値を表示する。

## 14. Exit

Exit方法:

- IPO
- 事業会社への売却
- ファンドへの売却
- 創業者買戻し
- 清算

```text
GrossReturn = ExitProceeds / InvestedCapital
IRR = annualized return based on investment and exit weeks
```

## 15. AI投資家判断

投資家AIは、将来情報を参照せず、現在までに公開または提示された情報だけを使う。

評価項目:

- 成長率
- 粗利益率
- CAC回収期間相当
- 資金消費
- 経営チーム
- 市場規模
- 競合優位
- Exit可能性

## 16. テスト要件

- Pre-money、Post-money、投資家持分が一致する
- 調達額と会社現金増加額が一致する
- 新株発行後の株式数が一致する
- 優先株Exit分配の合計が売却額を超えない
- ダウンラウンド時の希薄化防止計算が正しい
- 同一シードで投資家提案が再現される
- 1,200週後も持株比率合計が100%相当を維持する
