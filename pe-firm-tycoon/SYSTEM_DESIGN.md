# System Design — PE Firm Tycoon v6

## Simulation layers

### 1. Market layer
The market state contains base rates, credit spreads, deal heat, public-market multiples and recession risk. Each quarter these variables move deterministically from the seeded RNG. They affect debt pricing, auction multiples and portfolio marks.

### 2. Ecosystem layer
Bankers, lenders, LPs and competing PE firms have persistent relationship / reputation values. Auction outcomes are not based on price alone: price, funding certainty, seller reputation, banker relationship and execution speed all enter seller utility.

### 3. Fund layer
Flagship Funds and Continuation Funds track commitments, calls, cash, NAV, DPI, TVPI, IRR, GP Commit, fees, distributions, NAV loans and term / investment-period status. Management fees are funded by capital calls, creating a J-curve instead of free GP revenue.

### 4. GP management-company layer
GP cash receives management fees, GP distributions and carry, while paying payroll, office overhead, deal costs and fundraising costs. Carry is allocated across partners. Partner morale changes with economics, workload and firm performance.

### 5. Deal layer
Every acquisition has a persistent banker, process source, competitors, auction bids, seller guidance, DD findings, debt financing, capital structure, IC authority, final bid, SPA protection and closing allocation.

### 6. Portfolio layer
Portfolio companies have CEO attributes, management morale, MIP, board agenda, add-on pipeline, integration state, debt, EBITDA, growth, valuation marks and exit options.

## Important trade-offs

- Higher Final Bid → higher seller utility / lower sponsor IRR.
- Higher leverage → lower sponsor equity / higher financing cost and downside risk.
- Aggressive NAV marks → stronger headline TVPI / larger future write-down risk.
- Side letters → stronger fundraising probability / weaker GP fee economics or governance flexibility.
- More Management Incentive → better alignment / lower fund ownership.
- NAV loan → more liquidity / future distributions diverted to debt repayment.
- Carry concentration → stronger Founder economics / higher senior-partner spin-out risk.
- Blocking LP liquidity → preserve fund structure / damage LP relationship.
- Choosing a non-optimal vintage for a deal → solves deployment needs / damages LP fairness reputation.

## Progression

The player begins as a small-buyout GP with Fund I and a boutique team. Track record, relationship capital and AUM unlock additional strategies. Alternative strategy mandates add fee-bearing AUM and change deal sourcing. The end-state is a multi-strategy alternative asset manager competing with other evolving firms rather than a fixed final level.
