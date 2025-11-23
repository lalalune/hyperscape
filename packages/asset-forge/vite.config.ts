import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
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
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:3004",
        changeOrigin: true,
      },
      "/assets": {
        target: "http://localhost:3004",
        changeOrigin: true,
      },
    },
  },
});
