import prettierConfig from '../core/configs/prettier/prettier.config.js';

/**
 * Prettier configuration for @elizaos/hyperfy
 * Uses the standardized configuration from core/configs with overrides
 */
export default {
  ...prettierConfig,
  // Hyperfy-specific overrides to maintain existing code style
  semi: false,
  singleQuote: true,
  jsxSingleQuote: true,
  trailingComma: 'es5',
  arrowParens: 'avoid',
  printWidth: 120,
};