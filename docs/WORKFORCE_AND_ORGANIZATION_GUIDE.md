# Workforce and Organization Guide

The organization screen now includes a workforce dashboard. It shows total headcount, office/store staff, managers, onboarding/training, satisfaction, morale, fatigue, overtime risk, turnover risk, payroll, office seats, department bottlenecks, store staffing limits, and project progress.

Learning notes explain productivity, capacity, utilization, span of control, bottlenecks, overtime, turnover, onboarding, training, backlog, opportunity loss, and payroll as fixed cost.

## Phase 5A 競合企業 AI

saveVersion 8 では、ラーメン（`businessID === 'ramen'`）のみ `js/competitor.js` の決定論的な競合状態を利用する。既存 `competitors` は削除せず、v7→v8 で `competitorStates[]`、`competitorActions[]`、`competitorMarketResultsByPresenceID`、`competitorMarketResultsByCompetitorID` と採番フィールドを追加する。対象外業種は従来の静的競合処理を維持する。
