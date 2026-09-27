# CLAUDE.md

オンライン旅行代理店(OTA)のデモサイト。実際の予約・決済は行わない。
コードは AI が書き、人間はコード差分をレビューしない。品質は機械的なゲートで保証する。

**最初に [docs/constitution.md](docs/constitution.md)(プロジェクト憲法)を読むこと。** この文書より憲法が優先する。

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

1. **変更提案**(役割: spec-author): `/opsx:propose`。proposal と specs の前に必ず Grilling(`grilling` → `domain-modeling`)を行う。
2. **受け入れテスト**(役割: test-author): 仕様の要件IDごとにテストを書く。この時点ではテストは失敗する。
3. **実装**(役割: implementer): 受け入れテストが通るように実装する。仕様と受け入れテストは変更しない。
4. **レビュー**(役割: reviewer): `reviewer` サブエージェントに仕様と差分だけを渡してレビューさせる。
5. **ゲート**: ローカルで `pnpm check` を通し、PR を作る。最終判定は CI。

役割は人間がセッション起動時に環境変数 `OTA_ROLE` で指定する(未指定は implementer)。役割外のパスへの書き込みは hook でブロックされる。ブロックされた場合は迂回せず、作業を止めて人間に報告する。

## コマンド

<!-- フェーズ0の実装完了時に確定する -->

| コマンド | 内容 |
|---|---|
| `pnpm setup` | docker compose の起動、マイグレーション、シード投入 |
| `pnpm dev` | アプリの起動 |
| `pnpm check` | 型、lint、依存ルール、単体テストをまとめて実行 |
| `pnpm test` | 単体テスト |
| `pnpm test:integration` | 結合テスト(Testcontainers) |
| `pnpm test:e2e` | E2E テスト(Playwright) |
| `pnpm mutation` | ミューテーションテスト |

## 実装の約束ごと(詳細は憲法と ADR)

- DDD は関数と型で書く。値オブジェクトはスマートコンストラクタ、状態遷移は判別共用体、エラーは `Result`(ADR-0003、ADR-0009)。
- 依存ルールは dependency-cruiser が検査する(ADR-0004)。
- API ルートは `defineRoute` で定義し、認可ポリシーを必ず宣言する(ADR-0010)。
- テストには、検証する要件IDを書く(例: `test('REQ-BOOKING-012: ...')`)。
- 未決事項や、決まっていない判断が必要になったら、推測で進めずに選択肢と推奨を示して相談する。
