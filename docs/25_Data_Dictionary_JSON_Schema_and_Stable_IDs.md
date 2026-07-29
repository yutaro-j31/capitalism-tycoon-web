# 25. データ辞書・JSONスキーマ・安定ID

## 1. 目的

本章は、ゲーム内データの意味、保存形式、ID規則、参照整合性を統一する。実装言語や画面構造が変わっても、保存データとシミュレーション上の意味が変質しないことを目的とする。

---

## 2. ルートセーブ構造

セーブデータのルートは概念上、次を持つ。

```json
{
  "saveVersion": 1,
  "saveId": "save_xxx",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "simulation": {},
  "player": {},
  "companies": [],
  "markets": {},
  "events": [],
  "achievements": {},
  "settings": {},
  "metadata": {}
}
```

`saveVersion` は移行判断に使用し、ゲーム内週数とは分離する。

---

## 3. 命名規則

- JSONキーは `camelCase`
- 列挙値は英小文字の `snake_case`
- IDは型を示す接頭辞を持つ
- 金額は原則として整数の円
- 比率は0から1の小数
- パーセント表示はUI側で変換
- 日付はシミュレーション週と実時間を混同しない

例:

- `company_01H...`
- `branch_01H...`
- `employee_01H...`
- `transaction_01H...`

---

## 4. 安定IDの原則

IDは表示名、配列位置、作成順の見かけに依存してはならない。

必須ID対象:

- player
- company
- branch
- product
- employee
- executive
- investor
- shareClass
- loan
- property
- transaction
- event
- achievement
- marketRegion
- competitor

削除済みエンティティのIDを再利用しない。

---

## 5. 金額型

金額は浮動小数点で保持しない。

```ts
type MoneyYen = number // safe integer only
```

規則:

- 1円未満は計算途中でのみ許容し、確定時に規定の丸めを行う
- 丸め方式を処理ごとに明示する
- 売上、原価、税、利息、配当は取引単位で確定する
- `NaN`、`Infinity`、負のゼロは禁止

大規模金額でJavaScriptの安全整数上限へ接近する場合は、BigIntまたは固定小数表現への移行を検討する。

---

## 6. シミュレーション状態

```json
{
  "week": 1,
  "year": 1,
  "weekOfYear": 1,
  "seed": "seed_string",
  "rngState": {},
  "economyState": "recovery",
  "policyRateBps": 50
}
```

`week` は単調増加する正の整数。`rngState` は再開後の決定論維持に必要な状態を含む。

---

## 7. プレイヤー

```json
{
  "id": "player_xxx",
  "name": "",
  "personalCashYen": 0,
  "personalLiabilitiesYen": 0,
  "portfolio": [],
  "ownedCompanyIds": [],
  "currentRole": "founder_ceo",
  "reputation": 0
}
```

会社現金を `personalCashYen` に直接加算してはならない。給与、配当、株式売却など正式な取引を経由する。

---

## 8. 会社

```json
{
  "id": "company_xxx",
  "name": "",
  "status": "private",
  "cashYen": 0,
  "retainedEarningsYen": 0,
  "branchIds": [],
  "employeeIds": [],
  "loanIds": [],
  "propertyIds": [],
  "shareClasses": [],
  "ledger": [],
  "parentCompanyId": null,
  "subsidiaryIds": []
}
```

会社状態例:

- `private`
- `public`
- `insolvent`
- `bankrupt`
- `liquidating`
- `acquired`
- `dissolved`

---

## 9. 株式と持分

```json
{
  "id": "shareclass_xxx",
  "companyId": "company_xxx",
  "classType": "common",
  "authorizedShares": 1000000,
  "issuedShares": 100000,
  "treasuryShares": 0,
  "holders": [
    {
      "holderId": "player_xxx",
      "shares": 60000
    }
  ]
}
```

不変条件:

`holdersの株数合計 + treasuryShares = issuedShares`

所有比率は保存値ではなく株数から再計算することを原則とする。

---

## 10. 店舗

```json
{
  "id": "branch_xxx",
  "companyId": "company_xxx",
  "regionId": "region_xxx",
  "status": "operating",
  "openedWeek": 1,
  "capacityPerWeek": 0,
  "seatCount": 0,
  "productIds": [],
  "assignedEmployeeIds": [],
  "leaseId": null,
  "propertyId": null
}
```

店舗は所有会社を必須とする。会社なき店舗は禁止する。

---

## 11. 商品

```json
{
  "id": "product_xxx",
  "branchId": "branch_xxx",
  "name": "",
  "priceYen": 0,
  "unitCostYen": 0,
  "qualityScore": 0,
  "prepTimeUnits": 0,
  "active": true
}
```

価格と原価は0以上。販売停止商品は削除せず、履歴整合性のため `active: false` とする。

---

## 12. 従業員

```json
{
  "id": "employee_xxx",
  "companyId": "company_xxx",
  "branchId": null,
  "departmentId": null,
  "role": "staff",
  "salaryYenPerWeek": 0,
  "skills": {},
  "morale": 0,
  "employmentStatus": "active"
}
```

従業員は同一週に複数会社へ所属できない。

---

## 13. 借入

```json
{
  "id": "loan_xxx",
  "borrowerCompanyId": "company_xxx",
  "lenderId": "bank_xxx",
  "principalYen": 0,
  "outstandingPrincipalYen": 0,
  "annualRateBps": 0,
  "rateType": "fixed",
  "startWeek": 1,
  "maturityWeek": 53,
  "repaymentType": "amortizing",
  "collateralIds": [],
  "covenants": [],
  "status": "current"
}
```

元本残高は0未満にならない。返済、利息、手数料は別勘定で記録する。

---

## 14. 不動産

```json
{
  "id": "property_xxx",
  "ownerId": "company_xxx",
  "regionId": "region_xxx",
  "purchasePriceYen": 0,
  "bookValueYen": 0,
  "marketValueYen": 0,
  "accumulatedDepreciationYen": 0,
  "collateralForLoanIds": []
}
```

所有者は個人または会社のどちらか一方。共有所有を実装する場合は持分構造を別テーブル化する。

---

## 15. 会計取引

```json
{
  "id": "transaction_xxx",
  "week": 1,
  "entityId": "company_xxx",
  "type": "sale",
  "description": "",
  "entries": [
    {
      "account": "cash",
      "debitYen": 1000,
      "creditYen": 0
    },
    {
      "account": "revenue",
      "debitYen": 0,
      "creditYen": 1000
    }
  ],
  "sourceEntityId": "branch_xxx"
}
```

各取引で借方合計と貸方合計が一致しなければ保存してはならない。

---

## 16. 列挙値管理

列挙値はコード中に分散させず、中央定義する。

例:

- companyStatus
- branchStatus
- employmentStatus
- economyState
- loanStatus
- eventType
- transactionType
- roleType

既存値の名称変更はセーブ移行を伴う。単純な文字列置換で済ませない。

---

## 17. 参照整合性

ロード時に最低限、以下を検証する。

- 参照先IDが存在する
- 親子会社関係が循環していない
- 店舗の会社IDと会社側branchIdsが一致
- 従業員所属が重複しない
- 株式総数が一致
- 借入残高が負でない
- 担保が複数融資へ不正重複していない
- 取引の借方・貸方が一致

修復可能な不整合は移行処理で修復し、修復不能時はバックアップへ退避する。

---

## 18. JSON Schema運用

- スキーマファイルはバージョン管理する
- CIでサンプルセーブを検証する
- 必須項目追加時はdefaultまたはmigrationを用意する
- `additionalProperties` の扱いを型ごとに決める
- 数値範囲、文字列長、列挙値を定義する
- スキーマ合格だけで意味整合性が保証されるとは考えない

---

## 19. 移行規則

移行関数は1バージョンずつ適用する。

```text
v1 -> v2 -> v3 -> current
```

飛び越し移行を原則禁止する。各移行は冪等性を持ち、同じ入力に二度適用して状態を壊さないようにする。

---

## 20. 派生値

以下は原則として保存せず再計算する。

- 所有比率
- 時価総額
- 純資産
- 営業利益率
- ROE
- 市場シェア
- 借入依存度

ただし性能上キャッシュする場合は、原データと更新時点を保持し、ロード時に再構築可能とする。

---

## 21. テスト要件

- 全エンティティのschema validation
- ID重複検出
- 参照切れ検出
- 株式総数不変条件
- 会計取引均衡
- 旧バージョン移行
- セーブ・ロード同値性
- 1200週後のシリアライズ
- 不正値の拒否

---

## 22. 禁止事項

- 配列indexを永続IDとして使う
- 表示名を参照キーとして使う
- 金額を文字列と数値で混在させる
- 保存時に循環参照を残す
- 既存列挙値を移行なしで変更する
- 会社現金と個人現金を同じフィールドに持つ
- 派生値だけを保存して原データを失う
