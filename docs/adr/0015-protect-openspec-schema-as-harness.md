# ADR-0015: OpenSpec のスキーマと設定をハーネスとして保護し、要件文に (SHALL) を付ける

- 日付: 2026-09-27
- 関連: ADR-0006 の保護対象の分類を一部置き換える。ADR-0005 の要件の書き方を補う

## 背景

- ADR-0006 では `openspec/` 全体を仕様として扱い、役割 spec-author が書き込めるとした。しかし `openspec/schemas/` と `openspec/config.yaml` には、Grilling の強制や要件IDの規則(ADR-0005)が含まれる。spec-author がこれらを変更できると、仕様を書く役割が自分に課された規則を緩められる。
- OpenSpec 1.13 の検証は、要件の本文に `SHALL` または `MUST` が含まれないと要件として認識しない。日本語の EARS 形式だけで書いた要件は、厳格な検証で失敗する。

## 決定

- `openspec/schemas/` と `openspec/config.yaml` はハーネスとして扱い、役割 harness だけが変更できる。`openspec/specs/` と `openspec/changes/` は、これまでどおり spec-author が変更できる。
- mattpocock/skills の取り込み記録(`skills-lock.json`)もハーネスとして扱う。
- 要件の本文は日本語の EARS 形式で書き、文末に `(SHALL)` を付ける(例: 「利用者が検索したとき、システムは空室のあるホテルの一覧を表示しなければならない(SHALL)。」)。

## 検討した選択肢

- 要件の本文を英語で書く: 仕様は人間がレビューするものであり、日本語で読めることを優先するため不採用。
- OpenSpec の検証を緩める: 検証の設定はスキーマの外にあり変更できないため不可。

## 結果

- 仕様を書く役割は、Grilling や要件IDの規則を変更できない。
- 日本語の要件が OpenSpec の厳格な検証を通る。

## 出典(確認日: 2026-09-27)

- 日本語だけの要件は検証に失敗し、`(SHALL)` を付けると通ること: OpenSpec 1.13.2 の CLI で `openspec validate --strict` を実行して確認
- OpenSpec の要件の書式(SHALL / MUST): https://github.com/Fission-AI/OpenSpec/blob/main/docs/customization.md
