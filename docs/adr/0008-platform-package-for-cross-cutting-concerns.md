# ADR-0008: 横断的な技術基盤を platform パッケージに置く

- ステータス: 提案中
- 日付: 2026-09-27

## 背景

DB 接続とトランザクション管理、ロガー、ドメインイベントの配信、時計と ID 生成、環境変数の検証、冪等キーの保存、認可ポリシーの型など、どのモジュールも必要とするが業務の知識を持たない部品がある。これらは外部ライブラリ(pg、pino など)に依存するため、domain から参照できる shared には置けない。

## 決定

- `packages/platform` を新設し、横断的な技術基盤の実装を置く。
- `@ota/platform` を import できるのは、各モジュールの infrastructure と apps のみとする(ADR-0004)。
- application が必要とするポートの型(Clock、IdGenerator、EventPublisher、TransactionRunner など)は `@ota/shared` に置き、実装を platform に置く。
- platform は業務の知識を持たない。業務の用語や判断が入り込んだ場合は、該当するモジュールへ移す。

## 検討した選択肢

- apps/web で組み立てて各モジュールに渡す: apps/fake-supplier や統合テストでも同じ部品が必要になり、重複するため不採用。
- shared に置く: domain が外部ライブラリに間接的に依存することになるため不採用。

## 結果

- domain と application は外部ライブラリから切り離されたまま、技術基盤を共有できる。
