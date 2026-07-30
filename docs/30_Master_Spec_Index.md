# 開発マスター仕様書 全体索引

## 1. この索引の目的

本ファイルは、`docs/` 配下の仕様書を目的別に参照するための入口である。実装、レビュー、テスト、運用判断では、該当章を確認し、必要に応じて関連章も同時に参照する。

## 2. 最上位原則

最初に以下を確認する。

1. `01_Project_Overview.md`
2. `02_Game_Design_Principles.md`
3. `03_Core_Game_Loop.md`
4. `04_Architecture_Decisions.md`

特に優先する原則:

- ブラウザ版・iPhone最優先
- セーブ互換性
- 決定論
- 会計整合性
- 会社資産と個人資産の分離
- 長期プレイ可能性

## 3. シミュレーション基盤

- `05_Time_and_Turn_System.md`: 週送り、四半期、年度、処理順
- `06_Player_and_Company_Data_Model.md`: プレイヤー、会社、所有関係
- `07_Accounting_System.md`: 会計、仕訳、財務諸表
- `08_Save_and_Migration_System.md`: 保存、読込、移行、復旧

## 4. 店舗・商品・組織

- `09_Restaurant_and_Branch_System.md`: 店舗、立地、在庫、能力
- `10_Product_Menu_and_Demand_System.md`: 商品、価格、品質、需要
- `11_Employees_Headquarters_and_Executives.md`: 従業員、役員、後継者
- `12_Headquarters_Control_and_Delegation.md`: 本社、予算、権限、内部統制

## 5. 経済・市場・競合

- `13_Economy_Interest_and_Market_System.md`: 景気、物価、賃金、金利
- `14_Competition_AI_System.md`: 競合AIの判断、資金繰り、倒産
- `15_Market_Structure_and_Competition_System.md`: 市場規模、シェア、飽和、参入退出

## 6. 資本市場・投資

- `16_Stock_Market_IPO_and_Dividend_System.md`: 株式、IPO、配当、希薄化
- `17_Venture_Capital_and_Funding_Rounds.md`: VC、資金調達ラウンド
- `18_MA_Subsidiary_and_Integration_System.md`: M&A、子会社、買収後統合
- `19_Real_Estate_Bank_and_Collateral_System.md`: 不動産、借入、担保、返済

## 7. UI・長期プレイ

- `20_UI_UX_and_iPhone_Interaction.md`: iPhone操作、表示、アクセシビリティ
- `21_Events_Achievements_Hall_of_Fame_and_Succession.md`: イベント、実績、殿堂、世代交代

## 8. 開発・試験運用

- `22_GitHub_PR_and_Codex_Workflow.md`: GitHub、PR、Codex運用
- `23_Playwright_Autoplay_and_Test_Strategy.md`: 自動プレイ、長期回帰
- `24_Roadmap_Backlog_and_Release_Criteria.md`: 優先順位、ロードマップ、リリース基準
- `26_Game_Balance_Tuning_and_Validation.md`: バランス調整、複数戦略・複数seed評価

## 9. データ・品質・運用

- `25_Data_Dictionary_JSON_Schema_and_Stable_IDs.md`: JSON、安定ID、参照整合性
- `27_Incident_Logging_and_Telemetry.md`: 障害対応、ログ、復旧、テレメトリ
- `28_Security_Data_Protection_and_Cheat_Resistance.md`: セキュリティ、データ保護
- `29_Glossary_Open_Questions_and_Change_Log.md`: 用語、未決定事項、変更履歴

## 10. 監査・実装移行

- `31_Spec_Consistency_and_Code_Gap_Audit.md`: 仕様書間の正本整理、現行コード適合状況、P0/P1ギャップ
- `32_P0_P1_Implementation_Backlog.md`: PR分割、依存関係、受入条件、実装順

新しい実装作業を開始する前に、対象業務仕様に加えて`31`と`32`を確認する。

## 11. 作業別参照ガイド

### 週送りロジックを変更する場合

`03` → `05` → `07` → `08` → `23` → `25` → `31` → `32`

### 店舗売上や需要を変更する場合

`09` → `10` → `13` → `15` → `26` → `31`

### 借入・IPO・M&Aを実装する場合

`07` → `16` / `18` / `19` → `25` → `23` → `31`

### セーブ構造を変更する場合

`08` → `25` → `27` → `29` → `31` → `32`

### iPhone画面を変更する場合

`20` → 関連業務仕様 → `23` → `31`

### Codexへ開発を依頼する場合

`22` → 対象業務仕様 → `24` → `31` → `32` → `23`

### バグ修正を行う場合

`27` → 関連仕様 → `23` → `29` → `31`

## 12. PRレビュー必須確認

- 仕様書と実装が一致しているか
- SAVE_KEY / saveVersionへの影響が明記されているか
- 決定論が維持されているか
- 会計不変条件を破壊していないか
- 会社資産と個人資産が混在していないか
- iPhone操作性が維持されているか
- 回帰テストが追加されているか
- docsが同時更新されているか
- `31`の既知ギャップを悪化させていないか
- `32`の受入条件を満たしているか

## 13. 文書更新ルール

- 新規仕様は適切な既存章へ追加する
- 既存章で扱えない場合のみ新章を作成する
- 重複記述を避け、正本となる章を1つにする
- 関連章から相互参照を追加する
- 重要な変更は`29`の変更履歴へ記録する
- コード監査結果が変わった場合は`31`を更新する
- P0/P1タスクの完了時は`32`の状態と証跡を更新する

## 14. 現在の次工程

1. P0-01 乱数直接使用の棚卸しとCIガード
2. P0-05 Playwright基盤導入
3. P0-02 RandomServiceとseed状態の導入
4. P0-04 saveVersionとmigration registryの統合
5. P0-03 安定ID・連番採番基盤
6. iPhone主要導線E2Eと決定論ブラウザ回帰
7. リリースゲートへの統合