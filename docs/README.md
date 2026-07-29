# 資本主義ポケット TYCOON 開発マスター仕様書

> 対象リポジトリ: `yutaro-j31/capitalism-tycoon-web`  
> 正式名称: 資本主義ポケット TYCOON / Capitalism Tycoon Web  
> 文書体系バージョン: 1.0-draft  
> 最終更新日: 2026-07-30

## 1. この文書群の役割

`docs/` は、本プロジェクトにおけるゲーム仕様、設計判断、データ契約、開発運用、テスト基準の正本である。ChatGPT、Codex、人間の開発者、レビュー担当者は、実装判断を行う前にこの文書群を参照する。

コードと仕様書が矛盾した場合、次の順序で処理する。

1. 現行コードが意図的な最新仕様を実装しているか確認する。
2. 意図的な変更なら、同一PRで仕様書を更新する。
3. 意図しない逸脱なら、実装を仕様へ戻す。
4. 判断不能な場合は、セーブ互換性、決定論、会計整合性、会社資産と個人資産の分離、iPhone操作性を優先する。

## 2. 最上位の設計原則

以下は通常の機能要件より上位に置く。

1. **ブラウザ版を正本とする**  
   Mobile Safariを最重要対象とし、デスクトップブラウザを二次対象とする。
2. **iPhoneファースト**  
   片手操作、狭い画面、誤タップ防止、長時間プレイ時の可読性を優先する。
3. **セーブ互換性を壊さない**  
   `SAVE_KEY`、`saveVersion`、移行処理を明示し、既存セーブを無断で破棄しない。
4. **決定論を維持する**  
   同一初期状態、同一入力、同一乱数シードから同一結果を得られること。
5. **会計整合性を守る**  
   取引は資産、負債、純資産、収益、費用、キャッシュフローへ一貫して反映する。
6. **会社資産と個人資産を混同しない**  
   会社の現金を個人が直接使用できない。役員報酬、配当、株式売却等の正式な経路を介する。
7. **長期プレイに耐える**  
   数百週から千週超でも破綻、極端なインフレ、処理遅延、数値オーバーフローを起こさない。
8. **回帰テストを伴う**  
   新機能は既存挙動を保つテストと、必要に応じて長期シミュレーションを追加する。

## 3. 文書構成

### Part A: 基本設計

- [01 プロジェクト概要](./01_Project_Overview.md)
- [02 ゲームデザイン原則](./02_Game_Design_Principles.md)
- [03 コアゲームループ](./03_Core_Game_Loop.md)
- [04 アーキテクチャ決定記録](./04_Architecture_Decisions.md)

### Part B: 経営シミュレーション

今後追加する文書:

- 05_Time_and_Turn_System.md
- 06_Player_and_Company_Model.md
- 07_Restaurant_Operations.md
- 08_Product_and_Pricing.md
- 09_Employees_and_Headquarters.md
- 10_Competition_AI.md
- 11_Economy_and_Market.md
- 12_Events_and_News.md
- 13_Long_Term_Progression.md

### Part C: 財務・資本市場

今後追加する文書:

- 14_Accounting_System.md
- 15_Banking_and_Debt.md
- 16_Stock_Market.md
- 17_Venture_Capital.md
- 18_IPO.md
- 19_MA.md
- 20_Real_Estate.md
- 21_Personal_Wealth.md

### Part D: 技術仕様

今後追加する文書:

- 22_Save_System.md
- 23_Data_Model.md
- 24_Randomness_and_Determinism.md
- 25_Performance.md
- 26_UI_UX.md
- 27_Accessibility.md
- 28_Analytics_and_Telemetry.md

### Part E: 開発運用

今後追加する文書:

- 29_GitHub_Workflow.md
- 30_PR_Review_Guide.md
- 31_Test_Strategy.md
- 32_Playwright_Autoplay.md
- 33_Codex_Development_Guide.md
- 34_Release_and_Migration.md
- 35_Roadmap_and_Backlog.md

## 4. 優先順位の判定

機能同士が競合する場合、次の順に判断する。

1. セーブデータ消失・破損の防止
2. 会計・資金移動の正確性
3. 決定論と再現性
4. 進行不能・クラッシュの防止
5. iPhoneでの操作性
6. ゲームバランス
7. 表示品質・演出
8. 新規コンテンツ量

## 5. 仕様変更のルール

仕様変更PRには最低限、次を記載する。

- 変更の目的
- プレイヤー体験への影響
- セーブ互換性への影響
- 会計への影響
- 決定論への影響
- iPhone UIへの影響
- 追加・更新したテスト
- 更新した仕様書ファイル

## 6. 用語

- **週送り**: プレイヤーが意思決定後、ゲーム内時間を1週進める操作。
- **会社**: 法人格としての事業主体。会社現金、設備、借入、従業員等を保有する。
- **個人**: プレイヤー本人。個人現金、保有株式、不動産等を保有する。
- **会社価値**: 株式価値または企業価値。文脈により明示する。
- **決定論**: 同じ状態と入力から同じ結果が生成される性質。
- **正本**: 意思決定時に最優先で参照する情報源。

## 7. 完成条件

このマスター仕様書は、次を満たした時点でv1.0とする。

- 現行の主要ゲーム機能が文書化されている。
- セーブデータと移行規則が定義されている。
- 売上、費用、利益、資金移動の基準式が定義されている。
- 競合AIと経済変動の入力・出力が定義されている。
- 主要画面のiPhone向けUI要件が定義されている。
- PR、CI、レビュー、リリースの運用が定義されている。
- Playwrightによる自動プレイと長期回帰試験の方針が定義されている。
