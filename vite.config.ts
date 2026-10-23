import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/ — config imported from vitest/config so the `test` key is typed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) {
            return "vendor-firebase";
          }
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router-dom/")
          ) {
            return "vendor-react";
          }
        },
      },
    },
  },
  test: {
    globals: true,
    coverage: {
      include: ["src/**", "functions/src/**"],
      exclude: ["**/*.test.*", "src/test/**", "src/main.tsx"],
      // Ratchet: raise as coverage grows, never lower.
      thresholds: { statements: 83, branches: 77, functions: 85, lines: 84 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["**/*.int.test.*"],
        },
      },
      {
        extends: true,
        test: {
          name: "functions",
          environment: "node",
          include: ["functions/src/**/*.test.ts"],
          exclude: ["**/*.int.test.*"],
        },
      },
      // Needs the emulators: run via `npm run test:int`.
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["**/*.int.test.ts"],
          exclude: ["**/node_modules/**"],
          fileParallelism: false,
        },
      },
    ],
  },
});
