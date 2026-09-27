# ADR-0018: CI のワークフローとハーネスの検査

- 日付: 2026-09-27
- 関連: ADR-0005(Grilling 記録の検査)、ADR-0007(CI を最終ゲートにする)、ADR-0010(Route Handler と Server Actions の禁止)、ADR-0016(PR の分離)

## 背景

ADR-0007 で、GitHub Actions の CI を最終ゲートとし、ルールセットの必須チェックにすると決めた。ADR-0005、ADR-0010、ADR-0016 では、CI で検査する項目を決めた。ここでは、CI の構成と、各検査の具体的な判定を決める。

憲法 第4条はハーネスの変更に OpenSpec の変更提案と ADR を求める。しかし、変更提案の「Grilling 記録」を検査する仕組み自体をこの変更で作るため、フェーズ0の立ち上げとして変更提案は作らず、判断をこの ADR に記録する(ADR-0001 のフェーズ0の例外と同じ扱い。人間の合意による)。

## 決定

### CI の構成(`.github/workflows/ci.yml`)

- トリガーは main への `pull_request` と、main への `push`。権限は `contents: read` のみ。
- ジョブは typecheck、lint、depcruise、unit、integration(Testcontainers)、acceptance(受け入れテスト)、harness-self-test(ハーネスの自己テスト)、harness-checks(ハーネスの検査)、pr-separation(PR の分離。`pull_request` のみ)と、集約ジョブ ci-ok。
- ルールセット main-protection の必須チェックは ci-ok だけにする。ジョブを追加しても、ルールセットを変える必要はない。
- ci-ok は `if: always()` で必ず実行し、すべての依存ジョブが success のときだけ成功する(`push` での pr-separation の skipped だけは許す)。
  - 条件で skipped になったジョブは、必須チェックとしては成功扱いになる。`!cancelled()` にすると、run をキャンセルしたときに ci-ok が skipped になり、CI を通さずにマージできるおそれがある。
- Node は `package.json` の `volta.node`、pnpm は `packageManager` の版を使う(ADR-0012)。
- actions はコミットの SHA で固定し、コメントに版を書く(タグの付け替えによる改変を防ぐ)。
  - actions/checkout v7.0.1、actions/setup-node v7.0.0、pnpm/action-setup v6.1.0
- checkout は `persist-credentials: false` とする(依存のスクリプトからトークンを読めないようにする)。
- 受け入れテストは Vitest のプロジェクト `acceptance`(`tests/acceptance/**/*.test.ts`)で実行する。仕様が空の間はテストがないため、`--passWithNoTests` で成功させる(テストの有無は要件トレーサビリティの検査が担う)。

### PR の分離(ADR-0016)

- 変更されたファイルは、PR の base と head の merge-base から head までの差分(リネームは前後の両方のパス)とする。
- 保護対象の分類(`protected-paths.ts`)で分類し、「実装」(保護対象以外)を変更する PR が、仕様・用語集・ADR、**憲法**、受け入れテストを変更していれば失敗させる。憲法は ADR-0016 の本文に明記がないが、仕様と同じく扱う。ハーネスは実装とも仕様とも同じ PR に含めてよい。
- 検査のスクリプトと分類は、**base 側の版**で実行する。PR 側で検査や分類を書き換えて素通りさせないため。base に検査がない場合(この検査を導入する PR のみ)は PR 側の版で実行する。

### Route Handler と Server Actions(ADR-0010)

- `apps/web/(src/)app/**/route.*` のうち、Hono のマウント先 `apps/web/src/app/api/[[...route]]/route.ts` 以外を禁止する。
  - ADR-0010 は マウント先を `apps/web/app/api/[[...route]]/route.ts` と書いているが、実際の配置(`src/` 配下)に合わせる。
- Pages Router の API Routes(`apps/web/(src/)pages/api/`)も、`defineRoute` を通らない入口になるため禁止する。
- `apps/` と `packages/` のソースで、ファイルの先頭または関数の本体の先頭に `'use server'` ディレクティブがあれば禁止する。コメントや文字列の値との区別のため、TypeScript の構文木で判定する。

### 要件トレーサビリティ(憲法 第1条・第2条、ADR-0005)

- 要件の見出しは `### Requirement: REQ-<コンテキスト>-<3桁> <要件名>` の形とし、形の崩れた見出し(ID なし、コロンなし、階層違いなど)を失敗させる。仕様の中で要件IDの重複を禁止する。
- 差分の節の見出し(大文字小文字を区別しない)、RENAMED の `FROM:` / `TO:` の行(行頭の記号は任意)、コードブロックの中の見出しの無視は、OpenSpec の解釈に合わせる。
- `openspec/specs` のすべての要件IDについて、**実行されるテストのテスト名**にその要件IDを含む受け入れテストがなければ失敗させる。
  - 数えるのは、CI の acceptance ジョブが実行する `tests/acceptance/**/*.test.ts` のテストだけとする。これ以外のファイル(`.spec.ts` など)にテストがあれば失敗させる。対象のパターンと Vitest の設定が一致することは、自己テストで検査する。
  - テスト名は `test` / `it` とその修飾子(`test.each(...)`、`test.concurrent` など)の第1引数に、囲んでいる `describe` の名前を前に付けたものとする。中にテストのない `describe` は数えない。
  - 構文木で判定し、次のテストは数えない: コメントの中のもの、`skip` / `todo` / `fixme` / `skipIf` / `runIf` / `fails` の修飾子のもの、これらの修飾子の `describe` の中のもの、`{ skip: true }` などのオプションのもの、本体で `test.skip()` などを呼ぶもの。
  - 条件分岐の中のテストや、呼ばれない関数の中のテストは、静的には判定できないため数えてしまう(限界として受け入れる)。
- 受け入れテストが参照する要件ID(テスト名に限らずファイル内のすべて)は、`openspec/specs`、または進行中の変更提案(`openspec/changes/<name>/specs`、archive を除く)の ADDED / MODIFIED / RENAMED 後の要件に存在しなければならない。受け入れテストは変更提案を archive する前に書くため(人間の決定)。
- 変更提案の ADDED で、仕様にすでにある要件IDを再利用すれば失敗させる。
- 仕様が空の間は、要件がないので成功する。

### Grilling 記録(ADR-0005)

- 進行中の変更提案(`openspec/changes/<name>/`、archive を除く)に `proposal.md` があり、「## Grilling 記録」欄に `- Q: 質問 → A: 決定事項` の形の記録が1行以上あることを検査する(`->` も認める)。
- HTML コメントとコードブロックの中の記録、テンプレートのままの空欄は認めない。記録の中身の妥当性は機械では判定できないため、PR のレビューで確認する。

### CODEOWNERS

- `.github/CODEOWNERS` で、保護対象(ADR-0006、ADR-0015)の所有者を @Ydayo とする。
- ハーネスの自己テストで、リポジトリの全ファイルについて「保護対象であること」と「CODEOWNERS の所有者がいること」が一致することを検査する(分類と CODEOWNERS のずれを防ぐ)。

### ADR-0007 の「憲法を変更するコミットの作者が人間であることの検査」

- ADR-0016 で、憲法も AI が変更して PR で人間が承認するとしたため、この検査は実装しない。

## 検討した選択肢

- ジョブごとにルールセットの必須チェックを登録する: ジョブの追加のたびにルールセットの変更(人間の作業)が必要になるため不採用。
- actions をタグで指定する: 読みやすいが、タグの付け替えで中身が変わりうるため不採用。
- ci-ok を `if: !cancelled()` にする(GitHub の推奨): 上記のとおり、キャンセルで CI を素通りさせるおそれがあるため不採用。
- PR の分離の検査を PR 側の版で実行する: 同じ PR で分類を書き換えれば素通りできるため不採用。
- 要件IDの参照を正規表現でファイル全体から探す: コメントアウトしたテストや skip したテストも「テストあり」と数えてしまうため不採用。
- 検査のファイルの列挙で、生成物のディレクトリ名(`reports` など)を除外する: 業務上の同名のディレクトリまで検査から漏れるため不採用。`git ls-files` で .gitignore に従う。
- この変更も OpenSpec の変更提案を通す: Grilling 記録の検査がまだないため、フェーズ0の立ち上げとして不採用(人間の合意)。

## 結果

- ci-ok が成功しない限り、PR は main にマージできない(ルールセットに必須チェックを追加した後)。
- 実装の PR で、仕様や受け入れテストを変えることはできない。
- 認可ポリシーを宣言しない API の入口(Route Handler、Pages Router の API Routes、Server Actions)は CI で検出される。
- テストのない要件、存在しない要件を参照するテスト、Grilling 記録のない変更提案は CI で検出される。
- ci.yml 自体と、PR の分離以外の検査は PR 側の版で実行される。これらの改変は CODEOWNERS と PR のレビューで人間が確認する。

## 出典(確認日: 2026-09-27)

- 条件で skipped になったジョブは、必須チェックとして成功扱いになる: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks
- 依存ジョブが失敗すると、条件式のないジョブは skipped になる。`needs.<id>.result` の値: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs 、 https://docs.github.com/en/actions/reference/workflows-and-actions/contexts
- `pull_request` イベントの ref(マージコミット)と `pull_request.base.sha`: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows 、 https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request
- actions/checkout v7(`fetch-depth`、`persist-credentials`、変更履歴): https://github.com/actions/checkout 、 https://raw.githubusercontent.com/actions/checkout/main/CHANGELOG.md
- actions/setup-node v7(`node-version-file: package.json` は `volta.node` を最初に読む、`cache: pnpm` は pnpm の導入後に指定する): https://raw.githubusercontent.com/actions/setup-node/main/docs/advanced-usage.md 、 https://github.com/actions/setup-node/releases
- pnpm/action-setup v6(`version` を省略すると `packageManager` を読む、v6.1.0 で pnpm 12 に対応): https://github.com/pnpm/action-setup 、 https://github.com/pnpm/action-setup/releases/tag/v6.1.0
- 各 action の最新版とコミット SHA: GitHub API(`repos/{owner}/{repo}/releases/latest`、`repos/{owner}/{repo}/commits/{tag}`)で確認
- CODEOWNERS の書式(最後に一致したパターンが優先、所有者には Write 権限が必要): https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- GitHub のホストランナー(ubuntu-latest)に Docker がある: https://raw.githubusercontent.com/actions/runner-images/main/images/ubuntu/Ubuntu2404-Readme.md
- Testcontainers の動作環境: https://node.testcontainers.org/supported-container-runtimes/
- OpenSpec の差分仕様の解釈(節の見出しを大文字小文字を区別せずに照合、RENAMED の `FROM:` / `TO:` の書式、コードブロックの中の無視): OpenSpec 1.13.2 のソース(`dist/core/parsers/requirement-blocks.js`)で確認。https://github.com/Fission-AI/OpenSpec/blob/main/src/core/parsers/requirement-blocks.ts
- Vitest のテストのオプション(`skip`、`todo`、`fails`)と修飾子(`skipIf`、`runIf`): Vitest 4.1.11 の型定義(`@vitest/runner` の `TestOptions`、`ChainableTestAPI`)で確認。https://vitest.dev/api/
- 未確認: Playwright の `test.fixme` と `test.skip()` の扱い。受け入れテストは現時点では Vitest で実行するため、Playwright で受け入れテストを書くことになった時点で確認する。
- `base.sha...head.sha` の差分が PR の変更ファイルと一致すること: Ydayo/ota-demo#8 で、`git diff --name-only --no-renames` の結果と GitHub API(`pulls/{number}/files`)の一覧が一致することを確認(29 ファイル)
