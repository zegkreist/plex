import fs from "fs/promises";
import path from "path";
import { AllFather } from "@plex-agents/allfather";

/**
 * Classe responsável por consolidar álbuns duplicados/separados
 * usando análise de covers e IA
 */
export class AlbumConsolidator {
  constructor(allFather = null) {
    // Usa AllFather existente ou cria um novo
    this.allfather =
      allFather ||
      new AllFather({
        ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
        model: process.env.OLLAMA_DEFAULT_MODEL || "deepseek-r1:7b",
        temperature: 0.1, // Precisão para metadados
      });

    this.coverFilenames = ["cover.png", "cover.jpg", "cover.jpeg", "folder.jpg", "folder.png"];
    this.curatedMarkerFile = ".curated";
  }

  /**
   * Escaneia um diretório de música com estrutura music/artistas/albums/
   */
  async scanMusicDirectory(musicPath) {
    console.log(`🔍 Escaneando diretório: ${musicPath}`);

    const artists = [];

    try {
      const entries = await fs.readdir(musicPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const artistPath = path.join(musicPath, entry.name);
          const albums = await this.scanArtistDirectory(artistPath, entry.name);

          if (albums.length > 0) {
            artists.push({
              name: entry.name,
              path: artistPath,
              albums: albums,
            });
          }
        }
      }

      console.log(`✅ Encontrados ${artists.length} artistas`);
      return artists;
    } catch (error) {
      console.error(`❌ Erro ao escanear diretório: ${error.message}`);
      return [];
    }
  }

  /**
   * Escaneia os álbuns de um artista
   */
  async scanArtistDirectory(artistPath, artistName) {
    const albums = [];

    try {
      const entries = await fs.readdir(artistPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const albumPath = path.join(artistPath, entry.name);

          // Verifica se já foi curado
          const isCurated = await this.isAlreadyCurated(albumPath);

          const coverPath = await this.findCoverImage(albumPath);
          const tracks = await this.findMusicFiles(albumPath);

          albums.push({
            name: entry.name,
            path: albumPath,
            artist: artistName,
            coverPath: coverPath,
            trackCount: tracks.length,
            tracks: tracks,
            isCurated: isCurated,
          });
        }
      }

      return albums;
    } catch (error) {
      console.error(`❌ Erro ao escanear artista ${artistName}: ${error.message}`);
      return [];
    }
  }

  /**
   * Verifica se um álbum já foi curado
   */
  async isAlreadyCurated(albumPath) {
    try {
      const markerPath = path.join(albumPath, this.curatedMarkerFile);
      await fs.access(markerPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Marca um álbum como curado
   */
  async markAsCurated(albumPath, metadata = {}) {
    try {
      const markerPath = path.join(albumPath, this.curatedMarkerFile);
      const markerData = {
        curatedAt: new Date().toISOString(),
        metadata: metadata,
      };

      await fs.writeFile(markerPath, JSON.stringify(markerData, null, 2), "utf-8");
      console.log(`✅ Álbum marcado como curado: ${albumPath}`);
    } catch (error) {
      console.error(`❌ Erro ao marcar como curado: ${error.message}`);
    }
  }

  /**
   * Encontra o arquivo de cover em um álbum
   */
  async findCoverImage(albumPath) {
    for (const filename of this.coverFilenames) {
      const coverPath = path.join(albumPath, filename);
      try {
        await fs.access(coverPath);
        return coverPath;
      } catch {
        // Continua buscando
      }
    }

    return null;
  }

  /**
   * Encontra arquivos de música em um álbum
   */
  async findMusicFiles(albumPath) {
    const musicExtensions = [".flac", ".mp3", ".m4a", ".wav", ".ogg", ".opus"];
    const files = [];

    try {
      const entries = await fs.readdir(albumPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (musicExtensions.includes(ext)) {
            files.push({
              name: entry.name,
              path: path.join(albumPath, entry.name),
              ext: ext,
            });
          }
        }
      }

      return files;
    } catch (error) {
      console.error(`❌ Erro ao buscar arquivos de música: ${error.message}`);
      return [];
    }
  }

  /**
   * Agrupa álbuns por similaridade de cover
   * Retorna grupos de álbuns que provavelmente são o mesmo álbum
   */
  async groupAlbumsByCover(albums, similarityThreshold = 0.85) {
    console.log(`🎨 Agrupando ${albums.length} álbuns por similaridade de cover...`);

    // Filtra apenas álbuns com cover
    const albumsWithCovers = albums.filter((album) => album.coverPath !== null);

    if (albumsWithCovers.length === 0) {
      console.log("⚠️  Nenhum álbum com cover encontrado");
      return [];
    }

    const groups = [];
    const processed = new Set();

    for (let i = 0; i < albumsWithCovers.length; i++) {
      if (processed.has(i)) continue;

      const albumA = albumsWithCovers[i];
      const group = [albumA];
      processed.add(i);

      // Compara com os demais álbuns
      for (let j = i + 1; j < albumsWithCovers.length; j++) {
        if (processed.has(j)) continue;

        const albumB = albumsWithCovers[j];

        try {
          // Usa a função de comparação de imagens por conteúdo do AllFather (via LLM com visão)
          const similarity = await this.allfather.compareImagesByContent(albumA.coverPath, albumB.coverPath);

          if (similarity !== null && similarity >= similarityThreshold) {
            group.push(albumB);
            processed.add(j);
            console.log(`📎 Álbuns similares (${(similarity * 100).toFixed(1)}%): "${albumA.name}" ↔ "${albumB.name}"`);
          }
        } catch (error) {
          console.error(`❌ Erro ao comparar covers: ${error.message}`);
        }
      }

      // Só adiciona grupos com mais de 1 álbum (potenciais duplicatas)
      if (group.length > 1) {
        groups.push(group);
      }
    }

    console.log(`✅ Encontrados ${groups.length} grupos de álbuns similares`);
    return groups;
  }

  /**
   * Determina o nome correto do álbum usando AllFather
   */
  async determineCorrectAlbumName(albumGroup) {
    console.log(`🧠 Determinando nome correto para grupo de ${albumGroup.length} álbuns...`);

    try {
      // Pega o primeiro cover disponível
      const coverAlbum = albumGroup.find((a) => a.coverPath);
      const coverUrl = coverAlbum ? `file://${coverAlbum.coverPath}` : null;

      // Extrai informações das músicas
      const firstAlbumWithTracks = albumGroup.find((a) => a.tracks.length > 0);
      const sampleTrack = firstAlbumWithTracks?.tracks[0]?.name || "";

      // Prepara os candidatos
      const candidates = albumGroup.map((album) => ({
        albumName: album.name,
        trackCount: album.trackCount,
        path: album.path,
      }));

      // Usa o AllFather para determinar o nome correto
      const metadata = await this.allfather.getMusicMetadata(sampleTrack, albumGroup[0].artist, {
        coverImageUrl: coverUrl,
      });

      // Se o AllFather retornou metadados, usa o nome do álbum dele
      if (metadata && metadata.album) {
        console.log(`✅ Nome correto determinado: "${metadata.album}"`);

        // Encontra o candidato mais similar ao resultado
        const bestMatch = this.findBestMatchingCandidate(metadata.album, candidates);

        return {
          correctName: metadata.album,
          metadata: metadata,
          bestMatchCandidate: bestMatch,
          allCandidates: candidates,
        };
      }

      // Fallback: escolhe o álbum com mais músicas
      const largestAlbum = albumGroup.reduce((prev, current) => (current.trackCount > prev.trackCount ? current : prev));

      console.log(`⚠️  AllFather não retornou metadados. Usando álbum com mais faixas: "${largestAlbum.name}"`);

      return {
        correctName: largestAlbum.name,
        metadata: null,
        bestMatchCandidate: { albumName: largestAlbum.name, trackCount: largestAlbum.trackCount },
        allCandidates: candidates,
      };
    } catch (error) {
      console.error(`❌ Erro ao determinar nome correto: ${error.message}`);

      // Em caso de erro, escolhe o álbum com mais músicas
      const largestAlbum = albumGroup.reduce((prev, current) => (current.trackCount > prev.trackCount ? current : prev));

      return {
        correctName: largestAlbum.name,
        metadata: null,
        bestMatchCandidate: { albumName: largestAlbum.name, trackCount: largestAlbum.trackCount },
        allCandidates: candidates,
        error: error.message,
      };
    }
  }

  /**
   * Encontra o candidato mais similar ao nome correto
   */
  findBestMatchingCandidate(correctName, candidates) {
    let bestMatch = candidates[0];
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = this.calculateTextSimilarity(correctName, candidate.albumName);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    return { ...bestMatch, matchScore: bestScore };
  }

  /**
   * Calcula similaridade textual simples
   */
  calculateTextSimilarity(a, b) {
    const normalize = (str) =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .trim();

    const normA = normalize(a);
    const normB = normalize(b);

    if (normA === normB) return 1.0;

    // Similaridade de tokens
    const tokensA = new Set(normA.split(/\s+/));
    const tokensB = new Set(normB.split(/\s+/));

    const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)));
    const union = new Set([...tokensA, ...tokensB]);

    return intersection.size / union.size;
  }

  /**
   * Gera relatório de consolidação
   */
  generateConsolidationReport(groups, results) {
    console.log("\n" + "=".repeat(80));
    console.log("📊 RELATÓRIO DE CONSOLIDAÇÃO DE ÁLBUNS");
    console.log("=".repeat(80));

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const result = results[i];

      console.log(`\n🎵 Grupo ${i + 1}:`);
      console.log(`   Nome correto: ${result.correctName}`);
      console.log(`   Álbuns encontrados:`);

      for (const album of group) {
        const marker = album.name === result.bestMatchCandidate?.albumName ? "✓" : " ";
        console.log(`   ${marker} - ${album.name} (${album.trackCount} faixas)`);
      }

      if (result.metadata) {
        console.log(`   Metadados obtidos: Artista=${result.metadata.artist}, Ano=${result.metadata.year}`);
      }
    }

    console.log("\n" + "=".repeat(80));
  }

  /**
   * Processa todos os álbuns de um artista
   */
  async consolidateArtistAlbums(artistPath, artistName, options = {}) {
    const { dryRun = true, skipCurated = true, similarityThreshold = 0.85 } = options;

    console.log(`\n${"=".repeat(80)}`);
    console.log(`🎵 Consolidando álbuns de: ${artistName}`);
    console.log(`${"=".repeat(80)}`);

    // Escaneia os álbuns
    const albums = await this.scanArtistDirectory(artistPath, artistName);

    if (albums.length === 0) {
      console.log("⚠️  Nenhum álbum encontrado");
      return { groups: [], results: [] };
    }

    console.log(`📀 Encontrados ${albums.length} álbuns:`);
    for (const album of albums) {
      const curatedMark = album.isCurated ? "✓" : " ";
      console.log(`   [${curatedMark}] ${album.name} - ${album.trackCount} faixas`);
    }

    // Filtra álbuns já curados se solicitado
    const albumsToProcess = skipCurated ? albums.filter((a) => !a.isCurated) : albums;

    if (albumsToProcess.length === 0) {
      console.log("\n✅ Todos os álbuns já foram curados!");
      return { groups: [], results: [] };
    }

    if (skipCurated && albumsToProcess.length < albums.length) {
      console.log(`\n⏭️  Pulando ${albums.length - albumsToProcess.length} álbuns já curados`);
    }

    // Agrupa por similaridade de cover
    const groups = await this.groupAlbumsByCover(albumsToProcess, similarityThreshold);

    if (groups.length === 0) {
      console.log("\n✅ Nenhuma duplicata encontrada!");
      return { groups: [], results: [] };
    }

    console.log(`\n🔍 Processando ${groups.length} grupos de álbuns similares...`);

    // Determina o nome correto para cada grupo
    const results = [];

    for (let i = 0; i < groups.length; i++) {
      console.log(`\n--- Grupo ${i + 1}/${groups.length} ---`);
      const result = await this.determineCorrectAlbumName(groups[i]);
      results.push(result);

      // Pequena pausa entre requisições
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Gera relatório
    this.generateConsolidationReport(groups, results);

    // Se não for dry-run, marca como curado
    if (!dryRun) {
      console.log("\n💾 Marcando álbuns como curados...");
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const result = results[i];

        for (const album of group) {
          await this.markAsCurated(album.path, {
            correctAlbumName: result.correctName,
            originalName: album.name,
            groupId: i,
            metadata: result.metadata,
          });
        }
      }
      console.log("✅ Todos os álbums processados foram marcados como curados");
    } else {
      console.log("\n🔍 Modo dry-run ativo - nenhuma alteração foi salva");
    }

    return { groups, results };
  }
}
