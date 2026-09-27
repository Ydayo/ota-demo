# ADR-0010: すべての API ルートに認可ポリシーの宣言を必須とする

- ステータス: 提案中
- 日付: 2026-09-27

## 背景

認可の付け忘れは重大な欠陥になるが、人間がコードをレビューしないため、付け忘れを目視で検出できない。

## 決定

### ルートの定義

- API ルートは自前のヘルパー `defineRoute` で定義する。`defineRoute` は @hono/zod-openapi のルート定義をラップし、認可ポリシーの指定を型で必須にする。
- 認可ポリシーは次のいずれかとする(フェーズ1で増減を検討する)。
  - `public`: 誰でもアクセスできる
  - `authenticated`: ログインが必要
  - `owner`: ログインが必要で、かつ本人のリソースのみ(リソースの所有者を解決する関数を併せて指定する)
- 定義されたルートはレジストリに登録する。
- Better Auth がマウントする `/api/auth/*` も、レジストリにポリシー(`public`、認証処理は Better Auth に委譲)とともに登録する。

### `defineRoute` を通らないルートの検出

`defineRoute` を通らないルートはレジストリに登録されないため、次の3つの経路を塞ぐ。

| 経路 | 対策 |
|---|---|
| Hono の `app.get` などを直接呼んで登録したルート | 起動時とテストで、Hono アプリに実際に登録されたルートの一覧(`app.routes`)とレジストリを突き合わせ、レジストリにないルートが1つでもあれば失敗させる |
| Next.js の Route Handler(`app/**/route.ts`) | `apps/web/app/api/[[...route]]/route.ts`(Hono のマウント先)以外の `route.ts` を CI の検査で禁止する |
| Server Actions(`'use server'`) | CI の検査で禁止する。書き込みはすべて Hono の API 経由とする |

### 認可の自動検査

- レジストリを走査し、全ルートに対して「未ログインでのアクセス」「別ユーザーのリソースへのアクセス」を検査するテストを自動で実行する。

## 検討した選択肢

- ミドルウェアをルートごとに付ける: 付け忘れを型で検出できないため不採用。
- すべてを既定でログイン必須にする: 公開ルートの宣言漏れは防げるが、本人のリソースのみという制約の付け忘れは防げないため不採用。
- Server Actions を認可ポリシーつきで許可する: 認可の検査経路が2つになるため不採用。
- 薄い Server Actions(Hono の API を呼ぶ中継と `revalidatePath` のみ)を許可する: `<form action>` による JavaScript なしの送信や、送信後の画面更新が簡単になる利点がある。一方で、Action の1つ1つが直接 POST で呼べる公開の入口になり、Action が中継以外をしていないことを保証する検査が追加で必要になる。書き込みの呼び出し経路も2通りになる。人間がコードをレビューしない本プロジェクトでは、認可の漏れを機械で防げることとハーネスの単純さを優先し、不採用とした。フォームの使い勝手が必要になった時点で、ADR で再検討する。

## 結果

- 認可ポリシーのないルートは、どの経路で追加されても、マージ前に検出される。
- 新しいルートを追加すると、認可の検査テストが自動で対象に含まれる。

## 出典(確認日: 2026-09-27)

- Server Actions は直接の POST リクエストで呼び出せ、Action ごとに認証と認可の確認が必要: https://nextjs.org/docs/app/guides/data-security

- Hono の `app.routes`: ソースコード上の公開プロパティ(`routes: RouterRoute[]`)。公式ドキュメントには記載がない: https://github.com/honojs/hono/blob/main/src/hono-base.ts
  - ドキュメントに記載のない API のため、Hono の更新で変わる可能性がある。変わった場合は突き合わせのテスト自体が失敗して気づける。代替として `hono/dev` の `inspectRoutes` がある(こちらもドキュメント未記載。`showRoutes` は記載あり): https://hono.dev/docs/helpers/dev 、 https://github.com/honojs/hono/blob/main/src/helper/dev/index.ts
- @hono/zod-openapi の `openAPIRegistry`: https://github.com/honojs/middleware/blob/main/packages/zod-openapi/src/index.ts
