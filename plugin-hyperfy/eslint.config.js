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
        
        // Cypress globals
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
      // Configure unused vars to be warnings with common patterns
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'prefer-const': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
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
