import rootConfig from '../../eslint.config.js'

export default [
  ...rootConfig,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        // Node.js globals for testing
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        require: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        
        // Playwright/testing globals
        page: 'readonly',
        browser: 'readonly',
        context: 'readonly',
        
        // Browser globals for testing
        HTMLCanvasElement: 'readonly',
        WebGLRenderingContext: 'readonly',
        WebGL2RenderingContext: 'readonly',
        OffscreenCanvas: 'readonly',
        ImageBitmap: 'readonly',
        HTMLLabelElement: 'readonly',
        crypto: 'readonly',
        TextEncoder: 'readonly',
        FileReader: 'readonly',
        ReadableStream: 'readonly',
        ProgressEvent: 'readonly',
        ErrorEvent: 'readonly',
        XMLHttpRequest: 'readonly',
        WebAssembly: 'readonly',
        TextDecoder: 'readonly',
        self: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        requestAnimationFrame: 'readonly',
        performance: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLButtonElement: 'readonly',
        
        // Testing framework globals
        test: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      // More permissive for test framework
      '@typescript-eslint/no-explicit-any': 'off', // Testing often requires any types
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_|^unused|^error|^e$|^world$|^options$|^screenshot$|^playerStats$|^serverOutput$|^serverResult$|^detectedShapes$|^totalTests$|^config$|^imageUrl$|^analysis$|^screenshotPath$',
          varsIgnorePattern: '^_|^unused|^error|^e$|^mock|^test|^fixture|^TEST_|^screenshot$|^playerStats$|^serverOutput$|^serverResult$|^detectedShapes$|^totalTests$|^fs$|^response$|^worldConfig$|^TestHelpers$|^TestMetrics$|^configEntries$|^TestValidation$|^ValidationFailure$|^HyperfyFramework$|^spawn$|^createServerWorld$|^allEntities$|^componentTypes$|^cubeProxy$|^sphereProxies$',
          caughtErrorsIgnorePattern: '^_|^error|^e$',
          ignoreRestSiblings: true,
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'no-undef': 'off', // Test environments have many globals
      'prefer-const': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-constant-condition': 'warn',
      'no-fallthrough': 'warn',
      'no-unreachable': 'warn',
      'no-case-declarations': 'warn',
      'no-redeclare': 'warn',
      
      // Allow console logging in tests
      'no-console': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-debugger': 'warn',
      'no-unused-expressions': 'off',
    },
  },
  {
    // Even more permissive for test files
    files: ['**/*.test.{js,mjs,ts}', '**/*.spec.{js,mjs,ts}', '**/test-*.{js,mjs,ts}', '**/*Test.{js,ts,tsx,mjs}', '**/*TestSuite.{js,ts,tsx,mjs}'],
    rules: {
      // Completely disable problematic rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'prefer-const': 'off',
      'no-empty': 'off',
      'no-undef': 'off',
      'no-unused-expressions': 'off',
      'no-console': 'off',
      'no-debugger': 'off',
    },
  },
]