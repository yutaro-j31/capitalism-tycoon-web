# Phase 5A 競合エンジン監査

## 現行データ構造
`MASTER.competitors` は `id` 相当を初期化時に UUID で付与され、`name`、`businessID`、`areaID`、`stores`、`brand`、`quality`、`strategy`、`ownedPlayerShares` を持つ静的配列として `state.competitors` に保存されていた。セーブ内では競合の資金、負債、利益、地域別シェア、意思決定履歴は正本として存在しなかった。

## 現在の競合オファー式
`js/market.js` の `competitorOffers()` は `businessID` と `areaID` で `state.competitors` を抽出し、ラーメンは参照価格 920 円、対象外業種はマスター価格を基準にした。戦略は低価格型、品質型、ブランド型、利便性型、バランス型へ変換され、価格倍率、品質加算、ブランド加算、利便性加算を静的に適用していた。

## 市場計算への接続点
`calculateMarkets()` が Phase 1A 対象店舗を市場別に束ね、`calculateMarket()` がプレイヤー店舗オファーと競合オファーを同じ `utility()` と `softShares()` に投入する。非購入選択肢も同じ shares に含まれる。

## 現在の市場シェア処理
プレイヤー店舗はセグメント別 share を需要へ掛け、能力制約後に売上と市場シェアを保存していた。競合は従来 `segments[].shares` と `competitors` 表示用オファーには残るが、売上・利益・能力制約後の実績は保存していなかった。

## 現在の競合イベント・週次更新
`updateCompetitors()` と買収関連イベントは存在するが、Phase 1A の標準ラーメン市場オファーを週次に更新する詳細 AI ではなかった。株式市場・買収イベントの `competitorOwnedRatio` は企業買収圧力であり、ラーメン競合の財務とは独立している。

## 未使用フィールドと既存乱数
静的競合の `ownedPlayerShares` は Phase 5A の市場 AI には使わない。既存の週次処理は多数の `Math.random()` / `rand()` を株価、マクロ、既存事業売上、子会社等で使うため、Phase 5A は `competitor.js` 内で乱数を使わず、既存乱数呼出順を増やさない設計にする。

## 今回置き換える範囲
`businessID === 'ramen'` の競合オファーだけを `competitorStates[].marketPresence` から作る。競合市場結果、簡易財務、価格・広告・品質・能力・撤退・借入・再建の意思決定もラーメン競合だけに適用する。

## 今回維持する範囲
既存 `competitors` 配列、対象外業種の `competitorOffers()`、対象外業種の旧売上式、株価、株価履歴、VC/M&A/子会社、プレイヤー財務・供給・人材の正本は維持する。

## 対象業種 / 対象外業種
対象業種はコード上の実 ID `ramen`。名前の部分一致は使わない。`cafe`、`conveni` 等の対象外業種は従来の静的競合式を維持する。

## 設計上の判断
競合店舗は個別店舗を生成せず、市場別集約プレゼンスを `competitorStates[].marketPresence` に保存する。静的戦略マスターは `competitor.js` の定数で保持し、セーブには `strategyID` だけを保存する。
