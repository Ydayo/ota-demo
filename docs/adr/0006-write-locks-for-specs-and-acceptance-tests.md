# ADR-0006: 仕様・受け入れテスト・ハーネスへの書き込みを役割でロックする

- ステータス: 提案中
- 日付: 2026-09-27

## 背景

AI が実装とテストの両方を書くと、実装に都合のよいテストを書いたり、失敗したテストを弱めて通したりするおそれがある。人間がコードをレビューしないため、これを構造的に防ぐ必要がある。

## 決定

- 保護対象: `openspec/`、`tests/acceptance/`、すべての `CONTEXT.md` と `CONTEXT-MAP.md`、すべての `docs/adr/`、`docs/constitution.md`、すべての `CLAUDE.md`、`.claude/`(`.claude/rules/` を含む)、`.github/`、`tooling/harness/`、閾値を含む設定ファイル。
- `CLAUDE.md` と `.claude/rules/` は AI の振る舞いを左右するため、実装役が書き換えられないようにする。
- 保護は3層で行う。
  1. Claude Code の PreToolUse hook: 保護対象への書き込みをブロックする(早期フィードバック)。
  2. CODEOWNERS とブランチ保護: 保護対象を変更する PR には人間のレビューを必須とする。
  3. CI: 閾値の引き下げ、`.skip` / `.only`、`@ts-ignore` などを検出して失敗させる。
- 役割によるロック解除: 人間がセッション起動時に環境変数 `OTA_ROLE` を指定した場合のみ、役割に応じたパスへの書き込みを許可する。
  - `spec-author`: `openspec/`、`CONTEXT.md`、`CONTEXT-MAP.md`、`docs/adr/`
  - `test-author`: `tests/acceptance/`
  - `harness`: `.claude/`、`.github/`、`tooling/harness/`、すべての `CLAUDE.md`、閾値の設定ファイル
  - 未指定(implementer): 保護対象への書き込みはすべて禁止
- AI は自分のセッションの環境変数を変更できないため、自らロックを解除できない。
- Bash 経由の書き込みはヒューリスティックに検出するが、完全には防げない。最終判定は CI と CODEOWNERS で行う。

## 検討した選択肢

- ロック用のファイルで状態を切り替える: AI がファイルを書き換えて解除できるため不採用。
- Git hooks でブロックする: `--no-verify` で回避できるため、最終ゲートにはしない。

## 結果

- 実装役の AI は、仕様・受け入れテスト・ハーネスを変更できない。
- 役割の切り替えには人間がセッションを起動し直す必要がある。
