#!/usr/bin/env node
/**
 * Analisa os metadados das músicas baixadas e gera um JSON com artistas e álbuns.
 * Útil para identificar álbuns incompletos e baixar o restante das músicas.
 */

import { readdir, stat } from "fs/promises";
import { writeFile } from "fs/promises";
import { join, extname, basename, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import { parseFile } from "music-metadata";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");

const AUDIO_EXTENSIONS = [".flac", ".mp3", ".m4a", ".opus", ".ogg", ".wav", ".aac"];

let errorCount = 0;
let errorFiles = [];

/**
 * Extrai metadados de um arquivo de áudio
 */
async function getMetadata(filePath) {
  try {
    //Ler metadados incluindo a capa
    const metadata = await parseFile(filePath, {
      skipCovers: false, // NECESSÁRIO para ler a capa
      duration: false,
    });
    const stats = await stat(filePath);

    const common = metadata.common;
    const native = metadata.native;

    // Tentar diferentes fontes de metadados (common tem prioridade)
    let artist = common.artist || common.artists?.[0] || null;
    let album = common.album || null;
    let albumArtist = common.albumartist || common.artist || null;
    let title = common.title || null;
    let year = common.year ? String(common.year) : common.date ? String(common.date).substring(0, 4) : null;
    let genre = common.genre?.[0] || null;

    // Se não achou nos common, tentar nos tags nativos (FLAC usa vorbis)
    if (!artist && native?.vorbis) {
      const vorbis = native.vorbis.find((t) => t.id === "ARTIST" || t.id === "artist");
      artist = vorbis?.value;
    }
    if (!album && native?.vorbis) {
      const vorbis = native.vorbis.find((t) => t.id === "ALBUM" || t.id === "album");
      album = vorbis?.value;
    }
    if (!title && native?.vorbis) {
      const vorbis = native.vorbis.find((t) => t.id === "TITLE" || t.id === "title");
      title = vorbis?.value;
    }
    if (!year && native?.vorbis) {
      const vorbis = native.vorbis.find((t) => t.id === "DATE" || t.id === "date" || t.id === "YEAR" || t.id === "year");
      if (vorbis?.value) {
        year = String(vorbis.value).substring(0, 4);
      }
    }
    if (!albumArtist && native?.vorbis) {
      const vorbis = native.vorbis.find((t) => t.id === "ALBUMARTIST" || t.id === "albumartist");
      albumArtist = vorbis?.value || artist;
    }

    // Gerar hash da capa do álbum para identificar álbuns únicos
    let coverHash = null;
    if (common.picture && common.picture.length > 0) {
      const cover = common.picture[0];
      // Criar hash MD5 dos primeiros 1KB da imagem (suficiente para identificar)
      const dataToHash = cover.data.slice(0, Math.min(1024, cover.data.length));
      coverHash = createHash("md5").update(dataToHash).digest("hex").substring(0, 12);
    }

    return {
      artist: artist,
      album: album,
      album_artist: albumArtist,
      title: title,
      track_number: common.track?.no ? String(common.track.no) : null,
      disc_number: common.disk?.no ? String(common.disk.no) : null,
      date: year,
      genre: genre,
      file_path: filePath,
      file_size: stats.size,
      format: extname(filePath).toLowerCase(),
      cover_hash: coverHash, // Hash da capa para identificar álbuns
      format: extname(filePath).toLowerCase(),
    };
  } catch (error) {
    // Incrementar contador de erros
    errorCount++;
    errorFiles.push({
      file: basename(filePath),
      error: error.message,
    });

    // Não logar cada erro individual para não poluir a saída
    // Apenas retornar null para pular o arquivo
    return null;
  }
}

/**
 * Busca recursivamente todos os arquivos de áudio no diretório
 */
async function findAudioFiles(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      await findAudioFiles(fullPath, files);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (AUDIO_EXTENSIONS.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Varre o diretório de músicas e extrai todos os metadados
 */
async function scanMusicDirectory(directory) {
  console.log(`🔍 Escaneando diretório: ${directory}`);

  const musicFiles = await findAudioFiles(directory);
  console.log(`📁 Encontrados ${musicFiles.length} arquivos de áudio`);

  const metadataList = [];
  let processed = 0;

  for (const filePath of musicFiles) {
    processed++;
    if (processed % 50 === 0) {
      console.log(`   Processando... ${processed}/${musicFiles.length}`);
    }

    const metadata = await getMetadata(filePath);
    if (metadata && metadata.artist && metadata.album) {
      metadataList.push(metadata);
    } else if (metadata) {
      console.log(`⚠️  Sem artista/álbum: ${basename(filePath)}`);
    }
  }

  console.log(`✅ ${metadataList.length} arquivos processados com metadados completos`);
  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} arquivo(s) com erro de leitura (detalhes no final)`);
  }
  return metadataList;
}

/**
 * Cria estrutura organizada de artistas e álbuns
 */
function buildLibraryStructure(metadataList) {
  const library = {};
  // Map para armazenar nome do álbum por hash de capa
  const albumNamesByHash = new Map();

  for (const metadata of metadataList) {
    const artist = metadata.album_artist || metadata.artist;
    const albumName = metadata.album;

    // Usar hash da capa como identificador único, ou nome do álbum se não tiver capa
    const albumKey = metadata.cover_hash ? `${albumName} [${metadata.cover_hash}]` : albumName;

    // Armazenar o nome real do álbum associado ao hash
    if (metadata.cover_hash) {
      if (!albumNamesByHash.has(metadata.cover_hash)) {
        albumNamesByHash.set(metadata.cover_hash, albumName);
      }
    }

    if (!library[artist]) {
      library[artist] = {};
    }

    if (!library[artist][albumKey]) {
      library[artist][albumKey] = {
        album_name: albumName, // Nome real do álbum
        cover_hash: metadata.cover_hash, // Hash da capa para identificação
        tracks: [],
        track_count: 0,
        total_size: 0,
        formats: new Set(),
        year: null,
        genres: new Set(),
      };
    }

    const albumData = library[artist][albumKey];

    albumData.tracks.push({
      title: metadata.title,
      track_number: metadata.track_number,
      disc_number: metadata.disc_number,
      file: basename(metadata.file_path),
      format: metadata.format,
    });

    albumData.track_count++;
    albumData.total_size += metadata.file_size;
    albumData.formats.add(metadata.format);

    if (metadata.date && !albumData.year) {
      albumData.year = metadata.date;
    }

    if (metadata.genre) {
      albumData.genres.add(metadata.genre);
    }
  }

  // Converter Sets para arrays e ordenar tracks
  const result = {};
  for (const [artist, albums] of Object.entries(library)) {
    result[artist] = {};
    for (const [albumKey, data] of Object.entries(albums)) {
      result[artist][albumKey] = {
        album_name: data.album_name,
        cover_hash: data.cover_hash,
        track_count: data.track_count,
        total_size_mb: Math.round((data.total_size / (1024 * 1024)) * 100) / 100,
        formats: Array.from(data.formats).sort(),
        year: data.year,
        genres: Array.from(data.genres).sort(),
        tracks: data.tracks.sort((a, b) => {
          const discA = parseInt(a.disc_number) || 0;
          const discB = parseInt(b.disc_number) || 0;
          if (discA !== discB) return discA - discB;

          const trackA = parseInt(a.track_number) || 999;
          const trackB = parseInt(b.track_number) || 999;
          return trackA - trackB;
        }),
      };
    }
  }

  return result;
}

/**
 * Gera estatísticas da biblioteca
 */
function generateStatistics(library) {
  const stats = {
    total_artists: Object.keys(library).length,
    total_albums: 0,
    total_tracks: 0,
    total_size_gb: 0,
    formats: new Set(),
  };

  for (const albums of Object.values(library)) {
    stats.total_albums += Object.keys(albums).length;

    for (const album of Object.values(albums)) {
      stats.total_tracks += album.track_count;
      stats.total_size_gb += album.total_size_mb;
      album.formats.forEach((format) => stats.formats.add(format));
    }
  }

  stats.total_size_gb = Math.round((stats.total_size_gb / 1024) * 100) / 100;
  stats.formats = Array.from(stats.formats).sort();

  return stats;
}

/**
 * Função principal
 */
async function main() {
  // Reset de contadores
  errorCount = 0;
  errorFiles = [];

  // Diretório de downloads hardcoded
  const downloadsDir = join(PROJECT_ROOT, "downloads");

  try {
    await stat(downloadsDir);
  } catch (error) {
    console.error(`❌ Diretório não encontrado: ${downloadsDir}`);
    console.error(`\nCrie a pasta downloads/ ou coloque suas músicas lá.`);
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("🎵 Analisador de Biblioteca Musical");
  console.log("=".repeat(60));
  console.log();

  // Escanear diretório
  const metadataList = await scanMusicDirectory(downloadsDir);

  if (metadataList.length === 0) {
    console.log("\n❌ Nenhum arquivo de áudio encontrado com metadados válidos");
    process.exit(1);
  }

  console.log("\n📊 Construindo estrutura da biblioteca...");
  const library = buildLibraryStructure(metadataList);

  console.log("📈 Gerando estatísticas...");
  const stats = generateStatistics(library);

  // Salvar JSON
  const outputFile = join(PROJECT_ROOT, "library_analysis.json");
  const outputData = {
    statistics: stats,
    library: library,
  };

  await writeFile(outputFile, JSON.stringify(outputData, null, 2), "utf-8");

  console.log(`\n✅ Análise salva em: ${outputFile}`);

  // Mostrar estatísticas
  console.log("\n" + "=".repeat(60));
  console.log("📊 ESTATÍSTICAS DA BIBLIOTECA");
  console.log("=".repeat(60));
  console.log(`🎤 Artistas: ${stats.total_artists}`);
  console.log(`💿 Álbuns: ${stats.total_albums}`);
  console.log(`🎵 Faixas: ${stats.total_tracks}`);
  console.log(`💾 Tamanho total: ${stats.total_size_gb} GB`);
  console.log(`📁 Formatos: ${stats.formats.join(", ")}`);

  // Mostrar artistas com mais álbuns
  console.log("\n" + "=".repeat(60));
  console.log("🏆 TOP 10 ARTISTAS (mais álbuns)");
  console.log("=".repeat(60));

  const sortedArtists = Object.entries(library)
    .sort((a, b) => Object.keys(b[1]).length - Object.keys(a[1]).length)
    .slice(0, 10);

  sortedArtists.forEach(([artist, albums], i) => {
    const totalTracks = Object.values(albums).reduce((sum, album) => sum + album.track_count, 0);
    console.log(`${String(i + 1).padStart(2)}. ${artist}`);
    console.log(`    📀 ${Object.keys(albums).length} álbuns | 🎵 ${totalTracks} faixas`);
  });

  // Álbuns com poucas faixas (possivelmente incompletos)
  console.log("\n" + "=".repeat(60));
  console.log("⚠️  ÁLBUNS COM POUCAS FAIXAS (< 5)");
  console.log("=".repeat(60));

  const incompleteAlbums = [];
  for (const [artist, albums] of Object.entries(library)) {
    for (const [albumKey, albumData] of Object.entries(albums)) {
      if (albumData.track_count < 5) {
        // Usar o nome real do álbum para exibição
        const displayName = albumData.album_name || albumKey;
        incompleteAlbums.push({
          artist,
          album: displayName,
          albumKey: albumKey, // Manter a chave para referência
          count: albumData.track_count,
        });
      }
    }
  }

  incompleteAlbums.sort((a, b) => a.count - b.count);

  if (incompleteAlbums.length > 0) {
    incompleteAlbums.slice(0, 20).forEach(({ artist, album, count }) => {
      console.log(`  • ${artist} - ${album}`);
      console.log(`    └─ ${count} faixa(s)`);
    });
  } else {
    console.log("  ✅ Todos os álbuns têm 5+ faixas");
  }

  // Mostrar erros de leitura, se houver
  if (errorCount > 0) {
    console.log("\n" + "=".repeat(60));
    console.log(`⚠️  ERROS DE LEITURA (${errorCount} arquivo(s))`);
    console.log("=".repeat(60));
    console.log("Arquivos que não puderam ser lidos:\n");

    // Agrupar por tipo de erro
    const errorsByType = {};
    errorFiles.forEach(({ file, error }) => {
      if (!errorsByType[error]) {
        errorsByType[error] = [];
      }
      errorsByType[error].push(file);
    });

    for (const [error, files] of Object.entries(errorsByType)) {
      console.log(`📛 ${error}`);
      files.slice(0, 5).forEach((file) => {
        console.log(`   • ${file}`);
      });
      if (files.length > 5) {
        console.log(`   ... e mais ${files.length - 5} arquivo(s)`);
      }
      console.log();
    }

    console.log("💡 Dica: Esses arquivos podem estar corrompidos ou incompletos.");
    console.log("   Considere baixá-los novamente.");
  }

  console.log("\n" + "=".repeat(60));
  console.log(`📄 Arquivo JSON completo: ${outputFile}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});
