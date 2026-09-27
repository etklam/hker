import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./integration/safety.ts"],
    include: ["integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
