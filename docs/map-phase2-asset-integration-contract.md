# マップ Phase 2 — asset integration contract（未統合・プレビュー専用）

**現在地**: `prototypes/map-world-preview.js` / `map-phase2-preview.html` は
まだ `prototypes/map-canvas-renderer.js` へ正式統合されていない。本番の
`index.html` / `js/` / `css/` には一切触れていない。この文書自体もプレビュー
段階の設計メモであり、正式統合時に `docs/map-phase1-canvas-foundation.md` の
後継としてPhase 2の一次資料になる想定。

**今回の目的**: pannable world（Canvas + local sprite + DOM overlay、street-grid
→ block template → building placement という順序）を土台として固定し、
今後20〜50種類の背景建物・小物・open-space系assetを**rendererを作り直さずに**
段階的に追加できるようにする。renderer本体（isometric変換・camera・culling・
道路3階層・footprint予約・contact shadow）は変更していない。変更したのは
「どのsprite IDを選ぶか」の一段だけ。

## ベースライン化した現状の構成（変更していない部分）

- Canvas 2D + local sprite + DOM overlay、procedural building生成なし
- street grid（`STREET_PERIOD`）→ block template（`BLOCK_TEMPLATES`）→
  landmark gradient → footprint予約、という生成順序
- 3階層道路（arterial/secondary/local）、camera clamp（tile座標ベース、
  viewportサイズから自動算出）、culling、pan中のcity再構築なし
- 決定論的hash（`hash()`）のみを乱数源とする。Math.random不使用
- hero/filler（scale・alpha を落とした背景建物）の区別

## 1. Manifest format（`assets/map-sprites/phase2/sprites.json`）

Phase 1の`sprites.json`とは**別ファイル**。Phase 1本番マニフェストは変更していない。

```json
{
  "version": 1,
  "phase": "map-sprite-phase2-preview",
  "tile": { "w": 64, "h": 32 },
  "sprites": [
    {
      "id": "office_glass_tower",
      "file": "sprites/01_office_glass_tower.png",
      "category": "office.hero",
      "footprintType": "1x1",
      "footprint": { "w": 1, "h": 1 },
      "anchor": { "x": 0.5, "y": 0.96 },
      "scaleClass": "xl",
      "tier": "hero",
      "districtTags": ["cbd"],
      "spawnWeight": 20,
      "drawLayer": "building",
      "daytime": true,
      "prototype": true,
      "placeholder": true,
      "notes": "Phase 1由来の実asset。office.hero枠の暫定割当"
    }
  ]
}
```

| field | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | string | ✓ | manifest内で一意 |
| `file` | string | ✓ | `assets/map-sprites/phase2/`からの相対パス。remote URL・`..`・絶対パスは拒否（Phase 1の`validateManifest`と同じ安全側ルールを踏襲） |
| `category` | string | ✓ | 下記2節のtaxonomy leaf文字列のいずれか1つ（dot記法） |
| `footprintType` | `'1x1'\|'1x2'\|'2x1'\|'2x2'` | ✓ | `footprint`と併記（型ヒント＋検証用）。`footprint`が実データ、`footprintType`は矛盾していないかの検証に使う |
| `footprint` | `{w,h}` | ✓ | 既存のfootprint予約ロジックがそのまま使う |
| `anchor` | `{x,y}` (0..1) | ✓ | 画像内の接地点。Phase 1と同じ意味 |
| `scaleClass` | `xs\|s\|m\|l\|xl\|landmark` | — | サイズヒント（現状は描画に未使用、将来のscale調整用に保持） |
| `tier` | `'hero'\|'filler'\|'background'` | ✓ | 描画時の主張度合い。hero=フル表示、filler=`FILLER_SCALE/FILLER_ALPHA`適用、background=filler同様（将来、さらに控えめな係数を分離する余地を残すため別値にしている） |
| `districtTags` | string[] | ✓ | どのdistrict（`cbd`/`commercial`/`residential`/`premiumResidential`/`logistics`/`landmark`）で出現候補になるか |
| `spawnWeight` | number > 0 | ✓ | 同一category×district内での相対重み（既存`selectMapSprite`の重み付き抽選と同じ考え方） |
| `drawLayer` | `'ground'\|'building'\|'prop'` | ✓ | 将来propsが増えたときの描画順ヒント。現状`building`のみ使用 |
| `propSlots` | `{dx,dy,anchor}[]` | — | 建物に付随する小物の取り付け点（未使用、将来用に予約） |
| `daytime` / `prototype` | bool | — | Phase 1のフィールドを踏襲 |
| `placeholder` | bool | — | trueなら「本来の完成度のassetが届くまでの暫定割当」であることを明示 |
| `notes` | string | — | 人間向けメモ |

**検証ルール**（`validateCategoryManifest()`、Phase 1の`validateManifest`と同じ「1行の不備で
manifest全体を落とさない」方針を踏襲）:
- `id`重複拒否、`file`のpath escape拒否（`..`・絶対パス・remote URL）
- `category`がtaxonomy一覧に存在しない場合は行を無効化
- `footprintType`と`footprint.w/h`が矛盾する場合は行を無効化（例: `1x1`なのに`footprint:{w:2,h:2}`）
- `tier`が3値以外、`districtTags`が空配列、`spawnWeight<=0`は無効化

## 2. Category taxonomy

```
office.hero / office.mid / office.small
commercial.hero / commercial.mid / commercial.small
residential.premium / residential.mid / residential.low
townhouse
logistics
civic
landmark
openSpace.park / openSpace.plaza / openSpace.parking / openSpace.service
props
```

`openSpace.*`と`props`は**sprite manifestの対象外**（Canvas primitiveで描画する既存の
`openTypeFor()`/`paintOpenLots()`をそのまま使う）。対応関係:

| taxonomy | 既存の実装 |
|---|---|
| `openSpace.park` | `openType: 'pocketPark'` / `'treeStrip'`（`GREEN_TYPES`） |
| `openSpace.plaza` | `openType: 'plaza'` / `'forecourt'`（`HARDSCAPE_TYPES`） |
| `openSpace.parking` | `openType: 'parking'`（`INDUSTRIAL_OPEN_TYPES`） |
| `openSpace.service` | `openType: 'loadingBay'`（`INDUSTRIAL_OPEN_TYPES`） |
| `props` | 未実装（3節参照）。将来、建物sprite自体に`propSlots`で付随させるか、
  低コストなCanvas primitive（駐輪ラック程度）で先行させるか要検討 |

## 3. Placeholder fallback chain

カテゴリごとに実assetが1件もない場合、以下の順で代替カテゴリを試す
（`CATEGORY_FALLBACK`、決定論的・確率操作なし）。**チェーンを辿っても
0件のカテゴリは建物を諦めてopen spaceへ倒す**（開発用プレースホルダ枠を
無理に埋めない。Phase 1の「sprite未着=プレースホルダ描画」方針と対称で、
Phase 2では「候補ゼロ=そのプロットをopen space化」という穏当な縮退にした）。

```js
const CATEGORY_FALLBACK = {
  'office.small':  ['office.mid', 'office.hero'],
  'office.mid':    ['office.hero'],
  'office.hero':   [],
  'commercial.small': ['commercial.mid', 'commercial.hero'],
  'commercial.mid':   ['commercial.small', 'commercial.hero'],
  'commercial.hero':  [],
  'residential.low':     ['residential.mid', 'townhouse'],
  'residential.mid':     ['residential.premium', 'townhouse'],
  'residential.premium': [],
  'townhouse':  ['residential.low', 'residential.mid'],
  'logistics':  [],
  'civic':      [],
  'landmark':   []
};
```

現行15 spriteでの実際のfallback発火状況（4節参照）: `office.small`は
`office.mid`が無いため`office.hero`まで落ちる。`residential.low`は
`residential.mid`にヒットする。`civic`は候補が一切無いため常にopen space化
（＝現状civic建物は出現しない。open spaceとしての`civic edge`は
`openSpace.plaza`で代替済み）。

## 4. 現行15 spriteのplaceholder mapping

**2026-09revision（重複排除）**: 当初はPNGを`assets/map-sprites/phase2/sprites/`へ
複製していたが、同一binaryを2箇所で管理すると将来どちらか片方だけ更新されて
乖離するリスクがあるため廃止した。`assets/map-sprites/phase1/`を**canonical
source**として維持し、Phase 2側は複製を持たない。

- `assets/map-sprites/phase2/sprites.json`（manifest本体、`category`/
  `districtTags`/`spawnWeight`等のメタデータのみ）は従来通りPhase 2側に置く
- 実画像は`assets/map-sprites/phase1/`から読む。`map-phase2-preview.html`が
  manifest取得用の`ASSET_BASE`（`./assets/map-sprites/phase2`）と画像取得用の
  `IMAGE_BASE`（`./assets/map-sprites/phase1`）を分離し、
  `MW.loadSprites(index2, IMAGE_BASE)`で読み込む
- manifestの`file`値自体はPhase 1側と同じ`sprites/01_office_glass_tower.png`
  形式のまま（`..`によるpath escapeは一切使わない。1節の検証ルールで
  `..`・絶対パス・remote URLは引き続き拒否される。base directoryの選択は
  manifestデータではなくページ側の設定で行っている）
- `assets/map-sprites/phase2/sprites/`ディレクトリ自体を作らない
  （存在しないことを`contract-verify`で確認、8節参照）

Phase 1側の`assets/map-sprites/phase1/`・manifest・
`tests/map-canvas-foundation-test.js`は無変更。将来、実asset（P0〜P2の
不足リスト）が届いた際はPhase 2固有の新規PNGとして
`assets/map-sprites/phase2/sprites/`へ追加し、Phase 1由来のplaceholder行
だけがcanonical source参照のまま残る想定。

| category | 割当sprite | footprint | tier | 備考 |
|---|---|---|---|---|
| `office.hero` | office_glass_tower, office_setback_tower, office_podium_hq, office_prestige_hq | 1x1×2, 2x2×2 | hero | 5種中4種がhero級 |
| `office.mid` | office_wide_midrise | 2x2 | filler | office.smallの不在を部分的に緩和 |
| `office.small` | **なし** | — | — | fallback: mid→hero |
| `commercial.hero` | commercial_shopping_complex, commercial_department_store | 2x2×2 | hero | |
| `commercial.mid` | commercial_mixed_use, commercial_nightlife | 1x1×2 | filler | |
| `commercial.small` | commercial_billboard | 1x1 | filler | |
| `residential.premium` | residential_premium | 2x2 | hero | |
| `residential.mid` | residential_midrise | 1x1 | filler | `districtTags`に`commercial`も付与（commercial districtのX-infillが借用するため。付与し忘れて一度commercial occupancyが62.5%→43.8%へ落ちる回帰を作り、検証で発見・修正した） |
| `residential.low` | **なし** | — | — | fallback: mid |
| `townhouse` | residential_townhouses | 2x2 | filler | 同様に`commercial`も`districtTags`に付与 |
| `logistics` | industrial_warehouse | 2x2 | hero/filler both | industrial地区のH/S両方を兼務 |
| `civic` | **なし** | — | — | 建物としては非出現。周辺はopenSpace.plazaで代替 |
| `landmark` | landmark_tokyo_tower | 1x1 | hero | |

## 5. District placement rules

block template（`BLOCK_TEMPLATES`、変更なし）のH/S/Xロールに、
district別のcategory候補を割り当てる`ROLE_CATEGORY`テーブルを新設した
（roleの空間配置ロジックそのものは無変更、「roleが何のsprite categoryを
要求するか」だけを差し替えた）。

| district | H → | S → | X → |
|---|---|---|---|
| cbd | `office.hero` | `office.mid` / `office.small`（fallback込み） | `commercial.small` / `commercial.mid` |
| commercial | `commercial.hero` | `commercial.mid` / `commercial.small` | `residential.low` / `townhouse` |
| residential | `residential.mid` | `residential.low` / `townhouse` | — |
| premiumResidential | `residential.premium` | `residential.mid` / `townhouse` | — |
| logistics | `logistics` | `logistics` | — |
| landmark | `landmark`（固定1棟） | — | — |

occupancy（H+S+Xの合計が街区に占める割合）はこれまでの階層をそのまま維持:
CBD 60-70% / commercial 55-65% / residential 40-52% / premium 30-42% /
logistics 25-38%。district内のhero比率はblock templateのH枠数（各districtに
つき1）でそのまま制御されるため、今回のcategory化でも変わらない。

## 6. 不足asset優先リスト（Coffee Inc 2 inspiredな都市俯瞰へ寄せるため）

**最優先（背景建物、20種前後）**:
1. `office.small` ×3〜4（1x1、低層〜中層オフィス。現状ゼロ、fallbackで
   heroへ2段跳びしているのが一番の穴）
2. `commercial.small` ×3〜4（1x1、個人商店・小型店舗。既存1種のみ）
3. `residential.low` ×3〜4（1x1、低層集合住宅・アパート。現状ゼロ）
4. `townhouse`系のバリエーション ×2〜3（既存1種のみ、隣棟が同じ絵に見えやすい）
5. `commercial.mid` 追加 ×2（既存2種のみ）
6. `office.mid` 追加 ×2（既存1種のみ）

**openSpace / parking / park / plaza系**: 現状はCanvas primitiveのみで
sprite不要。ただし「駐輪ラック」「街路灯」「ベンチ」程度の軽量propが
あると`openSpace.plaza`/`openSpace.park`の説得力が上がる（7節参照）。

**civic**: 交番・郵便局・小規模公共施設など1x1が1〜2種あるとlandmark
周辺（`landmarkCivic`）の「都市に埋め込まれた」感がさらに増す。現状
landmark周辺はopenSpace.plazaのみで代替している。

**1x1 / 2x2バランス**: 現行15種は2x2が7種・1x1が7種・landmarkが1種と
footprint自体は均衡している。ただし**1x1側の大半がすでにhero/mid級**で、
「小さくて控えめな1x1」が不足している。今回の不足リスト（1〜4番）は
すべて1x1想定。2x2の追加は当面不要。

## 7. props（今回は実装しない、設計だけ予約）

`propSlots`をmanifestスキーマに用意したが、今回は空実装。将来案:
(a) 建物sprite自体に`propSlots: [{dx,dy,anchor}]`を持たせ、そこへ小道具
sprite（自転車・ゴミ収集・看板灯）を追加でblitする、(b) 低コストな
Canvas primitiveとして`openSpace.plaza`/`park`にベンチ・街灯を追加する
（`paintOpenLots()`の拡張で足りる）。(b)の方が新規asset不要で着手しやすい。

## 8. 変更したファイル（foundation commit時点）

- `docs/map-phase2-asset-integration-contract.md`（新規、本ファイル）
- `assets/map-sprites/phase2/sprites.json`（新規、category taxonomy manifest。
  画像本体は持たない。`assets/map-sprites/phase1/`をcanonical sourceとして参照）
- `prototypes/map-world-preview.js`（`validateCategoryManifest`/
  `indexCategoryManifest`/`selectSpriteForCategory`/`ROLE_CATEGORY`/
  `CATEGORY_FALLBACK`/`CATEGORY_TAXONOMY`を追加。`buildWorldDistrict`のsprite
  選択部分だけ差し替え。camera/road/culling/landmark gradient/block templateは無変更）
- `map-phase2-preview.html`（`ASSET_BASE`＝manifest取得元と`IMAGE_BASE`＝画像取得元
  を分離し、画像はPhase 1のディレクトリから読む）

`prototypes/map-canvas-renderer.js`（Phase 1本体）・`assets/map-sprites/phase1/`・
`index.html`・`js/`・`css/`は一切変更していない。`assets/map-sprites/phase2/sprites/`
ディレクトリ（PNGの複製）は作らない。

## 9. Contract checklist（コミット前に個別検証済み）

`node`スクリプト（13項目のassertion、スクラッチ環境で実行、`tests/`未登録）で
以下をすべて確認した:

| # | 項目 | 結果 |
|---|---|---|
| 1 | sprite ID重複をreject | ✓ 重複行のみ落とし、他14行は維持 |
| 2 | unknown categoryをrejectまたは安全に無視 | ✓ 該当行のみ落とし、manifest全体は落とさない |
| 3 | missing assetでwhite screenにならない | ✓ 画像0件でも`blitWorldSprites`は例外を投げず、全プロットがplaceholder経路へ |
| 4 | fallback chain循環が起きない | ✓ `CATEGORY_FALLBACK`はDFS+on-stack判定で構造的にDAGと確認。加えて`selectSpriteForCategory`自体がfallbackを1段しか展開しない実装なので、仮に表が循環していても実行時ハングは起きない |
| 5 | manifest entry順が変わっても決定論が壊れない | ✓ `sprites`配列を逆順にしても district出力が完全一致 |
| 6 | relative pathが想定asset root外へ出られない | ✓ `..`・絶対パス・`https://`・`C:\`いずれも拒否。実manifestの15行全てplain filename |
| 7 | weighted selectionもpure deterministic | ✓ 同一入力を20回呼んでも同一出力。かつtile空間を掃引すると複数sprite間で分散 |
| 8 | Math.random / simulation RNG不使用 | ✓ renderer/pageソースをgrepで確認（`assets/.../sprites.json`内の言及はコメント文のみ） |
| 9 | SAVE_KEY / saveVersion不変 | ✓ renderer/pageとも該当文字列を一切含まない |

副次確認として「`assets/map-sprites/phase2/sprites/`が存在しないこと」
「manifestの各`file`がPhase 1側に実在すること」も同スクリプトで確認した
（3節「同一binaryの二重管理を避ける」の担保）。

## 10. テスト方針（正式統合時）

このプレビュー自体はまだ`tests/`に未登録。上記9節の13 assertionを、
正式統合（`prototypes/map-canvas-renderer.js`への統合・PR化）の際に
`tests/map-canvas-foundation-test.js`と同水準の契約テストへ昇格させる。
あわせて以下も再確認する:
- district別occupancy・hero/filler比率の実測（5節の表と一致）
- 5種のピン（store/tenant/office/realestate/landmark）のクリック選択（Playwright）
- パフォーマンス（DOM node数・city再構築回数・pan frame time）が
  Phase 2A時点の実測から悪化していないこと

## 11. P0 pass（2026-09、背景建物20種の実asset追加）

6節の不足リスト最優先3項目（`office.small` / `commercial.small` /
`residential.low`）を実装した。ChatGPT側で生成されたasset packを監査し、
metadataは全て本contractのsource of truth（`ROLE_CATEGORY` /
`FOOTPRINT_BY_TYPE` / `CATEGORY_TAXONOMY`）へ合わせ込んだ
（`anchorHint`/`footprintType`はpack付属の推定値をそのまま使わず、
実測・再計算し直した）。

- `office.small` 6種、`commercial.small` 8種、`residential.low` 6種、
  計20 sprite追加（manifest行数は15→35）
- footprintTypeは全て`1x1`に統一（6節「今回の不足リストはすべて1x1想定」
  の通り。pack付属の`footprint: "medium"`ラベルは画像の見た目サイズの
  分類であり、タイル占有数とは無関係だったため上書きした）
- `anchor`はpack付属の`anchorHint`（式による近似値）を採用せず、各PNGの
  alphaチャンネルの実際の接地行/列から測定し直した（Pillowで最下段の
  非透明ピクセルを検出し、その行のalpha加重x中心を接地点とした）
- `districtTags`はROLE_CATEGORYから逆算: `office.small`→`['cbd']`、
  `commercial.small`→`['cbd','commercial']`、
  `residential.low`→`['commercial','residential']`
  （pack付属の`office`/`mixedUse`/`roadsideRetail`等の独自タグは
  本contractのdistrict語彙と一致しないため使わなかった）
- `spawnWeight`は20種とも一律10（既存hero系の16〜22より低く設定。
  今回はspawn比率のチューニングをスコープ外とし、次回Visual
  Calibration passで見直す前提）
- `tier`は`background`（`filler`と描画上は同じ扱いだが、この20種は
  意図的に「ありふれた背景建物」であることを表す語彙として選んだ）

**実asset本体の配置場所**: 4節で説明した通りPhase 1の15枚は
`assets/map-sprites/phase1/`をcanonical sourceとして参照するだけだが、
今回のP0の20枚は正真正銘の新規artのため
`assets/map-sprites/phase2/sprites/p0/{office_small,commercial_small,
residential_low}/`へ実体を置いた（Phase 1側との重複はSHA256で無しを確認）。

**`map-phase2-preview.html`の対応（renderer本体は無変更）**: 従来の
`boot()`は`MW.loadSprites(index, IMAGE_BASE)`という単一呼び出しで
manifest全行をPhase 1のディレクトリから読んでいた（15行全てが
`placeholder:true`だったため成立していた）。P0で`placeholder`のない
実体行が初めて登場したため、`sprite.placeholder`の有無でmanifestを
2分割し、`placeholder:true`の行は従来通り`IMAGE_BASE`（Phase 1）から、
`placeholder`なしの行は`ASSET_BASE`（Phase 2自身のディレクトリ）から
読むよう`boot()`内の画像ロード呼び出しだけを2回呼び出し+マージへ
変更した。`prototypes/map-canvas-renderer.js`の`loadSprites()`自体・
`selectSpriteForCategory`/`validateCategoryManifest`は無変更。

**効果の実測**（`office.small`/`commercial.small`/`residential.low`の
foundation時点の状態と比較、tokyo/32×28タイル）:
- `office.small`: 0タイル→48タイル・distinct 6種（以前は全て
  office.mid/hero へfallback）
- `commercial.small`: 1sprite（`commercial_billboard`のみ）→9種、
  72タイルに分散
- `residential.low`: 0タイル→82タイル・distinct 6種（以前は全て
  residential.mid/townhouseへfallback）
- district別occupancy（cbd 62.5% / commercial 62.5% / residential
  44.1% / premium 30.0% / industrial 26.7%）はP0追加前後で完全一致
  （spawnWeight・block template・fallback chainのアルゴリズムは
  一切変更していないため）
- 「普通のbackground building」対「hero」の出現タイル数比は
  約202:46（≒4.4:1）で、6節に掲げた「ありふれた1x1の不足」を
  数値上も解消した

## 12. 今後のP1/P2・Visual Calibration

- P1（civic 3〜4種、office.mid追加、residential.mid追加）・P2
  （openSpace系props）は本passの対象外。次のasset追加PRで扱う
- 今回`spawnWeight`は一律10に固定した（意図的にチューニングしていない）。
  hero/filler/background間の出現比率を作品としてどう調整するかは
  別途「Visual Calibration PR」として切り出す想定
- `civic`カテゴリは依然として実asset0件のまま（6節参照）
