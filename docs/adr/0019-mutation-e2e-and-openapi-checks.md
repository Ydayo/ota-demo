# ADR-0019: ミューテーションテスト、E2E、OpenAPI の破壊的変更の検知

- 日付: 2026-09-27
- 関連: ADR-0012(Stryker、Playwright、oasdiff の採用)、ADR-0018(CI の構成)

## 背景

ADR-0012 で、ミューテーションテストに Stryker 10(パッケージごとに設定と閾値を置く)、E2E に Playwright、OpenAPI の破壊的変更の検知に oasdiff の CLI を使うと決めた。ここでは、それぞれの具体的な設定と、CI での扱いを決める。

## 決定

### ミューテーションテスト(Stryker)

- Stryker 10.0.0 と vitest-runner 10.0.0 を使う。
- 各パッケージに `stryker.config.mjs` を置き、ハーネスの共通設定(`tooling/harness/src/mutation/stryker.ts` の `strykerConfig`)から作る。パッケージが指定できるのは「種類」と「変異させないファイル(exclude)」だけとする。
  - 変異させるファイルは、パッケージのすべてのソース(`**/*.{ts,tsx,mts,cts}`)とし、テスト、型宣言、生成物(`.next`)だけを共通で除く。これ以外の除外は、各パッケージの設定に理由のコメントとともに明示する。
  - 実行用のスクリプトは、各パッケージの設定が `strykerConfig({ kind: パスから決まる種類, exclude })` の戻り値と完全に一致することを検査する。閾値、範囲、`allowEmpty` などの書き換えを防ぐため。
- 閾値(ミューテーションスコアの %)は次のとおりとする(人間の決定)。`break` を下回ると CI が失敗する。閾値を下げるには ADR が必要(憲法 第3条)。

| 種類 | 対象 | high | low | break |
|---|---|---|---|---|
| domain | `packages/modules/*`、`packages/products/*`、`packages/shared` | 90 | 80 | 80 |
| other | `packages/platform`、`apps/web` | 80 | 60 | 60 |

- `apps/` と `packages/` のすべてのパッケージに設定を置く。ただし、テスト用の偽物の `apps/fake-supplier` は対象外とする。設定の漏れはハーネスが検出する。
- `apps/web` では、画面と Hono のマウント先(`src/app/`)、コンポジションルートの `src/server/container.ts`(環境変数と DB の接続を組み立てる)、`next.config.ts` を対象外とし、E2E で起動して確かめる。
- Stryker 用に、サンドボックスを root とする Vitest の設定を別に置く。理由は次の2つ。
  - Vitest は、パッケージのディレクトリから上に向かってルートの `vitest.config.ts` を探して使う。ルートの設定の include はリポジトリのルート基準なので、テストが1件も見つからない。
  - vitest-runner は、`projects` から1つのプロジェクトを選べない。
- vitest-runner のプラグインはパスで指定する(pnpm の配置では自動で見つからない)。
- `allowEmpty` は既定の false のままにする。true にすると、テストが0件のときにスコアを計算せずに成功し、テストのないコードが素通りする。変異させるコードがないパッケージ(雛形の `export {}` だけなど)は、実行用のスクリプト(`tooling/harness/src/mutation/run.ts`)が構文木で判定してスキップする。
- 失敗したときもサンドボックス(`.stryker-tmp`)を残さない(`cleanTempDir: 'always'`)。
- 次の書き方でゲートを無効にできるため、実行用のスクリプトで禁止する。
  - `// Stryker disable` のコメント: ミュータントがすべて無視(Ignored)になるとスコアが NaN になり、Stryker は閾値の判定で失敗しない。変異させるファイルにこのコメントがあれば失敗させ、実行後のレポートに Ignored が1件でもあれば失敗させる。
  - `stryker.conf.json` などの別の名前の設定ファイル: Stryker は `stryker.conf.*` を `stryker.config.*` より優先して読む。設定ファイルを `stryker run stryker.config.mjs` と明示し、別の名前の設定ファイルがあれば失敗させる。
- CI では、PR ごとにすべてのパッケージを実行する。実行時間が問題になったら、incremental モードや変更のあったパッケージだけの実行を ADR で検討する。
- 導入時のスコア(2026-09-27): `packages/shared` 100%、`packages/platform` 67.71%、`apps/web` 86.05%。ほかのパッケージは変異させるコードがない。

### E2E(Playwright + axe)

- Playwright 1.63.0 と @axe-core/playwright 4.13.0 を使う。E2E はワークスペースのパッケージ `@ota/tests`(`tests/`)に置き、テストは `tests/e2e/*.spec.ts` とする。ブラウザは Chromium のみとする。
- E2E は、アプリ全体の起動とアクセシビリティの基本を検査する。要件ごとの振る舞いは受け入れテスト(`tests/acceptance/`)で検証する。
- アクセシビリティは axe で WCAG 2.2 AA を検査し(タグ `wcag2a`、`wcag2aa`、`wcag21a`、`wcag21aa`、`wcag22aa`)、違反を0件とする。
- CI では、`next build` の後に `next start`(本番モード)で検査する。DB は PostgreSQL のサービスコンテナ(docker compose と同じ `postgres:18.6`)を使う。ローカルでは、起動中の開発サーバーがあれば再利用し、DB は `pnpm infra:up` で起動する。
- Playwright の webServer は `next` を直接起動する。`pnpm --filter` を経由すると停止のシグナルが Next に届かず、テストの終了後に停止を120秒待ち続けることをローカルで確認した。
- `tests/playwright.config.ts` は、`vitest.config.ts` と同じくハーネスとして保護する(CODEOWNERS)。CI は `package.json` のスクリプトを経由せず、設定ファイルを明示して Playwright を実行する。
- axe の設定は `tests/e2e/axe.ts` にまとめ、違反のある HTML で違反を検出できることを E2E の中で自己テストする。
- ESLint で、E2E のテストを止める書き方(`test.skip` / `fixme` / `fail` / `only`、`test.describe.skip` など)と、axe の検査の範囲を変える書き方(`disableRules`、`exclude` など)を禁止する。Vitest 用のルールでは Playwright の書き方を検出できないことを確認したため。

### OpenAPI の破壊的変更の検知(oasdiff)

- `apps/web/openapi.json`(OpenAPI 3.1。`getOpenAPI31Document` で生成)をコミットする。API の定義と一致することは、単体テスト(`toMatchFileSnapshot`)で検査する。CI では Vitest がスナップショットを書き換えないため、更新し忘れると失敗する。
- 生成の関数(`apps/web/src/server/openapi.ts`)と、その単体テスト(`openapi.test.ts`)はハーネスとして保護する(CODEOWNERS)。これらを消すか変えると、`openapi.json` が古いまま比較されて検知をすり抜けるため。
- `defineRoute` では、ルートを OpenAPI 文書から隠す `hide` を指定できないようにする(型で拒否する)。
- CI のジョブ `openapi`(PR のみ)で、base の `apps/web/openapi.json` と PR 側のファイルを `oasdiff breaking --fail-on ERR` で比べる。破壊的変更(ERR)は、例外なく常に失敗させる(人間の決定)。意図した破壊的変更が必要になったら、その時点で許可の仕組みを ADR で決める。
- base にファイルがない場合(導入する PR のみ)は比較しない。base のコミット自体を取得できない場合は失敗させる。
- 比較の前に、oasdiff が破壊的変更のフィクスチャ(`tooling/harness/fixtures/openapi/`)で失敗し、同じ文書同士では成功することを確かめる(自己テスト)。
- `--fail-on ERR` のため、WARN(破壊的かもしれない変更)は失敗させない。
- oasdiff の CLI は、GitHub のリリース(v1.32.1、`linux_amd64`)から取得し、ワークフローに固定した SHA-256 で照合してから使う。テレメトリを無効にする環境変数 `OASDIFF_NO_TELEMETRY=1` を設定する。

### CI の構成の自己テスト(ADR-0018 の補足)

- ハーネスの自己テストで、`ci-ok` の `needs` にほかのすべてのジョブがあること、外部の action がコミットの SHA で固定されていること、checkout が `persist-credentials: false` であること、各ジョブが検査のコマンドを実行していること、oasdiff の版と SHA-256 が固定されていることを検査する。ジョブを追加して `needs` に入れ忘れると、そのジョブが必須チェックから外れるため。
- PR の分離の検査は、base 側の版だけで実行する。導入時の代替の処理(base に検査スクリプトがないときは PR 側の版を使う)は削除する。

## 検討した選択肢

- Stryker をリポジトリのルートで1つの設定で動かす: 閾値がグローバルに1つしか持てず、パッケージごとに閾値を変えられないため不採用(ADR-0012)。
- `allowEmpty: true` にして、雛形のパッケージも Stryker で実行する: テストのないコードが素通りすることを確認したため不採用。
- 各パッケージで変異させるファイル(mutate)を指定させる: 決めたディレクトリの外にコードを置くと、閾値を下げずに範囲を狭められるため不採用。すべてを対象にし、除外だけを明示させる。
- `apps/web` の閾値を下げる、または `container.ts` も対象にする: `container.ts` は環境変数と DB の実物が必要で単体テストに向かず、E2E で確かめられる。閾値を下げずに対象から外すことを選んだ。
- E2E で複数のブラウザ(Firefox、WebKit)を検査する: CI の時間とブラウザの導入の手間に見合わないため、現時点では不採用。
- OpenAPI の文書を base と PR の両方で生成して比べる: base 側でも依存のインストールが必要になり、CI が遅くなる。コミットした文書なら、API の変更を PR の差分として人間が確認できるため、コミットする方式を採用した。
- 破壊的変更を PR のラベルで許可する: 人間がラベルを付けたことの検査も必要になる。公開 API の利用者がいない現時点では、単純さを優先して不採用(人間の決定)。
- oasdiff の GitHub Action を使う: 外部サービスへの送信の有無が確認できないため不採用(ADR-0012)。

## 結果

- 業務ロジックを含むパッケージに、テストの強さの下限(スコア 80%)が機械的に課される。
- テストのないコードや、雛形のまま設定のないパッケージは CI で検出される。
- 本番モードでのアプリの起動、DB への接続、トップページのアクセシビリティが、PR ごとに検査される。
- API の破壊的変更は、PR の段階で検出される。API の変更は `apps/web/openapi.json` の差分として PR に現れる。
- CI の時間が伸びる(導入時点で、ミューテーションテストは約40秒、E2E はブラウザの導入とビルドを含めて数分)。

## 出典(確認日: 2026-09-27)

- Stryker 10.0.0 のリリース(Node 22 以上、TypeScript 7 の実験的対応): https://github.com/stryker-mutator/stryker-js/releases/tag/v10.0.0
- Stryker の設定(`thresholds`、`mutate`、`allowEmpty`、`cleanTempDir`、`plugins`、`tempDirName`、設定ファイルの名前): https://stryker-mutator.io/docs/stryker-js/configuration/ 、 https://stryker-mutator.io/docs/stryker-js/config-file/
- vitest-runner のオプション(`vitest.configFile`、`vitest.related`)と、プロジェクトを選べないこと: https://stryker-mutator.io/docs/stryker-js/vitest-runner/ 、 https://github.com/stryker-mutator/stryker-js/issues/6215
- ローカルで確認したこと(Stryker 10.0.0、Vitest 4.1.11、pnpm 12.6.0)
  - プラグインをパスで指定しないと「Cannot find TestRunner plugin "vitest"」で失敗する
  - パッケージのディレクトリで Vitest を実行すると、ルートの `vitest.config.ts` が使われ、テストが0件になる
  - `allowEmpty: true` でテストのないコードを実行すると、スコアを計算せずに終了コード 0 で終わる
  - ミュータントが0件なら、終了コード 0 で終わる
  - スコアが `break` を下回ると終了コード 1 で終わる(フィクスチャで 16.67%)
- Vitest のスナップショット(`toMatchFileSnapshot`、CI では書き換えずに失敗する): https://vitest.dev/guide/snapshot 。`CI=1` で古い `openapi.json` が失敗し、書き換えられないことをローカルで確認
- Playwright の CI と webServer: https://playwright.dev/docs/ci-intro 、 https://playwright.dev/docs/test-webserver
- Playwright の動作環境(Node 22 / 24 / 26): https://playwright.dev/docs/intro
- axe のタグ(WCAG 2.2 AA には 2.0 / 2.1 / 2.2 のタグをすべて指定する): https://playwright.dev/docs/accessibility-testing 、 https://github.com/dequelabs/axe-core/blob/develop/doc/API.md 、 https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md
- GitHub Actions の PostgreSQL サービスコンテナ(ポートの割り当て、ヘルスチェック): https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers
- @hono/zod-openapi の `getOpenAPI31Document`: https://github.com/honojs/middleware/blob/main/packages/zod-openapi/README.md
- oasdiff の `breaking` と `--fail-on`: https://github.com/oasdiff/oasdiff/blob/main/docs/BREAKING-CHANGES.md 。v1.32.1 で、必須プロパティの削除とパスの削除が ERR(終了コード 1)、説明の変更が終了コード 0 になることをローカルで確認
- oasdiff のリリースのアセットと checksums.txt: https://github.com/oasdiff/oasdiff/releases/tag/v1.32.1
- oasdiff のテレメトリ(v1.32.1 の依存にテレメトリのパッケージがない、`OASDIFF_NO_TELEMETRY`): https://github.com/oasdiff/oasdiff/blob/v1.32.1/go.mod 、 https://github.com/oasdiff/telemetry
- Stryker の設定ファイルの探索順(`stryker.conf.*` が `stryker.config.*` より先)と、スコアが NaN のときに閾値で失敗しないこと: Stryker 10.0.0 の実装(`config-file-formats.js`、`mutation-test-report-helper.js`)で確認。`// Stryker disable` のフィクスチャで、実行用のスクリプトが失敗することをローカルで確認
- ESLint の Vitest 用のルールが Playwright の `test.fixme` などを検出しないこと、追加したルールが検出すること: ローカルで確認
- 未確認: oasdiff の CLI が `breaking` の実行中にネットワークに接続しないこと
- 未確認(受け入れたリスク): `postgres:18.6` のイメージはタグで指定し、digest では固定していない。Playwright のブラウザは Playwright の配布に任せ、ハッシュを固定していない
