# Phase 4A Balance Report

| Scenario | Old staff | New staff | Old payroll | New payroll | Old dept effect | New dept effect | Old capacity | New capacity | Old units | New units | Cash diff | Fatigue | Morale | Utilization | Divergence | Allowed | Reason |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| No HQ/no departments | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 55 | 0 | 0.0% | yes | No workforce created. |
| One operations department | 1 | 1 | 85000 | 85000 | 0.43 | 0.43 | 0 | 0 | 0 | 0 | 0 | 20 | 55 | 0.70 | 0.0% | yes | Migrated headcount preserved. |
| Multiple departments | 3 | 3 | 203000 | 203000 | 0.43 | 0.42 | 0 | 0 | 0 | 0 | 0 | 20 | 55 | 0.82 | -2.3% | yes | Workforce multiplier near baseline. |
| Standard ramen store x1 | 5 | 5 | 52500 | 52500 | 0 | 0 | 2050 | 2050 | 1030 | 1030 | 0 | 20 | 55 | 0.50 | 0.0% | yes | `b.wage` retained as base store payroll. |
| Standard ramen store x10 | 50 | 50 | 525000 | 525000 | 0 | 0 | 20500 | 20500 | 10300 | 10300 | 0 | 20 | 55 | 0.50 | 0.0% | yes | Store cohorts scale by group. |
| CXO present | 1 | 1 | 85000 | 85000 | 0.63 | 0.62 | 0 | 0 | 0 | 0 | 0 | 20 | 55 | 0.70 | -1.6% | yes | CXO stays a department multiplier. |
| Key personnel present | 1 | 1 | 85000 | 85000 | 0.43 | 0.43 | 0 | 0 | 0 | 0 | 0 | 20 | 55 | 0.70 | 0.0% | yes | Key personnel remain individual records. |
| Remote work enabled | 8 | 8 | 540000 | 540000 | 0.99 | 0.98 | 0 | 0 | 0 | 0 | 0 | 18 | 56 | 0.76 | -1.0% | yes | Remote lowers office penalty. |
| Branch office present | 16 | 16 | 1040000 | 1040000 | 1.50 | 1.48 | 0 | 0 | 0 | 0 | 0 | 20 | 55 | 0.68 | -1.3% | yes | Branch capacity included. |
| Staff shortage | 1 | 1 | 17500 | 17500 | 0 | 0 | 2050 | 683 | 1030 | 683 | -319240 | 85 | 40 | 3.00 | -33.7% | intentional | Staff limited capacity and lost demand. |
| Manager shortage | 12 | 12 | 780000 | 780000 | 1.31 | 1.05 | 0 | 0 | 0 | 0 | 0 | 35 | 48 | 1.10 | -19.8% | intentional | Management coverage penalty. |
| Training active | 5 | 5 | 325000 | 325000 | 0.75 | 0.67 | 0 | 0 | 0 | 0 | 0 | 24 | 55 | 0.92 | -10.7% | intentional | Temporary training capacity reduction model. |
| Project active | 5 | 5 | 325000 | 325000 | 0.75 | 0.74 | 0 | 0 | 0 | 0 | -1000 | 22 | 55 | 0.94 | -1.3% | yes | Project spends weekly budget once. |
