import rootConfig from '../../eslint.config.js';

export default [
  ...rootConfig,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        // Browser/DOM globals needed by Hyperfy
        HTMLLabelElement: 'readonly',
        crypto: 'readonly',
        
        // Browser globals
        cy: 'readonly',
        Cypress: 'readonly',
        React: 'readonly',
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
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        performance: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLButtonElement: 'readonly',
        
        // Node.js globals
        NodeJS: 'readonly',
        require: 'readonly',
        
        // Additional globals for AI plugin
        PlayerRole: 'readonly',

        // PhysX/Emscripten globals
        PHYSX: 'readonly',
        read: 'readonly',
        readbuffer: 'readonly',
        scriptArgs: 'readonly',
        quit: 'readonly',
        print: 'readonly',
        printErr: 'readonly',

        // Emscripten bindings
        _emscripten_bind_PxArticulationDrive_PxArticulationDrive_1: 'readonly',
        _emscripten_bind_PxArticulationDrive_PxArticulationDrive_2: 'readonly',
        _emscripten_bind_PxArticulationDrive_PxArticulationDrive_3: 'readonly',
        _emscripten_bind_PxArticulationLimit_PxArticulationLimit_1: 'readonly',
        _emscripten_bind_PxBounds3_PxBounds3_1: 'readonly',
        _emscripten_bind_PxContactBuffer_contact_2: 'readonly',
        _emscripten_bind_PxD6JointDrive_PxD6JointDrive_1: 'readonly',
        _emscripten_bind_PxD6JointDrive_PxD6JointDrive_2: 'readonly',
        _emscripten_bind_PxExtendedVec3_PxExtendedVec3_1: 'readonly',
        _emscripten_bind_PxExtendedVec3_PxExtendedVec3_2: 'readonly',
        _emscripten_bind_PxFilterData_PxFilterData_1: 'readonly',
        _emscripten_bind_PxFilterData_PxFilterData_2: 'readonly',
        _emscripten_bind_PxFilterData_PxFilterData_3: 'readonly',
        _emscripten_bind_PxHeightFieldGeometry_PxHeightFieldGeometry_1: 'readonly',
        _emscripten_bind_PxHeightFieldGeometry_PxHeightFieldGeometry_2: 'readonly',
        _emscripten_bind_PxHeightFieldGeometry_PxHeightFieldGeometry_3: 'readonly',
        _emscripten_bind_PxHeightFieldGeometry_PxHeightFieldGeometry_4: 'readonly',
        _emscripten_bind_PxMassProperties_PxMassProperties_2: 'readonly',
        _emscripten_bind_PxPlane_PxPlane_1: 'readonly',
        _emscripten_bind_PxQuat_PxQuat_2: 'readonly',
        _emscripten_bind_PxQuat_PxQuat_3: 'readonly',
        _emscripten_bind_PxRigidBodyExt_computeVelocityDeltaFromImpulse_6: 'readonly',
        _emscripten_bind_PxRigidBodyExt_computeVelocityDeltaFromImpulse_7: 'readonly',
        _emscripten_bind_PxTetrahedronMeshDesc_PxTetrahedronMeshDesc_1: 'readonly',
        _emscripten_bind_PxTriangle_PxTriangle_1: 'readonly',
        _emscripten_bind_PxTriangle_PxTriangle_2: 'readonly',
        _emscripten_bind_PxVec3_PxVec3_1: 'readonly',
        _emscripten_bind_PxVec3_PxVec3_2: 'readonly',
        _emscripten_bind_PxVec4_PxVec4_1: 'readonly',
        _emscripten_bind_PxVec4_PxVec4_2: 'readonly',
        _emscripten_bind_PxVec4_PxVec4_3: 'readonly',
      },
    },
  },
  {
    // Override rules for all files in this plugin
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      // Relax TypeScript comment directives for legacy code
      '@typescript-eslint/ban-ts-comment': [
        'warn',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          'ts-nocheck': 'allow-with-description',
        },
      ],
      // Turn off all unused variable warnings for AI plugin
      '@typescript-eslint/no-unused-vars': 'off',
      
      // Turn off explicit any warnings for AI plugin flexibility
      '@typescript-eslint/no-explicit-any': 'off',
      'prefer-const': 'off', // Allow flexible variable declarations in AI plugin
      'no-empty': 'off', // Allow empty blocks in AI plugin patterns
      'no-undef': 'off', // AI plugins have many dynamic globals
      'no-constant-condition': 'off',
      'no-fallthrough': 'off',
      'no-unreachable': 'off',
      'no-case-declarations': 'off',
      'no-redeclare': 'off',
    },
  },
  {
    // More permissive rules for test files
    files: ['**/*.test.{js,ts,tsx}', '**/__tests__/**/*.{js,ts,tsx}', '**/test-*.{js,ts}'],
    rules: {
      // Allow any in tests for flexibility
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_|^runtime$|^message$|^state$|^playerId$|^updates$|^callback$|^data$|^world$|^key$|^value$|^pattern$|^id$|^broadcast$',
          varsIgnorePattern: '^_|^mock|^impostor$|^Vector3$|^setGameState$|^Memory$|^hyperfyPlugin$|^TestCase$|^world$|^HyperfyWorld$|^messageReceived$|^describe$|^it$|^expect$|^testMessage$|^fireEvent$|^waitFor$|^id$|^HyperfyService$|^logger$|^serviceInstance$|^afterEach$|^createMockWorld$|^beforeEach$|^ModelType$|^SimulationConfig$|^gameState$|^State$|^HandlerCallback$|^createUniqueUuid$',
          caughtErrorsIgnorePattern: '^_|^error$',
          ignoreRestSiblings: true,
        },
      ],
      'no-undef': 'off',
      'no-empty': 'off',
      'no-unused-expressions': 'off',
    },
  },
  {
    // Special rules for PhysX files
    files: ['**/physx/**/*.js'],
    rules: {
      'no-var': 'off',
      'no-throw-literal': 'off',
      'no-prototype-builtins': 'off',
      eqeqeq: 'off',
      'no-constant-condition': 'off',
      'no-setter-return': 'off',
      'no-async-promise-executor': 'off',
      'no-global-assign': 'off',
      'getter-return': 'off',
      'no-return-assign': 'off',
      'no-cond-assign': 'off',
      'no-fallthrough': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'prefer-const': 'off',
      'no-empty': 'off',
    },
  },
];
