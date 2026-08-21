export function normalizeExternalHttpsUrl(value: unknown) {
  if (typeof value !== "string") return null;

  const candidate = value.trim();
  if (!candidate || candidate.length > 2_048) return null;

  try {
    const url = new URL(candidate);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
