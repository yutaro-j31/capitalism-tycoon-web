# Phase 5B-1 競合複数市場・実績履歴監査

## 基準
- 基準 `main`: `92e5e2ba269ad7a9256704c1d1c4f4d43eb86158`
- 開始時 `saveVersion`: 8
- 対象業種: `businessID === 'ramen'`
- 対象外業種: 既存の静的競合処理を維持する。

## Phase 5Aで実装済み
- `competitorStates[]` を競合企業状態の正本として保存する。
- 各競合は `marketPresence[]` を持つため、データ構造上は複数市場を保持できる。
- 市場計算結果は `competitorMarketResultsByPresenceID` と `competitorMarketResultsByCompetitorID` へ集計される。
- 競合財務は全active presenceの売上、変動費、固定費、能力維持費を合算する。
- 価格、ブランド、品質、能力、撤退、借入、再建の行動形式が存在する。
- `competitorActions[]` は160件、企業別 `actionHistory` は20件に制限される。
- 競合処理は `Math.random`、`rand`、`Date.now` を使用しない。

## 複数市場対応の不足
`processWeek()` の財務集計は全active presenceを対象にしている。一方、`decide()` は次の処理で最初のactive presenceだけを選択している。

```js
(c.marketPresence || []).find(x => x.active)
```

このため、2件目以降の市場は財務へ含まれるが、価格、能力、品質、ブランド、撤退判断の候補として評価されない。Phase 5B-1では、全active presenceを安定順で評価し、戦略と実績に基づいて主要対象市場を1件選ぶ方式へ変更する。

## 実績履歴の不足
Phase 5Aでは各presenceに前週値と当週値が保存されるが、4週、13週、52週の推移を計算できる履歴は存在しない。企業全体についても当週財務と累積利益だけで、週次履歴は存在しない。

Phase 5B-1では次を正本として追加する。

- `competitorPerformanceHistoryByID`
- `competitorPresenceHistoryByID`

各IDごとの配列へ週次スナップショットを最大104週保存する。同一ID・同一週の重複追加は禁止する。

## 今回実装する範囲
- 全active presenceの評価
- 決定論的な主要市場選択
- 企業別週次実績履歴
- presence別週次実績履歴
- 4週・13週集計に利用できる保存形式
- 履歴104週上限
- 同一週重複防止
- `saveVersion 9` とv8→v9マイグレーション
- `competitor.validate()`による履歴検証
- 回帰、移行、複数市場、render純粋性、決定論性テスト

## 今回維持する範囲
- 地域参入の本実装
- 投資プロジェクト
- 能力縮小
- 借入返済
- 信用スコア更新
- 再建計画
- 倒産処理
- 対象外業種
- Phase 1A需要式
- プレイヤー会計、供給、人材、株価

上記は後続のPhase 5B PRへ分割する。

## 設計判断
- 履歴は表示用コピーではなく、競合AIが過去実績を参照するための保存済み正本とする。
- 市場評価は配列の元順序に依存させず、`presenceID`で安定ソートしてからスコアリングする。
- 同点時は `presenceID`の辞書順で決定する。
- 1回の判断では主要市場1件だけを対象にし、全市場の同時変更を防ぐ。
- render処理は履歴を追加せず、週次処理だけが各週1回追加する。
