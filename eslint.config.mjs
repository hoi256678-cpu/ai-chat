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
    "next-env.d.ts",
    // git worktrees (superpowers subagent-driven-development) — these can
    // contain their own node_modules/venvs that aren't otherwise excluded
    // by the ignores above.
    ".worktrees/**",
    // Separate Python subsystem (see CLAUDE.md) — its .venv bundles JS
    // tooling (e.g. torch's model_dump viewer) that isn't our code.
    "ml-service/**",
  ]),
]);

export default eslintConfig;
