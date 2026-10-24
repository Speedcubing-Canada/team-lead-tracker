import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/ (config imported from vitest/config so the `test` key is typed).
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
      exclude: ["**/*.test.*", "src/test/**", "functions/src/test/**", "src/main.tsx"],
      // Ratchet, about a point under measured: raise as coverage grows, never lower.
      thresholds: { statements: 88, branches: 82, functions: 86, lines: 90 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["**/*.int.test.*", "src/routes/**", "src/auth/**"],
        },
      },
      // Whole-app tests on in-memory fakes; see src/test/routeSetup.ts.
      {
        extends: true,
        test: {
          name: "routes",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts", "./src/test/routeSetup.ts"],
          include: ["src/routes/**/*.test.tsx", "src/auth/**/*.test.tsx"],
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
          setupFiles: ["./src/test/emulatorGuard.ts"],
          include: ["**/*.int.test.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
