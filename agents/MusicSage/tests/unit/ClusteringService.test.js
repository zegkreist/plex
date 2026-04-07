import { ClusteringService } from "../../src/services/ClusteringService.js";

// ── Helpers para criar embeddings sintéticos ──────────────────────────────────

/**
 * Cria um embedding de dimensão `dim` com valor alto somente nas posições
 * indicadas por `hotDims`. Simula clusters separáveis na biblioteca.
 *
 *   rockVec    → [1, 1, 0, 0, 0, 0, 0, 0]
 *   jazzVec    → [0, 0, 1, 1, 0, 0, 0, 0]
 *   electroVec → [0, 0, 0, 0, 1, 1, 0, 0]
 */
function makeVec(hotDims, dim = 8) {
  const v = new Array(dim).fill(0);
  hotDims.forEach((i) => { v[i] = 1; });
  return v;
}

/**
 * Cria um registro de embedding no formato esperado pelo ClusteringService.
 */
function makeEntry(overrides = {}) {
  return {
    embedding:   overrides.embedding ?? makeVec([0, 1]),
    title:        overrides.title   ?? "Unknown",
    artist:       overrides.artist  ?? "Unknown Artist",
    album:        overrides.album   ?? "Unknown Album",
    genres:       overrides.genres  ?? [],
    processedAt:  new Date().toISOString(),
  };
}

/**
 * Constrói um store de embeddings com faixas de 3 estilos musicais bem
 * separados: Rock, Jazz e Eletrônico.
 *
 * Isso assegura que o k-means encontrará os 3 clusters com alta confiança.
 */
function makeLibraryStore() {
  const store = {};
  const styles = [
    { name: "rock",     hotDims: [0, 1], artist: "Led Zeppelin",     album: "IV" },
    { name: "jazz",     hotDims: [2, 3], artist: "Miles Davis",       album: "Bitches Brew" },
    { name: "electro",  hotDims: [4, 5], artist: "Daft Punk",         album: "Discovery" },
  ];

  styles.forEach((style, si) => {
    for (let i = 0; i < 5; i++) {
      const key = `${style.name}-${i}`;
      // Adiciona pequena variação para que PCA encontre variância
      const embedding = makeVec(style.hotDims).map((v, j) =>
        v + (j === si ? 0.01 * i : 0)
      );
      store[key] = makeEntry({
        embedding,
        title:  `Track ${i + 1}`,
        artist: style.artist,
        album:  style.album,
        genres: [style.name],
      });
    }
  });

  return store; // 15 faixas, 3 clusters naturais
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("ClusteringService", () => {
  let svc;
  beforeEach(() => { svc = new ClusteringService(); });

  // ── Edge cases ───────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("retorna clusters=[] para store vazio", () => {
      const result = svc.cluster({}, 3);
      expect(result.clusters).toEqual([]);
    });

    it("retorna clusters=[] para menos de 2 embeddings", () => {
      const store = { "1": makeEntry() };
      const result = svc.cluster(store, 2);
      expect(result.clusters).toEqual([]);
    });

    it("k é clampado ao número total de faixas quando k > n", () => {
      const store = {
        "1": makeEntry(),
        "2": makeEntry(),
        "3": makeEntry(),
      };
      const result = svc.cluster(store, 10); // pede 10, só tem 3
      expect(result.k).toBeLessThanOrEqual(3);
      expect(result.clusters.length).toBeLessThanOrEqual(3);
    });
  });

  // ── Estrutura do resultado ────────────────────────────────────────────────────

  describe("estrutura do resultado", () => {
    let result;
    beforeEach(() => {
      result = svc.cluster(makeLibraryStore(), 3);
    });

    it("retorna campo k", () => {
      expect(result).toHaveProperty("k", 3);
    });

    it("retorna array de clusters com comprimento k", () => {
      expect(result.clusters).toHaveLength(3);
    });

    it("cada cluster tem id, color, count e tracks", () => {
      for (const cl of result.clusters) {
        expect(cl).toHaveProperty("id");
        expect(cl).toHaveProperty("color");
        expect(cl).toHaveProperty("count");
        expect(cl).toHaveProperty("tracks");
        expect(typeof cl.id).toBe("number");
        expect(typeof cl.color).toBe("string");
        expect(cl.color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    it("cada track tem ratingKey, title, artist, album, genres, x, y", () => {
      const track = result.clusters[0].tracks[0];
      expect(track).toHaveProperty("ratingKey");
      expect(track).toHaveProperty("title");
      expect(track).toHaveProperty("artist");
      expect(track).toHaveProperty("album");
      expect(track).toHaveProperty("genres");
      expect(track).toHaveProperty("x");
      expect(track).toHaveProperty("y");
      expect(track).toHaveProperty("z");
    });

    it("coordenadas x estão no intervalo [0, 1]", () => {
      const allTracks = result.clusters.flatMap((c) => c.tracks);
      for (const t of allTracks) {
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x).toBeLessThanOrEqual(1);
      }
    });

    it("coordenadas z estão no intervalo [0, 1]", () => {
      const allTracks = result.clusters.flatMap((c) => c.tracks);
      for (const t of allTracks) {
        expect(t.z).toBeGreaterThanOrEqual(0);
        expect(t.z).toBeLessThanOrEqual(1);
      }
    });

    it("coordenadas y estão no intervalo [0, 1]", () => {
      const allTracks = result.clusters.flatMap((c) => c.tracks);
      for (const t of allTracks) {
        expect(t.y).toBeGreaterThanOrEqual(0);
        expect(t.y).toBeLessThanOrEqual(1);
      }
    });

    it("soma de count bate com o total de faixas no store", () => {
      const totalCount = result.clusters.reduce((s, c) => s + c.count, 0);
      expect(totalCount).toBe(15);
    });

    it("soma de tracks.length bate com count de cada cluster", () => {
      for (const cl of result.clusters) {
        expect(cl.tracks).toHaveLength(cl.count);
      }
    });

    it("todas as 15 faixas estão atribuídas a algum cluster", () => {
      const allRatingKeys = result.clusters.flatMap((c) =>
        c.tracks.map((t) => t.ratingKey)
      );
      expect(new Set(allRatingKeys).size).toBe(15);
    });

    it("nenhuma faixa aparece em mais de um cluster", () => {
      const allRatingKeys = result.clusters.flatMap((c) =>
        c.tracks.map((t) => t.ratingKey)
      );
      expect(allRatingKeys.length).toBe(new Set(allRatingKeys).size);
    });
  });

  // ── Cores ─────────────────────────────────────────────────────────────────────

  describe("cores dos clusters", () => {
    it("cluster 0 usa a primeira cor da paleta", () => {
      const result = svc.cluster(makeLibraryStore(), 3);
      const cl0 = result.clusters.find((c) => c.id === 0);
      expect(cl0.color).toBe(ClusteringService.COLORS[0]);
    });

    it("paleta tem 20 cores distintas", () => {
      expect(ClusteringService.COLORS).toHaveLength(20);
      const unique = new Set(ClusteringService.COLORS);
      expect(unique.size).toBe(20);
    });

    it("cada cor é um hex válido de 7 caracteres", () => {
      for (const c of ClusteringService.COLORS) {
        expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  // ── k mínimo (k=2) ──────────────────────────────────────────────────────────

  describe("k=2", () => {
    it("funciona com exatamente 2 clusters", () => {
      const store = {};
      for (let i = 0; i < 4; i++) {
        store[`rock-${i}`]  = makeEntry({ embedding: makeVec([0, 1]) });
        store[`jazz-${i}`]  = makeEntry({ embedding: makeVec([6, 7]) });
      }
      const result = svc.cluster(store, 2);
      expect(result.k).toBe(2);
      expect(result.clusters).toHaveLength(2);
      const total = result.clusters.reduce((s, c) => s + c.count, 0);
      expect(total).toBe(8);
    });
  });

  // ── Biblioteca grande ────────────────────────────────────────────────────────

  describe("biblioteca grande", () => {
    it("processa 100 faixas em no máximo 5s", () => {
      const store = {};
      // Gera 100 faixas com vetores de 768 dimensões e 5 clusters naturais
      const groups = [
        [0, 1, 2],       // rock
        [200, 201, 202], // jazz
        [400, 401, 402], // electro
        [600, 601, 602], // classical
        [700, 701, 702], // hip-hop
      ];
      for (let i = 0; i < 100; i++) {
        const group = groups[i % 5];
        const embedding = new Array(768).fill(0);
        group.forEach((d) => { embedding[d] = 1 + (i * 0.001); });
        store[`track-${i}`] = makeEntry({ embedding });
      }

      const t0 = Date.now();
      const result = svc.cluster(store, 5);
      const elapsed = Date.now() - t0;

      expect(elapsed).toBeLessThan(5000);
      expect(result.clusters).toHaveLength(5);
      const total = result.clusters.reduce((s, c) => s + c.count, 0);
      expect(total).toBe(100);
    }, 10000);
  });

  // ── _normalizeL2() ───────────────────────────────────────────────────────────

  describe("_normalizeL2()", () => {
    it("retorna vetor com norma ≈ 1", () => {
      const v = [3, 4]; // norma = 5
      const norm = svc._normalizeL2(v);
      const len = Math.sqrt(norm[0] ** 2 + norm[1] ** 2);
      expect(len).toBeCloseTo(1.0, 10);
    });

    it("não modifica o vetor original (retorna nova array)", () => {
      const v = [3, 4];
      const copy = [...v];
      svc._normalizeL2(v);
      expect(v).toEqual(copy);
    });

    it("retorna cópia do vetor zero sem divisão por zero", () => {
      const v = [0, 0, 0];
      expect(() => svc._normalizeL2(v)).not.toThrow();
      const result = svc._normalizeL2(v);
      expect(result).toEqual([0, 0, 0]);
    });
  });

  // ── clusterAuto() ──────────────────────────────────────────────────────────

  describe("clusterAuto()", () => {
    it("retorna estrutura com k, clusters e tracks", () => {
      const store = makeLibraryStore();
      const result = svc.clusterAuto(store, 2, 5);
      expect(result).toHaveProperty("k");
      expect(result).toHaveProperty("clusters");
      expect(Array.isArray(result.clusters)).toBe(true);
    });

    it("k escolhido está dentro do intervalo [kMin, kMax]", () => {
      const store = makeLibraryStore();
      const result = svc.clusterAuto(store, 2, 5);
      expect(result.k).toBeGreaterThanOrEqual(2);
      expect(result.k).toBeLessThanOrEqual(5);
    });

    it("encontra 3 clusters para biblioteca com 3 estilos bem separados", () => {
      const store = makeLibraryStore();
      // Rock [0,1], Jazz [2,3], Electro [4,5] são ortogonais → elbow em k=3
      const result = svc.clusterAuto(store, 2, 6);
      expect(result.k).toBe(3);
    });

    it("retorna { k:1, clusters:[] } para store com menos de 2 faixas", () => {
      const result = svc.clusterAuto({ single: makeEntry() }, 2, 5);
      expect(result).toEqual({ k: 1, clusters: [] });
    });

    it("distribui todas as faixas entre os clusters", () => {
      const store = makeLibraryStore();
      const result = svc.clusterAuto(store, 2, 6);
      const total = result.clusters.reduce((s, c) => s + c.count, 0);
      expect(total).toBe(Object.keys(store).length);
    });
  });
});
