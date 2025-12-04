import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const uiPort = Number(env.ASSET_FORGE_PORT) || 3400;
  const apiPort = Number(env.ASSET_FORGE_API_PORT) || 3401;

  return {
    plugins: [react()],
    resolve: {
      dedupe: ["react", "react-dom", "react/jsx-runtime", "three"],
      alias: {
        "@": path.resolve(__dirname, "src"),
        react: path.resolve(__dirname, "../../node_modules/react"),
        "react-dom": path.resolve(__dirname, "../../node_modules/react-dom"),
        "react/jsx-runtime": path.resolve(
          __dirname,
          "../../node_modules/react/jsx-runtime",
        ),
        // three is resolved from local node_modules, not root
      },
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "three",
        "@react-three/fiber",
        "@react-three/drei",
      ],
      esbuildOptions: {
        resolveExtensions: [".mjs", ".js", ".jsx", ".json", ".ts", ".tsx"],
      },
    },
    server: {
      port: uiPort,
      proxy: {
        "/api": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
        "/assets": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
