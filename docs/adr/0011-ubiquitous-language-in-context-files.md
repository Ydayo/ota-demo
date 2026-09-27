# ADR-0011: ユビキタス言語をコンテキストごとの CONTEXT.md に置く

- ステータス: 提案中
- 日付: 2026-09-27

## 背景

仕様、コード、テストで同じ言葉を使うため、用語集が必要である。同じ言葉でもコンテキストによって意味が違う場合は、コンテキストごとに定義したい。また、Grilling で使う domain-modeling スキルは、用語集を `CONTEXT.md`、コンテキストの一覧を `CONTEXT-MAP.md` に書き込む規約を持つ。

## 決定

- domain-modeling スキルの規約に合わせる。
  - `CONTEXT-MAP.md`(リポジトリルート): コンテキストの一覧、各 `CONTEXT.md` の場所、コンテキスト間の関係(上流・下流、腐敗防止層の位置)
  - `packages/modules/<コンテキスト>/CONTEXT.md`: 各コンテキストの用語集
  - `packages/shared/CONTEXT.md`: 共有カーネル(複数コンテキストで同じ意味を持つ用語。金額、宿泊期間など)
- リポジトリルートには `CONTEXT.md` を置かない(単一コンテキストのリポジトリと誤判定されるのを防ぐため)。
- 用語の各項目には、日本語の用語、コード上の英語名、定義を必ず含める。書式は domain-modeling の書式に従ったうえで、この3項目を追加する。
- 開発プロセスの用語(受け入れテスト、ゲートなど)は業務の用語ではないため、`CONTEXT.md` には置かず、`docs/constitution.md` に定義する。
- 用語集はロック対象とし(ADR-0006)、変更は人間のレビューを必要とする。

## 検討した選択肢

- `docs/glossary.md` に全コンテキストの用語をまとめる: domain-modeling に書き込み先を毎回指示する必要があり、指示が守られないと書き込み先がずれるため不採用。

## 結果

- Grilling の中で、用語集がスキルの改造なしに正しい場所へ更新される。
- 用語集がコンテキストのコードの隣に置かれ、コンテキストごとの定義という方針がファイル配置に表れる。

## 出典(確認日: 2026-09-27)

- domain-modeling の規約(`CONTEXT.md`、`CONTEXT-MAP.md`、`docs/adr/`)と書式ファイル(`CONTEXT-FORMAT.md`、`ADR-FORMAT.md`): https://github.com/mattpocock/skills/tree/main/skills/engineering/domain-modeling
- `CONTEXT` を `GLOSSARY` に改名する PR は、マージされずにクローズされた(2026-09-24)。現在の規約は `CONTEXT.md` のまま: https://github.com/mattpocock/skills/pull/876
