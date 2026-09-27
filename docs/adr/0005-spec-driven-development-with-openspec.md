# ADR-0005: 仕様駆動開発に OpenSpec を使い、仕様作成時に Grilling を必須とする

- 日付: 2026-09-27

## 背景

仕様を唯一の正とし(憲法 第1条)、仕様から受け入れテストを先に作る。商材の追加など変更が続く前提のため、変更ごとに仕様差分を積み上げて「現在の仕様」を常に最新に保てる仕組みが必要である。また、AI が曖昧なまま仕様を書くことを防ぐため、仕様作成時に人間との対話で計画と用語を詰めたい。

## 決定

- 仕様駆動開発ツールとして OpenSpec を採用する。仕様は `openspec/specs/`、変更提案は `openspec/changes/` に置く。
- 受け入れ条件は EARS 形式で書き、要件IDを付ける。要件IDは要件の見出しに `### Requirement: REQ-BOOKING-001 <要件名>` の形で含める(OpenSpec 1.13.2 の `validate --strict` を通ることをローカルで確認済み)。OpenSpec は MODIFIED / RENAMED の差分を、前後の空白を除いた見出し全体の完全一致(大文字小文字を区別)で照合するため、要件IDを含む見出しは常に完全一致で書く。
- OpenSpec の標準スキーマ(spec-driven)をプロジェクトに複製したカスタムスキーマ `ota-flow` を使う。
- proposal と specs の作成前に、Grilling(mattpocock/skills の grill-with-docs と同じ手順: `grilling` スキル → `domain-modeling` スキル)を必ず実行する。grill-with-docs 自体はユーザー起動専用のため、スキーマから同等の2スキルを起動する。
- Grilling の実行を以下の4層で担保する。
  1. カスタムスキーマの proposal / specs の instruction
  2. `openspec/config.yaml` の rules
  3. UserPromptSubmit hook による、`/opsx:*` 実行時の注意喚起
  4. 変更提案に「Grilling 記録」欄があることを CI で検査
- ハーネスやアーキテクチャの変更も、OpenSpec の変更提案として同じ流れを通す。
- OpenSpec が生成する `.claude/skills/openspec-*` は直接編集しない(`openspec update` で上書きされるため)。

## 検討した選択肢

- GitHub Spec Kit / cc-sdd: 比較の結果は実装時に追記する。
- 生成されたスキルを直接改造する: `openspec update` で消えるため不採用。
- Grilling を人間が手動で起動する: 起動し忘れを防げないため不採用。

## 結果

- 仕様と用語集・ADR が、人間との対話の中で同時に更新される。
- Grilling を経ていない変更提案は CI で検出される。

## 出典(確認日: 2026-09-27)

- 見出しによる要件の照合(前後の空白を除いて、大文字小文字を区別した完全一致): https://github.com/Fission-AI/OpenSpec/blob/main/openspec/specs/openspec-conventions/spec.md 、 https://github.com/Fission-AI/OpenSpec/blob/main/src/core/parsers/requirement-blocks.ts
- `validate --strict`(警告も失敗として扱う): https://github.com/Fission-AI/OpenSpec/blob/main/docs-lab/reference/cli.md
- カスタムスキーマ、`config.yaml` の `context` と `rules`: https://github.com/Fission-AI/OpenSpec/blob/main/docs/customization.md
- 生成されるスキルは `openspec update` で上書きされる: https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md
- grill-with-docs はユーザー起動専用で、`grilling` と `domain-modeling` を順に呼ぶ: https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/SKILL.md 、 https://github.com/mattpocock/skills/blob/main/docs/engineering/grill-with-docs.md
- 要件IDを含む見出しが `validate --strict` を通ること: OpenSpec 1.13.2 の CLI をローカルで実行して確認(`### Requirement: REQ-BOOKING-001 ...` の追加差分を検証し、アーカイブ後の仕様の検証も通過)
