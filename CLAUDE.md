# CLAUDE.md

オンライン旅行代理店(OTA)のデモサイト。実際の予約・決済は行わない。
コードは AI が書き、人間はコード差分をレビューしない。品質は機械的なゲート(CI)で保証する。

## プロジェクト憲法(最優先)

@docs/constitution.md

## 言語

- ユーザーとのやり取り、仕様、ADR、用語集は日本語で書く。
- コード、識別子、コミットメッセージは英語で書く。識別子は `CONTEXT.md` の英語名に従う。

## どこに何があるか

| パス | 内容 |
|---|---|
| `openspec/specs/` | 現在の仕様(要件IDつきの受け入れ条件) |
| `openspec/changes/` | 変更提案 |
| `CONTEXT-MAP.md` | コンテキストの一覧と関係 |
| `packages/modules/<ctx>/` | 業務モジュール(`domain/` `application/` `infrastructure/` `index.ts`、用語集 `CONTEXT.md`、固有の ADR `docs/adr/`) |
| `packages/products/<商材>/` | 商材ごとの実装 |
| `packages/shared/` | 共有カーネル(値オブジェクト、Result、ポートの型) |
| `packages/platform/` | 横断的な技術基盤(DB、ロガー、イベント配信など) |
| `apps/web/` | Next.js + Hono(プレゼンテーション層) |
| `apps/fake-supplier/` | 疑似サプライヤー API |
| `tests/acceptance/` | 受け入れテスト |
| `docs/adr/` | システム全体の ADR |
| `tooling/` | 共有設定とハーネスの検査スクリプト |

## 開発の流れ

1. 変更提案(spec-author): `/opsx:propose`。proposal と specs の前に Grilling を行う。
2. 受け入れテスト(test-author): 要件IDごとにテストを書く。
3. 実装(implementer): 受け入れテストが通るように実装する。
4. レビュー(reviewer): `reviewer` サブエージェントに仕様と差分だけを渡す。
5. ゲート: ローカルで `pnpm check` を通して PR を作る。最終判定は CI。

- 役割は人間がセッション起動時に `OTA_ROLE` で指定する(未指定は implementer)。役割は spec-author / test-author / implementer / reviewer / harness の5つ。ハーネス(hooks、CI、検査スクリプト、閾値)の変更は harness の役割で行う。
- hook やゲートにブロックされたら、迂回せずに作業を止めて人間に報告する。
- テスト名には、検証する要件IDを含める(例: `test('REQ-BOOKING-012: ...')`)。

## コマンド

| コマンド | 内容 |
|---|---|
| `pnpm infra:up` / `pnpm infra:down` | docker compose で PostgreSQL、Mailpit、疑似サプライヤーを起動 / 停止 |
| `pnpm dev` | Web アプリを起動(http://localhost:3000) |
| `pnpm check` | 型チェック、lint、依存ルール、単体テストをまとめて実行(PR 前に必ず通す) |
| `pnpm typecheck` | 型チェック(TypeScript 7 の `tsc`) |
| `pnpm lint` | ESLint |
| `pnpm depcruise` | 依存ルールの検査 |
| `pnpm test` | 単体テストとハーネスの自己テスト |
| `pnpm test:integration` | 結合テスト(Testcontainers。Docker が必要) |

<!-- 以下はフェーズ0の後続の PR で追加する: pnpm test:e2e / pnpm mutation -->

## 設計判断の索引

要点のみを示す。**該当する作業をするとき、または判断に迷ったときは、リンク先の ADR を読んでから進めること。**

- ADR は影響範囲でルートかモジュールの `docs/adr/` に置く。main にある ADR はすべて有効で、書き換えない。変更は新しい ADR で置き換える → [ADR-0001](docs/adr/0001-record-architecture-decisions.md)
- コンテキストごとに1パッケージ、公開は `index.ts` のみ → [ADR-0002](docs/adr/0002-monorepo-and-package-granularity.md)
- DDD は関数と型で書く。状態遷移は判別共用体、遷移関数はイベントを返す → [ADR-0003](docs/adr/0003-functional-domain-modeling-style.md)
- 依存ルールは dependency-cruiser が検査する。他コンテキストの利用は application のポートと infrastructure のアダプター経由 → [ADR-0004](docs/adr/0004-module-dependency-rules.md)
- 仕様は OpenSpec、要件IDは要件の見出しに含める → [ADR-0005](docs/adr/0005-spec-driven-development-with-openspec.md)
- 役割ごとの書き込みロック → [ADR-0006](docs/adr/0006-write-locks-for-specs-and-acceptance-tests.md)
- 最終ゲートはルールセットと CI、PR は bot アカウントで作る。人間の GitHub 認証情報は使わない → [ADR-0007](docs/adr/0007-ci-as-final-gate-with-bot-account.md)
- 横断的な技術基盤は `@ota/platform`(infrastructure と apps のみ参照可) → [ADR-0008](docs/adr/0008-platform-package-for-cross-cutting-concerns.md)
- 業務上のエラーは `Result` で返す → [ADR-0009](docs/adr/0009-result-type-for-domain-errors.md)
- API ルートは `defineRoute` で定義し、認可ポリシーを宣言する。Route Handler の追加と Server Actions は禁止 → [ADR-0010](docs/adr/0010-authorization-policy-declaration.md)
- 他のユーザーのリソースへのアクセスには、存在しない場合と同じ 404 を返す → [ADR-0014](docs/adr/0014-not-found-for-other-users-resources.md)
- 用語はコンテキストごとの `CONTEXT.md` に従う → [ADR-0011](docs/adr/0011-ubiquitous-language-in-context-files.md)
- 最新メジャー版を見送るツールがある(ESLint、Vitest、Drizzle)。勝手に上げない → [ADR-0012](docs/adr/0012-technology-stack-and-versions.md)
- 人間が承認した PR は、承認されたコミットの SHA を指定して bot がマージする → [ADR-0013](docs/adr/0013-bot-merges-human-approved-pull-requests.md)
