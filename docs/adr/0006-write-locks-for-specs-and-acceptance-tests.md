# ADR-0006: 仕様・受け入れテスト・ハーネスへの書き込みを役割でロックする

- ステータス: 承認済み(PR #1)
- 日付: 2026-09-27

## 背景

AI が実装とテストの両方を書くと、実装に都合のよいテストを書いたり、失敗したテストを弱めて通したりするおそれがある。人間がコードをレビューしないため、これを構造的に防ぐ必要がある。

## 決定

### 保護対象

`openspec/`、`tests/acceptance/`、すべての `CONTEXT.md` と `CONTEXT-MAP.md`、すべての `docs/adr/`、`docs/constitution.md`、すべての `CLAUDE.md`、`.claude/`(`.claude/rules/` を含む)、`.github/`、`tooling/harness/`、閾値を含む設定ファイル。

`CLAUDE.md` と `.claude/rules/` は AI の振る舞いを左右するため、実装役が書き換えられないようにする。

### 防御の層と、それぞれの限界

| 層 | 仕組み | 限界 |
|---|---|---|
| 最終防衛線 | CODEOWNERS とリポジトリのルールセット(ADR-0007)。保護対象を変更する PR は人間の承認なしにマージできない | なし(AI が人間の GitHub 認証情報を使えないことが前提。ADR-0007) |
| 最終防衛線 | CI の検査。閾値の引き下げ、`.skip` / `.only`、`@ts-ignore` などを検出する。`docs/constitution.md` を変更するコミットの作者が人間であることを検査する | 検査項目に挙げたものしか検出できない |
| 早期フィードバック | Claude Code の PreToolUse hook。保護対象への書き込みを役割に応じてブロックする | 迂回できる(下記) |
| 早期フィードバック | `.claude/settings.json` の deny ルール。Bash からの `claude` の起動、`~/.claude/` への書き込みを拒否する | 公式ドキュメントが「セキュリティ境界ではない」と明記しており、別の書き方で迂回できる |

**hook と deny ルールは早期フィードバックであり、ロックの保証は最終防衛線(CODEOWNERS、ルールセット、CI)が担う。**

### 役割によるロック解除

人間がセッション起動時に環境変数 `OTA_ROLE` を指定した場合のみ、hook は役割に応じたパスへの書き込みを許可する。

| 役割 | 書き込みを許可するパス |
|---|---|
| `spec-author` | `openspec/`、`CONTEXT.md`、`CONTEXT-MAP.md`、`docs/adr/` |
| `test-author` | `tests/acceptance/` |
| `harness` | `.claude/`、`.github/`、`tooling/harness/`、すべての `CLAUDE.md`、閾値の設定ファイル |
| `reviewer` | なし(読み取りのみ) |
| 未指定(`implementer`) | なし(保護対象への書き込みはすべて禁止) |

- **`docs/constitution.md` はどの役割でも書き込めない。** 憲法の変更は人間が直接行う(ADR-0007)。
- `OTA_ROLE` の指定は、AI による迂回を防ぐものではない。AI は Bash から `OTA_ROLE=... claude -p` で子セッションを起動したり、`~/.claude/settings.json` の `env` に書き込んだりして、ロックを外せる。deny ルールはこれを妨げるが、完全には防げない。`OTA_ROLE` は、正直に動く AI に作業範囲を示すための仕組みと位置づける。

### 将来の強化候補(未確認)

- Claude Code のサンドボックス(macOS では Seatbelt)の `sandbox.filesystem.denyWrite` を使うと、Bash 経由の書き込みも OS のレベルで拒否できる。ただし、役割ごとに設定を切り替える方法と、Docker・Testcontainers との両立は未確認のため、フェーズ0では採用しない。

## 検討した選択肢

- ロック用のファイルで状態を切り替える: AI がファイルを書き換えて解除できるため不採用。
- Git hooks でブロックする: `--no-verify` で回避できるため、最終防衛線にはしない。
- hook を最終防衛線とみなす: 上記のとおり迂回できるため不採用。

## 結果

- 保護対象の変更は、AI がどのように迂回しても、人間の承認なしに main に入らない。
- hook は、正直に動く AI の誤操作を早期に止める役割を果たす。

## 出典(確認日: 2026-09-27)

- Bash のルールはセキュリティ境界ではない、パスの書式、deny ルールは設定の層をまたいで結合される: https://code.claude.com/docs/en/permissions.md 、 https://code.claude.com/docs/en/settings.md
- 設定の `env` はセッションと hook を含むすべてのサブプロセスに適用される: https://code.claude.com/docs/en/settings.md
- hook はセッションの環境変数を引き継ぐ: https://code.claude.com/docs/en/hooks-guide.md
- サンドボックスのファイルシステム制限: https://code.claude.com/docs/en/sandboxing.md
- `.claude/settings.json` 自体を AI の変更から守る公式の設定: 見つからなかった(未確認)。CODEOWNERS とルールセットで守る。
