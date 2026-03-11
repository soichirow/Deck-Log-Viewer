# Deck Log Viewer

Bushiroad DECK LOG のデッキコードからカードリストを取得し、Excel/CSV 形式でコピーできる Web アプリ。

## 公開ページ

**https://soichirow.github.io/Deck-Log-Viewer/**

デッキコードをハッシュに含めて共有できます:
```
https://soichirow.github.io/Deck-Log-Viewer/#6RXE0,3YZP2
```

## 機能

- デッキコードまたは URL を入力してカードリストを取得
- 複数デッキの一括取得（カンマ・スペース・改行区切り）
- Excel 用 TSV / CSV コピー（ヘッダー有無切替）
- カード画像サムネイル表示
- 列の表示/非表示・並び替え（設定は localStorage に保存）
- デッキ単位のコピー
- 5 件ごとのページング
- 共有 URL コピー

## 対応タイトル

ヴァンガード / ヴァイスシュヴァルツ / Reバース / Shadowverse EVOLVE / ヴァイスシュヴァルツブラウ / ドリームオーダー / hololive OCG / 五等分の花嫁 / ラブライブ!OCG / ヴァイスシュヴァルツロゼ / GODZILLA CG

## 構成

| ファイル | 役割 |
|---------|------|
| `index.html` | ページ構造 |
| `app.js` | フロントエンドロジック |
| `style.css` | スタイル |
| `worker.js` | Cloudflare Worker プロキシ（CORS 回避） |

## プロキシ

DECK LOG API は CORS を許可していないため、Cloudflare Worker 経由でリクエストしています。

```
GET https://decklog-proxy.card-master-dm.workers.dev?deck_id=XXXX
```

## データ元

[DECK LOG（デッキログ）](https://decklog.bushiroad.com/) - 株式会社ブシロード
