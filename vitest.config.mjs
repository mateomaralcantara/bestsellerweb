import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/.hardening-backups/**",
      "**/audit-reports/**",
      "**/reportes/**",
      "**/supabase/.temp/**",
    ],
  },
});