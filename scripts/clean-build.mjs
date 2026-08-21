import { rm } from "node:fs/promises";

await Promise.all([
  rm(".next", { recursive: true, force: true }),
  rm("tsconfig.tsbuildinfo", { force: true }),
]);

console.log("Artefactos de compilación eliminados.");
