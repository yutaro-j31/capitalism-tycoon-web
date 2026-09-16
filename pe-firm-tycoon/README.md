# PE Firm Tycoon — Private Capital Industry Simulator v6

スマートフォン優先の1ファイル・ブラウザゲーム。PEファームのGP会社、ファンド、案件、LP、Portfolio、競合市場を同時に経営するシミュレーターです。

## Core loop

1. Investment Thesisを研究し、BankerとのRelationshipを構築
2. Teaser → NDA → CIM → 1st Bid → DD → Debt → Capital Structure → IC → Final Bid → SPA → Closing
3. Fund I / II / IIIのどこに案件をAllocationするか決定
4. PortfolioのBoard、CEO、MIP、Buy & Build、Value Creationを運営
5. Trade Sale / Secondary / IPO / Continuation FundでExit
6. DPI / TVPI / IRR / Carryを形成
7. Pre-Marketing → DDQ → Anchor LP → First Close → Final Closeで次号Fundをraise
8. GP会社を採用・Carry配分・Partner retentionで拡大
9. StrategyをSmall BuyoutからCredit / Secondaries / Real Estateまで拡張

## 22 integrated systems

1. Living Private Capital Ecosystem — 競合PEがAUM・評判・価格規律を持ち独立して動く
2. Relationship Network — Banker / Lender / LPとの関係値が案件・Debt・Fundraisingへ影響
3. Institutional Fundraising — Pre-Marketing / DDQ / Anchor / First Close / Final Close、Side Letter
4. GP Economics — Management Fee、Carry、給与、オフィス、Fundraising費、Deal Cost、Partner Carry
5. Partner Politics — IC vote、Morale、Carry再配分、Retention、Spin-out
6. Investment Thesis — Sector Knowledge / Conviction / Research / Active Thesis
7. Buy & Build — Add-on sourcing、買収、Integration Risk、Synergy
8. Portfolio Board Simulation — 四半期Board agendaと意思決定
9. Management Incentive Program — MIP拡張とManagement alignment / dilution
10. CEO Market — Growth / Cost / M&A / Turnaround / IPO能力を持つCEO候補
11. Dynamic Debt Market — Base Rate / Credit Spread / lender relationshipを反映したDebt quote
12. Capital Structure Engineering — Conservative / Base / Max Senior / Seller Note + Mezz
13. LPAC — Continuation / Fund Extensionの利益相反審査、Fairness Opinion
14. Cross-Fund Allocation Conflict — Fund I / II / III間の案件配分とLP fairness
15. Valuation Committee — Conservative / Fair / Aggressive NAV marks、Exit write-down risk
16. J-Curve — Management Fee capital call、Fund cashflow、初期TVPI/IRR悪化
17. Secondary Market — LP liquidity request、transfer facilitate / block
18. NAV Financing — Fund-level NAV facility、interest、Exit proceedsから返済
19. Multi-dimensional Reputation — Seller / Banker / LP / Lender / Management
20. PE League Table — Playerと競合PEのAUM / performance / reputation比較
21. Partner Spin-out — 低Morale Partnerが独立し、その後ゲーム内競合になる
22. Strategy Evolution — Small Buyout → Mid-Market → Growth → Infrastructure → Credit → Secondaries → Real Estate

## Technical notes

- Single-file HTML/CSS/vanilla JavaScript source packaged for static hosting
- No external libraries
- Deterministic seeded RNG; no Math.random / Date.now / crypto.randomUUID
- localStorage save with in-memory fallback
- Save migration tested from legacy v1 / v2 / v5 shapes
- iPhone-first responsive UI
- Existing save key retained: `pe_firm_tycoon_v1`
