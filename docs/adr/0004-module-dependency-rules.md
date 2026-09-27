# ADR-0004: モジュールと層の依存ルールを機械的に強制する

- 日付: 2026-09-27

## 背景

モジュラーモノリス、DDD、クリーンアーキテクチャの依存ルールは、規約だけでは AI の実装で崩れやすい。人間がコードをレビューしないため、機械的に検査する必要がある。

## 決定

### 依存してよい先(許可リスト)

各層が依存してよい先を許可リストで定める。ここに挙げていない依存はすべて禁止する。「同じ層」は、同じパッケージの同じ層のディレクトリ内を指す。

| 依存元 | 依存してよい先 |
|---|---|
| `packages/shared` | 同じパッケージ内のみ(npm パッケージ、Node 組込みモジュールを含め、外部への依存を一切禁止) |
| 各モジュールの domain | 同じ層、`@ota/shared` |
| 各モジュールの application | 同じ層、同じモジュールの domain、`@ota/shared` |
| 各モジュールの infrastructure | 同じ層、同じモジュールの domain と application、`@ota/shared`、`@ota/platform`、他モジュールの `index.ts`、npm パッケージ |
| 各モジュールの `index.ts` | 同じモジュールの全層 |
| `packages/products/<商材>` | モジュールと同じ層構造・同じ規則に従う。infrastructure は他モジュールの `index.ts` に依存してよい |
| `packages/platform` | 同じパッケージ内、`@ota/shared`、npm パッケージ |
| `apps/*` | 各モジュールと商材の `index.ts`、`@ota/shared`、`@ota/platform`、npm パッケージ |

### 禁止する依存(個別ルール)

| ルール | 内容 |
|---|---|
| module-public-api | 他モジュール・他商材の `index.ts` 以外への import を禁止する |
| shared-pure | `@ota/shared` から外部(npm パッケージ、Node 組込みモジュール、他パッケージ)への import を禁止する |
| domain-pure | domain から、同じ層と `@ota/shared` 以外への import を禁止する |
| application-inward | application から、同じ層、同じモジュールの domain、`@ota/shared` 以外への import を禁止する(他モジュールへの直接依存も禁止) |
| no-outward | domain / application から infrastructure への import を禁止する |
| platform-restricted | `@ota/platform` を import できるのは infrastructure、platform 自身、apps のみとする |
| modules-no-products | `packages/modules/*` から `packages/products/*` への import を禁止する |
| products-isolated | 商材同士の import を禁止する |
| table-ownership | Drizzle のテーブル定義は各モジュールの infrastructure に置き、他モジュールからの import を禁止する |
| no-circular | 循環参照を禁止する |

### コンテキスト間の連携

- application は他モジュールに直接依存しない。他コンテキストの機能が必要な場合は、application に**ポート**を定義し、infrastructure の**アダプター**が他モジュールの `index.ts` を呼び出して実装する。このアダプターは、他コンテキストのモデルを自コンテキストのモデルに変換する腐敗防止層を兼ねる。
- 他コンテキストのドメインイベントの購読も、infrastructure のアダプターが受け取り、自コンテキストのユースケースの呼び出しに変換する。
- 複数コンテキストにまたがるサガは、それを所有するモジュールの application に置き、各コンテキストへはポート経由でアクセスする。

### 商材

- 商材の共通契約(search / quote / hold / confirm / cancel のポート)は booking が定義し、`@ota/booking` の `index.ts` から公開する。
- 各商材(`packages/products/<商材>`)は、この契約を infrastructure で実装する。booking は商材を知らない(依存性の逆転)。
- 商材の実装を booking に渡す組み立ては `apps/web` で行う。

### DB

- PostgreSQL のスキーマ(`booking`、`catalog` など)をモジュールごとに分け、テーブルの所有者を明確にする。

### ハーネス自体の検査

- 各ルールに違反するフィクスチャを用意し、違反が検出されることを CI で確認する。
- 違反時のエラーメッセージには、この ADR のパスを含める。

## 検討した選択肢

- application から他モジュールの `index.ts` を直接呼ぶ: 実装量は減るが、application が他コンテキストの型に直接依存し、腐敗防止層の置き場所が曖昧になる。テストで他モジュールを差し替えにくくなるため不採用。
- 商材の共通契約を `@ota/shared` に置く: shared は複数コンテキストで同じ意味を持つ値の置き場所であり、予約のための契約は booking の関心事であるため不採用。
- ESLint の `no-restricted-imports` / `import/no-restricted-paths`: パス単位の規則は書けるが、循環参照や層の表現力で dependency-cruiser に劣るため、主たる検査には採用しない。
- 規約とレビューのみ: 人間がコードをレビューしない前提と矛盾するため不採用。

## 結果

- 依存ルールの違反はマージ前に必ず検出される。
- コンテキスト間の連携はすべてポートとアダプターを経由するため、ボイラープレートは増えるが、各コンテキストを独立してテストできる。
- ルールの変更はハーネスの変更として扱い、ADR を必要とする(憲法 第4条)。
