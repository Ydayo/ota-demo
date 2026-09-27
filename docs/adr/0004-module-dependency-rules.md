# ADR-0004: モジュールと層の依存ルールを機械的に強制する

- ステータス: 提案中
- 日付: 2026-09-27

## 背景

モジュラーモノリス、DDD、クリーンアーキテクチャの依存ルールは、規約だけでは AI の実装で崩れやすい。人間がコードをレビューしないため、機械的に検査する必要がある。

## 決定

dependency-cruiser で以下のルールを検査し、違反があれば CI を失敗させる。

| ルール | 内容 |
|---|---|
| module-public-api | 他モジュールの `index.ts` 以外への import を禁止する |
| domain-pure | domain から、`@ota/shared` 以外への import を禁止する(npm パッケージ、Node 組込みモジュールを含む) |
| application-inward | application から、同じモジュールの domain と `@ota/shared` 以外への import を禁止する |
| no-outward | domain / application から infrastructure への import を禁止する |
| platform-restricted | `@ota/platform` を import できるのは infrastructure と apps のみとする |
| booking-no-products | booking から `packages/products/*` への import を禁止する |
| table-ownership | Drizzle のテーブル定義は各モジュールの infrastructure に置き、他モジュールからの import を禁止する |
| no-circular | 循環参照を禁止する |

- DB は PostgreSQL のスキーマ(`booking`、`catalog` など)をモジュールごとに分け、テーブルの所有者を明確にする。
- ハーネス自体も検査する。各ルールに違反するフィクスチャを用意し、違反が検出されることを CI で確認する。

## 検討した選択肢

- ESLint の `no-restricted-imports` / `import/no-restricted-paths`: パス単位の規則は書けるが、循環参照や層の表現力で dependency-cruiser に劣るため、主たる検査には採用しない。
- 規約とレビューのみ: 人間がコードをレビューしない前提と矛盾するため不採用。

## 結果

- 依存ルールの違反はマージ前に必ず検出される。
- ルールの変更はハーネスの変更として扱い、ADR を必要とする(憲法 第4条)。
