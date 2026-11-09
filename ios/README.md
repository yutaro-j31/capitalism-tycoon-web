# iOSアプリ化

ブラウザ版のゲームを、そのままの内容でiPhone/iPadアプリとして動かすための最小の入れ物です。
ゲーム本体（`index.html`・`js/`・`css/`・`assets/`・`prototypes/`）には手を加えず、アプリの中に同梱して
`WKWebView` で表示します。通信は不要で、オフラインで動きます。

開発者の手元にMacもiPadもない前提なので、ビルドはGitHub Actions上のMacで行います。

## 構成

| ファイル | 役割 |
| --- | --- |
| `App/TycoonApp.swift` | アプリの入口。画面全体にゲームを表示する |
| `App/GameWebView.swift` | `WKWebView` 本体。確認ダイアログ、ファイル書き出し、外部リンクを扱う |
| `App/BundleSchemeHandler.swift` | 同梱したゲームを `tycoon://game/` という固定の場所から配信する |
| `project.yml` | XcodeGen用のプロジェクト定義。Xcodeプロジェクトはビルド時に生成し、コミットしない |
| `../scripts/build-ios-web-bundle.js` | ゲーム本体を `ios/build/web/` に写す。読み込むファイルが欠けていれば失敗する |
| `../tests/ios-web-bundle-test.js` | 同梱の完全性と、アプリ側に必要な機能があることの検査 |
| `../.github/workflows/ios-build.yml` | 上記を実行し、iOSシミュレータで一度起動して最初の画面を画像で残す |

## いま保証していること

`iOS Build` ワークフローが緑なら、次が確認できています。

- Swiftのソースがコンパイルできる
- ゲームのファイルが全部アプリの中に入っている
- シミュレータ上でアプリが起動し、落ちずに動き続ける（最初の画面の画像が成果物に残る）

## まだ保証していないこと

- 実機のiPhoneでの動作（シミュレータは実機ではありません）
- セーブがアプリの再起動後も残ること
- バックアップの書き出し（共有シート）と確認ダイアログの実際の挙動
- 署名とApp Store提出

## App Storeに出すまでに必要なこと

1. Apple Developer Programへの登録
2. App Store Connectでアプリの登録枠を作り、APIキーを発行してリポジトリのSecretsに入れる
3. `project.yml` の `PRODUCT_BUNDLE_IDENTIFIER`（いまは仮の値）を正式なIDに変える
4. アプリアイコンを追加する
5. 署名つきビルドとTestFlight送信のジョブを追加する（別PR）

## セーブについて

セーブはアプリ内の `tycoon://game` という固定の場所に保存されます。アプリを更新しても場所は
変わらないので、セーブは引き継がれます。ブラウザ版（Safari）のセーブとは別物で、自動では移りません。
移すときは、ブラウザ版でバックアップを書き出し、アプリ版で読み込みます。
