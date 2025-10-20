module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  settings: {
    react: { version: 'detect' },
    'import/resolver': {
      typescript: {},
      alias: { map: [['@', './src']], extensions: ['.ts', '.tsx', '.js', '.jsx'] }
    }
  },
  rules: {
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'import/no-restricted-paths': ['error', {
      zones: [
        { target: './src', from: './src', except: ['@/'] }
      ]
    }],
    'import/no-unresolved': 'error',
    'import/order': ['warn', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }]
  }
} 