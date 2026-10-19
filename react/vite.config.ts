import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Relative base so the built site works from any folder on GitHub Pages (it is published at /next/).
export default defineConfig({
  base: "./",
  plugins: [react()],
  worker: { format: "es" },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
