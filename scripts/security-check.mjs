import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const failures = [];
const tracked = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  {
  encoding: "utf8",
  }
)
  .split("\0")
  .filter((file) => Boolean(file) && existsSync(file));

const forbiddenTracked = tracked.filter((file) =>
  file !== ".env.example" &&
  /(^|\/)(?:\.env(?:\..*)?|.*\.backup(?:-|$)|.*\.bak$|reportes\/|reports\/)/i.test(file)
);

if (forbiddenTracked.length > 0) {
  failures.push(`Archivos privados o de respaldo versionados: ${forbiddenTracked.join(", ")}`);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const dependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};

for (const forbiddenDependency of [
  "epubjs",
  "xmldom",
  "@xmldom/xmldom",
  "prisma",
  "@prisma/client",
]) {
  if (dependencies[forbiddenDependency]) {
    failures.push(`Dependencia retirada por riesgo o falta de uso: ${forbiddenDependency}`);
  }
}

const requiredSnippets = new Map([
  ["proxy.ts", ["Content-Security-Policy", "frame-ancestors 'none'", "x-nonce"]],
  [
    "app/api/payments/paypal/create-order/route.ts",
    ["requireTrustedMutation", "consumeRateLimit", "readJsonBody"],
  ],
  [
    "app/api/payments/paypal/capture-order/route.ts",
    ["referencesMatch", "capturing", "consumeRateLimit"],
  ],
  [
    "app/api/payments/paypal/webhook/route.ts",
    ["verifyPayPalWebhookSignature", "claimWebhookEvent", "MAX_WEBHOOK_BYTES"],
  ],
  [
    "supabase/migrations/20260820_total_security_hardening.sql",
    [
      "grant_book_purchase_atomic",
      "claim_paypal_webhook_event",
      "consume_api_rate_limit",
      "on table public.orders from authenticated",
    ],
  ],
  [
    "lib/security/http.ts",
    ["request.body.getReader()", "totalBytes > maxBytes", "requireKnownLength"],
  ],
  [
    "app/api/books/[bookkey]/preview/[page]/route.ts",
    [
      '.eq("status", "published")',
      ".from(PREVIEW_BUCKET)",
      ".download(storagePath)",
      "detectImageType(bytes)",
    ],
  ],
  [
    "app/catalog/[slug]/preview/page.tsx",
    ['.eq("status", "published")', "/api/books/${encodeURIComponent(book.slug)}/preview/"],
  ],
  [
    "app/api/applications/affiliate/route.ts",
    [
      "requireTrustedMutation(request)",
      "supabase.auth.getUser()",
      "consumeRateLimit(request",
      "email !== accountEmail",
    ],
  ],
  [
    "components/forms/auth-form.tsx",
    [
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
      "captchaToken: captchaToken || undefined",
      "https://challenges.cloudflare.com/turnstile/v0/api.js",
    ],
  ],
  [
    "lib/security/rate-limit.ts",
    ["configured.length >= 32", 'process.env.NODE_ENV === "production"'],
  ],
  [
    "app/api/health/route.ts",
    [
      "timingSafeEqual",
      "/auth/v1/settings",
      "/v1/oauth2/token",
      "AbortSignal.timeout(8_000)",
    ],
  ],
]);

for (const [file, snippets] of requiredSnippets) {
  const content = readFileSync(file, "utf8");
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      failures.push(`${file} no contiene el control requerido: ${snippet}`);
    }
  }
}

const publicSecretPattern = /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE|OPENAI|CRON)/;
const credentialPatterns = [
  {
    label: "OpenAI API key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    label: "Supabase secret key",
    pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/,
  },
  {
    label: "GitHub token",
    pattern: /\bgh[opusr]_[A-Za-z0-9]{20,}\b/,
  },
  {
    label: "private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
];

for (const file of tracked.filter((name) => /\.(?:ts|tsx|js|mjs|cjs|json|ya?ml|md)$/i.test(name))) {
  let content = "";
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  if (publicSecretPattern.test(content)) {
    failures.push(`${file} contiene un nombre de secreto expuesto como NEXT_PUBLIC.`);
  }

  for (const credential of credentialPatterns) {
    if (credential.pattern.test(content)) {
      failures.push(`${file} parece contener una credencial real: ${credential.label}.`);
    }
  }
}

if (failures.length > 0) {
  console.error("\nCONTROLES DE SEGURIDAD FALLIDOS\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Controles estáticos de seguridad: OK");
