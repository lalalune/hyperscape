import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

export default [
  js.configs.recommended,
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/public/**",
      "**/libs/**",
      "**/core/libs/**",
      "packages/hyperscape/src/core/libs/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
        warnOnUnsupportedTypeScriptVersion: false,
      },
      globals: {
        // Node.js globals
        global: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
        clearImmediate: "readonly",
        // WebAPI and Browser globals
        XRSession: "readonly",
        AudioContext: "readonly",
        GainNode: "readonly",
        AudioListener: "readonly",
        AudioNode: "readonly",
        MediaStream: "readonly",
        MediaStreamAudioSourceNode: "readonly",
        File: "readonly",
        HTMLElement: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLVideoElement: "readonly",
        CanvasRenderingContext2D: "readonly",
        CanvasGradient: "readonly",
        CanvasPattern: "readonly",
        CanvasImageSource: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly",
        PointerEvent: "readonly",
        TouchEvent: "readonly",
        DragEvent: "readonly",
        WheelEvent: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        MessageEvent: "readonly",
        CloseEvent: "readonly",
        ErrorEvent: "readonly",
        EventListener: "readonly",
        Node: "readonly",
        Element: "readonly",
        DOMRect: "readonly",
        SVGGElement: "readonly",
        WebSocket: "readonly",
        WebGL2RenderingContext: "readonly",
        Worker: "readonly",
        Blob: "readonly",
        FormData: "readonly",
        Image: "readonly",
        requestAnimationFrame: "readonly",
        performance: "readonly",
        Performance: "readonly",
        WebGLProgram: "readonly",
        WebGLShader: "readonly",
        ImageData: "readonly",        ResizeObserver: "readonly",
        MutationObserver: "readonly",
        ScrollBehavior: "readonly",
        DataTransferItem: "readonly",
        Transferable: "readonly",
        AudioBufferSourceNode: "readonly",
        PannerNode: "readonly",
        OffscreenCanvas: "readonly",
        btoa: "readonly",
        crypto: "readonly",
        screen: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        self: "readonly",
        NodeJS: "readonly",
        React: "readonly",
        SVGCircleElement: "readonly",

        // Browser globals
        window: "readonly",
        Window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        HTMLImageElement: "readonly",
        ImageBitmap: "readonly",
        TexImageSource: "readonly",
        AudioBuffer: "readonly",
        CSSStyleDeclaration: "readonly",

        // Cloudflare Workers / Web Platform API globals
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        ReadableStream: "readonly",
        Touch: "readonly",
        TouchList: "readonly",

        // Common testing globals
        describe: "readonly",
        test: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        jest: "readonly",
        vi: "readonly",

        // PhysX global
        PHYSX: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-dupe-class-members": "error", // TypeScript-aware duplicate member checking
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": "allow-with-description",
          "ts-nocheck": "allow-with-description",
        },
      ],

      // JavaScript rules
      "no-unused-vars": "off", // Handled by TypeScript
      "no-dupe-class-members": "off", // Handled by TypeScript - allows method overloads
      "no-undef": "warn",
      "prefer-const": "warn",
      "no-var": "warn",
      "no-console": "off", // Allow console in this project
      "no-empty": ["warn", { allowEmptyCatch: true }],

      // Common issues
      "no-constant-condition": "warn",
      "no-cond-assign": "warn",
      "no-fallthrough": "warn",
    },
  },
  {
    // Relax rules for build and configuration files
    files: [
      "**/*.config.{js,mjs,ts}",
      "**/build/**/*.{js,mjs,ts}",
      "**/scripts/**/*.{js,mjs,ts}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-var-requires": "off",
      "no-undef": "off",
    },
  },
  {
    // Special handling for generated/vendor files
    files: [
      "**/*.d.ts",
      "**/node_modules/**/*",
      "**/dist/**/*",
      "**/build/**/*",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-undef": "off",
      "prefer-const": "off",
      "no-var": "off",
    },
  },
  {
    // Relax any rules for complex system files that require dynamic typing
    files: [
      "**/systems/client/ClientNetwork.ts",
      "**/systems/client/ClientInput.ts",
      "**/systems/client/ClientCameraSystem.ts",
      "**/systems/client/EquipmentVisualSystem.ts",
      "**/systems/shared/combat/*.ts",
      "**/systems/shared/entities/ResourceSystem.ts",
      "**/systems/shared/infrastructure/SystemLoader.ts",
      "**/systems/shared/world/TerrainShader.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
