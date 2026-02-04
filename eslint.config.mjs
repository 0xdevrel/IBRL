import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // This repo is a fast-moving hackathon prototype; allow pragmatic typing while features stabilize.
      "@typescript-eslint/no-explicit-any": "off",
      // Common client-only pattern; the dashboard is dynamically imported with SSR disabled.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
