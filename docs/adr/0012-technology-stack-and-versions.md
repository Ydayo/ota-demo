# ADR-0012: 技術スタックとバージョンの方針

- ステータス: 提案中
- 日付: 2026-09-27

## 背景

主要ツールの多くで、最新のメジャー版に互換性の問題がある(2026-09-27 時点、公式ドキュメント・リリースノート・issue で確認)。最新版を無条件に採用すると、ハーネスが動かない、または静かに誤った結果を出す。

## 決定

### 実行環境
- Node 24 LTS(Volta で固定)、pnpm 12(`packageManager` で固定)。
- Volta は保守終了が告知されているが、既に導入済みのため当面は使い続ける。移行先(mise など)は必要になった時点で ADR で判断する。

### TypeScript
- TypeScript 7(ネイティブ版)を型チェックに使い、TypeScript 6 をツールの API 用に併用する(公式の併用手順)。
  - `@typescript/native` = `typescript@7.x`(`tsc` として型チェックに使う)
  - `typescript` = `@typescript/typescript6@6.x`(typescript-eslint、dependency-cruiser、Stryker などが API として読み込む)
- 理由: TypeScript 7.0 はコンパイラ API を提供しておらず(7.1 で提供予定)、typescript-eslint と dependency-cruiser は TS7 に対応していない。
- TS7 で削除された設定(`baseUrl`、`moduleResolution: node` など)は使わない。

### 最新メジャー版を見送るもの
| ツール | 採用する版 | 見送る版 | 理由 |
|---|---|---|---|
| ESLint | 9.x | 10.x | eslint-config-next が依存する eslint-plugin-react が ESLint 10 で動かない |
| Vitest | 4.1.x | 5.x | Stryker の vitest-runner が Vitest 5 のテスト名の形式変更に未対応で、ミュータントが全て生存扱いになる(stryker-js #6210) |
| Drizzle ORM | 0.45.x | 1.0 rc/beta | 1.0 が未リリース |

見送った版は、該当する問題が解消された時点で ADR を作って更新する。

### 採用するもの(版は package.json と pnpm の catalog で固定する)
- Next.js 16(App Router、Turbopack)、Hono 4 + @hono/zod-openapi + Zod 4
- Better Auth 1.7(Drizzle アダプター)
- Drizzle ORM 0.45 + drizzle-kit 0.31 + node-postgres
- Vitest 4.1、fast-check 4 + @fast-check/vitest、Playwright、Testcontainers、MSW
- Stryker 10(パッケージごとに設定ファイルを置き、閾値をパッケージ単位で設定する。Stryker はパス単位の閾値を持たないため)
- dependency-cruiser 18、pino 10、tsx
- PostgreSQL 18、Mailpit
- OpenAPI の破壊的変更の検知には oasdiff の CLI を使う(GitHub Action 版は外部サービスへの送信の有無が確認できないため使わない)

## 検討した選択肢

- すべて最新メジャー版を使う: 上記の互換性問題によりハーネスが成立しないため不採用。
- TypeScript 6 のみを使う: 動作するが、型チェックの高速化という TS7 の利点を捨てることになる。併用手順が公式に示されているため不採用。

## 結果

- ハーネスが確実に動く組み合わせになる。
- 見送った版の問題が解消されたかを定期的に確認する必要がある。

## 出典(確認日: 2026-09-27)

- TypeScript 7 と TypeScript 6 の併用: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- typescript-eslint の対応 TypeScript 版: https://typescript-eslint.io/users/dependency-versions 、 https://github.com/typescript-eslint/typescript-eslint/issues/12518
- dependency-cruiser の TS7 対応予定: https://github.com/sverweij/dependency-cruiser/releases
- Stryker の TS7 実験的対応: https://github.com/stryker-mutator/stryker-js/pull/6099
- Stryker の Vitest 5 不具合: https://github.com/stryker-mutator/stryker-js/issues/6210
- Stryker の設定(閾値はグローバルのみ): https://stryker-mutator.io/docs/stryker-js/configuration/
- eslint-plugin-react の ESLint 10 不具合: https://github.com/jsx-eslint/eslint-plugin-react/issues/3977
- ESLint 10: https://eslint.org/blog/2026/02/eslint-v10.0.0-released/
- Vitest 5 の移行ガイド: https://vitest.dev/guide/migration/
- pnpm 11 / 12: https://pnpm.io/blog/releases/11.0 、 https://pnpm.io/blog/releases/12.0
- Turborepo のサポート方針: https://turborepo.dev/docs/getting-started/support-policy
- Volta の保守終了: https://github.com/volta-cli/volta/issues/2080
- Next.js 16 への移行: https://nextjs.org/docs/app/guides/upgrading/version-16
- Drizzle v1 への移行(1.0 は未リリース): https://orm.drizzle.team/docs/upgrade-v1
- PostgreSQL 公式イメージ: https://hub.docker.com/_/postgres
- oasdiff: https://github.com/oasdiff/oasdiff 、 https://github.com/oasdiff/oasdiff-action

未確認: Next.js の型チェックが TS7 と TS6 の併用構成でどちらの `tsc` を使うか、drizzle-kit と @hono/zod-openapi の TS7 下での実機動作。フェーズ0の実装で確認し、結果をこの節に追記する。
