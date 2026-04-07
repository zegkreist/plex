import { jest } from "@jest/globals";
import { EmbeddingService } from "../../src/services/EmbeddingService.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────
//
// Representa a diversidade real de uma biblioteca: formatos diferentes (MP3,
// FLAC, OGG, M4A), metadados completos ou parcialmente ausentes, caracteres
// especiais e gêneros múltiplos.
//
// Cada faixa inclui Media[0].Part[0].file — o path retornado pelo Plex,
// que é usado pelo AudioAnalyzerService para localizar o arquivo no disco.
//
const TRACKS = {
  // MP3 — metadados completos, gêneros múltiplos
  metal: {
    ratingKey: "100",
    title: "Paranoid",
    artist: "Black Sabbath",
    album: "Paranoid",
    genres: ["Heavy Metal", "Rock"],
    Media: [{ Part: [{ file: "/music/Black Sabbath/Paranoid/01 - Paranoid.mp3" }] }],
  },
  // FLAC — sem gêneros
  jazz: {
    ratingKey: "101",
    title: "So What",
    artist: "Miles Davis",
    album: "Kind of Blue",
    genres: [],
    Media: [{ Part: [{ file: "/music/Miles Davis/Kind of Blue/01 - So What.flac" }] }],
  },
  // OGG — sem álbum
  rock_noAlbum: {
    ratingKey: "102",
    title: "Wish You Were Here",
    artist: "Pink Floyd",
    album: undefined,
    genres: ["Progressive Rock"],
    Media: [{ Part: [{ file: "/music/Pink Floyd/Wish You Were Here/05 - Wish You Were Here.ogg" }] }],
  },
  // M4A — caracteres Unicode
  unicode: {
    ratingKey: "103",
    title: "Jóga",
    artist: "Björk",
    album: "Homogenic",
    genres: ["Art Pop", "Electronic"],
    Media: [{ Part: [{ file: "/music/Björk/Homogenic/07 - Jóga.m4a" }] }],
  },
  // MP3 — metadados completamente ausentes (edge case)
  sparse: {
    ratingKey: "104",
    title: undefined,
    artist: undefined,
    album: undefined,
    genres: undefined,
    // sem Media — testa o path sem arquivo
  },
};

const ALL_TRACKS = Object.values(TRACKS);

// Vetor sintético de 768 dimensões (simula nomic-embed-text)
const FAKE_VECTOR = Array.from({ length: 768 }, (_, i) => i / 768);

// ── Factory helpers ───────────────────────────────────────────────────────────

function makeAxios(overrides = {}) {
  return {
    post: jest.fn().mockResolvedValue({
      data: { embeddings: [FAKE_VECTOR] },
    }),
    ...overrides,
  };
}

function makeScanner(tracks = ALL_TRACKS) {
  return {
    scan: jest.fn().mockResolvedValue({ artists: [], albums: [], tracks }),
  };
}

/**
 * Cria um mock de AudioAnalyzerService que retorna features acústicas fixas.
 * Permite testar a integração sem tocar em arquivos reais ou ffmpeg.
 */
function makeAudioAnalyzer(featuresOrNull = FAKE_FEATURES) {
  return {
    analyze:                   jest.fn().mockResolvedValue(featuresOrNull),
    buildAcousticDescription:  jest.fn((track, features) =>
      `"${track.title || 'Unknown'}" by ${track.artist || 'Unknown Artist'}. ` +
      `Format: FLAC. Acoustics: RMS ${features.rmsDb} dBFS (loud, energetic), ` +
      `peak ${features.peakDb} dBFS, moderately compressed.`
    ),
  };
}

// Features acústicas sintéticas (simula saída de ffprobe + ffmpeg astats)
const FAKE_FEATURES = {
  codec: "flac", duration: 285, bitrate: 900000, sampleRate: 44100, channels: 2,
  bpm: null, rmsDb: -18.5, peakDb: -5.3, crestFactor: 6.2, dynamicRange: 45.0, flatFactor: 0,
};

function makeService({ tracks, axiosOverrides, audioAnalyzer, ...rest } = {}) {
  return new EmbeddingService({
    axios: makeAxios(axiosOverrides),
    libraryScanner: makeScanner(tracks),
    audioAnalyzer: audioAnalyzer ?? null, // null = sem análise acústica
    ollamaUrl: "http://ollama-test:11434",
    embeddingModel: "nomic-embed-text",
    storageFile: false, // sem I/O em disco nos testes
    ...rest,
  });
}

/** Inicia o batch, espera terminar (com _sleep mockado para ser instantâneo). */
async function runBatch(service, options = {}) {
  jest.spyOn(service, "_sleep").mockResolvedValue(undefined);
  await service.startBatch(options);
  // Aguarda o loop assíncrono de background completar
  const deadline = Date.now() + 3000;
  while (service.getStatus().running) {
    if (Date.now() > deadline) throw new Error("Batch não completou em 3s");
    await new Promise((r) => setTimeout(r, 10));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("EmbeddingService", () => {
  // ── _buildDescription() ─────────────────────────────────────────────────────

  describe("_buildDescription() — sem audioAnalyzer (fallback metadata)", () => {
    let service;
    beforeEach(() => { service = makeService(); }); // audioAnalyzer = null

    it("descreve faixa com metadados completos (MP3)", async () => {
      const desc = await service._buildDescription(TRACKS.metal);
      expect(desc).toContain('"Paranoid"');
      expect(desc).toContain("Black Sabbath");
      expect(desc).toContain('album "Paranoid"');
      expect(desc).toContain("Heavy Metal");
      expect(desc).toContain("Rock");
    });

    it("descreve faixa FLAC com gênero vazio", async () => {
      const desc = await service._buildDescription(TRACKS.jazz);
      expect(desc).toBe('"So What" by Miles Davis, album "Kind of Blue".');
    });

    it("omite seção de álbum para faixa OGG sem álbum", async () => {
      const desc = await service._buildDescription(TRACKS.rock_noAlbum);
      expect(desc).toContain('"Wish You Were Here"');
      expect(desc).toContain("Pink Floyd");
      expect(desc).toContain("Progressive Rock");
      expect(desc).not.toContain('album "'); // sem seção de álbum explícita
    });

    it("preserva caracteres Unicode em título e artista (M4A)", async () => {
      const desc = await service._buildDescription(TRACKS.unicode);
      expect(desc).toContain("Jóga");
      expect(desc).toContain("Björk");
    });

    it("usa fallbacks 'Unknown' para metadados ausentes", async () => {
      const desc = await service._buildDescription(TRACKS.sparse);
      expect(desc).toContain("Unknown");
      expect(desc).toContain("Unknown Artist");
    });

    it("separa múltiplos gêneros com vocabulário expandido", async () => {
      const desc = await service._buildDescription({
        title: "T", artist: "A", album: "B",
        genres: ["Jazz", "Fusion", "Soul"],
      });
      expect(desc).toContain("Jazz");
      expect(desc).toContain("Fusion");
      expect(desc).toContain("Soul");
    });

    it("inclui vocabulário de gênero expandido na descrição", async () => {
      const desc = await service._buildDescription(TRACKS.metal);
      // "Heavy Metal" tem vocabulário no genreVocabulary.js
      expect(desc).toContain("distorted guitars");
    });

    it("não lança erro quando genres é undefined (sem campo)", async () => {
      await expect(service._buildDescription({ title: "T", artist: "A" })).resolves.not.toThrow();
    });
  });

  describe("_buildDescription() — com audioAnalyzer injetado", () => {
    it("chama audioAnalyzer.analyze() com o path do arquivo Plex", async () => {
      const audioAnalyzer = makeAudioAnalyzer();
      const svc = makeService({ tracks: [TRACKS.metal], audioAnalyzer });
      await svc._buildDescription(TRACKS.metal);
      expect(audioAnalyzer.analyze).toHaveBeenCalledWith(
        "/music/Black Sabbath/Paranoid/01 - Paranoid.mp3"
      );
    });

    it("chama buildAcousticDescription quando analyze() retorna features", async () => {
      const audioAnalyzer = makeAudioAnalyzer();
      const svc = makeService({ audioAnalyzer });
      const desc = await svc._buildDescription(TRACKS.metal);
      expect(audioAnalyzer.buildAcousticDescription).toHaveBeenCalledTimes(1);
      // A descrição retornada é a do mock (contém dados acústicos)
      expect(desc).toContain("dBFS");
    });

    it("faz fallback para metadados quando analyze() retorna null (arquivo inacessível)", async () => {
      const audioAnalyzer = makeAudioAnalyzer(null); // analyze retorna null
      const svc = makeService({ audioAnalyzer });
      const desc = await svc._buildDescription(TRACKS.metal);
      // buildAcousticDescription NÃO foi chamado
      expect(audioAnalyzer.buildAcousticDescription).not.toHaveBeenCalled();
      // Usou fallback: contém apenas metadados
      expect(desc).toContain("Paranoid");
      expect(desc).toContain("Black Sabbath");
    });

    it("faz fallback para metadados quando analyze() lança exceção", async () => {
      const audioAnalyzer = makeAudioAnalyzer();
      audioAnalyzer.analyze.mockRejectedValue(new Error("ffmpeg not found"));
      const svc = makeService({ audioAnalyzer });
      const desc = await svc._buildDescription(TRACKS.metal);
      expect(desc).toContain("Paranoid");
      expect(desc).not.toContain("dBFS");
    });

    it("faz fallback para metadados quando track não tem campo Media (path ausente)", async () => {
      const audioAnalyzer = makeAudioAnalyzer();
      const svc = makeService({ audioAnalyzer });
      const desc = await svc._buildDescription(TRACKS.sparse); // sparse não tem Media
      expect(audioAnalyzer.analyze).not.toHaveBeenCalled();
      expect(desc).toContain("Unknown");
    });
  });

  // ── getStatus() ─────────────────────────────────────────────────────────────

  describe("getStatus()", () => {
    it("retorna estado inicial correto com running=false", () => {
      const s = makeService().getStatus();
      expect(s.running).toBe(false);
      expect(s.done).toBe(0);
      expect(s.skipped).toBe(0);
      expect(s.errors).toBe(0);
      expect(s.stored).toBe(0);
      expect(s.model).toBe("nomic-embed-text");
    });

    it("usa modelo padrão quando embeddingModel não é passado", () => {
      const svc = new EmbeddingService({
        axios: makeAxios(),
        libraryScanner: makeScanner(),
        ollamaUrl: "http://ollama:11434",
        storageFile: false,
      });
      expect(svc.getStatus().model).toBe("nomic-embed-text");
    });

    it("reflete modelo configurado pelo chamador", () => {
      const svc = makeService({ embeddingModel: "mxbai-embed-large" });
      expect(svc.getStatus().model).toBe("mxbai-embed-large");
    });
  });

  // ── getOne() / getStored() ──────────────────────────────────────────────────

  describe("getOne() / getStored()", () => {
    it("retorna null para ratingKey inexistente", () => {
      expect(makeService().getOne("999")).toBeNull();
    });

    it("retorna embedding após processamento", async () => {
      const svc = makeService({ tracks: [TRACKS.metal] });
      await runBatch(svc);
      const result = svc.getOne("100");
      expect(result).not.toBeNull();
      expect(Array.isArray(result.embedding)).toBe(true);
      expect(result.embedding).toHaveLength(768);
    });

    it("getStored() retorna todos os embeddings processados", async () => {
      const svc = makeService();
      await runBatch(svc);
      const stored = svc.getStored();
      expect(Object.keys(stored)).toHaveLength(ALL_TRACKS.length);
    });

    it("embedding armazenado contém title, artist, album e genres", async () => {
      const svc = makeService({ tracks: [TRACKS.metal] });
      await runBatch(svc);
      const entry = svc.getOne("100");
      expect(entry).toMatchObject({
        title:  "Paranoid",
        artist: "Black Sabbath",
        album:  "Paranoid",
        genres: ["Heavy Metal", "Rock"],
      });
      expect(entry).toHaveProperty("description");
      expect(entry).toHaveProperty("processedAt");
    });
  });

  // ── reset() ─────────────────────────────────────────────────────────────────

  describe("reset()", () => {
    it("limpa todos os embeddings do store", async () => {
      const svc = makeService();
      await runBatch(svc);
      expect(svc.getStatus().stored).toBeGreaterThan(0);
      svc.reset();
      expect(svc.getStatus().stored).toBe(0);
    });

    it("getOne() retorna null para todas as faixas após reset", async () => {
      const svc = makeService({ tracks: [TRACKS.metal, TRACKS.jazz] });
      await runBatch(svc);
      svc.reset();
      expect(svc.getOne("100")).toBeNull();
      expect(svc.getOne("101")).toBeNull();
    });
  });

  // ── startBatch() ────────────────────────────────────────────────────────────

  describe("startBatch()", () => {
    it("chama libraryScanner.scan()", async () => {
      const scanner = makeScanner();
      const svc = new EmbeddingService({
        axios: makeAxios(),
        libraryScanner: scanner,
        ollamaUrl: "http://ollama:11434",
        storageFile: false,
      });
      await runBatch(svc);
      expect(scanner.scan).toHaveBeenCalledTimes(1);
    });

    it("processa todas as faixas da biblioteca", async () => {
      const svc = makeService();
      await runBatch(svc);
      expect(svc.getStatus().stored).toBe(ALL_TRACKS.length);
    });

    it("processa faixas MP3, FLAC, OGG e M4A pelo mesmo caminho", async () => {
      // A EmbeddingService é agnóstica ao formato: usa apenas metadados do Plex
      // (ou análise acústica quando audioAnalyzer está configurado)
      const svc = makeService();
      await runBatch(svc);
      // Todas as faixas (independente do formato de áudio) devem ter embedding
      for (const track of ALL_TRACKS) {
        expect(svc.getOne(track.ratingKey)).not.toBeNull();
      }
    });

    it("usa descrição acústica quando audioAnalyzer está configurado e arquivo existe", async () => {
      const audioAnalyzer = makeAudioAnalyzer();
      const svc = makeService({ tracks: [TRACKS.metal], audioAnalyzer });
      await runBatch(svc);
      // analyze() foi chamado com o path do Plex
      expect(audioAnalyzer.analyze).toHaveBeenCalledWith(
        "/music/Black Sabbath/Paranoid/01 - Paranoid.mp3"
      );
      // buildAcousticDescription() foi chamado
      expect(audioAnalyzer.buildAcousticDescription).toHaveBeenCalledTimes(1);
    });

    it("continua processando as faixas quando audioAnalyzer.analyze() retorna null em alguns casos", async () => {
      const audioAnalyzer = makeAudioAnalyzer();
      // Arquivo da faixa sparse não tem Media → analyze não é chamado para ela
      // As demais faixas têm Media e devem chamar analyze normalmente
      const svc = makeService({ tracks: ALL_TRACKS, audioAnalyzer });
      await runBatch(svc);
      expect(svc.getStatus().stored).toBe(ALL_TRACKS.length);
    });

    it("chama axios.post com modelo e input corretos", async () => {
      const axios = makeAxios();
      const svc = new EmbeddingService({
        axios,
        libraryScanner: makeScanner([TRACKS.metal]),
        ollamaUrl: "http://ollama-test:11434",
        embeddingModel: "nomic-embed-text",
        storageFile: false,
      });
      await runBatch(svc);
      const [url, body] = axios.post.mock.calls[0];
      expect(url).toBe("http://ollama-test:11434/api/embed");
      expect(body.model).toBe("nomic-embed-text");
      expect(typeof body.input).toBe("string");
      expect(body.input).toContain("Paranoid");
    });

    it("lança erro quando batch já está em execução", async () => {
      const svc = makeService();
      // Não mocka _sleep: batch fica rodando
      jest.spyOn(svc, "_sleep").mockReturnValue(new Promise(() => {}));
      await svc.startBatch();
      await expect(svc.startBatch()).rejects.toThrow("Batch já em execução");
    });

    it("lança erro quando biblioteca está vazia", async () => {
      const svc = makeService({ tracks: [] });
      await expect(svc.startBatch()).rejects.toThrow("Biblioteca vazia");
    });

    it("contabiliza erros sem abortar o batch quando Ollama falha em uma faixa", async () => {
      const axios = makeAxios();
      const err = new Error("Ollama down");
      axios.post
        .mockRejectedValueOnce(err) // falha na 1ª faixa (metal)
        .mockResolvedValue({ data: { embeddings: [FAKE_VECTOR] } }); // resto OK
      const svc = new EmbeddingService({
        axios,
        libraryScanner: makeScanner(ALL_TRACKS),
        ollamaUrl: "http://ollama:11434",
        storageFile: false,
      });
      await runBatch(svc);
      expect(svc.getStatus().errors).toBe(1);
      // As demais faixas foram processadas (errors não aborta o loop)
      expect(svc.getStatus().stored).toBe(ALL_TRACKS.length - 1);
    });

    // ── Cache (force=false) ──────────────────────────────────────────────────

    describe("cache: pula faixas já processadas (force=false)", () => {
      it("não chama axios para faixas que já têm embedding", async () => {
        const axios = makeAxios();
        const svc = new EmbeddingService({
          axios,
          libraryScanner: makeScanner(ALL_TRACKS),
          ollamaUrl: "http://ollama:11434",
          storageFile: false,
        });
        // 1ª rodada — processa tudo
        await runBatch(svc);
        const callsAfterFirst = axios.post.mock.calls.length;

        // 2ª rodada — sem force: 0 novas chamadas
        await runBatch(svc, { force: false });
        expect(axios.post.mock.calls.length).toBe(callsAfterFirst);
      });

      it("incrementa skipped para cada faixa em cache", async () => {
        const svc = makeService();
        await runBatch(svc);        // processa tudo
        await runBatch(svc, { force: false }); // tudo em cache
        expect(svc.getStatus().skipped).toBe(ALL_TRACKS.length);
      });

      it("não altera os embeddings existentes em re-run sem force", async () => {
        const svc = makeService({ tracks: [TRACKS.metal] });
        await runBatch(svc);
        const originalEntry = { ...svc.getOne("100") };

        await runBatch(svc, { force: false });
        expect(svc.getOne("100")).toEqual(originalEntry);
      });
    });

    // ── force=true (botão Refresh) ───────────────────────────────────────────

    describe("force=true: reprocessa toda a biblioteca (botão Refresh)", () => {
      it("chama axios mesmo para faixas que já têm embedding", async () => {
        const axios = makeAxios();
        const svc = new EmbeddingService({
          axios,
          libraryScanner: makeScanner([TRACKS.metal]),
          ollamaUrl: "http://ollama:11434",
          storageFile: false,
        });
        await runBatch(svc);
        const callsAfterFirst = axios.post.mock.calls.length;

        await runBatch(svc, { force: true });
        expect(axios.post.mock.calls.length).toBe(callsAfterFirst + 1);
      });

      it("skipped permanece 0 quando force=true", async () => {
        const svc = makeService({ tracks: [TRACKS.metal, TRACKS.jazz] });
        await runBatch(svc);
        await runBatch(svc, { force: true });
        expect(svc.getStatus().skipped).toBe(0);
      });

      it("atualiza processedAt para cada faixa re-processada", async () => {
        const svc = makeService({ tracks: [TRACKS.metal] });
        await runBatch(svc);
        const firstProcessedAt = svc.getOne("100").processedAt;

        // Garante timestamp diferente
        await new Promise((r) => setTimeout(r, 2));

        await runBatch(svc, { force: true });
        const secondProcessedAt = svc.getOne("100").processedAt;

        expect(secondProcessedAt).not.toBe(firstProcessedAt);
      });
    });
  });

  // ── stopBatch() ─────────────────────────────────────────────────────────────

  describe("stopBatch()", () => {
    it("não lança erro quando não há batch em execução", () => {
      expect(() => makeService().stopBatch()).not.toThrow();
    });

    it("interrompe o batch após a faixa atual", async () => {
      const axios = makeAxios();
      let callCount = 0;
      axios.post.mockImplementation(() => {
        callCount++;
        return Promise.resolve({ data: { embeddings: [FAKE_VECTOR] } });
      });

      const svc = new EmbeddingService({
        axios,
        libraryScanner: makeScanner(ALL_TRACKS),
        ollamaUrl: "http://ollama:11434",
        storageFile: false,
      });

      // Pausa o _sleep da 1ª faixa para dar tempo de chamar stopBatch
      let resolveFirstSleep;
      jest.spyOn(svc, "_sleep").mockImplementation(() => {
        if (callCount === 1) {
          return new Promise((r) => { resolveFirstSleep = r; });
        }
        return Promise.resolve();
      });

      await svc.startBatch();
      await new Promise((r) => setTimeout(r, 20)); // aguarda 1ª faixa processar
      svc.stopBatch();
      resolveFirstSleep?.(); // libera o sleep da 1ª faixa

      // Aguarda finalização
      const deadline = Date.now() + 2000;
      while (svc.getStatus().running && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 10));
      }

      expect(svc.getStatus().running).toBe(false);
      // Processou no máximo 1 faixa (a que estava em andamento)
      expect(callCount).toBeLessThanOrEqual(2);
    });
  });

  // ── _fetchEmbedding() ────────────────────────────────────────────────────────

  describe("_fetchEmbedding()", () => {
    it("usa /api/embed como endpoint primário", async () => {
      const axios = makeAxios();
      const svc = makeService({ axiosOverrides: axios });
      await svc._fetchEmbedding("test text");
      expect(axios.post.mock.calls[0][0]).toContain("/api/embed");
    });

    it("suporta resposta { embeddings: [[...]] } (Ollama ≥ 0.3)", async () => {
      const axios = makeAxios({
        post: jest.fn().mockResolvedValue({ data: { embeddings: [FAKE_VECTOR] } }),
      });
      const svc = makeService({ axiosOverrides: axios });
      const result = await svc._fetchEmbedding("test");
      expect(result).toEqual(FAKE_VECTOR);
    });

    it("suporta resposta { embedding: [...] } (formato legado)", async () => {
      const axios = makeAxios({
        post: jest.fn().mockResolvedValue({ data: { embedding: FAKE_VECTOR } }),
      });
      const svc = makeService({ axiosOverrides: axios });
      const result = await svc._fetchEmbedding("test");
      expect(result).toEqual(FAKE_VECTOR);
    });

    it("faz fallback para /api/embeddings quando /api/embed retorna 404", async () => {
      const notFoundErr = Object.assign(new Error("Not Found"), {
        response: { status: 404 },
      });
      const axios = {
        post: jest.fn()
          .mockRejectedValueOnce(notFoundErr)
          .mockResolvedValueOnce({ data: { embedding: FAKE_VECTOR } }),
      };
      const svc = makeService({ axiosOverrides: axios });
      const result = await svc._fetchEmbedding("test");
      expect(result).toEqual(FAKE_VECTOR);
      expect(axios.post.mock.calls[1][0]).toContain("/api/embeddings");
      expect(axios.post.mock.calls[1][1]).toHaveProperty("prompt");
    });

    it("lança erro quando resposta não contém um array válido", async () => {
      const axios = makeAxios({
        post: jest.fn().mockResolvedValue({ data: { result: "broken" } }),
      });
      const svc = makeService({ axiosOverrides: axios });
      await expect(svc._fetchEmbedding("test")).rejects.toThrow();
    });
  });

  // ── getSimilarTracks() ───────────────────────────────────────────────────────

  describe("getSimilarTracks()", () => {
    it("retorna array vazio quando ratingKey não existe no store", () => {
      expect(makeService().getSimilarTracks("999")).toEqual([]);
    });

    it("não inclui a própria faixa nos resultados", async () => {
      const svc = makeService();
      await runBatch(svc);
      const results = svc.getSimilarTracks("100");
      expect(results.map((r) => r.ratingKey)).not.toContain("100");
    });

    it("retorna faixas em ordem decrescente de similaridade", async () => {
      // Cria service com vetores distintos para testar ordenação
      const trackA = { ratingKey: "A", title: "A", artist: "X", album: "", genres: [] };
      const trackB = { ratingKey: "B", title: "B", artist: "X", album: "", genres: [] };
      const trackC = { ratingKey: "C", title: "C", artist: "X", album: "", genres: [] };

      const vecA = [1, 0, 0];
      const vecB = [0.9, 0.1, 0]; // mais próximo de A
      const vecC = [0, 0, 1];     // mais distante de A

      const axios = {
        post: jest.fn()
          .mockResolvedValueOnce({ data: { embeddings: [vecA] } }) // trackA
          .mockResolvedValueOnce({ data: { embeddings: [vecB] } }) // trackB
          .mockResolvedValueOnce({ data: { embeddings: [vecC] } }), // trackC
      };
      const svc = new EmbeddingService({
        axios,
        libraryScanner: makeScanner([trackA, trackB, trackC]),
        ollamaUrl: "http://ollama:11434",
        storageFile: false,
      });
      await runBatch(svc);

      const results = svc.getSimilarTracks("A", 2);
      expect(results[0].ratingKey).toBe("B"); // mais similar
      expect(results[1].ratingKey).toBe("C"); // menos similar
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    });

    it("retorna similaridade 1.0 para vetores idênticos", async () => {
      const tracks = [
        { ratingKey: "X", title: "X", artist: "Y", album: "", genres: [] },
        { ratingKey: "Z", title: "Z", artist: "Y", album: "", genres: [] },
      ];
      const sameVec = [0.5, 0.5, 0.5];
      const axios = {
        post: jest.fn().mockResolvedValue({ data: { embeddings: [sameVec] } }),
      };
      const svc = new EmbeddingService({
        axios,
        libraryScanner: makeScanner(tracks),
        ollamaUrl: "http://ollama:11434",
        storageFile: false,
      });
      await runBatch(svc);
      const results = svc.getSimilarTracks("X");
      expect(results[0].similarity).toBeCloseTo(1.0, 5);
    });

    it("respeita o parâmetro limit", async () => {
      const svc = makeService(); // tem ALL_TRACKS.length faixas
      await runBatch(svc);
      expect(svc.getSimilarTracks("100", 2)).toHaveLength(2);
      expect(svc.getSimilarTracks("100", 100)).toHaveLength(ALL_TRACKS.length - 1);
    });
  });

  // ── searchByText() ────────────────────────────────────────────────────────

  describe("searchByText()", () => {
    it("retorna array vazio quando o store está vazio", async () => {
      const svc = makeService();
      // store vazio — não chama _fetchEmbedding
      const results = await svc.searchByText("chill jazz evening");
      expect(results).toEqual([]);
    });

    it("embeda o texto da query e retorna faixas ordenadas por similaridade", async () => {
      // Dois tracks com vetores distintos; query é mais próxima do track A
      const trackA = { ratingKey: "A", title: "Blue Rondo", artist: "Dave Brubeck", album: "Time Out", genres: ["Jazz"] };
      const trackB = { ratingKey: "B", title: "Paranoid",   artist: "Black Sabbath", album: "Paranoid",   genres: ["Metal"] };

      const vecA     = [1, 0, 0];   // jazz
      const vecB     = [0, 1, 0];   // metal
      const vecQuery = [0.98, 0.1, 0]; // bem próxima do jazz

      const mockPost = jest.fn()
        .mockResolvedValueOnce({ data: { embeddings: [vecA] } })    // batch: trackA
        .mockResolvedValueOnce({ data: { embeddings: [vecB] } })    // batch: trackB
        .mockResolvedValueOnce({ data: { embeddings: [vecQuery] } }); // searchByText query

      const svc = new EmbeddingService({
        axios: { post: mockPost },
        libraryScanner: makeScanner([trackA, trackB]),
        ollamaUrl: "http://ollama:11434",
        storageFile: false,
      });
      await runBatch(svc);

      const results = await svc.searchByText("chill jazz evening", 10);
      expect(results).toHaveLength(2);
      expect(results[0].ratingKey).toBe("A");
      expect(results[1].ratingKey).toBe("B");
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    });

    it("cada resultado inclui ratingKey, title, artist, album, genres e similarity", async () => {
      const track = { ratingKey: "T1", title: "Foo", artist: "Bar", album: "Baz", genres: ["Pop"] };
      const mockPost = jest.fn()
        .mockResolvedValueOnce({ data: { embeddings: [[1, 0]] } }) // batch
        .mockResolvedValueOnce({ data: { embeddings: [[0.9, 0.1]] } }); // query

      const svc = new EmbeddingService({
        axios: { post: mockPost },
        libraryScanner: makeScanner([track]),
        ollamaUrl: "http://ollama:11434",
        storageFile: false,
      });
      await runBatch(svc);

      const [result] = await svc.searchByText("something", 5);
      expect(result).toHaveProperty("ratingKey", "T1");
      expect(result).toHaveProperty("title",  "Foo");
      expect(result).toHaveProperty("artist", "Bar");
      expect(result).toHaveProperty("album",  "Baz");
      expect(result).toHaveProperty("genres");
      expect(result).toHaveProperty("similarity");
      expect(typeof result.similarity).toBe("number");
    });

    it("respeita o parâmetro limit", async () => {
      const tracks = [
        { ratingKey: "X1", title: "A", artist: "A", album: "", genres: [] },
        { ratingKey: "X2", title: "B", artist: "B", album: "", genres: [] },
        { ratingKey: "X3", title: "C", artist: "C", album: "", genres: [] },
      ];
      const vec = [1, 0, 0];
      const mockPost = jest.fn().mockResolvedValue({ data: { embeddings: [vec] } });

      const svc = new EmbeddingService({
        axios: { post: mockPost },
        libraryScanner: makeScanner(tracks),
        ollamaUrl: "http://ollama:11434",
        storageFile: false,
      });
      await runBatch(svc);

      const results = await svc.searchByText("any text", 2);
      expect(results).toHaveLength(2);
    });

    it("chama _fetchEmbedding com o texto exato fornecido", async () => {
      const track = { ratingKey: "Z", title: "Z", artist: "Z", album: "", genres: [] };
      const mockPost = jest.fn()
        .mockResolvedValueOnce({ data: { embeddings: [[1, 0]] } }) // batch
        .mockResolvedValueOnce({ data: { embeddings: [[0.9, 0.1]] } }); // query

      const svc = new EmbeddingService({
        axios: { post: mockPost },
        libraryScanner: makeScanner([track]),
        ollamaUrl: "http://ollama:11434",
        storageFile: false,
      });
      await runBatch(svc);
      await svc.searchByText("late night blues session", 5);

      // Última chamada ao Ollama deve ter o texto da query
      const lastCall = mockPost.mock.calls.at(-1);
      expect(lastCall[1]).toMatchObject({ input: "late night blues session" });
    });
  });
});
