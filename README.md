# ota-demo

オンライン旅行代理店(OTA)のデモサイト。**実際の予約・決済は行わない。**

コードはすべて AI(Claude)が書き、人間はコード差分をレビューしない。
代わりに、仕様・ADR・用語集だけを人間がレビューし、コードの正しさは機械的なゲート(CI)で保証する。

> 構築中(フェーズ0: ハーネス構築)

## ローカルでの起動

必要なもの: Node.js 24、pnpm 12、Docker

```bash
pnpm install
pnpm infra:up   # PostgreSQL、Mailpit、疑似サプライヤーを起動
pnpm dev        # http://localhost:3000
```

環境変数は既定値のままオフラインで動作する(一覧は `.env.example`)。
送信メールは Mailpit(http://localhost:8025)で確認できる。

## ライセンス

ライセンスは付与していない(All rights reserved)。コードの閲覧は自由だが、複製・改変・再配布は許可しない。
