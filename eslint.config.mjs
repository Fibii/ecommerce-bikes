import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Layer rule: the domain imports only the domain. Anything that is not a
  // path inside src/domain is rejected, which covers React, Next.js, zod,
  // Node built-ins and the other layers.
  {
    files: ["src/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // Allowed: "./x" and "@/domain/x", with no ".." segment.
              regex: "^(?!(?:\\./|@/domain/)(?!(?:.*/)?\\.\\.(?:/|$)))",
              message:
                "The domain imports only the domain: use ./ or @/domain/ paths.",
            },
          ],
        },
      ],
    },
  },
  // Layer rule: application imports the domain and itself only. Its tests may
  // also use the in-memory adapters, as AGENTS.md describes.
  {
    files: ["src/application/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex:
                "^(?!(?:\\./|@/domain/|@/application/)(?!(?:.*/)?\\.\\.(?:/|$)))",
              message:
                "The application layer imports only the domain and itself.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/application/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex:
                "^(?!(?:\\./|@/domain/|@/application/|@/infrastructure/)(?!(?:.*/)?\\.\\.(?:/|$)))",
              message:
                "Application tests import the domain, the application and the in-memory adapters.",
            },
          ],
        },
      ],
    },
  },
  // Layer rule: adapters implement ports. They may use the domain, the
  // application's ports and Node, never the framework or the UI.
  {
    files: ["src/infrastructure/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "react",
                "react/*",
                "react-dom",
                "react-dom/*",
                "zod",
                "@/app/*",
                "@/features/*",
                "@/ui/*",
                "@/server/*",
                "@/contracts/*",
                "@/application/*",
                "!@/application/ports",
              ],
              message:
                "Adapters import the domain and application ports, not the framework or other layers.",
            },
          ],
        },
      ],
    },
  },
  // Layer rule: only server/composition.ts imports infrastructure.
  {
    files: ["src/app/**", "src/features/**", "src/ui/**", "src/contracts/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/infrastructure/*", "**/infrastructure/*"],
              message:
                "Only server/composition.ts imports infrastructure; use the application through the composition root.",
            },
          ],
        },
      ],
    },
  },
  // Turns off ESLint rules that conflict with Prettier. Keep it last.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated reports:
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
