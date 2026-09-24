import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['build', '.react-router'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  /* Route modules export loaders/meta alongside the component by design, and
     the admin UI kit exports small helpers (cx, statusTone) next to components. */
  {
    files: [
      'app/routes/**/*.{ts,tsx}',
      'app/root.tsx',
      'app/admin/components/**/*.tsx',
    ],
    rules: { 'react-refresh/only-export-components': 'off' },
  }
);
