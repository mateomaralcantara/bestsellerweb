const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function warn(msg) {
  console.log(`⚠️ ${msg}`);
}

function fail(msg) {
  console.log(`❌ ${msg}`);
}

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

console.log("\n🔎 Diagnóstico de routing\n");

const middlewareCandidates = [
  path.join(root, "middleware.ts"),
  path.join(root, "middleware.js"),
];

const nextConfigCandidates = [
  path.join(root, "next.config.js"),
  path.join(root, "next.config.mjs"),
  path.join(root, "next.config.ts"),
];

const notFoundCandidates = [
  path.join(root, "app", "not-found.tsx"),
  path.join(root, "app", "not-found.ts"),
  path.join(root, "app", "catalog", "not-found.tsx"),
  path.join(root, "app", "catalog", "not-found.ts"),
];

const layoutCandidates = [
  path.join(root, "app", "layout.tsx"),
  path.join(root, "app", "layout.ts"),
  path.join(root, "app", "catalog", "layout.tsx"),
  path.join(root, "app", "catalog", "layout.ts"),
];

const middlewareFile = middlewareCandidates.find(exists) || null;
const nextConfigFile = nextConfigCandidates.find(exists) || null;

if (middlewareFile) {
  ok(`Existe middleware: ${path.relative(root, middlewareFile)}`);
  const code = readIfExists(middlewareFile) || "";

  if (
    code.includes("NextResponse.redirect") ||
    code.includes("NextResponse.rewrite") ||
    code.includes("redirect(")
  ) {
    warn("El middleware contiene redirect/rewrite. Revísalo.");
  } else {
    ok("El middleware no muestra redirects obvios");
  }

  if (code.includes("/catalog") || code.includes("catalog")) {
    warn("El middleware menciona catalog explícitamente");
  }
} else {
  ok("No existe middleware.*");
}

if (nextConfigFile) {
  ok(`Existe next config: ${path.relative(root, nextConfigFile)}`);
  const code = readIfExists(nextConfigFile) || "";

  if (code.includes("redirects(") || code.includes("rewrites(")) {
    warn("next.config tiene redirects o rewrites");
  } else {
    ok("next.config no muestra redirects/rewrites obvios");
  }

  if (code.includes("/catalog")) {
    warn("next.config menciona /catalog explícitamente");
  }
} else {
  warn("No encontré next.config.*");
}

const notFoundFiles = notFoundCandidates.filter(exists);
if (notFoundFiles.length > 0) {
  ok(`Encontré ${notFoundFiles.length} archivo(s) not-found`);
  notFoundFiles.forEach((file) =>
    console.log(`- ${path.relative(root, file)}`)
  );
} else {
  warn("No encontré not-found.*");
}

const layoutFiles = layoutCandidates.filter(exists);
if (layoutFiles.length > 0) {
  ok(`Encontré ${layoutFiles.length} layout(s) relevantes`);
  layoutFiles.forEach((file) =>
    console.log(`- ${path.relative(root, file)}`)
  );
} else {
  warn("No encontré layout relevante");
}

const detailPage = path.join(root, "app", "catalog", "[slug]", "page.tsx");

if (exists(detailPage)) {
  ok("Existe app/catalog/[slug]/page.tsx");
  const code = readIfExists(detailPage) || "";

  if (code.includes("notFound()")) {
    warn("La página detalle usa notFound()");
  }

  if (code.includes("redirect(")) {
    warn("La página detalle usa redirect()");
  }

  if (code.includes("console.log")) {
    ok("La página detalle ya tiene logs");
  } else {
    warn("La página detalle no tiene logs para depuración");
  }
} else {
  fail("No existe app/catalog/[slug]/page.tsx");
}