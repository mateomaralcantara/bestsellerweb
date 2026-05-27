// scripts/audit-project.mjs
// Uso:
// npm run audit:project
// node scripts/audit-project.mjs
// node scripts/audit-project.mjs C:/ruta/a/proyecto
// node scripts/audit-project.mjs --no-content

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const rootArg = args.find((arg) => !arg.startsWith("--"));

const ROOT = path.resolve(rootArg || process.cwd());

const INCLUDE_CONTENT = !flags.has("--no-content");

const OUTPUT_MD = path.join(ROOT, "software-structure-report.md");
const OUTPUT_JSON = path.join(ROOT, "software-structure-report.json");

const MAX_FILE_SIZE_FOR_CONTENT = 100_000;
const MAX_TREE_DEPTH = 9;
const MAX_TOTAL_FILES = 12_000;
const MAX_INCLUDED_FILES = 180;

const REPORT_FILES = new Set([
  "software-structure-report.md",
  "software-structure-report.json",
]);

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
  ".output",
  ".cache",
  ".parcel-cache",
  "out",
  "logs",
  "tmp",
  "temp",
  ".idea",
  ".vscode",
]);

const IGNORE_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  ".DS_Store",
  ...REPORT_FILES,
]);

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".prisma",
  ".sql",
  ".md",
  ".css",
  ".scss",
  ".html",
  ".yml",
  ".yaml",
]);

const PRIVATE_ASSET_EXTENSIONS = new Set([
  ".pdf",
  ".epub",
  ".zip",
  ".mp4",
  ".mov",
  ".m4v",
]);

const HIGH_SIGNAL_FILENAMES = new Set([
  "package.json",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "middleware.ts",
  "middleware.js",
  "tailwind.config.js",
  "tailwind.config.ts",
  "postcss.config.js",
  "postcss.config.mjs",
  "tsconfig.json",
  "jsconfig.json",
  "schema.prisma",
  "docker-compose.yml",
  "docker-compose.yaml",
  "Dockerfile",
  "README.md",
]);

const HIGH_SIGNAL_TERMS = [
  "book",
  "books",
  "libro",
  "libros",
  "reader",
  "read",
  "leer",
  "summary",
  "resumen",
  "purchase",
  "purchases",
  "compra",
  "checkout",
  "payment",
  "payments",
  "stripe",
  "paypal",
  "mercadopago",
  "auth",
  "session",
  "user",
  "usuario",
  "order",
  "orders",
  "api",
  "route",
  "middleware",
  "prisma",
  "db",
  "database",
];

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function rel(filePath) {
  return toPosix(path.relative(ROOT, filePath));
}

function segments(filePath) {
  return toPosix(filePath).split("/").filter(Boolean);
}

function hasSegment(filePath, segment) {
  return segments(filePath).includes(segment);
}

function isIgnoredDir(name) {
  return IGNORE_DIRS.has(name);
}

function isIgnoredFile(name) {
  return IGNORE_FILES.has(name);
}

function isEnvFile(name) {
  return name === ".env" || name.startsWith(".env.");
}

function hashContent(content) {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function redactSecrets(content) {
  let output = content;

  output = output.replace(
    /(sk_live_|sk_test_|pk_live_|pk_test_)[A-Za-z0-9_\-]+/g,
    "$1[REDACTED]"
  );

  output = output.replace(
    /(Bearer\s+)[A-Za-z0-9._\-]+/gi,
    "$1[REDACTED]"
  );

  output = output.replace(
    /(DATABASE_URL\s*=\s*)[^\n]+/gi,
    "$1[REDACTED]"
  );

  output = output.replace(
    /(api[_-]?key|secret|token|password|passwd|private[_-]?key)(\s*[:=]\s*)["'`]?[^\n"'`,}]+["'`]?/gi,
    "$1$2[REDACTED]"
  );

  output = output.replace(
    /("(?:apiKey|secret|token|password|privateKey|clientSecret|webhookSecret)"\s*:\s*)"(.*?)"/gi,
    '$1"[REDACTED]"'
  );

  return output;
}

async function safeReadText(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function safeStat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

function sortEntries(entries) {
  return entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });
}

async function walk(dir, depth = 0, allFiles = [], treeLines = []) {
  if (allFiles.length >= MAX_TOTAL_FILES) return { allFiles, treeLines };

  let entries;

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return { allFiles, treeLines };
  }

  entries = sortEntries(
    entries.filter((entry) => {
      if (entry.isSymbolicLink()) return false;
      if (entry.isDirectory()) return !isIgnoredDir(entry.name);
      if (entry.isFile()) return !isIgnoredFile(entry.name);
      return false;
    })
  );

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = rel(absolutePath);
    const indent = "  ".repeat(depth);
    const prefix = entry.isDirectory() ? "📁" : "📄";

    treeLines.push(`${indent}${prefix} ${entry.name}`);

    if (entry.isDirectory()) {
      if (depth + 1 < MAX_TREE_DEPTH) {
        await walk(absolutePath, depth + 1, allFiles, treeLines);
      } else {
        treeLines.push(`${indent}  … profundidad máxima alcanzada`);
      }

      continue;
    }

    if (entry.isFile()) {
      const stats = await safeStat(absolutePath);
      const ext = path.extname(entry.name).toLowerCase();

      allFiles.push({
        path: relativePath,
        absolutePath,
        name: entry.name,
        ext,
        size: stats?.size ?? 0,
      });

      if (allFiles.length >= MAX_TOTAL_FILES) break;
    }
  }

  return { allFiles, treeLines };
}

function fileScore(file) {
  const p = file.path.toLowerCase();
  const name = file.name;
  let score = 0;

  if (HIGH_SIGNAL_FILENAMES.has(name)) score += 100;

  if (hasSegment(p, "app")) score += 30;
  if (hasSegment(p, "pages")) score += 25;
  if (hasSegment(p, "api")) score += 30;
  if (hasSegment(p, "components")) score += 15;
  if (hasSegment(p, "lib")) score += 20;
  if (hasSegment(p, "server")) score += 25;
  if (hasSegment(p, "actions")) score += 25;
  if (hasSegment(p, "prisma")) score += 40;

  for (const term of HIGH_SIGNAL_TERMS) {
    if (p.includes(term)) score += 10;
  }

  if (/\/route\.(ts|js)$/.test(p)) score += 45;
  if (/\/page\.(tsx|ts|jsx|js)$/.test(p)) score += 35;
  if (/\/layout\.(tsx|ts|jsx|js)$/.test(p)) score += 15;

  return score;
}

function shouldIncludeContent(file) {
  if (!INCLUDE_CONTENT) return false;
  if (isEnvFile(file.name)) return false;
  if (file.size <= 0 || file.size > MAX_FILE_SIZE_FOR_CONTENT) return false;

  const extAllowed =
    SOURCE_EXTENSIONS.has(file.ext) || HIGH_SIGNAL_FILENAMES.has(file.name);

  if (!extAllowed) return false;

  return fileScore(file) >= 20;
}

function getDeps(packageJson) {
  return {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {}),
  };
}

function hasDep(deps, name) {
  return Boolean(deps[name]);
}

function detectProjectType(packageJson) {
  const deps = getDeps(packageJson);
  const found = [];

  if (hasDep(deps, "next")) found.push("Next.js");
  if (hasDep(deps, "react")) found.push("React");
  if (hasDep(deps, "@prisma/client") || hasDep(deps, "prisma")) {
    found.push("Prisma");
  }
  if (
    hasDep(deps, "next-auth") ||
    hasDep(deps, "@auth/core") ||
    hasDep(deps, "@clerk/nextjs") ||
    hasDep(deps, "clerk")
  ) {
    found.push("Auth");
  }
  if (hasDep(deps, "stripe")) found.push("Stripe");
  if (hasDep(deps, "@paypal/checkout-server-sdk") || hasDep(deps, "paypal")) {
    found.push("PayPal");
  }
  if (hasDep(deps, "mercadopago")) found.push("Mercado Pago");
  if (hasDep(deps, "tailwindcss")) found.push("Tailwind CSS");
  if (hasDep(deps, "typescript")) found.push("TypeScript");

  return found;
}

function cleanAppRoute(route) {
  const cleaned = route
    .split("/")
    .filter(Boolean)
    .filter((part) => !part.startsWith("(") || !part.endsWith(")"))
    .filter((part) => !part.startsWith("@"))
    .join("/");

  return cleaned ? `/${cleaned}` : "/";
}

function appFileToRoute(filePath) {
  let route = filePath
    .replace(/^app\//, "")
    .replace(/(^|\/)(page|route)\.(tsx|ts|jsx|js)$/, "");

  return cleanAppRoute(route);
}

function pagesFileToRoute(filePath) {
  let route = filePath
    .replace(/^pages\//, "")
    .replace(/\.(tsx|ts|jsx|js)$/, "")
    .replace(/\/index$/, "")
    .replace(/^index$/, "");

  route = route
    .split("/")
    .filter(Boolean)
    .join("/");

  return route ? `/${route}` : "/";
}

function extractRoutes(files) {
  const routes = [];

  for (const file of files) {
    const p = file.path;

    if (/^app\/(?:.*\/)?page\.(tsx|ts|jsx|js)$/.test(p)) {
      routes.push({
        type: "app-page",
        route: appFileToRoute(p),
        file: p,
      });
    }

    if (/^app\/(?:.*\/)?route\.(ts|js)$/.test(p)) {
      routes.push({
        type: "app-api-route",
        route: appFileToRoute(p),
        file: p,
      });
    }

    if (/^pages\/api\/.*\.(ts|js)$/.test(p)) {
      routes.push({
        type: "pages-api-route",
        route: pagesFileToRoute(p),
        file: p,
      });
    }

    if (
      /^pages\/.*\.(tsx|ts|jsx|js)$/.test(p) &&
      !p.startsWith("pages/api/") &&
      !p.includes("/_")
    ) {
      routes.push({
        type: "pages-page",
        route: pagesFileToRoute(p),
        file: p,
      });
    }
  }

  return routes.sort((a, b) => {
    if (a.route === b.route) return a.file.localeCompare(b.file);
    return a.route.localeCompare(b.route);
  });
}

function extractEnvKeys(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("=")[0]?.trim())
    .filter(Boolean);
}

async function collectEnvInfo(files) {
  const envFiles = files.filter((file) => isEnvFile(file.name));
  const result = [];

  for (const file of envFiles) {
    const content = await safeReadText(file.absolutePath);

    result.push({
      file: file.path,
      keys: content ? extractEnvKeys(content) : [],
    });
  }

  return result.sort((a, b) => a.file.localeCompare(b.file));
}

async function readPackageJson() {
  const packagePath = path.join(ROOT, "package.json");
  const content = await safeReadText(packagePath);

  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function collectIncludedFiles(files) {
  const candidates = files
    .filter(shouldIncludeContent)
    .map((file) => ({
      ...file,
      score: fileScore(file),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.path.localeCompare(b.path);
    })
    .slice(0, MAX_INCLUDED_FILES);

  const included = [];

  for (const file of candidates) {
    const content = await safeReadText(file.absolutePath);
    if (!content) continue;

    included.push({
      path: file.path,
      size: file.size,
      score: file.score,
      sha256: hashContent(content),
      content: redactSecrets(content),
    });
  }

  return included.sort((a, b) => a.path.localeCompare(b.path));
}

function dependencyTable(packageJson) {
  if (!packageJson) return [];

  const deps = packageJson.dependencies || {};
  const devDeps = packageJson.devDependencies || {};

  return Object.entries({ ...deps, ...devDeps })
    .map(([name, version]) => ({
      name,
      version,
      type: deps[name] ? "dependency" : "devDependency",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function findPublicPrivateAssets(files) {
  return files
    .filter((file) => file.path.startsWith("public/"))
    .filter((file) => PRIVATE_ASSET_EXTENSIONS.has(file.ext))
    .map((file) => ({
      path: file.path,
      size: file.size,
    }))
    .sort((a, b) => b.size - a.size);
}

function contentHasAny(includedFiles, terms) {
  const lowerTerms = terms.map((term) => term.toLowerCase());

  return includedFiles.some((file) => {
    const content = file.content.toLowerCase();
    return lowerTerms.some((term) => content.includes(term));
  });
}

function detectRiskAreas(files, routes, packageJson, includedFiles) {
  const risks = [];
  const deps = getDeps(packageJson);
  const publicAssets = findPublicPrivateAssets(files);

  if (publicAssets.length) {
    risks.push({
      level: "high",
      area: "public-assets",
      note:
        "Hay PDFs/EPUBs/videos/zips dentro de /public. Si ahí vive el libro completo, cualquiera puede acceder con la URL directa.",
      evidence: publicAssets.slice(0, 10).map((asset) => asset.path),
    });
  }

  const hasReadRoute = routes.some((route) =>
    /read|leer|reader|book|libro/i.test(route.route)
  );

  if (!hasReadRoute) {
    risks.push({
      level: "medium",
      area: "book-reader-routing",
      note:
        "No detecté claramente una ruta de lectura. Puede que el lector esté mezclado con una página pública.",
    });
  }

  const hasAuth =
    hasDep(deps, "next-auth") ||
    hasDep(deps, "@auth/core") ||
    hasDep(deps, "@clerk/nextjs") ||
    hasDep(deps, "clerk");

  if (!hasAuth) {
    risks.push({
      level: "medium",
      area: "auth",
      note:
        "No detecté una librería común de autenticación. Para vender libros necesitas identificar al usuario antes de autorizar lectura.",
    });
  }

  const hasPayments =
    hasDep(deps, "stripe") ||
    hasDep(deps, "mercadopago") ||
    hasDep(deps, "paypal") ||
    hasDep(deps, "@paypal/checkout-server-sdk");

  if (!hasPayments) {
    risks.push({
      level: "medium",
      area: "payments",
      note:
        "No detecté integración común de pagos. Puede estar custom, pero conviene revisar cómo confirmas compras.",
    });
  }

  const hasDirectPdfUsage = contentHasAny(includedFiles, [
    "pdfUrl",
    ".pdf",
    "application/pdf",
    "getDocument({ url",
  ]);

  if (hasDirectPdfUsage) {
    risks.push({
      level: "high",
      area: "pdf-access",
      note:
        "Detecté señales de PDF usado directamente en el frontend. Si el pdfUrl apunta a un archivo público, el libro no está protegido.",
    });
  }

  const hasPurchaseLogic = contentHasAny(includedFiles, [
    "purchase",
    "purchases",
    "paid",
    "checkout",
    "payment",
    "stripe",
    "mercadopago",
    "paypal",
  ]);

  if (!hasPurchaseLogic) {
    risks.push({
      level: "high",
      area: "purchase-gate",
      note:
        "No detecté lógica clara de compra/pago en archivos clave. Para bloquear Ver libro, debe existir una validación server-side de compra pagada.",
    });
  }

  return risks;
}

function makeMarkdownReport({
  root,
  generatedAt,
  packageJson,
  projectType,
  dependencies,
  routes,
  envInfo,
  risks,
  publicAssets,
  treeLines,
  includedFiles,
}) {
  const scripts = packageJson?.scripts || {};

  let md = "";

  md += "# Software Structure Report\n\n";
  md += `Generated at: ${generatedAt}\n\n`;
  md += `Root: \`${root}\`\n\n`;

  md += "## Project detected\n\n";
  md += projectType.length
    ? projectType.map((item) => `- ${item}`).join("\n") + "\n\n"
    : "- Unknown / custom\n\n";

  md += "## Package scripts\n\n";
  if (Object.keys(scripts).length) {
    for (const [name, command] of Object.entries(scripts)) {
      md += `- \`${name}\`: \`${command}\`\n`;
    }
  } else {
    md += "No scripts found.\n";
  }
  md += "\n";

  md += "## Main dependencies\n\n";
  if (dependencies.length) {
    for (const dep of dependencies) {
      md += `- ${dep.name}: \`${dep.version}\` (${dep.type})\n`;
    }
  } else {
    md += "No dependencies found.\n";
  }
  md += "\n";

  md += "## Routes detected\n\n";
  if (routes.length) {
    for (const route of routes) {
      md += `- [${route.type}] \`${route.route}\` → \`${route.file}\`\n`;
    }
  } else {
    md += "No routes detected.\n";
  }
  md += "\n";

  md += "## Public private-like assets\n\n";
  if (publicAssets.length) {
    for (const asset of publicAssets.slice(0, 30)) {
      md += `- \`${asset.path}\` (${asset.size} bytes)\n`;
    }
  } else {
    md += "No PDF/EPUB/video/zip files detected inside /public.\n";
  }
  md += "\n";

  md += "## Environment files\n\n";
  if (envInfo.length) {
    for (const env of envInfo) {
      md += `### ${env.file}\n\n`;
      if (env.keys.length) {
        for (const key of env.keys) {
          md += `- ${key}\n`;
        }
      } else {
        md += "No keys detected or file unreadable.\n";
      }
      md += "\n";
    }
  } else {
    md += "No .env files detected.\n\n";
  }

  md += "## Possible risk areas\n\n";
  if (risks.length) {
    for (const risk of risks) {
      md += `- **${risk.level.toUpperCase()} / ${risk.area}:** ${risk.note}\n`;

      if (risk.evidence?.length) {
        for (const item of risk.evidence) {
          md += `  - Evidence: \`${item}\`\n`;
        }
      }
    }
  } else {
    md += "No obvious risk areas detected automatically.\n";
  }
  md += "\n";

  md += "## Recommended update direction\n\n";
  md += "- El resumen debe vivir en una página pública sin entregar `pdfUrl` real.\n";
  md += "- El lector completo debe vivir en una ruta protegida.\n";
  md += "- El PDF completo no debe estar en `/public`.\n";
  md += "- El endpoint que entrega el PDF debe validar usuario + compra con estado pagado.\n";
  md += "- El frontend nunca debe decidir si alguien pagó; eso va en servidor.\n\n";

  md += "## Project tree\n\n";
  md += "```txt\n";
  md += treeLines.join("\n");
  md += "\n```\n\n";

  md += "## High-signal file contents\n\n";
  md += "Archivos clave para revisar arquitectura, rutas, pagos, auth, lector, base de datos y separación resumen/libro.\n\n";

  if (!INCLUDE_CONTENT) {
    md += "Content capture disabled with `--no-content`.\n\n";
    return md;
  }

  for (const file of includedFiles) {
    md += `### ${file.path}\n\n`;
    md += `Size: ${file.size} bytes  \n`;
    md += `Score: ${file.score}  \n`;
    md += `SHA256 short: ${file.sha256}\n\n`;

    const ext = path.extname(file.path).replace(".", "") || "txt";

    md += "```" + ext + "\n";
    md += file.content;
    md += "\n```\n\n";
  }

  return md;
}

async function main() {
  console.log(`Escaneando proyecto: ${ROOT}`);

  const packageJson = await readPackageJson();
  const { allFiles, treeLines } = await walk(ROOT);

  const projectType = detectProjectType(packageJson || {});
  const dependencies = dependencyTable(packageJson);
  const routes = extractRoutes(allFiles);
  const envInfo = await collectEnvInfo(allFiles);
  const includedFiles = await collectIncludedFiles(allFiles);
  const publicAssets = findPublicPrivateAssets(allFiles);
  const risks = detectRiskAreas(
    allFiles,
    routes,
    packageJson || {},
    includedFiles
  );

  const generatedAt = new Date().toISOString();

  const jsonReport = {
    generatedAt,
    root: ROOT,
    projectType,
    package: {
      name: packageJson?.name || null,
      version: packageJson?.version || null,
      scripts: packageJson?.scripts || {},
    },
    dependencies,
    routes,
    envInfo,
    publicAssets,
    risks,
    stats: {
      totalFiles: allFiles.length,
      includedFiles: includedFiles.length,
      includeContent: INCLUDE_CONTENT,
    },
    files: allFiles.map((file) => ({
      path: file.path,
      ext: file.ext,
      size: file.size,
    })),
    includedFiles: includedFiles.map((file) => ({
      path: file.path,
      size: file.size,
      score: file.score,
      sha256: file.sha256,
    })),
  };

  const mdReport = makeMarkdownReport({
    root: ROOT,
    generatedAt,
    packageJson,
    projectType,
    dependencies,
    routes,
    envInfo,
    risks,
    publicAssets,
    treeLines,
    includedFiles,
  });

  await fs.writeFile(OUTPUT_JSON, JSON.stringify(jsonReport, null, 2), "utf8");
  await fs.writeFile(OUTPUT_MD, mdReport, "utf8");

  console.log("");
  console.log("Listo. Reportes generados:");
  console.log(`- ${OUTPUT_MD}`);
  console.log(`- ${OUTPUT_JSON}`);
  console.log("");
  console.log(`Archivos escaneados: ${allFiles.length}`);
  console.log(`Archivos clave incluidos: ${includedFiles.length}`);
  console.log("");
  console.log("Súbeme estos dos archivos:");
  console.log("- software-structure-report.md");
  console.log("- software-structure-report.json");
}

main().catch((error) => {
  console.error("Error generando reporte:");
  console.error(error);
  process.exit(1);
});