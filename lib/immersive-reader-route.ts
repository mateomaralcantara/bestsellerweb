export function isImmersiveReaderRoute(pathname: string | null) {
  const safePathname = pathname || "";

  return (
    safePathname.startsWith("/reader/") ||
    /^\/catalog\/[^/]+\/preview\/?$/.test(safePathname)
  );
}
