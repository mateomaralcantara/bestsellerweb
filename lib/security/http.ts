const JSON_CONTENT_TYPE = /^application\/(?:[a-z0-9.+-]*\+)?json(?:\s*;|$)/i;

export class HttpRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "HttpRequestError";
  }
}

export function requireTrustedMutation(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  const marker = request.headers.get("x-bestseller-request");
  const allowedOrigins = new Set([requestUrl.origin]);
  const configuredSite = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSite) {
    try {
      allowedOrigins.add(new URL(configuredSite).origin);
    } catch {
      throw new HttpRequestError(
        "NEXT_PUBLIC_SITE_URL no tiene un formato válido.",
        500
      );
    }
  }

  if (fetchSite === "cross-site" || (origin && !allowedOrigins.has(origin))) {
    throw new HttpRequestError("Origen de solicitud no permitido.", 403);
  }

  if (!origin && marker !== "1") {
    throw new HttpRequestError("Solicitud no verificada.", 403);
  }

  if (marker !== "1") {
    throw new HttpRequestError("Falta la marca de solicitud segura.", 403);
  }
}

export function requireBodyWithinLimit(
  request: Request,
  maxBytes: number,
  requireKnownLength = false
) {
  const rawLength = request.headers.get("content-length");
  if (!rawLength) {
    if (requireKnownLength) {
      throw new HttpRequestError(
        "La solicitud debe declarar su tamaño.",
        411
      );
    }

    return;
  }

  const contentLength = Number(rawLength);
  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength < 0 ||
    contentLength > maxBytes
  ) {
    throw new HttpRequestError("La solicitud es demasiado grande.", 413);
  }
}

export function requireMultipartFormData(request: Request, maxBytes: number) {
  const contentType = request.headers.get("content-type") || "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !/boundary=/i.test(contentType)) {
    throw new HttpRequestError(
      "Content-Type debe ser multipart/form-data con boundary.",
      415
    );
  }

  // `Request.formData()` almacena el multipart completo en memoria. Exigir un
  // tamaño conocido permite rechazar la carga antes de que Next.js la procese.
  requireBodyWithinLimit(request, maxBytes, true);
}

async function readBodyBytes(request: Request, maxBytes: number) {
  requireBodyWithinLimit(request, maxBytes);

  if (!request.body || request.bodyUsed) {
    throw new HttpRequestError("La solicitud está vacía.", 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("body_limit_exceeded").catch(() => undefined);
        throw new HttpRequestError("La solicitud es demasiado grande.", 413);
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    throw new HttpRequestError("La solicitud está vacía.", 400);
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}

function decodeUtf8(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new HttpRequestError("La solicitud no contiene UTF-8 válido.", 400);
  }
}

export async function readJsonBody<T>(request: Request, maxBytes = 16_384) {
  const contentType = request.headers.get("content-type") || "";
  if (!JSON_CONTENT_TYPE.test(contentType)) {
    throw new HttpRequestError(
      "Content-Type debe ser application/json.",
      415
    );
  }

  const text = decodeUtf8(await readBodyBytes(request, maxBytes));

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpRequestError("El JSON de la solicitud no es válido.", 400);
  }
}

export async function readTextBody(request: Request, maxBytes: number) {
  return decodeUtf8(await readBodyBytes(request, maxBytes));
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function isPayPalOrderId(value: string) {
  return /^[A-Z0-9]{8,32}$/.test(value);
}

export function errorStatus(error: unknown, fallback = 500) {
  return error instanceof HttpRequestError ? error.status : fallback;
}

export function publicErrorMessage(
  error: unknown,
  fallback: string
) {
  return error instanceof HttpRequestError ? error.message : fallback;
}
