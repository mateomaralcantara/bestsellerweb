import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function getSupabaseOrigin() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!rawUrl) return "";

  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

function buildContentSecurityPolicy(nonce: string) {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const supabaseOrigin = getSupabaseOrigin();
  const supabaseSocket = supabaseOrigin.replace(/^https:/, "wss:");
  const paypalSources = "https://*.paypal.com https://*.paypalobjects.com https://*.venmo.com";
  const turnstileSource = "https://challenges.cloudflare.com";
  const scriptDevelopment = isDevelopment ? " 'unsafe-eval'" : "";
  const upgradeInsecureRequests = isDevelopment
    ? ""
    : "upgrade-insecure-requests;";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${scriptDevelopment} ${paypalSources} ${turnstileSource}`,
    "script-src-attr 'none'",
    `style-src 'self' 'nonce-${nonce}' ${paypalSources}`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseOrigin} ${paypalSources}`,
    `font-src 'self' data: ${paypalSources}`,
    `connect-src 'self' ${supabaseOrigin} ${supabaseSocket} ${paypalSources}`,
    `frame-src 'self' ${paypalSources} ${turnstileSource}`,
    `child-src 'self' blob: ${paypalSources}`,
    `media-src 'self' blob: ${supabaseOrigin}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${paypalSources}`,
    "frame-ancestors 'none'",
    upgradeInsecureRequests,
  ]
    .filter(Boolean)
    .join("; ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request: { headers: requestHeaders },
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    await supabase.auth.getClaims().catch(() => undefined);
  }

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("X-Frame-Options", "DENY");

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png|bestseller-icon-1024.png|og-image.png|pdf.worker.min.mjs|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
