import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";
import path from "path";
import yaml from "@rollup/plugin-yaml";

// Define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    yaml()
  ],
  build: {
    rollupOptions: {
      input: {
        configurator: resolve(__dirname, "configurator.html"),
        overlay: resolve(__dirname, "overlay.html"),
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    // Add this to help Vite handle the HMR for Tauri
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
