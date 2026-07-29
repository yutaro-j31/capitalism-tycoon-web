# 10 Product, Menu, and Demand System

## 1. Purpose

This document defines how products are created, priced, produced, sold, improved, retired, and evaluated by customers. The system must create meaningful trade-offs between price, quality, cost, complexity, capacity, brand, and market fit.

## 2. Product Identity

Every product must have an immutable stable ID. Product names may change, but historical sales, recipes, reviews, achievements, and accounting records must remain linked to the same ID.

```ts
interface ProductDefinition {
  id: string;
  category: string;
  name: string;
  recipeVersion: number;
  active: boolean;
}
```

## 3. Product Attributes

Minimum supported attributes:

- Base price
- Ingredient cost
- Preparation time
- Complexity
- Quality
- Consistency
- Novelty
- Health perception
- Portion size
- Brand fit
- Target customer segment
- Required equipment
- Required employee skill
- Waste risk
- Delivery suitability

All attributes must have documented ranges and units.

## 4. Menu Composition

A menu is a store-specific selection of active products. The same product may have different availability or price by store only when explicitly supported.

Menu design must affect:

- Customer choice
- Average ticket
- Kitchen congestion
- Inventory breadth
- Waste
- Training burden
- Brand clarity
- Cross-selling

A larger menu must not be strictly superior. Complexity penalties must offset excessive assortment.

## 5. Customer Segments

Demand is generated from segment-level preferences rather than a single universal customer.

Suggested segments:

- Value seekers
- Office workers
- Families
- Enthusiasts
- Tourists
- Health-conscious customers
- Delivery-first customers
- Premium customers

Each segment may have different sensitivity to:

- Price
- Quality
- Waiting time
- Cleanliness
- Novelty
- Brand
- Location
- Promotion

## 6. Product Utility

For each available product and customer segment, calculate bounded utility.

```text
utility =
  qualityWeight × perceivedQuality
+ valueWeight × perceivedValue
+ noveltyWeight × novelty
+ brandWeight × brandFit
+ convenienceWeight × convenience
- waitWeight × expectedWait
- riskWeight × inconsistency
```

Choice probabilities must be deterministic given the same state and seed. The implementation may use a normalized score or bounded softmax, but it must avoid numeric overflow and preserve testability.

## 7. Price and Value

Perceived value is not equivalent to low price.

```text
perceivedValue = perceivedQuality / max(relativePrice, epsilon)
```

Price changes must affect both demand and margin. The UI must display expected direction but must not reveal perfect demand forecasts unless unlocked by research or staff capability.

## 8. Quality Formation

Realized quality is produced from several components:

```text
realizedQuality =
  recipePotential
× ingredientQualityFactor
× employeeSkillFactor
× equipmentFactor
× processDisciplineFactor
× workloadFactor
```

Quality must decline under excessive load, poor staffing, broken equipment, or cost cutting.

## 9. Preparation Time and Congestion

Each sold item consumes preparation capacity. Menu complexity and product mix must influence effective throughput.

```text
kitchenLoad = sum(unitsSoldByProduct × preparationTime)
congestionFactor = function(kitchenLoad / availableKitchenMinutes)
```

When load exceeds capacity, the system must reduce fulfilled orders, increase waiting time, or degrade quality according to documented rules.

## 10. Ingredient Cost

Standard ingredient cost should be derived from recipe quantities and market prices.

```text
standardCost = sum(quantityPerUnit × ingredientMarketPrice)
actualCost = standardCost × purchaseEfficiency × wasteFactor
```

Changes in commodity prices, supplier contracts, or recipe formulation must flow through to gross margin.

## 11. Product Development

New product development may require:

- Research budget
- Development time
- Employee capacity
- Test marketing
- Equipment investment
- Approval decision

Product development outcomes must not rely on uncontrolled randomness. Results should be reproducible using stored seeds and state.

## 12. Product Lifecycle

Suggested lifecycle stages:

```ts
type ProductLifecycle =
  | 'concept'
  | 'development'
  | 'test_market'
  | 'launch'
  | 'growth'
  | 'mature'
  | 'decline'
  | 'retired';
```

Lifecycle affects novelty, awareness, forecast confidence, and cannibalization.

## 13. Cannibalization

A new product may shift sales from existing products. Incremental demand must be distinguished from transferred demand.

```text
incrementalCustomers = totalCustomersAfterLaunch - baselineCustomers
cannibalizedUnits = newProductUnits - incrementalUnitsAttributedToNewDemand
```

The game must not treat all new-product revenue as incremental economic value.

## 14. Promotions and Discounts

Promotions must specify:

- Target product or menu
- Discount type
- Duration
- Eligible channels
- Budget
- Customer segment
- Expected operational impact

Discounts reduce net sales and may increase congestion, waste, and acquisition of low-loyalty customers.

## 15. Product KPIs

Required metrics:

- Units sold
- Gross sales
- Net sales
- Average realized price
- Ingredient cost
- Gross profit
- Gross margin
- Preparation minutes consumed
- Waste
- Refunds
- Customer rating
- Repeat purchase rate
- Cannibalization estimate
- Store coverage

## 16. Menu Optimization and Delegation

Automated menu management may recommend or execute:

- Price changes
- Product retirement
- Promotion
- Recipe cost reduction
- Store rollout
- Capacity adjustment

Every automated action must retain an explanation and respect player-defined limits.

## 17. Guardrails

- Product price must not be negative
- Recipe quantities must not be negative
- Products requiring unavailable equipment cannot be sold
- Retired products cannot generate ordinary new sales
- Product sales cannot exceed store/channel capacity
- Cost reduction cannot improve quality unless explicitly caused by process innovation
- Discounts must be reflected in net sales and cash

## 18. Required Tests

- Identical state and seed produce identical product mix
- Raising price reduces or preserves demand under ordinary positive elasticity
- Margin calculations reconcile to accounting entries
- Menu complexity creates measurable operating impact
- Product retirement preserves historical results
- Commodity price shocks flow through recipe costs
- Promotions never create unrecorded revenue or expense
- Demand allocation sums to realized customers

## 19. Open Implementation Questions

- Existing product and recipe schema
- Current support for segment-level demand
- Current use of preparation capacity
- Whether product R&D is already implemented
- Existing promotion and discount structures
- Current historical product analytics
