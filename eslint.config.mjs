// ESLint flat config (ESLint 10 reads only this format; it replaced .eslintrc.json).
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// CLAUDE.md "File size guidelines": functions <= 50 lines
const maxLinesPerFunction = { max: 50, skipBlankLines: true, skipComments: true };

export default tseslint.config(
  {
    files: ['src/**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2020 },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      'no-console': 'off',
      'max-lines-per-function': ['error', maxLinesPerFunction],
    },
  },
  {
    // Known exceptions - listed in CLAUDE.md; split when next touched
    files: [
      'src/app.ts',
      'src/app/CountryFilterPart.ts',
      'src/app/EmptyStatePart.ts',
      'src/app/FilterPreferencesPart.ts',
      'src/app/KeyboardPart.ts',
      'src/services/DataService.ts',
      'src/services/FilterService.ts',
      'src/services/ui/CardPart.ts',
    ],
    rules: {
      'max-lines-per-function': ['warn', maxLinesPerFunction],
    },
  },
);
