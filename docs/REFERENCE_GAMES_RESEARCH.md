# Wall Street Raider 動画調査まとめ — Capitalism Tycoonへの応用・システム分析

> **この文書の位置づけ**
>
> - 2026-09 にオーナーが作成した参照作品の調査まとめを、長期構想の資料として登録したものです。**実装仕様ではありません。**
> - この調査を受けて行った実装可否監査と、確定したオーナー判断は `docs/CAPITAL_ALLOCATION_VISION.md` にあります。
> - **採用しなかった箇所**: §3 の所有の閾値（5 / 20 / 33 / 51 / 80%）は採用していません。日本の会社法の閾値に基づく Control Ladder を採用しました（`docs/CAPITAL_ALLOCATION_VISION.md` 第1部 A-5）。
> - 本文は受領時の内容のままです。変えたのは Markdown の見出し・箇条書き・コードブロックへの整形だけです。

## 監査との対応（§46 の20項目）

§46 で「監査へ追加すべき」とされた20項目が、`docs/CAPITAL_ALLOCATION_VISION.md` 第2部（監査報告）でどこまで扱われているかをまとめます。

「浅い」「未検討」の項目は、該当する Phase に着手する前に検討します（同文書 第1部 B-4）。

| # | 項目 | 監査での扱い | 該当箇所 |
|---|---|---|---|
| 1 | Industry Supply / Demand | 浅い（ramen の需給は詳細。業界単位の供給能力モデルは未設計） | §15.3 |
| 2 | ROIC vs Cost of Capital | 未検討（Deal Book の比較軸に含めていない） | — |
| 3 | Deployable Capital | 未検討（既存の `shareholderReturnCapacity()` の安全額が近い概念） | — |
| 4 | Group Treasury | 浅い（資金プールの図のみ。既存の `group-capital-allocation-*` との接続は未設計） | §10 |
| 5 | Consolidated Accounting | 扱いあり | §4 #66–67、§10 |
| 6 | Legal Entity Risk Compartmentalization | 未検討 | — |
| 7 | Market Liquidity | 扱いあり | §4 #2–6 |
| 8 | Counterparty Capacity | 未検討 | — |
| 9 | AI Capital Allocation | 扱いあり | §15.2 |
| 10 | Automation Policy | 扱いあり | §14 |
| 11 | Opportunity Screener | 扱いあり | §4 #23 |
| 12 | Post-M&A Value Creation | 浅い（PMI は既存。一般 M&A の買収後選択肢は未設計） | §4 #51、#58 |
| 13 | Bank Balance Sheet | 浅い（金融子会社を簡易案として扱うのみ） | §4 #85–88 |
| 14 | Macro → Corporate linkage | 扱いあり | §15.1 |
| 15 | Capital Allocation Dashboard | 扱いあり（Deal Book） | §12 |
| 16 | Ownership / Control separation | 扱いあり | §11.2 |
| 17 | Corporate Actions | 扱いあり | §4.1 |
| 18 | Debt / Interest Rate interaction | 扱いあり | §4 #74、#76 |
| 19 | Commodity / input-cost linkage | 扱いあり（原材料価格指数として） | §4 #83 |
| 20 | Delegation hierarchy | 扱いあり | §14 |

**判断が分かれている点**: §26 はデリバティブを「リスク管理（ヘッジ）」として使うことを提案しています。一方、監査 §8 はオプション・先物を「実装しない（F）」としました。ヘッジ用途に限った導入を行うかどうかは未決です。

---

## 調査対象

- Wall Street Raider 現行Steam版 Gameplay
- Wall Street Raider 現行版 First Look
- Steam公式が紹介している現行Walkthrough
- TrimBarktree Builds a Financial Empire Part 1 / Part 2
- 旧版 Getting Started / Tutorial
- Let’s Play Wall Street Raider Ep1〜Ep4
- 公式サイト掲載機能
- Steamコミュニティでの現行プレイヤー評価・要望

今回の目的は、Wall Street Raider（以下WSR）のUIを模倣することではなく、

**WSRがなぜCapital Allocationゲームとして成立しているのか**

を理解し、Capitalism Tycoonへ応用できる要素を抽出すること。

---

## 1. WSRの本質

WSRは単なる株式投資ゲームではない。

本質は、

**Capital AllocationそのものをGameplayにしたゲーム**

である。

基本ループは以下。

```
Cash
↓
Investment Opportunityを探す
↓
企業・資産を分析
↓
Capitalを投入
↓
Ownership / Controlを取得
↓
経営・財務政策を変更
↓
利益・企業価値を改善
↓
Capitalを回収
↓
次のOpportunityへ再配分
```

つまり、

「会社を経営して利益を増やす」

よりも、

「限られたCapitalを現在どこへ配分するのが最適か」

という判断がゲームの中心。

---

## 2. Opportunity Search / Screener

WSRでは投資対象を単純な一覧から選ぶのではない。

企業DBやScreenerを使い、

- Stock Price
- Book Value
- Net Worth
- Earnings
- Debt
- ROA
- Growth
- Industry
- Supply / Demand
- Valuation

などを確認して投資候補を探す。

重要なのは、

「案件を探す行為そのもの」がGameplayになっていること。

Capitalism Tycoonでは、

**Opportunity Screener**

として導入可能。

例：

- EV / EBITDA
- PER
- PBR
- ROIC
- Revenue Growth
- EBITDA Margin
- Debt / EBITDA
- Market Share
- Industry Growth
- Distress Level
- Strategic Fit
- Synergy Potential
- Ownership Structure
- Acquisition Difficulty

などでフィルタできるようにする。

---

## 3. Stock InvestmentとM&Aが同じシステム

WSRでは、

- Stock Investment
- M&A
- Corporate Control

が別々のゲームシステムではない。

```
株式取得
↓
Ownership %
↓
Influence
↓
Control
↓
Corporate Actions
```

という連続した仕組み。

Capitalism Tycoonでも、

| 保有比率 | 位置づけ |
|---|---|
| 5% | Financial Investment |
| 20% | Strategic Stake |
| 33% | Significant Influence |
| 51% | Control |
| 80〜100% | Subsidiary / Consolidation |

のようなOwnershipベースのシステムが望ましい。

> 登録時注記: この閾値は採用せず、日本の会社法の閾値に基づく Control Ladder を採用した（`docs/CAPITAL_ALLOCATION_VISION.md` 第1部 A-5）。「株式市場とM&Aを別モードにしない」という原則は採用している。

重要：

**株式市場とM&Aを別モードにしない。**

---

## 4. OwnershipとControl

WSRでは「株を持っていること」と「会社を支配していること」が重要。

Capitalism Tycoonでも、

**Ownership %** と **Control** を別概念として扱う価値がある。

例：

```
Player
↓ 70%
Holding Company
↓ 60%
Subsidiary A
↓ 35%
Company B
```

などの多層Ownershipを表現する。

```
PE Fund
↓
Portfolio Company

VC Fund
↓
Startup
```

も同じOwnership Engineで扱える。

---

## 5. M&A後から本当のゲームが始まる

WSRでは企業を買収して終わりではない。

買収後に、

- Management Change
- CEO Replacement
- Restructuring
- Growth変更
- Debt Reduction
- Asset Sale
- R&D変更
- Marketing変更
- Dividend
- Buyback
- Merger

などを行う。

つまり、

```
Acquire
↓
Value Creation
↓
Exit / Hold
```

という構造。

Capitalism TycoonのM&AやPEでも、

単なる

「買収 → 利益+○%」

ではなく、

**Post-M&A Value Creation**

を重要なGameplayにするべき。

---

## 6. Organic GrowthもCapital Allocation

WSRではOrganic Growthも単なるアップグレードではない。

企業には、

- Growth Rate
- Marketing
- R&D
- Productivity
- Assets
- Management Quality
- Industry Demand
- Industry Supply

などが存在する。

例えば、

```
Industry Supplyが多すぎる
↓
Growthを上げる
↓
さらに供給過剰
↓
Margin悪化
```

となる可能性がある。

逆に需要超過なら、

CapEx / Growth

が有利。

したがって、

**GrowthそのものがCapital Allocation判断になる。**

---

## 7. Growth vs Debt Repayment

WSRで非常に重要な判断。

余剰Cashを、

- Growthへ使うか
- Debt Repaymentへ使うか

を比較する。

基本的には、

**ROIC vs Cost of Debt / WACC**

が重要になる。

例：

- ROIC 15%
- Debt Interest 6%

なら、

借入を維持しながらGrowthへCapitalを投入する合理性がある。

逆に、

- Debt Interest 12%
- ROIC 8%

なら、

Debt Repaymentが合理的。

Capitalism Tycoonでも、

**ROIC vs Cost of Capital**

を重要な判断軸にする。

---

## 8. Opportunity Cost

WSRの根本。

会社に100億円Cashがある場合、

- New Stores
- New Factory
- Marketing
- R&D
- Hiring
- M&A
- Stocks
- PE
- VC
- Real Estate
- Buyback
- Dividend
- Debt Repayment

が、

**同じ100億円を奪い合う。**

これがCapital Allocationゲームになる理由。

Capitalism Tycoonでも、

- 店舗専用ポイント
- M&A専用ポイント
- PE専用ポイント

などに分けず、

できる限り

**同じCorporate Cash**

からCapitalを配分する。

---

## 9. Cash ≠ Deployable Capital

WSRでは手元Cashがすべて自由に使えるわけではない。

例えば、

- Tax Liability
- Debt Maturity
- Required Liquidity
- Existing Commitments

などがある。

Capitalism Tycoonでは、

```
Cash
− Tax Payable
− Debt Maturity
− Minimum Liquidity
− Committed CapEx
− PE / VC Commitments
= Deployable Capital
```

と表示するとよい。

これはCapital Allocation Dashboardの重要指標になる。

---

## 10. Debtは資金不足用ではなく戦略

WSRではDebtは、

「お金が足りない時に借りる」

だけではない。

Leverageを使うことで、

Equity Returnを高めるためのCapital Allocation Tool。

重要指標：

- Interest Rate
- Debt / EBITDA
- Interest Coverage
- ROIC
- WACC
- Credit Rating
- Liquidity

Capitalism Tycoonでも、

Debtを

**Capital Structure**

として扱う。

---

## 11. Interest Rateがゲーム全体を動かす

WSRではInterest Rateが多くのシステムへ影響する。

```
Interest Rate
↓
Corporate Debt Cost
↓
Growth Investment
↓
Company Earnings
↓
Stock Valuation
```

さらに、

```
Interest Rate
↓
Real Estate Cap Rate
↓
Property Value

Interest Rate
↓
LBO Financing
↓
M&A Valuation
```

などに波及。

Capitalism Tycoonでも、

**Macro → Corporate Finance → Investment Decision**

を接続する価値が高い。

---

## 12. Bank Ownership

WSRではBankそのものを所有可能。

Bank Assets例：

- Cash
- Corporate Loans
- Consumer Loans
- Credit Card Loans
- Mortgages
- Subprime Mortgages
- Securities

Liabilities：

- Deposits
- Wholesale Funding

Equity：

- Bank Capital

さらに、

- Capital Reserve
- Asset Allocation

も管理。

Capitalism Tycoon終盤の

**Financial Empire**

として非常に相性が良い。

---

## 13. Bankを競争戦略にも利用できる

動画で特に面白い要素。

自分の銀行が、

競合会社へLoanを出している場合、

Credit Lineを止めることで、

競合Expansionを制限できる。

つまり、

```
Bank
↓
Credit
↓
Competitor Expansion
↓
Industry Supply
↓
Market Share
↓
Player Profit
```

までつながる。

これは、

**システム間相互作用**

という意味で非常に参考になる。

---

## 14. Industry Supply / Demand

WSRにはIndustry単位の、

- Supply
- Demand

が存在する。

AI企業が過剰投資すれば、

```
Supply Excess
↓
Price Competition
↓
Margin低下
```

になる。

逆にSupply不足なら、

Pricing Powerが上がる。

Capitalism Tycoonでは、

**Industry Demand ÷ Industry Capacity**

から、

- Selling Price
- Customer Demand
- Margin
- Capacity Utilization
- Store Sales
- Market Share

などを変動させられる。

これは業界サイクルを作る重要システム。

---

## 15. AI CompetitorsもCapital Allocator

WSRの競合企業は、

単なる固定ステータスではない。

AIも、

- Borrow
- Expand
- Invest
- Reduce Debt
- Acquire
- Sell
- Grow
- Compete

などのCapital Allocationを行う。

Capitalism Tycoonでも、

AI企業を

**Capital Allocation Agent**

として設計するとよい。

AIにも可能な範囲で、

**Playerと同じEconomic Rules**

を適用する。

---

## 16. Management変更

WSRでは、

**Management Quality**

が企業Performanceへ影響する。

業績が悪い企業について、

- CEO Change
- Management Change
- Restructuring

などができる。

Capitalism Tycoonでは、

Management Team

をCapital Allocation能力へ接続できる。

例：

| 役職 | 効果 |
|---|---|
| Strong COO | Operations効率 |
| Strong CFO | Lower financing cost / Better treasury |
| Strong CEO | Better strategic allocation |
| Strong CIO | Better investment selection |

---

## 17. Autopilot / Delegation

WSRにはAutopilotがある。

会社数が増えた場合、

すべてをPlayerが手動管理しない。

これはBig AmbitionsのManagement Delegationと非常に相性がよい。

理想：

```
Store Manager
↓
店舗業務

Area Manager
↓
複数店舗

COO
↓
Operations

CFO
↓
Debt / Treasury / Capital Structure

CIO
↓
Investments

CEO
↓
Subsidiary Strategy

Player
↓
Group Capital Allocation
```

という階層。

重要：

Managerを単なるBuffにしない。

**Playerがしていた操作をManagerへ委任するAutomation Layer**

として扱う。

---

## 18. Automation Policy

WSRのAutopilotには、

意図しない行動を取る問題もある。

Capitalism Tycoonでは完全自動ではなく、

Policy型が望ましい。

例：

- Pricing
  - Aggressive
  - Balanced
  - Premium
- CapEx
  - Growth
  - Maintain
  - Freeze
- Debt
  - Conservative
  - Balanced
  - Leveraged
- M&A
  - Disabled
  - Recommend Only
  - Autonomous
- Legal
  - Manual Approval Required

これならPlayer Controlを失いにくい。

---

## 19. Consolidated Accounting

WSRでは複数企業を支配できる。

Capitalism Tycoonでも、

- Standalone
- Consolidated

を分ける価値がある。

```
Holding Company
├── Ramen Co
├── Logistics Co
├── Real Estate Co
└── Tech Co
```

それぞれ、

- Standalone P&L
- Standalone BS

を持ち、

Holding側で、

- Consolidated P&L
- Consolidated BS

を確認できるようにする。

---

## 20. Group Treasury

WSR現行プレイヤーからも、

親会社・子会社間のCash管理が分かりづらいという課題がある。

Capitalism Tycoonでは、

**Group Treasury Dashboard**

を最初から用意するとよい。

例：

| Entity | Cash | Debt | Available Capital |
|---|---|---|---|
| Holding | | | |
| Ramen Co | | | |
| Logistics Co | | | |
| Tech Co | | | |
| PE Fund I | | | |

などを一覧表示。

操作：

- Dividend
- Capital Contribution
- Intercompany Loan
- Debt Repayment
- Cash Sweep

この仕組みは企業帝国感を大きく高める。

---

## 21. Legal Entity = Risk Container

WSR動画では、

高Riskの取引をPlayer本人ではなく、

所有Bankなどの子会社に行わせる場面がある。

失敗した場合の損失を、

そのLegal Entity内へ限定できる。

Capitalism Tycoonでも、

- Holding Company
- Subsidiary
- SPV
- PE Fund
- Bank
- Project Company

などを、

**Risk Container**

として扱える。

Limited Liabilityの概念をGame Systemへ使える。

---

## 22. Tax

WSRではTaxもCapital Allocationに影響する。

Cashが多く見えても、

Tax Liabilityが存在すれば、

本当に使えるCapitalは少ない。

Capitalism Tycoonでは、

- Corporate Tax
- Personal Tax
- Capital Gains
- Dividend Tax
- Fund Tax

などを、

ゲームを複雑にしすぎない範囲で接続可能。

重要なのは、

Tax自体の細かさではなく、

**Capital Allocationへ影響すること。**

---

## 23. Corporate Actions

WSRには多くのCorporate Actionsが存在する。

候補：

- Regular Dividend
- Special Dividend
- Share Buyback
- Stock Split
- Bond Issue
- Bond Call
- Refinancing
- Equity Offering
- IPO
- Spin-off
- Asset Sale
- Liquidation
- Merger

Capitalism Tycoonでも、

企業価値・Ownership・Cash Flowへ接続すれば、

非常に有効。

---

## 24. M&A Exit / Integration Strategy

買収後の選択肢を増やす。

```
Acquire
↓
選択：
```

- Keep Independent
- Merge
- Subsidiary
- Restructure
- Sell Assets
- Spin-off
- Re-IPO
- Strategic Sale
- Secondary Buyout
- Liquidate

これをPEモードだけでなく、

一般M&Aにも利用可能。

---

## 25. VC / Startup

WSRには、

```
Private CompanyへのCapital Contribution
↓
Growth
↓
IPO
```

という流れがある。

Capitalism Tycoonでも、

```
VC
↓
Startup
↓
Growth
↓
Follow-on Funding
↓
IPO / M&A Exit
```

を、

Ownership Engineと同じ仕組みで扱える。

---

## 26. Derivatives

WSRには、

- Options
- Futures
- Commodity Futures
- Crypto Futures
- Interest Rate Swaps

などが存在。

ただしCapitalism Tycoonでは、

金融商品そのものを全部コピーする必要はない。

重要なのは、

**Risk Management**

として企業経営へ接続すること。

例：

```
Floating Debt
↓
Interest Rate Swap
↓
Fixed Rate化

Oil Exposure
↓
Commodity Hedge

Foreign Revenue
↓
FX Hedge
```

のようにする。

---

## 27. Commodity Markets

Commodity価格をBusiness Operationsへ接続するとよい。

例：

```
Oil ↑
↓
Transport Cost ↑
↓
Restaurant Logistics Cost ↑
↓
Margin ↓

Wheat ↑
↓
Food Cost ↑

Electricity ↑
↓
Factory Cost ↑

Semiconductor ↑
↓
Electronics production cost ↑
```

これにより、

- Market / Economy
- Store Operations

が同じ世界でつながる。

---

## 28. Market Liquidity / Counterparty

WSRの高レバレッジ取引では、

現実的には取引相手が存在しない規模までPositionを作れる問題がある。

Capitalism Tycoonでは、

- Market Liquidity
- Counterparty Capacity
- Order Book
- Bid
- Ask
- Spread
- Partial Fill
- Position Limit

を入れる価値がある。

ここはGlobal Business TycoonのMarket UIとも相性が良い。

---

## 29. Advanced Financial Risk Controls

極端な必勝パターンを防ぐため、

以下を検討。

- Margin Requirement
- Concentration Limit
- Counterparty Limit
- Liquidity Risk
- Capital Requirement
- Credit Rating
- Haircut
- Stress Test

特にBankやDerivativesで重要。

---

## 30. WSRでコピーしない方が良い部分

WSRの最大の弱点はUI/UX。

情報量が多く、

Desktop Terminalとしては成立するが、

iPhoneにはそのまま移植できない。

コピーしない：

- 過剰な同時表示
- 小さい文字
- 多数のWindow
- 深すぎるMenu
- 同じ操作の反復
- 手入力の多さ
- 発見しづらい機能
- 手動計算が必要なUI

---

## 31. 反復操作は削除

旧版動画では、

同種のInterest Rate Swapを数百件作成するなど、

Gameplay Depthではなく、

単なる操作回数になっている部分がある。

Capitalism Tycoonでは、

例：

- Target Exposure
- Duration
- Max Risk
- Counterparty Quality

を設定し、

**Create Hedge Portfolio**

のように一括処理する。

原則：

**Decision Depthは残す。Click数は減らす。**

---

## 32. WSRのLeverage問題

WSRでは、

- Bank
- Futures
- Swaps
- Options

などで、

極端なLeverage戦略が非常に強くなるケースがある。

Capitalism Tycoonでは、

Leverage自体は残すが、

- Margin
- Liquidity
- Credit
- Capital Requirement
- Market Impact
- Counterparty Risk

で制約する。

---

## 33. WSR最大の弱点：Progression

WSRは最初から大きなCapitalを持って開始するため、

「ゼロから資本家になる過程」

が弱い。

この部分はBig Ambitionsを参考にする。

理想Progression：

```
Founder
↓
Store Owner
↓
Multi-store Operator
↓
CEO
↓
Conglomerate Owner
↓
Capital Allocator
↓
Financial Empire
```

---

## 34. Big Ambitionsとの統合

Big Ambitionsから採用する要素：

- Founder Experience
- Store Operations
- Employees
- Scheduling
- Logistics
- Warehouses
- Factory
- HQ
- Management Delegation
- Physical World
- Rival Companies
- Progression

重要なのは、

**Playerの仕事が変わること。**

序盤：

- 価格設定
- 在庫
- 採用
- 店舗運営

中盤：

- Managers
- Warehouse
- HQ
- Expansion

後半：

- Capital Allocation
- M&A
- Portfolio
- Debt
- Investments

---

## 35. Global Business Tycoonとの統合

GBTから採用する要素：

- Modern Dashboard
- Portfolio UI
- Multi-industry Management
- Card UI
- Business Unit comparison
- Mobile-compatible Information Architecture
- Stock Market presentation
- Real Estate cards

つまり、

**WSRのSimulationを、GBTのような分かりやすいUIで操作する。**

---

## 36. 理想的な役割分担

### Wall Street Raider

担当：**Economic / Capital Allocation Engine**

- Accounting
- Ownership
- Capital
- Debt
- Markets
- M&A
- Banking
- Tax
- Risk
- Corporate Actions

### Big Ambitions

担当：**Progression / Operations**

- Founder
- Store
- Employees
- Logistics
- Factory
- HQ
- Delegation
- Physical presence

### Global Business Tycoon

担当：**Information Architecture / UX**

- Dashboard
- Portfolio
- Cards
- Drill-down
- Multi-business navigation
- Mobile-first presentation

---

## 37. Mobile UIの基本方針

WSRのTerminal UIをそのまま使わない。

**Entity中心にする。**

Company Detail例：

上部：

- Company Name
- Share Price
- Ownership %
- Enterprise Value
- Cash
- Debt

Tabs：

- Overview
- Operations
- Financials
- Ownership
- Capital
- Deals

主要Action：

**Allocate Capital**

そこから、

- Invest
- Expand
- Acquire
- Repay Debt
- Buyback
- Dividend
- R&D
- CapEx

へ遷移。

---

## 38. Capital Allocation画面

ゲームの中心画面として検討する。

例：

**Deployable Capital ¥82.4B**

Opportunities：

| 案件 | Capital Required | Return | Risk | Duration |
|---|---|---|---|---|
| Existing Stores | ¥4B | Expected Return 17% | Low | 2 Years |
| New Factory | ¥15B | Expected Return 21% | Medium | |
| Acquire Company A | ¥24B | Expected IRR 26% | High | |
| Debt Repayment | ¥10B | Return 8.2% equivalent | Very Low | |
| Buyback | ¥20B | Implied Return 13% | | |
| PE Deal | ¥8B | Expected IRR 24% | | |
| Real Estate | ¥12B | Expected Return 9% | | |

Playerは、

**同じCapitalをどこへ配分するか**

判断する。

---

## 39. Capital Allocationで比較する要素

IRRだけで決められないようにする。

比較：

- Expected Return
- Risk
- Duration
- Liquidity
- Leverage
- Strategic Fit
- Synergy
- Market Cycle
- Interest Rate
- Management Capacity
- Regulatory Risk
- Opportunity Cost
- Capital Requirement

これにより、

「IRRが一番高い案件を押すだけ」

になるのを防ぐ。

---

## 40. Ownership Graph

スマホでも、

Ownership Graphは非常に有効。

例：

```
Player
↓73%
Holding Company
├─100% Ramen Co
├─82% Logistics Co
├─65% Tech Co
└─20% Public Company A

PE Fund I
├─80% Target A
└─55% Target B
```

Entityをタップすると、

Company Detailへ遷移。

---

## 41. 最優先で採用価値が高いWSR要素

### S Priority

- Unified Capital Allocation
- Ownership / Control
- Group Treasury
- ROIC vs Cost of Capital
- Industry Supply / Demand
- Debt / Interest Rate
- AI Capital Allocation
- Delegation / Automation Policy

### High Priority

- Opportunity Screener
- Post-M&A Value Creation
- Consolidated Accounting
- Bank Balance Sheet
- Corporate Actions
- Legal Entity Risk Separation
- Macro → Corporate linkage
- Market Liquidity
- Counterparty limits

### Medium Priority

- Commodity Futures
- Hedging
- Interest Rate Swaps
- Advanced Options
- Litigation
- Regulatory systems

### Low Priority / Later

- Extremely niche corporate warfare
- Excessively detailed derivatives
- Greenmail等
- High-frequency trading的な操作

---

## 42. 最重要設計原則

Wall Street Raiderから学ぶべき最大のポイントは、

機能数ではない。

以下である。

**すべてのシステムを同じCapital・Cash Flow・Ownership・Balance Sheetの上で動かす。**

```
店舗利益
↓
Corporate Cash

Corporate Cash
↓
選択：
```

- Store Expansion
- Factory
- Marketing
- R&D
- Debt Repayment
- Buyback
- Dividend
- M&A
- Stocks
- PE
- VC
- Real Estate

という構造。

---

## 43. One Economic Reality

Capitalism Tycoonでは、

各機能を別ミニゲームにしない。

- Store
- Stocks
- M&A
- PE
- VC
- Real Estate
- Bank

などすべてが、

同じEconomic Reality上で動く。

重要基盤：

- Accounting
- Cash Flow
- Ownership
- Debt
- Valuation
- Tax
- Interest Rates
- Industry Supply / Demand
- Market Liquidity

---

## 44. Capitalism Tycoonの最終構造

```
Big Ambitions
= How you become a capitalist

↓

Global Business Tycoon
= How you interact with your empire

↓

Wall Street Raider
= How the economic world actually works
```

という構造が最も適している。

---

## 45. 最終ビジョン

Big Ambitionsの、

**ゼロから会社を育てる体験**

×

Global Business Tycoonの、

**CEOとして企業帝国全体を見渡せる現代的UI**

×

Wall Street Raiderの、

**Capital Allocationを中心に、企業・金融・市場・銀行・M&A・負債がすべて接続されたEconomic Simulation**

を組み合わせる。

重要なのは、

3作品の機能を単純に全部追加することではない。

- WSRを **Economic Core**
- Big Ambitionsを **Progression / Operations Layer**
- GBTを **Mobile UX Layer**

として役割分担させる。

---

## 46. Claude / Claude Code監査へ追加すべき重要項目

今回の動画調査を踏まえ、実装可否監査には必ず以下を追加する。

1. Industry Supply / Demand
2. ROIC vs Cost of Capital
3. Deployable Capital
4. Group Treasury
5. Consolidated Accounting
6. Legal Entity Risk Compartmentalization
7. Market Liquidity
8. Counterparty Capacity
9. AI Capital Allocation
10. Automation Policy
11. Opportunity Screener
12. Post-M&A Value Creation
13. Bank Balance Sheet
14. Macro → Corporate linkage
15. Capital Allocation Dashboard
16. Ownership / Control separation
17. Corporate Actions
18. Debt / Interest Rate interaction
19. Commodity / input-cost linkage
20. Delegation hierarchy

これらが現在のArchitectureで実現可能か確認する。

> 登録時注記: 各項目の監査での扱いは、この文書冒頭の「監査との対応」表を参照。

---

## 47. Claude Codeに最終的に検討させる問い

以下を必ず回答させる。

- WSR型Capital Allocationを現在のゲームのCore Loopへできるか
- 現在のAccounting Architectureで成立するか
- Ownership Engineを統一する必要があるか
- Company / Subsidiary / Fund / Bank / Storeをどう接続するか
- Group Treasuryをどう実装するか
- Consolidated Accountingは可能か
- ROIC / WACCをどう算出するか
- Industry Supply / Demandをどうモデル化するか
- AI企業にも同じCapital Allocationをさせられるか
- 100社・1000店舗をiPhoneで扱えるか
- Manager / CXOへ何を委任するか
- 市場流動性・Counterpartyをどこまで実装するか
- Bankを追加してもSimulation Performanceを維持できるか
- Save Compatibilityを維持できるか
- 既存Architectureのどこが最大のBottleneckか
- 実装前に直すべきTechnical Debtは何か

---

## 最終結論

WSRから参考にすべきものは、

「株・オプション・銀行などの機能が多いこと」

ではない。

本質は、

**会社経営、株式投資、M&A、銀行、負債、税金、市場、競争、マクロ経済をすべて『限られたCapitalをどこへ配分するか』という一つの問題に統合していること。**

Capitalism Tycoonも、

店舗経営ゲームに投資機能を追加するのではなく、

最終的には

**すべての経営行動をCapital Allocation Decisionへ統合する**

方向が最も有力。

理想形：

```
Founder
↓
Operator
↓
CEO
↓
Conglomerate Owner
↓
Capital Allocator
↓
Financial Empire
```

そしてゲームが成長するほど、

Playerが操作する項目数が増えるのではなく、

**Playerの意思決定レイヤーそのものが上がっていく。**

これをCapitalism Tycoon全体の中核設計原則とする。
