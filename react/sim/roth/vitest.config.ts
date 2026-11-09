// Local Vitest config for the Roth Catha sim (the project's shared config only includes src/**).
// Run from /home/claude/monsiv/react:  npx vitest run --config sim/roth/vitest.config.ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: { environment: "node", include: ["tests/**/*.test.ts"], testTimeout: 120000 },
});
