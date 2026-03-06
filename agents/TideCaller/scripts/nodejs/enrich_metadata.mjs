#!/usr/bin/env node
/**
 * Enriquece metadados das músicas usando MusicBrainz
 * Corrige álbuns identificados incorretamente (ex: playlists)
 */

import { readFile, writeFile, readdir } from "fs/promises";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { parseFile } from "music-metadata";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");
const DOWNLOADS_DIR = join(PROJECT_ROOT, "downloads");

const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2";
const USER_AGENT = "StreamripTools/1.0 (https://github.com/streamrip)";
const RATE_LIMIT_MS = 1000; // 1 request por segundo (regra do MusicBrainz)

// Formatos de áudio suportados
const AUDIO_EXTENSIONS = [".flac", ".m4a", ".mp3", ".opus", ".ogg", ".wav"];

/**
 * Verifica se um texto contém indicação de gravação ao vivo
 * Detecta: live, ao vivo, aovivo, ao-vivo, etc.
 */
function isLiveRecording(text) {
  if (!text) return false;

  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove acentos

  // Padrões de live em inglês e português
  const livePatterns = [
    /\blive\b/, // "live" como palavra completa
    /\(live\)/, // "(live)"
    /ao\s*vivo/, // "ao vivo", "aovivo"
    /ao[-_]vivo/, // "ao-vivo", "ao_vivo"
  ];

  return livePatterns.some((pattern) => pattern.test(normalized));
}

let requestCount = 0;
let foundCount = 0;
let notFoundCount = 0;
let lastRequestTime = 0;

// Cache de álbuns já buscados
const albumCache = new Map();
// Cache de recordings já buscados (chave: "artist::title")
const recordingCache = new Map();
let recordingCacheHits = 0;
let albumCacheHits = 0;
let cacheMisses = 0;

/**
 * Aguarda o rate limit do MusicBrainz
 */
async function rateLimitWait() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Escanear pasta recursivamente e coletar arquivos de áudio
 */
async function scanAudioFiles(dir) {
  const files = [];

  async function scan(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (AUDIO_EXTENSIONS.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  await scan(dir);
  return files;
}

/**
 * Extrair metadados de um arquivo de áudio
 */
async function getMetadata(filePath) {
  try {
    const metadata = await parseFile(filePath, { skipCovers: true });
    const common = metadata.common;

    return {
      artist: common.artist || common.albumartist || "Unknown Artist",
      album: common.album || "Unknown Album",
      title: common.title || "Unknown Title",
      track_number: common.track?.no || 0,
      format: metadata.format?.container || extname(filePath).substring(1),
      file: filePath,
    };
  } catch (error) {
    console.error(`❌ Erro ao ler ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Limpa o título da música removendo termos desnecessários
 */
function cleanTitle(title) {
  if (!title) return title;

  let cleaned = title;

  // Remover variações de "remaster" (case insensitive)
  cleaned = cleaned.replace(/\s*\(?re[-\s]?master(ed)?\)?/gi, "");

  // Remover anos entre parênteses se estiver associado ao remaster
  cleaned = cleaned.replace(/\s*\(?\d{4}\s*re[-\s]?master(ed)?\)?/gi, "");

  // Remover parênteses vazios que podem ter sobrado
  cleaned = cleaned.replace(/\s*\(\s*\)/g, "");

  // Remover espaços múltiplos
  cleaned = cleaned.replace(/\s+/g, " ");

  // Trim
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Busca informações de uma recording (faixa) no MusicBrainz
 */
async function searchRecording(artist, title) {
  // Criar chave de cache
  const cleanedTitle = cleanTitle(title);
  const cacheKey = `${artist.toLowerCase()}::${cleanedTitle.toLowerCase()}`;

  // Verificar cache primeiro
  if (recordingCache.has(cacheKey)) {
    recordingCacheHits++;
    return recordingCache.get(cacheKey);
  }

  // Não está no cache, aplicar rate limit e buscar
  await rateLimitWait();

  try {
    // Limpar e formatar query
    const query = `recording:"${cleanedTitle}" AND artist:"${artist}"`;
    const url = `${MUSICBRAINZ_API}/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

    requestCount++;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 503) {
        console.log("    ⏸  Rate limit, aguardando...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return await searchRecording(artist, title);
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    let result;
    if (data.recordings && data.recordings.length > 0) {
      // Pegar a primeira recording (geralmente é a mais relevante)
      const recording = data.recordings[0];

      // Se tem releases associados, pegar o primeiro que NÃO seja live
      if (recording.releases && recording.releases.length > 0) {
        // Primeiro tentar encontrar um release que não seja live
        let release = recording.releases.find((r) => {
          const title = r.title || "";
          return !isLiveRecording(title);
        });

        // Se todos forem live, usar o primeiro mesmo
        if (!release) {
          release = recording.releases[0];
        }

        result = {
          found: true,
          recording_id: recording.id,
          recording_title: recording.title,
          album: release.title,
          album_id: release.id,
          artist: recording["artist-credit"]?.[0]?.name || artist,
          date: release.date || null,
          country: release.country || null,
          barcode: release.barcode || null,
          track_count: release["track-count"] || null,
          score: recording.score || 0,
        };
      } else {
        result = {
          found: true,
          recording_id: recording.id,
          recording_title: recording.title,
          album: null,
          artist: recording["artist-credit"]?.[0]?.name || artist,
          score: recording.score || 0,
        };
      }
    } else {
      result = { found: false };
    }

    // Cachear resultado (mesmo que não encontrado, para não buscar de novo)
    recordingCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error(`    ❌ Erro ao buscar: ${error.message}`);
    const errorResult = { found: false, error: error.message };
    // Não cachear erros, permitir retry
    return errorResult;
  }
}

/**
 * Busca detalhes completos de um release (álbum)
 */
async function getReleaseDetails(releaseId) {
  await rateLimitWait();

  try {
    const url = `${MUSICBRAINZ_API}/release/${releaseId}?inc=recordings+artist-credits&fmt=json`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Extrair tracklist
    const tracks = [];
    if (data.media && data.media.length > 0) {
      for (const medium of data.media) {
        for (const track of medium.tracks || []) {
          tracks.push({
            position: track.position,
            number: track.number,
            title: track.recording?.title || track.title,
            length: track.length,
            recording_id: track.recording?.id,
          });
        }
      }
    }

    return {
      id: data.id,
      title: data.title,
      date: data.date,
      country: data.country,
      barcode: data.barcode,
      track_count: tracks.length,
      tracks: tracks,
      artist: data["artist-credit"]?.[0]?.name,
    };
  } catch (error) {
    console.error(`    ❌ Erro ao buscar release: ${error.message}`);
    return null;
  }
}

/**
 * Enriquece dados de uma faixa
 */
async function enrichTrack(trackData, index, total) {
  const artist = trackData.artist || trackData.album_artist;
  const title = trackData.title;

  if (!artist || !title) {
    console.log(`${index}/${total} ⚠️  Sem artista/título`);
    return null;
  }

  const cleanedTitle = cleanTitle(title);
  const titleChanged = cleanedTitle !== title;

  // Mostrar título original, indicar se foi limpo
  if (titleChanged) {
    console.log(`${index}/${total} 🔍 ${artist} - ${title}`);
    console.log(`    🧹 Limpando: "${cleanedTitle}"`);
  } else {
    console.log(`${index}/${total} 🔍 ${artist} - ${title}`);
  }

  // Verificar se teremos cache hit de recording
  const recordingCacheKey = `${artist.toLowerCase()}::${cleanedTitle.toLowerCase()}`;
  const isRecordingCached = recordingCache.has(recordingCacheKey);

  const result = await searchRecording(artist, title);

  if (isRecordingCached) {
    console.log(`    💾 Cache hit (recording)`);
  }

  if (result.found) {
    foundCount++;

    // Se encontrou um álbum, buscar detalhes completos (com cache)
    let albumDetails = null;
    if (result.album_id) {
      // Verificar se já está no cache
      if (albumCache.has(result.album_id)) {
        albumCacheHits++;
        albumDetails = albumCache.get(result.album_id);
        console.log(`    💾 Cache hit (álbum): ${result.album} (${albumDetails.track_count} faixas)`);
      } else {
        cacheMisses++;
        console.log(`    📀 Buscando álbum completo: ${result.album}...`);
        albumDetails = await getReleaseDetails(result.album_id);

        if (albumDetails) {
          albumCache.set(result.album_id, albumDetails);
          console.log(`    ✅ ${albumDetails.track_count} faixas | ${albumDetails.date || "sem data"}`);
        }
      }
    } else {
      console.log(`    ✅ Encontrado (sem álbum definido)`);
    }

    return {
      ...trackData,
      musicbrainz: {
        recording_id: result.recording_id,
        album_id: result.album_id,
        album_name: result.album,
        corrected_artist: result.artist,
        date: result.date,
        country: result.country,
        track_count: albumDetails?.track_count || result.track_count,
        score: result.score,
      },
      album_details: albumDetails, // Detalhes completos do álbum
    };
  } else {
    notFoundCount++;
    console.log(`    ❌ Não encontrado`);
    return {
      ...trackData,
      musicbrainz: null,
      album_details: null,
    };
  }
}

/**
 * Agrupa faixas por álbum corrigido
 */
function groupByCorrectAlbum(enrichedTracks) {
  const albums = new Map();
  const singles = [];
  const notFound = [];

  for (const track of enrichedTracks) {
    if (!track.musicbrainz) {
      notFound.push(track);
      continue;
    }

    if (!track.musicbrainz.album_name) {
      singles.push(track);
      continue;
    }

    const albumKey = track.musicbrainz.album_id || track.musicbrainz.album_name;

    if (!albums.has(albumKey)) {
      albums.set(albumKey, {
        album_id: track.musicbrainz.album_id,
        album_name: track.musicbrainz.album_name,
        artist: track.musicbrainz.corrected_artist || track.artist,
        year: track.musicbrainz.date?.substring(0, 4),
        country: track.musicbrainz.country,
        expected_tracks: track.musicbrainz.track_count,
        tracks: [],
      });
    }

    albums.get(albumKey).tracks.push(track);
  }

  // Converter Map para objeto
  const result = {
    albums: Array.from(albums.values()).map((album) => ({
      ...album,
      downloaded_tracks: album.tracks.length,
      missing_tracks: album.expected_tracks ? album.expected_tracks - album.tracks.length : null,
      is_complete: album.expected_tracks ? album.tracks.length >= album.expected_tracks : null,
    })),
    singles: singles,
    not_found: notFound,
  };

  return result;
}

/**
 * Função principal
 */
async function main() {
  const outputFile = join(PROJECT_ROOT, "library_enriched.json");

  console.log("=".repeat(60));
  console.log("🎵 Enriquecedor de Metadados - MusicBrainz");
  console.log("=".repeat(60));
  console.log();

  // Escanear pasta downloads
  console.log(`📁 Escaneando ${DOWNLOADS_DIR}...`);
  const audioFiles = await scanAudioFiles(DOWNLOADS_DIR);
  console.log(`🎧 Encontrados ${audioFiles.length} arquivos de áudio`);
  console.log();

  // Extrair metadados
  console.log("📖 Extraindo metadados dos arquivos...");
  const allTracks = [];
  let ignoredLive = 0;

  for (let i = 0; i < audioFiles.length; i++) {
    const metadata = await getMetadata(audioFiles[i]);
    if (metadata) {
      // Ignorar músicas ou álbuns LIVE
      const filePath = metadata.file;
      const title = metadata.title || "";
      const album = metadata.album || "";

      if (isLiveRecording(filePath) || isLiveRecording(title) || isLiveRecording(album)) {
        ignoredLive++;
        continue;
      }

      allTracks.push({
        artist: metadata.artist,
        album_artist: metadata.artist,
        original_album: metadata.album,
        original_album_key: metadata.album,
        title: metadata.title,
        track_number: metadata.track_number,
        file: metadata.file,
        format: metadata.format,
      });
    }

    // Progresso a cada 50 arquivos
    if ((i + 1) % 50 === 0) {
      console.log(`   Processados ${i + 1}/${audioFiles.length} arquivos...`);
    }
  }

  console.log(`📚 Total de faixas processadas: ${allTracks.length}`);
  if (ignoredLive > 0) {
    console.log(`🚫 Ignorados (LIVE): ${ignoredLive}`);
  }
  console.log();
  console.log("🔎 Buscando metadados no MusicBrainz...");
  console.log("⏱️  Rate limit: 1 request/segundo");
  console.log();

  // Processar faixas
  const enrichedTracks = [];
  for (let i = 0; i < allTracks.length; i++) {
    const result = await enrichTrack(allTracks[i], i + 1, allTracks.length);
    if (result) {
      enrichedTracks.push(result);
    }
  }

  console.log();
  console.log("📊 Agrupando por álbuns corretos...");
  const grouped = groupByCorrectAlbum(enrichedTracks);

  // Salvar resultado
  const output = {
    metadata: {
      generated_at: new Date().toISOString(),
      total_tracks: enrichedTracks.length,
      found: foundCount,
      not_found: notFoundCount,
      requests_made: requestCount,
    },
    albums: grouped.albums.sort((a, b) => {
      // Ordenar por artista, depois álbum
      if (a.artist !== b.artist) return a.artist.localeCompare(b.artist);
      return a.album_name.localeCompare(b.album_name);
    }),
    singles: grouped.singles,
    not_found: grouped.not_found,
    raw_tracks: enrichedTracks,
  };

  await writeFile(outputFile, JSON.stringify(output, null, 2), "utf-8");

  // Estatísticas
  console.log();
  console.log("=".repeat(60));
  console.log("📊 RESULTADOS");
  console.log("=".repeat(60));
  console.log(`✅ Encontrados: ${foundCount} (${Math.round((foundCount / enrichedTracks.length) * 100)}%)`);
  console.log(`❌ Não encontrados: ${notFoundCount} (${Math.round((notFoundCount / enrichedTracks.length) * 100)}%)`);
  console.log(`🔍 Requests MusicBrainz: ${requestCount}`);
  console.log(`💾 Cache hits (recordings): ${recordingCacheHits}`);
  console.log(`💾 Cache hits (álbuns): ${albumCacheHits}`);
  console.log(`⚡ Tempo economizado: ~${recordingCacheHits + albumCacheHits}s`);
  console.log();
  console.log(`💿 Álbuns identificados: ${grouped.albums.length}`);
  console.log(`🎵 Singles/EPs: ${grouped.singles.length}`);
  console.log();

  // Álbuns incompletos
  const incomplete = grouped.albums.filter((a) => a.is_complete === false);
  if (incomplete.length > 0) {
    console.log("⚠️  ÁLBUNS INCOMPLETOS:");
    incomplete.slice(0, 10).forEach((album) => {
      console.log(`   • ${album.artist} - ${album.album_name}`);
      console.log(`     └─ ${album.downloaded_tracks}/${album.expected_tracks} faixas (faltam ${album.missing_tracks})`);
    });
    if (incomplete.length > 10) {
      console.log(`   ... e mais ${incomplete.length - 10} álbuns`);
    }
  }

  console.log();
  console.log("=".repeat(60));
  console.log(`💾 Salvo em: ${outputFile}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});
