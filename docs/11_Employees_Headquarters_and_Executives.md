# 11 Employees, Headquarters, and Executives

## 1. Purpose

This document defines the people and organization system, covering store staff, managers, headquarters employees, executives, directors, retirement, succession, delegation, compensation, and organizational capacity.

## 2. Design Goals

The system must make people economically meaningful without requiring excessive micromanagement on iPhone. Hiring stronger employees should improve capability, but payroll, retention, culture, span of control, and succession risk must create trade-offs.

## 3. Stable Identity

Every employee and executive must have an immutable stable ID. Names, roles, compensation, and employment status may change while historical references remain valid.

```ts
interface Employee {
  id: string;
  personId: string;
  employerCompanyId: string;
  roleId: string;
  workplaceId?: string;
  status: EmployeeStatus;
}
```

## 4. Employment Status

```ts
type EmployeeStatus =
  | 'candidate'
  | 'active'
  | 'leave'
  | 'notice'
  | 'retired'
  | 'terminated'
  | 'deceased';
```

Status transitions must be explicit and recorded in the event history.

## 5. Employee Attributes

Minimum attributes:

- Role proficiency
- Learning speed
- Leadership
- Reliability
- Creativity
- Negotiation
- Financial skill
- Operational skill
- Marketing skill
- Technology skill
- Integrity
- Ambition
- Loyalty
- Stress tolerance
- Age and career stage
- Compensation expectation

Not every attribute needs to be fully visible to the player. Information quality may depend on interviews, HR capability, tenure, and executive reporting.

## 6. Store Employees

Store roles may include:

- Crew
- Cook
- Service staff
- Shift leader
- Store manager
- Area manager

Store staffing influences capacity, quality, service, overtime, cleanliness, accidents, and turnover.

## 7. Headquarters Departments

The headquarters may contain the following departments:

- Finance and accounting
- Human resources
- Product development
- Marketing and public relations
- Technology and data
- Procurement and supply chain
- Legal and compliance
- Corporate planning
- Investment and M&A
- Internal audit

Departments unlock or improve specific capabilities. A department must not exist only as a passive bonus; its staffing and quality must influence actual decisions, limits, forecast accuracy, or automation.

## 8. Organizational Capacity

Management capacity must constrain expansion.

```text
requiredManagementCapacity =
  storeComplexity
+ geographicComplexity
+ productComplexity
+ subsidiaryComplexity
+ transactionComplexity

capacityGap = availableManagementCapacity - requiredManagementCapacity
```

A negative capacity gap may increase errors, slow execution, reduce control quality, and raise compliance risk.

## 9. Span of Control

Managers have finite effective span. Excess direct reports reduce management effectiveness.

```text
spanFactor = clamp(idealSpan / actualSpan, minimumSpanFactor, 1)
```

Adding unnecessary hierarchy must also impose cost and communication delay.

## 10. Hiring

Hiring requires:

- Role definition
- Compensation range
- Recruitment channel
- Search duration
- Candidate pool generation
- Evaluation
- Offer
- Acceptance or rejection

Candidate generation must be deterministic from saved state and controlled seeds.

## 11. Compensation

Compensation may include:

- Base salary
- Bonus
- Commission
- Equity or options
- Retirement benefits
- Severance

Company compensation is a company expense and cash outflow. It must not be confused with the player's personal funds unless the player is the compensated employee or shareholder receiving the payment.

## 12. Performance and Development

Employee performance should depend on capability, role fit, training, workload, tools, manager quality, motivation, and organizational health.

```text
performance =
  capability
× roleFit
× managerFactor
× motivationFactor
× workloadFactor
× systemsFactor
```

Training consumes time and money and may improve future performance.

## 13. Motivation and Retention

Retention risk may depend on:

- Market pay gap
- Workload
- Promotion opportunity
- Manager quality
- Company performance
- Culture
- Equity value
- Personal ambition
- External offers

Turnover must create replacement cost, productivity loss, and institutional knowledge loss.

## 14. Executives

Core executive roles may include:

- CEO
- COO
- CFO
- CHRO
- CMO
- CTO
- Chief Strategy Officer
- General Counsel

Executives influence company-wide systems and delegated decisions. Executive authority must be represented explicitly.

```ts
interface ExecutiveAuthority {
  roleId: string;
  decisionDomains: string[];
  approvalLimit: number;
  mayHire: boolean;
  mayBorrow: boolean;
  mayInvest: boolean;
}
```

## 15. Board of Directors

The board may approve or reject major actions such as:

- Executive appointment and dismissal
- Large borrowing
- Equity issuance
- Major acquisition or sale
- Dividend policy
- Related-party transactions
- Succession plans

Board decisions must account for ownership, independence, governance quality, and conflicts of interest.

## 16. Founder and Player Roles

The player may simultaneously be:

- Shareholder
- Director
- Executive
- Employee
- Personal investor

Each role must remain legally and economically distinct. Actions available to the player depend on authority held in the relevant role.

## 17. Retirement and Succession

Executives and key employees may retire based on age, tenure, health events, personal plans, or board decisions. Retirement must not delete the person or their historical record.

Succession candidates may be:

- Internal executives
- Other internal employees
- External hires
- Family successors where supported

Candidate evaluation may include:

- Capability
- Company knowledge
- Leadership
- Strategic fit
- Board support
- Shareholder support
- Compensation
- Transition risk

## 18. Successor Promotion

When a successor is promoted:

1. Verify the position is vacant or transition-approved.
2. Close or amend the prior role assignment.
3. Create the new executive assignment.
4. Update authority and compensation.
5. Recalculate organizational effects.
6. Record the event.
7. Preserve deterministic state and save compatibility.

## 19. Delegation

Players may delegate repetitive decisions to managers or departments. Delegation must include:

- Scope
- Limits
- Objective
- Risk tolerance
- Review cadence
- Escalation conditions

Automated actions must include a human-readable explanation.

## 20. Misconduct and Governance Risk

Low integrity, weak controls, excessive pressure, or conflicts may increase misconduct risk. Outcomes may include:

- Theft
- Accounting manipulation
- Harassment
- Bribery
- Information leakage
- Regulatory violations

Events must not be purely arbitrary; risk must be traceable to state and controlled randomness.

## 21. Required KPIs

- Headcount
- Payroll
- Revenue per employee
- Profit per employee
- Turnover
- Vacancy rate
- Overtime
- Training investment
- Engagement or motivation
- Management capacity utilization
- Succession coverage
- Key-person concentration

## 22. Required Tests

- No employee has two incompatible active roles
- Payroll reconciles to accounting and cash
- Retired employees generate no ordinary active labor capacity
- Successor promotion preserves stable person identity
- Delegated decisions respect approval limits
- Store staffing effects reconcile with store capacity
- Organizational capacity penalties are deterministic
- Historical employment records survive role changes
- Related-party compensation is recorded correctly
- Long simulations do not produce invalid ages or duplicate IDs

## 23. Open Implementation Questions

- Existing employee skill fields
- Existing department taxonomy
- Current executive and board mechanics
- Current retirement and successor implementation
- Existing authority limits
- Current family or dynasty support
- Existing misconduct and governance events
