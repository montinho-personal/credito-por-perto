import { defineConfig, globalIgnores } from "eslint/config";
import coreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "node_modules/**",
    "reports/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
  ...coreWebVitals,
]);
