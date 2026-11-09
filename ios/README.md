# iOSアプリ化（Swift Playgrounds用パッケージ）

ブラウザ版のゲームを、そのままの内容でiPhone/iPadアプリとして動かすための最小の入れ物です。
ゲーム本体（`index.html`・`js/`・`css/`・`assets/`・`prototypes/`）には手を加えず、アプリの中に同梱して
`WKWebView` で表示します。通信は不要で、オフラインで動きます。

## 構成

| ファイル | 役割 |
| --- | --- |
| `swiftpm/Package.swift` | Swift Playgroundsのアプリ定義。`web/` を階層ごと同梱する |
| `swiftpm/TycoonApp.swift` | アプリの入口。画面全体にゲームを表示する |
| `swiftpm/GameWebView.swift` | `WKWebView` 本体。確認ダイアログ、ファイル書き出し、外部リンクを扱う |
| `swiftpm/BundleSchemeHandler.swift` | 同梱したゲームを `tycoon://game/` という固定の場所から配信する |
| `../scripts/build-ios-swiftpm.js` | 上の4ファイルとゲーム本体を1つのパッケージに組み立てる |

## パッケージの作り方

```bash
node scripts/build-ios-swiftpm.js dist
```

`dist/CapitalismPocketTycoon.swiftpm/` ができます。これをZIPにしてiPadへ渡し、展開して
Swift Playgroundsで開きます。ゲームが読み込むファイルが1つでも欠けていると、組み立ては失敗します。

## 実機で確認すること

このパッケージはSwiftのコンパイル環境がない場所で書かれており、**実機での動作は未確認**です。
`tests/ios-swiftpm-bundle-test.js` が保証するのは「必要なファイルが全部入っていること」までです。
最初に次の順で確認してください。

1. Swift Playgroundsでビルドが通り、タイトル画面が出る
2. 新規ゲームを始めて1週進められる
3. アプリを完全に終了して開き直しても、続きから始まる（セーブの永続性）
4. 出店マップが表示される（3D表示とスプライトの読み込み）
5. 設定画面からセーブのバックアップを書き出せる（共有シートが出る）
6. 確認が必要な操作で、確認ダイアログが出る
7. ノッチやホームバーに画面が重ならない

## App Storeに出す前に必要なこと

- `Package.swift` の `bundleIdentifier` は仮の値です。Swift Playgroundsのアプリ設定で、
  自分のApple Developerアカウントのチームと正式なIDに置き換えます。
- アプリアイコンは仮のものです。
- バージョン番号（`displayVersion`・`bundleVersion`）を提出のたびに上げます。

## セーブについて

セーブはアプリ内の `tycoon://game` という固定の場所に保存されます。アプリを更新しても場所は
変わらないので、セーブは引き継がれます。ブラウザ版（Safari）のセーブとは別物で、自動では移りません。
移すときは、ブラウザ版でバックアップを書き出し、アプリ版で読み込みます。
