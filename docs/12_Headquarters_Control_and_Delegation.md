# 12 Headquarters Control and Delegation

## 1. Purpose

This document defines how headquarters converts people, systems, policies, data, and governance into scalable control. Headquarters must enable growth without making expansion automatic or eliminating operational risk.

## 2. Headquarters Functions

Headquarters provides:

- Consolidated reporting
- Budgeting and forecasting
- Hiring and organizational design
- Procurement and supplier management
- Product and brand governance
- Capital allocation
- Risk management
- Legal and compliance support
- Technology and data systems
- Internal audit
- Strategic planning

Each function must have explicit inputs, outputs, costs, capacity, and measurable effects.

## 3. Headquarters Levels

Headquarters maturity may be represented through capability levels rather than a single building upgrade.

```ts
interface HeadquartersCapability {
  functionId: string;
  level: number;
  capacity: number;
  quality: number;
  automation: number;
  fixedCost: number;
}
```

Capability growth should require employees, systems, investment, and time.

## 4. Policies

Policies are persistent rules applied across a defined scope.

Examples:

- Pricing bands
- Food-cost targets
- Minimum cash buffers
- Hiring standards
- Capital expenditure limits
- Debt limits
- Dividend policy
- Store closure review criteria
- Supplier concentration limits
- Approval thresholds

```ts
interface CompanyPolicy {
  id: string;
  domain: string;
  scopeIds: string[];
  parameters: Record<string, number | string | boolean>;
  effectiveWeek: number;
  approvedByRoleId: string;
}
```

Policy changes must be versioned and recorded.

## 5. Budgeting

Budgets should cover at minimum:

- Revenue
- Cost of sales
- Payroll
- Rent
- Marketing
- Capital expenditure
- Research and development
- Financing
- Tax
- Cash balance

Budget variance must be calculated from actual results, not overwritten by later forecasts.

```text
variance = actual - budget
variancePercent = variance / max(abs(budget), epsilon)
```

## 6. Forecasting

Forecast quality depends on:

- Data history
- Finance capability
- Market volatility
- Business complexity
- Reporting quality
- Executive skill

Forecasts must not provide perfect information. The underlying simulation remains authoritative.

## 7. Approval Workflow

Major actions require authority checks.

```text
requestedAmount <= actorApprovalLimit
and actionDomain in actorDecisionDomains
and requiredBoardApprovalSatisfied
and policyConstraintsSatisfied
```

Actions failing approval must not mutate economic state.

## 8. Delegation Profiles

Delegation profiles define objectives and constraints.

```ts
interface DelegationProfile {
  id: string;
  ownerRoleId: string;
  delegateRoleId: string;
  domain: string;
  objective: 'growth' | 'profit' | 'cash_preservation' | 'quality' | 'risk_reduction';
  approvalLimit: number;
  riskTolerance: number;
  escalationThresholds: Record<string, number>;
  enabled: boolean;
}
```

Delegation must never grant more authority than the delegating role possesses.

## 9. Explainability

Every automated headquarters decision must log:

- Decision
- Responsible role
- Trigger
- Inputs used
- Policy applied
- Expected result
- Actual financial impact when known
- Whether player override is available

The explanation must be understandable in the mobile UI.

## 10. Internal Controls

Minimum controls:

- Separation of approval and payment for material transactions
- Restricted related-party transactions
- Cash reconciliation
- Inventory reconciliation
- Debt covenant monitoring
- Access control
- Audit trail
- Duplicate payment detection
- Unusual transaction detection

Control quality reduces but does not eliminate risk.

## 11. Internal Audit

Internal audit examines stores, departments, subsidiaries, and transactions. Audit scope and frequency depend on capacity and risk.

Findings may include:

- Process weakness
- Inventory loss
- Expense abuse
- Data inconsistency
- Policy violation
- Fraud indicators

Findings must lead to remediable actions rather than only flavor text.

## 12. Procurement

Centralized procurement can improve price and consistency but may create concentration and logistics risk.

Required supplier dimensions:

- Price
- Quality
- Capacity
- Reliability
- Lead time
- Currency exposure
- Geographic risk
- Concentration

Contracts must have effective dates and must not rewrite prior costs.

## 13. Technology and Data

Systems may improve:

- Reporting speed
- Forecast accuracy
- Automation capacity
- Inventory control
- Customer analysis
- Cybersecurity
- Multi-store scalability

Technology investment requires implementation time, operating cost, and change-management capacity.

## 14. Shared Service Allocation

Headquarters costs may be allocated to stores for analysis, but allocation must not alter consolidated profit.

```text
sum(storeAllocatedHQCost) = allocatableHQCost
consolidatedProfitBeforeAllocation = consolidatedProfitAfterAllocation
```

Allocation bases may include revenue, headcount, transactions, or direct usage. The chosen base must be visible.

## 15. Subsidiary Control

For subsidiaries, headquarters control depends on ownership, governance rights, and management agreements. The parent must not freely transfer subsidiary cash without a legal transaction such as dividend, loan, fee, or capital reduction.

## 16. Crisis Management

Headquarters must support escalation for:

- Liquidity shortage
- Covenant breach
- Food safety incident
- Cyber incident
- Executive vacancy
- Supply interruption
- Regulatory action
- Reputation crisis

Crisis actions may override ordinary policies only through an explicit emergency authority path.

## 17. Mobile UX Requirements

The headquarters screen must prioritize:

- Exceptions requiring attention
- Pending approvals
- Policy violations
- Cash and covenant risk
- Department capacity bottlenecks
- Delegated actions taken

Routine detail should remain available through drill-down rather than crowding the primary iPhone view.

## 18. Required Tests

- Approval failure causes no partial mutation
- Delegates cannot exceed delegator authority
- Policy effective dates are respected
- Shared-cost allocation sums correctly
- Budget history is immutable after period close
- Automated decisions produce explanation records
- Emergency overrides are logged
- Subsidiary cash transfers require valid transaction types
- Headquarters costs reconcile to accounting
- Long simulations preserve policy and audit history

## 19. Open Implementation Questions

- Existing headquarters department structures
- Current policy engine support
- Existing approval limits and board actions
- Current budget and forecast features
- Existing internal audit events
- Current supplier contract model
- Existing subsidiary control implementation
