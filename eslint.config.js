import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import nextVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/reports/**',
      '**/.stryker-tmp/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/next-env.d.ts',
      'tooling/harness/fixtures/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '*.cjs', '*.mjs', '*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // 憲法 第4条: any と型チェックの抑制を禁止する
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      // ADR-0003: 関数と型中心のスタイル。データは type で表す
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    },
  },
  // Next.js(apps/web のみ)
  ...nextVitals.map((config) => ({ ...config, files: ['apps/web/**/*.{ts,tsx}'] })),
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    settings: { next: { rootDir: 'apps/web' } },
  },
  // 憲法 第4条: eslint-disable には理由を必須にする
  comments.recommended,
  {
    rules: {
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
    },
  },
  // 憲法 第3条: テストを弱めない(.only / .skip / .todo の放置を禁止)
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'error',
      'vitest/warn-todo': 'error',
      // @fast-check/vitest の test.prop もテストブロックとして扱う
      'vitest/no-standalone-expect': ['error', { additionalTestBlockFunctions: ['test.prop', 'it.prop'] }],
    },
  },
  // 憲法 第3条: E2E(Playwright)のテストを止める書き方と、axe の検査の範囲を狭める書き方を禁止する(ADR-0019)
  {
    files: ['tests/**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='test'][callee.property.name=/^(skip|fixme|fail|only)$/]",
          message: 'テストを止める書き方(test.skip / fixme / fail / only)は禁止です(憲法 第3条)',
        },
        {
          selector:
            "CallExpression[callee.object.object.name='test'][callee.property.name=/^(skip|fixme|fail|only)$/]",
          message: 'テストを止める書き方(test.describe.skip など)は禁止です(憲法 第3条)',
        },
        {
          selector: "CallExpression[callee.property.name=/^(disableRules|exclude|include|options)$/]",
          message: 'axe の検査の範囲を変えることは禁止です。tests/e2e/axe.ts の設定を使ってください(ADR-0019)',
        },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);
