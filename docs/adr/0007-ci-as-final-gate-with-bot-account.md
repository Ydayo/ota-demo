# ADR-0007: GitHub のルールセットと CI を最終ゲートとし、AI は専用アカウントで PR を作る

> ADR-0013 で一部置き換え(PR のマージは bot が行う)
> ADR-0016 で一部置き換え(憲法も人間の確認つきで AI が変更できる)
> ADR-0018 で一部置き換え(憲法を変更するコミットの作者が人間であることの検査は行わない)

- 日付: 2026-09-27

## 背景

ローカルの Git hooks や Claude Code の hooks は、AI が迂回できる。最終的な品質判定は、AI が迂回できない場所で行う必要がある。また、AI が人間と同じ GitHub アカウントで PR を作ると、PR の作成者とコードオーナーが同一になり、コードオーナーのレビュー必須が機能しない(PR の作成者は自分の PR を承認できない)。

## 決定

### リポジトリとアカウント

- リポジトリは GitHub の公開リポジトリとする。無料プランでブランチ保護・ルールセット・CODEOWNERS を使えるのは公開リポジトリのみであるため(ポートフォリオとしての公開も兼ねる)。
- AI は専用のマシンアカウント `ydayo-bot`(Write 権限、Admin 権限なし)で push し、PR を作る。
- トークンは classic PAT(スコープ `repo` と `workflow`)とする。
  - fine-grained PAT は、他の個人アカウントが所有するリポジトリにコラボレーターとして参加していてもアクセスできないため使えない。
  - `workflow` は `.github/workflows/` の変更を push するために必要。
  - `repo` は非公開リポジトリにも及ぶスコープだが、bot がアクセスできるのはこのリポジトリのみのため、実際の影響範囲は変わらない。
- トークンは `~/.config/ota-demo/bot-token` に置き、このリポジトリの Git 設定でのみ使う。

### 人間の認証情報を AI から切り離す

AI が人間の GitHub 認証情報を使えると、AI が人間として PR を承認でき、すべての保護が無効になる。そのため:

- 開発マシンの CLI(`gh`、Git の認証情報ヘルパー、キーチェーン)には、人間の GitHub 認証情報を置かない。
- 人間は PR のレビュー、承認、マージをブラウザで行う。

### main ブランチのルールセット

クラシックなブランチ保護ではなく、リポジトリのルールセットで main を保護する(バイパスの対象を細かく指定できるため)。

| 設定 | 値 | 目的 |
|---|---|---|
| PR を必須にする | 有効 | main への直接 push を禁止する |
| 必要な承認数 | 1 | |
| コードオーナーのレビューを必須にする | 有効 | 保護対象(ADR-0006)の変更に人間の承認を必須にする |
| 新しいコミットの push で古い承認を取り消す | 有効 | 承認後に AI が追加したコミットを、承認なしでマージさせない |
| 最新の push は、push した人以外の承認を必須にする | 有効 | 同上 |
| 必須のステータスチェック | `ci-ok`(CI の作成後に追加) | CI の通過を必須にする |
| 強制 push とブランチの削除 | 禁止 | |
| バイパスを許可する対象 | 人間(`Ydayo`)のみ、モードは「PR 経由のときのみ」 | 下記 |

### 人間が変更するとき(憲法の改正など)

- 人間が作った PR は、自分で承認できない。そのため、人間はルールセットのバイパス(PR 経由のときのみ)を使ってマージする。直接の push はバイパスの対象にしない。
- `docs/constitution.md` はどの AI の役割でも変更できない(ADR-0006)。憲法の改正は、人間がブラウザ(GitHub のウェブエディター)で変更して PR を作り、バイパスでマージする。
- CI は、`docs/constitution.md` を変更するコミットの作者が人間であることを検査する。

## 検討した選択肢

- ローカルの hooks を最終ゲートにする: 迂回できるため不採用。
- クラシックなブランチ保護: 「管理者にも適用」を有効にすると人間の PR がマージできず、無効にすると管理者は PR を経ずに直接 push できる。PR 経由のときだけバイパスを許すことができないため不採用。
- 人間の変更も bot 経由で PR にする: コミットの作者が bot になり、人間の変更であることを CI で確認できなくなるため不採用。
- GitHub App で PR を作る: 無料で使えるが、トークンの発行(有効期限1時間)の仕組みが必要になり、個人開発には過剰なため不採用。
- 非公開リポジトリ: 無料プランではブランチ保護とルールセットが使えないため不採用。

## 結果

- CI を通過し、人間が承認しない限り、AI の変更は main に入らない。
- 承認後に AI が追加したコミットは、改めて承認されるまでマージできない。
- 人間の変更は、PR という記録を残したうえでマージできる。

## 出典(確認日: 2026-09-27)

- PR の作成者は自分の PR を承認できない: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/approving-a-pull-request-with-required-reviews
- 古い承認の取り消し、最新の push の承認、管理者への適用: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches 、 https://docs.github.com/en/rest/branches/branch-protection
- ルールセットのバイパス(「常に許可」と「PR 経由のときのみ」)と REST API: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository 、 https://docs.github.com/en/rest/repos/rules
- 個人ユーザーをバイパス対象に追加できる(2026-05-07): https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming/
- 無料プランの公開リポジトリでブランチ保護とルールセットが使える: https://github.com/github/docs/blob/main/data/reusables/gated-features/protected-branches.md 、 https://github.com/github/docs/blob/main/data/reusables/gated-features/repo-rules.md
- CODEOWNERS(コードオーナーは Write 権限が必要): https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- fine-grained PAT はコラボレーターとして参加しているリポジトリに使えない: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens 、 https://github.com/github/roadmap/issues/601
- classic PAT のスコープ: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
- 個人アカウント所有のリポジトリで、バイパス対象に個人ユーザーを追加できるか: ドキュメントに明記がなく未確認。設定時に確認する。
