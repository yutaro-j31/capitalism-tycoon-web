# マップ Phase 1 — Canvas + sprite renderer 基盤

方式検証用の vertical slice。**建物のvisualをコードで描かない**ことを前提に、
外部で制作した sprite が届いたらそのまま差し込める Canvas renderer 基盤を用意した。

本番の `index.html` からは読み込まれない。`js/` `css/` `index.html` への差分は **0**。
ゲームロジック・不動産・会計・セーブ・simulation RNG には触れていない。

## 方針（今回の中核）

建物のvisual source of truth は `assets/map-sprites/<set>/` のローカル画像。
renderer は **配置・奥行き順・blit** だけを担当する。

- procedural SVG building / Canvas rect のビル / 立方体の積み上げ / window grid の大量描画は **禁止**
- sprite 未着のプロットは **開発用プレースホルダ**（破線の区画枠 + asset ID）を描く。
  「それなりの街に見える仮ビル」は作らない
- `tests/map-canvas-foundation-test.js` が
  `drawBuilding` / `facade` / `windowGrid` 等のヘルパー混入を静的に拒否する

## レイヤー構成

| Layer | 内容 | DOM |
|---|---|---|
| A | terrain / 区画 / 道路・縁石・センターライン / 公園 / 水面 / **building sprite blit** | canvas 1枚 |
| B | 自社店舗・出店候補・オフィス・売買可能物件・選択リング | ピンのみ |
| C | prefecture / filter / legend / 選択物件カード（D UI v2） | HUD |

## ファイル

| ファイル | 役割 |
|---|---|
| `prototypes/map-canvas-renderer.js` | renderer基盤（本番bootには載せない） |
| `assets/map-sprites/phase1/sprites.json` | sprite manifest（15枚を宣言） |
| `map-phase1-prototype.html` | 東京ミニ地区の検証ページ |
| `tests/map-canvas-foundation-test.js` | 契約テスト（A〜H） |

## manifest

```json
{
  "id": "office-glass-tower-01",
  "file": "office-glass-tower.png",
  "category": "office",
  "zone": ["cbd"],
  "footprint": { "w": 1, "h": 1 },
  "anchor": { "x": 0.5, "y": 0.92 },
  "scaleClass": "xl",
  "grade": ["premium", "prestige"],
  "weight": 22
}
```

`anchor` は画像内の接地点の割合。`validateManifest()` は不正行のみ落として
残りを活かす（1行の不備でマップ全体を落とさない）。remote URL・`..`・絶対パスは拒否。

## 決定論

`selectMapSprite({ prefID, zoneType, useType, tileX, tileY, stableId, grade })` は純関数。
FNV-1a ハッシュを重み付きテーブルへ通すだけで、**RNGは一切消費しない**。
同じ県・同じ区画なら再読み込みしても必ず同じ asset が選ばれる。

## Canvas cache

city は `prefID / レイアウト / view box / dpr / 読込済みasset数` をキーにした
オフスクリーンcanvasへ描き、以後は blit するだけ。
**選択中マーカーはキーに入っていない**ので、ピンを押しても都市は再構築されない
（実測: 選択更新 1.3ms、`cacheMisses` は 1 のまま）。

## 実測（Chromium。iPhoneはWebKitがローカル環境に無いため 390×844 / DPR3 で相当条件）

| 指標 | desktop 1200px | iPhone 390px | 現行map |
|---|---|---|---|
| map全体 DOM node | 143 | 143 | 1,225 |
| overlay DOM node | 30 | 30 | — |
| 背景都市の DOM node | **1**（canvas） | 1 | SVG 394 |
| sprite preload | 49.9ms | 36.5ms | — |
| 初回 city 構築 | 36.3ms | 15.6ms | — |
| cache命中の再描画 | **0.10ms** | **0.05ms** | 3.4ms |
| 選択変更の更新 | **1.3ms** | 1.3ms | 都市ごと再生成 |
| city再構築回数（選択後） | 1（増えない） | 1 | — |
| devicePixelRatio | 2 (raw 2) | **2 (raw 3)** | — |
| 横スクロール溢れ | 0 | 0 | 0 |
| 最小タップ領域 | 44px | 44px | — |

前回の procedural 案は SVG 約6,100ノードだった。今回は背景都市が canvas 1枚に収まり、
**建物を増やしてもDOMは増えない**構造になっている。

## sprite が届いたら

1. `assets/map-sprites/phase1/` に manifest の `file` 名でPNGを置く（コード変更不要）
2. 実画像に合わせて `anchor` と `footprint` だけ調整
3. `scaleClass` 別の描画サイズを実画像で確認
4. プレースホルダが消えることをページの「読み込み状況」で確認

1枚欠けても白画面にはならず、そのプロットだけプレースホルダになる。

## 実sprite統合（2026-09-02）

外部制作の日中版sprite15種（`assets/map-sprites/phase1/sprites/`、計2.4MB）を統合した。
`source_sprite_sheet.png`（2.4MB）と `asset_preview.jpg`（200KB）はランタイムに不要な
参考資料のため、リポジトリには含めていない（README側も「source/reference限定、
ランタイムは個別ファイルを使う」と明記済み）。

manifestは届いたものをほぼそのまま採用したが、`zone`ではなく`zones`キーを使う
届け先の命名規約に合わせて `validateManifest()` 側で両対応にした
（`zones`を`zone`へ正規化、以後のコードは`zone`だけを見る）。`tile`ブロックの
宣言も必須ではなくした（renderer側のタイル寸法をasset側が知る必要はないため）。

**統合中に見つけて直したバグ2件**:
1. **footprint>1の建物が隣接区画へ盛大にはみ出す** — `blitSprites`が常に
   起点タイル（footprintの「奥」の角）を描画アンカーにしていたのに対し、
   render幅は`footprint.w * tile.w * widthFactor`で計算するため、幅2区画・
   高さ330px級の住宅タワーが公園を丸ごと隠す事故が発生した。区画予約
   （`buildDistrict`内、決定論的・footprint分だけ+tileX/+tileY方向へ隣接区画を
   確保）を追加し、公園ゾーンを道路で四方囲みにするレイアウト修正と合わせて解消。
2. **同じzoneを共有するピン種別が隣接区画に乗って片方タップ不能** —
   store/tenantは両方`commercial`ゾーンから独立に抽選していたため、隣接
   タイルに決定論的に着地することがあり、390px幅のiPhoneでは44pxヒット
   ターゲットが重なって片方が押せなくなっていた（Playwrightの実クリックで
   検出）。`overlayAnchors`に`MIN_PIN_TILE_SPACING`（タイル距離3以上）を
   導入し、既に配置済みのピンから離れた候補を優先するよう修正。

**Tokyo mini districtレイアウトの調整**（12→12列×15行、3回チューニング）:
- 1回目: CBDと住宅の間に1列の道路バッファを追加 → footprint2の建物には不十分で
  公園が完全に隠れたまま
- 2回目: 公園を専用の1行（四方を道路で囲む）に分離 → 可視化はしたが薄い帯で目立たず
- 3回目: 公園を2行に拡張、CBD/商業の行数を3行に戻して密度を回復 → 公園・CBD高層感・
  商業のネオン感・住宅のバルコニー/プール・物流倉庫・ランドマークがすべて
  1画面内で判別可能な状態に到達

## 実測（実sprite・Chromium。desktop 1200px / iPhone相当 390px・DPR3）

| 指標 | desktop | iPhone |
|---|---|---|
| map全体 DOM node | 142 | 142 |
| overlay DOM node | 29 | 29 |
| sprite preload | 75.5ms | 62.0ms |
| 初回 city 構築 | 71.0ms | 40.5ms |
| cache命中の再描画 | 0.19ms | 0.06ms |
| sprite blit / placeholder | 29 / 0 | 29 / 0 |
| 横スクロール溢れ | 0 | 0 |
| 最小タップ領域 | 44px | 44px |

既存のproperty selection（5ピン種別：store/tenant/office/realestate/landmark）を
すべてクリックし、カードが正しい街区・sprite ID・所有状態を表示すること、
フィルタが用途で正しく絞り込むことを desktop / iPhone 相当の両方で確認した。

## visual composition改善（2026-09-02）

15 sprite構成のまま、Tokyo daytime visual targetへ寄せる密度・地割り・陰影の
調整を行った。procedural buildingへは戻していない（sprite自体は無変更）。

**選択・密度**:
- `selectMapSprite()`に`excludeIds`を追加し、`buildDistrict()`が
  `nearbySpriteIds(byKey, tileX, tileY, NO_REPEAT_RADIUS=2)`で直近2タイル
  以内に使用済みのsprite idを渡すようにした。除外後も候補が残る場合のみ
  除外を適用する（Math.random不使用、決定論を維持）。
- `OPEN_RATE`（空き区画率）を`{cbd:8,commercial:10,residential:14,industrial:18}`
  から`{cbd:4,commercial:5,residential:6,industrial:8}`へ引き下げ、
  区画内の密度を上げた。
- CBD行を4列→6列、南側の商業行を4列→6列へ拡張し、住宅帯との間の道路を
  6タイル→4タイルへ短縮（公園の南北を隔てる道路帯・公園そのものの2行構成は
  変更していない）。footprint>1の建物が隣接ゾーンへ視覚的にはみ出さないよう、
  スクリーンショットで境界を確認してから採用した。

**道路・地面**:
- `classifyRoads()`を追加し、行・列いずれかが全域道路のタイルを
  `roadPrimary`（主要道路）、それ以外を`secondary`として分類する
  （純粋に配置データから決まる幾何判定で、乱数は使わない）。
- 主要道路のみセンターラインの破線を描画し、副道路は
  `SECONDARY_ROAD_WIDTH=0.52`で幅を狭めて再描画するようにした。
- `paintTerrain()`に、建築可能タイルの道路側の縁へ`SIDEWALK`色の
  インセットストロークを追加し、広場タイル（`cell.open`）には薄い
  斜線パターンの舗装を追加した。

**scale variation・landmark・陰影**:
- `cell.scaleVariant`（`SCALE_VARIANTS=[0.94,1.0,1.06]`、タイル座標の
  ハッシュで決定論的に選択）を`spriteRenderSize()`の幅計算へ適用し、
  同一spriteの反復でも僅かな大小差が出るようにした（アスペクト比は維持、
  歪ませない）。
- `LANDMARK_SCALE_BONUS=1.3`を追加し、`category==='landmark'`のsprite
  （Tokyo Tower）だけ通常の建物より1.3倍大きく描画する。
- `paintContactShadow()`を追加し、`blitSprites()`が各spriteの描画直前に
  半透明の楕円（`SHADOW_FILL='rgba(20,24,20,.22)'`）を接地点へ描くように
  した。blur/filterは使わず、`fill()`1回のみの軽量な実装。

**マーカー・HUD（`map-phase1-prototype.html`）**:
- `.pin i`の見た目サイズを13px→10px（選択時19px→15px）へ縮小した。
  `.pin`本体の44×44pxタップ領域は無変更（CITY FIRST / MARKER SECOND を維持）。
- `.hud-top`のフィルターチップを`flex-wrap:wrap`から
  `flex-wrap:nowrap; overflow-x:auto`の横スクロール1行へ変更し、
  iPhone幅でチップが複数行に折り返してマップを覆っていた問題を解消した。
  各チップの44px最小タップ領域は維持。

`tests/map-canvas-foundation-test.js`へ、上記の決定論性・道路分類・
scale variant・landmark拡大・contact shadow呼び出し・マーカー縮小・
横スクロールチップを検証するアサーションを追加した（カテゴリH以降、
「I: density, roads and shadow refinements」として区分）。

## 実測（visual composition改善後・Chromium。desktop 900px / iPhone相当 390px・DPR3）

| 指標 | desktop | iPhone |
|---|---|---|
| map全体 DOM node | 142 | 142 |
| overlay DOM node | 29 | 29 |
| sprite preload | 83.4ms | 66.9ms |
| 初回 city 構築 | 45.5ms | 52.4ms |
| cache命中の再描画 | 0.23ms | 0.07ms |
| 選択変更の更新 | 1.60ms | 1.50ms |
| sprite blit / placeholder | 35 / 0 | 35 / 0 |
| city再構築回数（選択後） | 1（増えない） | 1 |

sprite blit数が29→35へ増えた（密度増）一方、DOM nodeは142/29のまま変化していない
（背景都市はCanvas 1枚のままで、密度を上げてもDOMは増えない）。

負のテスト3パターンで検証済み: ① `LANDMARK_SCALE_BONUS`を1.0に戻すと
landmarkサイズのアサーションが赤くなる、② `blitSprites`から
`paintContactShadow`の呼び出しを外すと関数呼び出しのアサーションが赤くなる
（ヘルパーの存在だけでなく実際の呼び出しを検証しているため定義だけ残しても
検出できる）、③ `.pin i`のwidthを13pxへ戻すとマーカーサイズのアサーションが
赤くなる。

## Phase 2 以降（このPRではやらない）

- 東京全域 → 他県への拡張、40〜60 sprite
- 本番 map 画面への統合（`js/d-ui-shell.js` の `renderMapWorkspace()` 置換）
  ※ external enhancer は 79/79 で満杯のため、既存 `'d-ui-shell'` フック内で行う
- atlas 化、`footprint` が 1×1 を超える大型 sprite
- day/night 切替、天候、車両・人物のアニメーション
