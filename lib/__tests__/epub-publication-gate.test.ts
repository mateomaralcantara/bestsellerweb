import { describe, expect, it } from "vitest";
import {
  EPUB_PUBLICATION_MIN_SCORE,
  evaluateEpubPublicationGate,
} from "../epub-publication-gate";

const asset = {
  id: "asset-1",
  storage_path: "books/book-1/full/current.epub",
};

function report(overrides?: Record<string, unknown>) {
  return {
    id: "report-1",
    score: EPUB_PUBLICATION_MIN_SCORE,
    status: "pass",
    summary: {
      preflightProfile: "libroseller-10",
      sourceAssetId: asset.id,
      sourceStoragePath: asset.storage_path,
    },
    ...overrides,
  };
}

describe("evaluateEpubPublicationGate", () => {
  it("aprueba solo el reporte libroseller-10 del archivo vigente", () => {
    const result = evaluateEpubPublicationGate(asset, report());
    expect(result.ready).toBe(true);
    expect(result.code).toBe("ready");
  });

  it("rechaza reportes de un asset anterior", () => {
    const result = evaluateEpubPublicationGate(
      asset,
      report({
        summary: {
          preflightProfile: "libroseller-10",
          sourceAssetId: "asset-anterior",
          sourceStoragePath: asset.storage_path,
        },
      })
    );
    expect(result.ready).toBe(false);
    expect(result.code).toBe("asset_mismatch");
  });

  it("rechaza reportes viejos cuando la carga directa conserva el mismo asset id pero cambia la ruta", () => {
    const result = evaluateEpubPublicationGate(
      asset,
      report({
        summary: {
          preflightProfile: "libroseller-10",
          sourceAssetId: asset.id,
          sourceStoragePath: "books/book-1/full/old.epub",
        },
      })
    );
    expect(result.ready).toBe(false);
    expect(result.code).toBe("file_mismatch");
  });

  it("rechaza un score inferior a 90 aunque el reporte diga pass", () => {
    const result = evaluateEpubPublicationGate(asset, report({ score: 89 }));
    expect(result.ready).toBe(false);
    expect(result.code).toBe("quality_not_passed");
  });

  it("rechaza preflights heredados sin perfil libroseller-10", () => {
    const result = evaluateEpubPublicationGate(
      asset,
      report({ summary: { sourceAssetId: asset.id, sourceStoragePath: asset.storage_path } })
    );
    expect(result.ready).toBe(false);
    expect(result.code).toBe("profile_outdated");
  });
});
