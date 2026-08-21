const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function prefix(file: File, length: number) {
  return new Uint8Array(await file.slice(0, length).arrayBuffer());
}

function matches(bytes: Uint8Array, expected: number[], offset = 0) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

export async function assertSafeCoverFile(file: File) {
  const bytes = await prefix(file, 16);
  const jpeg = matches(bytes, [0xff, 0xd8, 0xff]);
  const png = matches(bytes, PNG_SIGNATURE);
  const webp =
    matches(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    matches(bytes, [0x57, 0x45, 0x42, 0x50], 8);

  if (!jpeg && !png && !webp) {
    throw new Error("La firma interna de la portada no es JPG, PNG ni WebP.");
  }
}

export async function assertSafePdfFile(file: File) {
  const bytes = await prefix(file, 5);
  if (!matches(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    throw new Error("La firma interna del manuscrito no corresponde a un PDF.");
  }
}

export async function assertSafeEpubFile(file: File) {
  const bytes = await prefix(file, 4);
  if (!matches(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    throw new Error("La firma interna del archivo no corresponde a un EPUB/ZIP.");
  }

  const JSZipModule = await import("jszip");
  const zip = await JSZipModule.default.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files) as Array<{
    _data?: { uncompressedSize?: number };
  }>;

  if (entries.length > 5_000) {
    throw new Error("El EPUB contiene demasiados archivos internos.");
  }

  const uncompressedBytes = entries.reduce(
    (total, entry) => total + Number(entry._data?.uncompressedSize || 0),
    0
  );

  if (uncompressedBytes > 512 * 1024 * 1024) {
    throw new Error("El EPUB expandido supera el límite de seguridad.");
  }

  const mimetype = zip.file("mimetype");
  const container = zip.file("META-INF/container.xml");

  if (!mimetype || !container) {
    throw new Error("El EPUB no contiene mimetype o META-INF/container.xml.");
  }

  const declaredType = (await mimetype.async("text")).trim();
  if (declaredType !== "application/epub+zip") {
    throw new Error("El archivo no declara el tipo application/epub+zip.");
  }

  const containerXml = await container.async("text");
  if (containerXml.length > 1_000_000 || !/<rootfile\b/i.test(containerXml)) {
    throw new Error("El contenedor interno del EPUB no es válido.");
  }
}
