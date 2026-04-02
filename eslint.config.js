import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir
      },
      globals: {
        ...globals.browser,
        Hooks: "readonly",
        game: "readonly",
        ui: "readonly",
        foundry: "readonly",
        Actor: "readonly",
        ActorSheet: "readonly",
        TextEditor: "readonly",
        ChatMessage: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/consistent-type-imports": "warn"
    }
  }
);
