# Phase 4A Workforce Engine Audit

Base audit commit: c5459fb611a21003a87d33875eedd2c68dfbbde2.

## 現行データ構造
- 部門は `departments` と `departmentStaff`。`departmentStaff` は部門別人数の数値だけで、スキル、疲労、管理職はなかった。
- CXOは `executives` と `executiveMarket`。CXOは個人管理で、年俸とスキルを持つ。
- 重要社員は `keyPersonnel`。個人管理で、一般社員とは別。
- 文化KPIは `employeeSatisfaction`, `employeeAbility`, `organizationCulture.morale`, `organizationCulture.turnoverRate`, `overtimeRisk`, `employeeComplaintLog`。
- オフィスは `officeCapacity`, `branchOffices.capacity`, `remoteWorkEnabled`。

## 現行費用計算
- 店舗給与は `business.wage` が固定費に含まれる。
- 部門費は `departments[].weeklyCost` と `departmentStaff` の追加人数費で計算されていた。
- CXO給与は4週ごとに `execPayroll` として計上される。
- 福利厚生投資は本社費として会計イベント化済み。

## 現行部門効果
- `departmentEffect(id)` は設置済み部門、`departmentStaff`、対応CXOスキルから倍率を返していた。
- 部門未設置は0。設置直後は最低0.35。

## 現行CXO効果
- 対応役職は accounting/CFO, hr/CHRO, product/CPO, operations/COO, marketing/CMO, dx/CTO, investment/CSO。
- CXOは一般管理職数へは含めない。

## 現行重要社員効果
- `keyPersonnel` は個別保存されるが、一般社員能力計算の正本ではなかった。

## 現行週次更新
- 週次はマクロ、市場、店舗、供給、会計、履歴、保存の順。
- 市場計算は `market.calculateMarkets()` が1回呼ばれる。
- 供給は期限切れ、納品、支払、市場後制約、消費、自動発注を担当。

## 現在利用されていない項目
- 既存KPIの多くはUI表示と一部サービス品質に使われ、部門別処理能力やプロジェクト進行には未接続だった。

## 二重人件費の可能性
- `departmentStaff` と新しい詳細社員を別々に給与計算すると二重計上になるため、Phase 4Aでは `workforceTeams` を正本、`departmentStaff` を互換ミラーにした。
- 店舗は方式Aを採用し、既存 `b.wage` を基本スタッフ給与として維持し、Phase 4A店舗チームは能力制約の正本にする。

## オフィス定員の扱い
- 店舗スタッフは本社定員へ含めない。
- 本社・支社定員とリモート適合人数からオフィス制約ペナルティを算出し、削除ではなく効率・疲労へ反映する。

## 今回置き換える範囲
- 一般社員の人数、能力、疲労、管理職、部門能力、採用候補、研修、プロジェクト進捗。

## 互換性のため残す項目
- `departmentStaff`, `employeeSatisfaction`, `employeeAbility`, `organizationCulture`, `overtimeRisk`, `executives`, `keyPersonnel`, `b.wage` は残す。

## コード上の事実
- `SAVE_KEY` は `capitalism_tycoon_web_v1` のまま。
- Phase 4Aは `js/workforce.js` のclassic scriptとして登録する。

## 設計上の判断
- 個別社員を生成せず、一般社員は社員グループで管理する。
- `departmentStaff` は正本ではなく同期表示用。
- プロジェクトは既存投資を二重化せず補助効果に限定する。
