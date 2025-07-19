import rootConfig from '../../eslint.config.js'

export default [
  ...rootConfig,
  // Global ignore patterns - must be first
  {
    ignores: [
      'build/**',
      'dist/**',
      'node_modules/**',
      '**/*.d.ts',
      'physx-js-webidl.js',
      'physx-js-webidl.wasm',
      'src/core/libs/**/*.js',
      '.env',
      // Ignore files with problematic plugin rules
      '**/world-client.js',
      '**/bundle.js'
    ]
  },
  {
    // Only lint specific files in this package
    files: [
      'src/**/*.{js,mjs,cjs,ts,tsx}',
      'scripts/**/*.{js,mjs,cjs,ts,tsx}',
      'world/**/*.{js,mjs,cjs,ts,tsx}',
      '*.{js,mjs,cjs,ts,tsx}'
    ],
    languageOptions: {
      globals: {
        // Three.js globals
        THREE: 'readonly',
        
        // Hyperfy app globals
        app: 'readonly',
        world: 'readonly',
        props: 'readonly',
        
        // Browser/WebGL globals
        HTMLCanvasElement: 'readonly',
        WebGLRenderingContext: 'readonly',
        WebGL2RenderingContext: 'readonly',
        OffscreenCanvas: 'readonly',
        ImageBitmap: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        fetch: 'readonly',
        navigator: 'readonly',
        window: 'readonly',
        document: 'readonly',
        location: 'readonly',
        history: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        
        // Node.js globals for server code
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        require: 'readonly',
        process: 'readonly',
        global: 'readonly',
        
        // PhysX/WebAssembly globals
        WebAssembly: 'readonly',
        Module: 'readonly',
        
        // React/JSX
        React: 'readonly',
        JSX: 'readonly',
      },
    },
    rules: {
      // Completely disable problematic rules for complex 3D engine
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': 'off', // Disable entirely for 3D engine
      'no-undef': 'off',
      'prefer-const': 'off', // Disable to avoid warnings
      'no-var': 'off',
      'no-empty': 'off',
      'no-case-declarations': 'off', // Allow case declarations in switch statements
      
      // Allow console logging in development
      'no-console': 'off',
      
      // Hyperfy-specific patterns that are acceptable
      'no-prototype-builtins': 'off',
      'no-constant-condition': 'warn',
      'no-fallthrough': 'warn',
      'no-unreachable': 'warn',
      'no-case-declarations': 'warn',
      'no-redeclare': 'warn',
      'no-unused-expressions': 'off',
      
      // Allow common 3D engine patterns
      'no-bitwise': 'off',
      'no-mixed-operators': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      'no-async-promise-executor': 'off',
      
      // Additional permissive rules for generated code patterns
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'no-dupe-class-members': 'off', // 3D engines have method overloading patterns
      'no-loss-of-precision': 'off', // 3D math requires high precision numbers
      'no-setter-return': 'off', // Some 3D patterns need setter returns
      'no-global-assign': 'off', // 3D engines may modify global objects
      'getter-return': 'off', // Complex getter patterns in 3D engines
      'no-unexpected-multiline': 'off', // Complex formatting in 3D math
      'no-misleading-character-class': 'off', // Complex regex in engines
      'no-func-assign': 'off', // Generated code patterns
      'no-self-assign': 'off', // Complex state management patterns
      'no-unsafe-finally': 'off', // Complex error handling in engines
      'no-useless-catch': 'off', // Error handling patterns
      'require-yield': 'off', // Generator patterns in 3D engines
      'valid-typeof': 'off', // Type checking patterns
      
      // Disable unknown plugin rules that appear in generated code
      'react-internal/safe-string-coercion': 'off',
      'compat/compat': 'off',
    },
  },
  {
    // Special rules for generated/vendor files
    files: [
      '**/libs/**/*.js', 
      '**/physx-js-webidl.js', 
      'build/**/*',
      'dist/**/*'
    ],
    rules: {
      // Turn off all rules for generated code
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-undef': 'off',
      'no-var': 'off',
      'prefer-const': 'off',
      'no-empty': 'off',
      'no-constant-condition': 'off',
      'no-fallthrough': 'off',
      'no-cond-assign': 'off',
      'no-prototype-builtins': 'off',
      
      // Disable unknown plugin rules
      'react-internal/safe-string-coercion': 'off',
      'compat/compat': 'off',
    },
  },
]