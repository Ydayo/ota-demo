# コンテキストマップ

本システムの境界づけられたコンテキストと、その関係を示す。
各コンテキストの用語は、それぞれの `CONTEXT.md` に定義する。
コンテキストの追加・分割・統合は、`docs/adr/` の ADR で判断する。

> フェーズ0時点の雛形である。コンテキスト間の関係(上流・下流、腐敗防止層の位置)はフェーズ1で確定する。

## コンテキスト一覧

| コンテキスト | 責務 | 用語集 |
|---|---|---|
| shared(共有カーネル) | 複数コンテキストで同じ意味を持つ値と型(金額、宿泊期間など) | [packages/shared/CONTEXT.md](packages/shared/CONTEXT.md) |
| catalog | 商品(ホテル、部屋タイプ)と在庫 | [packages/modules/catalog/CONTEXT.md](packages/modules/catalog/CONTEXT.md) |
| pricing | 料金計算 | [packages/modules/pricing/CONTEXT.md](packages/modules/pricing/CONTEXT.md) |
| booking | 予約とそのライフサイクル | [packages/modules/booking/CONTEXT.md](packages/modules/booking/CONTEXT.md) |
| payment | 決済と返金 | [packages/modules/payment/CONTEXT.md](packages/modules/payment/CONTEXT.md) |
| customer | 会員としての業務情報(認証そのものは Better Auth に委ねる) | [packages/modules/customer/CONTEXT.md](packages/modules/customer/CONTEXT.md) |

## 外部システム

| 外部システム | 接するコンテキスト | 境界 |
|---|---|---|
| サプライヤー API | catalog(予定) | 腐敗防止層(アダプター)で自コンテキストのモデルに変換する |
| 決済プロバイダー(fake / Stripe テストモード) | payment | ポート/アダプター |
| メール(Mailpit) | (未定) | ポート/アダプター |
| Better Auth | customer | (フェーズ1で確定) |

## 関係

フェーズ1で確定する。
