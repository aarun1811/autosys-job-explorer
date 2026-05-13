import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Exclude generated/build artifacts from all linting.
  // Note: src/components/ui/** is intentionally NOT globally ignored so that
  // import validation rules (e.g. import/no-unresolved) still run on vendored
  // shadcn components. The hex-restriction rule is disabled for that directory
  // via a targeted per-file override below.
  globalIgnores(['dist', 'src/routeTree.gen.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: 'Use CSS tokens (var(--color-*)) instead of raw hex literals. See tokens.css.',
        },
      ],
    },
  },
  // Vendored shadcn components may contain raw hex color literals — disable
  // only the hex-restriction rule for that directory, not all lint rules.
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
])
