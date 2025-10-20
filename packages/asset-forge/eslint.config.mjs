// @ts-check
import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import importPlugin from 'eslint-plugin-import'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'server/**', 'scripts/**']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: reactPlugin,
      'react-hooks': reactHooks,
      import: importPlugin
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: true,
        alias: { map: [['@', './src']], extensions: ['.ts', '.tsx', '.js', '.jsx'] }
      }
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'react/prop-types': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'import/no-unresolved': 'error',
      'import/order': ['warn', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }]
    }
  },
  {
    files: ['vite.config.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  }
] 