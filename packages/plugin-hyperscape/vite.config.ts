import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: "./",
  build: {
    emptyOutDir: false,
    outDir: "dist",
    manifest: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      three: path.resolve(__dirname, "node_modules/three"),
    },
  },
});
