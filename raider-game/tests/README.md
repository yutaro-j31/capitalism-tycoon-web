# Atlas Capital のテスト

本体プロジェクト（Capitalism Tycoon Web）のテスト・CIとは独立しています。

```
node raider-game/tests/run.js            # すべて（数分）
node raider-game/tests/run.js --quick    # 縮小版
node raider-game/tests/run.js --update-baseline   # バランス基準値を記録し直す
node raider-game/tests/run.js --make-fixture      # 旧セーブ見本を今の版で作り直す（通常は使わない）
```

Playwright と Chromium が必要です（Claude Code のクラウド環境には導入済み）。

| 種類 | 内容 |
|---|---|
| 決定論 | 同じシードで5年進めた全状態が2回とも一致する |
| 不変条件 | NaN、会社の現金マイナス、発行済株式超の保有、支配判定の不整合、市場シェア合計100%超がない（10年） |
| 旧セーブ | `fixtures/` の見本を読み込み、売上が変わらず、52週進めても壊れない |
| セーブ保全 | 書き出し→読み込みの完全復元、壊れたテキストの拒否、壊れたセーブからのバックアップ復元、書き込み失敗の通知 |
| 画面 | PC幅とiPhone 13で全タブを開き、横はみ出しとエラーがない |
| バランス | 単純な割安株ボットの1,000億円到達年数とライバルの最大純資産を記録し、`baseline.json` と比べる（±40%を超えたら WARN。失敗扱いにはしない） |

`fixtures/save-v1-pre-phase1.json` は Phase 1（都市×業種の市場）導入前の版で作ったセーブで、作り直さずに残します。
