const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const appDir = path.join(root, "app");

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function warn(msg) {
  console.log(`⚠️ ${msg}`);
}

function fail(msg) {
  console.log(`❌ ${msg}`);
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function walk(dir, results = []) {
  if (!exists(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(fullPath);
      walk(fullPath, results);
    }
  }

  return results;
}

console.log("\n🔎 Revisando rutas paralelas sin default.tsx\n");

if (!exists(appDir)) {
  fail("No existe carpeta app/");
  process.exit(1);
}

const dirs = walk(appDir);
const parallelRouteDirs = dirs.filter((dir) =>
  path.basename(dir).startsWith("@")
);

if (parallelRouteDirs.length === 0) {
  ok("No encontré rutas paralelas (@slot) en app/");
  process.exit(0);
}

let hasProblem = false;

for (const dir of parallelRouteDirs) {
  const rel = path.relative(root, dir);

  const hasDefault =
    exists(path.join(dir, "default.tsx")) ||
    exists(path.join(dir, "default.ts")) ||
    exists(path.join(dir, "default.jsx")) ||
    exists(path.join(dir, "default.js"));

  const hasPage =
    exists(path.join(dir, "page.tsx")) ||
    exists(path.join(dir, "page.ts")) ||
    exists(path.join(dir, "page.jsx")) ||
    exists(path.join(dir, "page.js"));

  console.log(`\n- ${rel}`);

  if (hasDefault) {
    ok("Tiene default.*");
  } else {
    fail("NO tiene default.*");
    hasProblem = true;
  }

  if (hasPage) {
    ok("Tiene page.*");
  } else {
    warn("No tiene page.*");
  }
}

if (hasProblem) {
  console.log(
    "\n💥 Encontré rutas paralelas sin default.*. Eso puede disparar el 404 que estás viendo."
  );
  process.exitCode = 1;
} else {
  console.log("\n🚀 Las rutas paralelas encontradas tienen default.*");
  process.exitCode = 0;
}