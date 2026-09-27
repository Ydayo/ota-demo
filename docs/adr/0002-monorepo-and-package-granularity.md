# ADR-0002: モノレポ構成とパッケージの粒度

- ステータス: 承認済み(PR #1)
- 日付: 2026-09-27

## 背景

システムはモジュラーモノリスとして、業務の単位(境界づけられたコンテキスト)で縦に分割する。分割の境界を規約だけでなく機械的に守らせたい。

## 決定

- pnpm workspaces と Turborepo によるモノレポとする。
- 境界づけられたコンテキストごとに1つのワークスペースパッケージとする(例: `@ota/booking`)。
- 各パッケージの `package.json` の `exports` は `./index.ts` のみを公開する。これにより、他パッケージから内部ファイルを import することが Node のモジュール解決の段階で不可能になる。dependency-cruiser による検査(ADR-0004)と二重に守る。
- パッケージ内部の層(domain / application / infrastructure)はディレクトリで分け、dependency-cruiser で依存方向を検査する。
- パッケージ構成:
  - `packages/modules/<コンテキスト>`: 業務モジュール
  - `packages/products/<商材>`: 商材ごとの実装(booking が定義する商材の共通契約を実装する。ADR-0004)
  - `packages/shared`: 共有カーネル(複数コンテキストで同じ意味を持つ値オブジェクトと型、ポートの型)
  - `packages/platform`: 横断的な技術基盤(ADR-0008)
  - `apps/web`: Next.js と Hono(プレゼンテーション層、コンポジションルート)
  - `apps/fake-supplier`: 疑似サプライヤー API
  - `tooling/*`: 共有設定とハーネスの検査スクリプト
- TypeScript はビルドせずソースのまま参照する(Just-in-Time パッケージ)。ツールのバージョンは実装時に公式ドキュメントで確認し、`package.json` で固定する。

## 検討した選択肢

- 層ごとにパッケージを分ける(例: `@ota/booking-domain`): パッケージ数が5倍になり管理コストが大きい。層の検査は dependency-cruiser で十分なため不採用。
- 単一パッケージ + ディレクトリ分割: モジュール境界がディレクトリの規約だけになり、exports による物理的な遮断ができないため不採用。

## 結果

- モジュールの公開窓口以外への参照は、exports と dependency-cruiser の二重で防がれる。
- Turborepo のキャッシュにより、変更のないパッケージのテストを省略できる。
