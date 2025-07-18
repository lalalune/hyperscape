import frontendConfig from '../core/configs/eslint/eslint.config.frontend.js';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

/**
 * ESLint configuration for @hyperscape/hyperfy
 * Uses the standardized frontend configuration from core/configs
 * 
 * Note: Hyperfy has legacy JS libraries and complex 3D graphics code
 * that requires relaxed linting rules for compatibility.
 */
export default [
  ...frontendConfig,
  {
    // Hyperfy-specific overrides
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        
        // DOM types
        HTMLElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLDivElement: 'readonly',
        
        // Event types
        PointerEvent: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        Event: 'readonly',
        EventTarget: 'readonly',
        
        // Web APIs
        CanvasRenderingContext2D: 'readonly',
        WebGLRenderingContext: 'readonly',
        WebGL2RenderingContext: 'readonly',
        SVGElement: 'readonly',
        SVGSVGElement: 'readonly',
        XMLHttpRequest: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        
        // File APIs
        Blob: 'readonly',
        File: 'readonly',
        FormData: 'readonly',
        FileReader: 'readonly',
        
        // Typed Arrays
        ArrayBuffer: 'readonly',
        Uint8Array: 'readonly',
        Float32Array: 'readonly',
        ImageData: 'readonly',
        
        // Browser APIs
        DOMRect: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        MutationObserver: 'readonly',
        ScrollBehavior: 'readonly',
        
        // Performance/Animation
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        
        // System
        console: 'readonly',
        process: 'readonly',
        
        // Hyperfy specific globals
        world: 'readonly',
        
        // React
        React: 'readonly',
      },
    },
    rules: {
      // Relaxed rules for legacy compatibility
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'warn',
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-undef': 'off', // TypeScript handles this
      'no-unused-expressions': 'off',
      'no-sequences': 'off',
      'no-prototype-builtins': 'off',
      'no-dupe-class-members': 'off',
      'no-redeclare': 'off',
      'no-async-promise-executor': 'off',
      'no-setter-return': 'off',
      'require-yield': 'off',
      
      // TypeScript overrides
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      
      // React overrides
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Ignore legacy and complex files
    ignores: [
      'dist/',
      'build/',
      'node_modules/',
      '*.config.js',
      '*.config.ts',
      'src/core/libs/**/*',
      'src/core/physx-js-webidl.js',
      'src/rpg/**/*', // RPG system has legacy code
      'src/types/global.d.ts',
    ],
  },
  {
    // Test files - additional globals
    files: ['**/*.test.{js,ts,tsx}', '**/*.spec.{js,ts,tsx}', '**/__tests__/**/*'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        vi: 'readonly',
        mock: 'readonly',
        spyOn: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
];