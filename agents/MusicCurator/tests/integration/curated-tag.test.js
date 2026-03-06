import { jest } from "@jest/globals";
import { AlbumConsolidator } from "../../src/album-consolidator.js";

/**
 * Testes de integração para determineCorrectAlbumName
 * Baseados em examples/test-curated-tag.js
 *
 * AllFather é mockado para não precisar de Ollama rodando.
 */
describe("AlbumConsolidator – determineCorrectAlbumName()", () => {
  function createMockAllFather(albumMetadata) {
    return {
      getMusicMetadata: jest.fn().mockResolvedValue(albumMetadata),
      compareImagesByContent: jest.fn().mockResolvedValue(0.95),
    };
  }

  // Grupo de álbuns de teste
  const mockGroup = [
    {
      name: "The Singularity (2022) [MP4] [16B-44100kHz]",
      path: "/fake/path/1",
      artist: "Wo Fat",
      trackCount: 7,
      coverPath: null,
      tracks: [{ name: "01 - The Witching Chamber.flac" }, { name: "02 - Orphans Of The Singe.flac" }],
    },
  ];

  it("adiciona tag [CURATED] quando normalizeToTitleCase=true", async () => {
    const allfather = createMockAllFather({
      album: "The Singularity",
      year: "2022",
    });

    const consolidator = new AlbumConsolidator(allfather);
    const result = await consolidator.determineCorrectAlbumName(mockGroup, {
      normalizeToTitleCase: true,
    });

    expect(result.correctName).toContain("[CURATED]");
  });

  it("NÃO adiciona tag [CURATED] quando normalizeToTitleCase=false", async () => {
    const allfather = createMockAllFather({
      album: "The Singularity",
      year: "2022",
    });

    const consolidator = new AlbumConsolidator(allfather);
    const result = await consolidator.determineCorrectAlbumName(mockGroup, {
      normalizeToTitleCase: false,
    });

    expect(result.correctName).not.toContain("[CURATED]");
  });

  it("inclui o ano encontrado via AllFather no nome final", async () => {
    const allfather = createMockAllFather({
      album: "Orphans Of The Singe",
      year: "2022",
    });

    const consolidator = new AlbumConsolidator(allfather);
    const result = await consolidator.determineCorrectAlbumName(mockGroup, {
      normalizeToTitleCase: true,
    });

    expect(result.correctName).toContain("(2022)");
  });

  it("aplica Title Case ao nome retornado pelo AllFather", async () => {
    const allfather = createMockAllFather({
      album: "the singularity",
      year: null,
    });

    const consolidator = new AlbumConsolidator(allfather);
    const result = await consolidator.determineCorrectAlbumName(mockGroup, {
      normalizeToTitleCase: true,
    });

    // Primeira letra de cada palavra deve ser maiúscula
    expect(result.correctName).toMatch(/The Singularity/);
  });

  it("usa nome normalizado do candidato quando AllFather não encontra metadados", async () => {
    const allfather = createMockAllFather(null); // AllFather retorna nulo

    const consolidator = new AlbumConsolidator(allfather);
    const result = await consolidator.determineCorrectAlbumName(mockGroup, {
      normalizeToTitleCase: true,
    });

    // Deve retornar um nome mesmo sem metadados do AllFather
    expect(result).toBeDefined();
    expect(result.correctName).toBeTruthy();
  });

  it("consulta AllFather com o nome de cada faixa do grupo", async () => {
    const mockFn = jest.fn().mockResolvedValue({ album: "Some Album", year: null });
    const allfather = { getMusicMetadata: mockFn, compareImagesByContent: jest.fn() };

    const consolidator = new AlbumConsolidator(allfather);
    await consolidator.determineCorrectAlbumName(mockGroup, { normalizeToTitleCase: true });

    // getMusicMetadata deve ter sido chamado ao menos uma vez
    expect(mockFn).toHaveBeenCalled();
    // Deve passar o nome do artista como segundo argumento
    expect(mockFn.mock.calls[0][1]).toBe("Wo Fat");
  });
});
