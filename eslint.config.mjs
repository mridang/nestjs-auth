// eslint.config.mjs
import mridangPlugin from '@mridang/eslint-defaults';
import markdownPlugin from 'eslint-plugin-markdown';
import tsParser from '@typescript-eslint/parser';

export default [
  // 1) your normal recommended rules
  ...mridangPlugin.configs.recommended,

  // 2) extract every ```ts``` block from .md → virtual files under an “.md” folder
  {
    files: ['**/*.md'],
    plugins: { markdown: markdownPlugin },
    processor: 'markdown/markdown'
  },

  // 3) catch those virtual files (they live under “README.md/<something>.ts”)
  //    and tell TS-ESLint: “no tsconfig here—just spin up a default program”
  {
    files: ['**/*.md/**'], // match “README.md/1_1.ts”, “README.md/2_2.ts”, etc.
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: undefined, // ✂️ kill any project loading
        createDefaultProgram: true, // fallback parser-only mode
        extraFileExtensions: ['.md'],
        tsconfigRootDir: process.cwd()
      }
    },
    rules: {
      // disable any rules that absolutely need type info
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },

  // 4) still let your real tests use `any` without errors
  {
    files: ['test/**/*.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
];
