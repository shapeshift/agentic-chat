import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import prettierConfig from 'eslint-config-prettier'
// @ts-expect-error - package doesn't provide types and has exports conflicts
import importPlugin from 'eslint-plugin-import'
import prettier from 'eslint-plugin-prettier'

export default [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      prettier,

      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: true,
      },
    },
    rules: {
      // Prettier integration
      'prettier/prettier': [
        'error',
        {
          arrowParens: 'avoid',
          printWidth: 120,
          semi: false,
          singleQuote: true,
          trailingComma: 'es5',
        },
      ],

      // TypeScript recommended rules
      ...typescript.configs.recommended.rules,
      ...typescript.configs['recommended-requiring-type-checking'].rules,

      // Custom TypeScript rules
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],

      // Import plugin rules
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-unresolved': 'error',
      'import/no-duplicates': 'error',
      'import/no-unused-modules': 'warn',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],

      // Turn off rules that conflict with Prettier
      ...prettierConfig.rules,
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.d.ts'],
  },
]
