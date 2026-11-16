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
