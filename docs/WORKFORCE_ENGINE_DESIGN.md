# Workforce Engine Design

Phase 4A adds `workforceTeams`, `workforceCandidates`, `workforceTrainings`, and `workforceProjects` with saveVersion 7. The workforce module is a classic script loaded after data and before supply/market/finance/engine.

## Employee groups
General staff are aggregated cohorts. Each team stores department/store/branch references, role, headcount, managers, average skill/experience/salary, morale, fatigue, engagement, onboarding, available headcount, capacity, workload, utilization, overtime, backlog, turnover risk, and update weeks.

## Role master
Roles are static and not copied into saves: store operations, operations, marketing, HR, finance/accounting, DX/IT, product/R&D, investment/M&A, procurement/logistics, and manager.

## Capacity
Effective capacity = available people × role capacity × skill × experience × training × fatigue × morale × management coverage × office constraint. Multipliers are clamped.

## Management coverage
Managers have span-of-control. Shortage lowers capacity/morale/project progress; excess managers increase payroll and can reduce direct productivity.

## Workload
Workload uses current game data: stores, open ramen stores, finance transaction volume, product ventures, investments, purchase orders, candidates, trainings, and workforce size.

## Payroll
Corporate workforce payroll replaces the previous department weekly cost formula in weekly settlement. Store `b.wage` remains the base staff payroll for Phase 4A to preserve calibration.
