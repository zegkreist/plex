#!/usr/bin/env node
/**
 * Organiza músicas por álbuns
 * Analisa downloads/ e library_enriched.json para criar estrutura organizada por álbuns
 */

import { readFile, writeFile, readdir, stat, mkdir, copyFile, access } from "fs/promises";
import { join, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";
import { parseFile } from "music-metadata";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");
const DOWNLOADS_DIR = join(PROJECT_ROOT, "downloads");
const OUTPUT_DIR = "/home/zegkreist/Documents/Pessoal/plex_server/music";

// Formatos de áudio e imagem
const AUDIO_EXTENSIONS = [".flac", ".m4a", ".mp3", ".opus", ".ogg", ".wav"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];

// Playlists conhecidas (não são álbuns)
const KNOWN_PLAYLISTS = ["ShroomTrip", "Viagem light", "Hotline Miami Soundtrack", "Balanço Groove Brasil 70’s"];

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

/** * Verifica se um nome é de playlist (case-insensitive, ignora caracteres especiais)
 */
function isPlaylistName(name) {
  if (!name) return false;

  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9\s]/g, "") // Remove caracteres especiais
    .replace(/\s+/g, " ")
    .trim();

  for (const playlist of KNOWN_PLAYLISTS) {
    const normalizedPlaylist = playlist
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Verificar se contém ou é similar
    if (normalized.includes(normalizedPlaylist) || normalizedPlaylist.includes(normalized)) {
      return true;
    }

    // Verificar palavras-chave principais
    const playlistWords = normalizedPlaylist.split(" ").filter((w) => w.length > 3);
    const nameWords = normalized.split(" ");

    if (playlistWords.length > 0) {
      const matches = playlistWords.filter((pw) => nameWords.some((nw) => nw.includes(pw) || pw.includes(nw)));
      if (matches.length >= Math.min(2, playlistWords.length)) {
        return true;
      }
    }
  }

  return false;
}

/** * Detecta se o arquivo vem de uma playlist conhecida
 */
function isFromPlaylist(filePath) {
  const normalizedPath = filePath.toLowerCase();

  for (const playlist of KNOWN_PLAYLISTS) {
    const normalizedPlaylist = playlist.toLowerCase();
    if (normalizedPath.includes(normalizedPlaylist)) {
      return true;
    }
  }

  return false;
}

/**
 * Extrai informações de álbum do caminho do arquivo
 * Estruturas suportadas:
 * 1. downloads/Artist - Album/track.flac (formato comum do Tidal)
 * 2. downloads/Artist/Album/track.flac (estrutura tradicional)
 */
function extractAlbumFromPath(filePath) {
  const relativePath = filePath.replace(DOWNLOADS_DIR, "").replace(/^\//, "");
  const parts = relativePath.split("/");

  // Se tem 2 partes: FolderName/file.flac
  if (parts.length >= 2) {
    const folderName = parts[0];

    // Verificar se o nome da pasta contém " - " (formato: "Artist - Album")
    if (folderName.includes(" - ")) {
      const dashIndex = folderName.indexOf(" - ");
      const artist = folderName.substring(0, dashIndex).trim();
      const album = folderName.substring(dashIndex + 3).trim();

      if (artist && album) {
        return {
          artist: artist,
          album: album,
          isValid: true,
        };
      }
    }

    // Estrutura tradicional: Artist/Album/file.flac
    if (parts.length >= 3) {
      return {
        artist: parts[0],
        album: parts[1],
        isValid: true,
      };
    }

    // Apenas uma pasta sem separador claro
    return {
      artist: folderName,
      album: null,
      isValid: false,
    };
  }

  // Sem estrutura reconhecível
  return {
    artist: null,
    album: null,
    isValid: false,
  };
}

/**
 * Normaliza nome para criar pastas (remove caracteres inválidos)
 */
function sanitizeFolderName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrai metadados de arquivo de áudio incluindo cover
 */
async function getMetadata(filePath) {
  try {
    const metadata = await parseFile(filePath, { skipCovers: false });
    const common = metadata.common;

    let coverHash = null;
    if (common.picture && common.picture.length > 0) {
      const cover = common.picture[0];
      // Hash do conteúdo completo da imagem para match preciso
      coverHash = createHash("md5").update(cover.data).digest("hex");
    }

    return {
      artist: common.artist || common.albumartist || "Unknown Artist",
      album: common.album || "Unknown Album",
      title: common.title || basename(filePath, extname(filePath)),
      track_number: common.track?.no || 0,
      cover_hash: coverHash,
      cover_data: common.picture && common.picture.length > 0 ? common.picture[0] : null,
      format: metadata.format?.container || extname(filePath).substring(1),
    };
  } catch (error) {
    console.error(`❌ Erro ao ler ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Escaneia pasta recursivamente buscando arquivos de áudio e covers
 */
async function scanDirectory(dir) {
  const items = { audioFiles: [], coverFiles: [] };

  async function scan(currentDir) {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (AUDIO_EXTENSIONS.includes(ext)) {
            items.audioFiles.push(fullPath);
          } else if (IMAGE_EXTENSIONS.includes(ext) && entry.name.toLowerCase().includes("cover")) {
            items.coverFiles.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`⚠️  Erro ao escanear ${currentDir}:`, error.message);
    }
  }

  await scan(dir);
  return items;
}

/**
 * Normaliza string para comparação (remove acentos, lowercase, espaços extras)
 * Remove também termos como "remastered", "live", anos, etc.
 */
function normalizeForComparison(str) {
  let normalized = str.toLowerCase();

  // Remover variações de "remaster"
  normalized = normalized.replace(/\s*\(?re[-\s]?master(ed)?\)?/gi, "");

  // Remover anos entre parênteses
  normalized = normalized.replace(/\s*\(?\d{4}\)?/g, "");

  // Remover "live", "ao vivo" e variações
  normalized = normalized.replace(/\s*\(?(live|ao[-\s]?vivo)\)?/gi, "");

  // Remover "deluxe", "edition", "expanded", etc.
  normalized = normalized.replace(/\s*\(?(deluxe|edition|expanded|special|anniversary|bonus)\)?/gi, "");

  // Normalizar unicode e remover caracteres especiais
  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Busca pasta de álbum existente que seja compatível
 * Retorna o caminho se encontrar, ou null se não encontrar
 */
function findExistingAlbumFolder(artist, albumName, coverHash, processedAlbums) {
  const normalizedArtist = normalizeForComparison(artist);
  const normalizedAlbum = normalizeForComparison(albumName);

  // Buscar em álbuns já processados
  for (const [key, info] of processedAlbums.entries()) {
    const existingNormalizedArtist = normalizeForComparison(info.artist);
    const existingNormalizedAlbum = normalizeForComparison(info.albumName);

    // Verificar se artista é o mesmo
    if (existingNormalizedArtist !== normalizedArtist) {
      continue;
    }

    // Verificar similaridade do nome do álbum (80% de match ou mais)
    const albumSimilarity = calculateSimilarity(normalizedAlbum, existingNormalizedAlbum);

    if (albumSimilarity >= 0.8) {
      // Nome similar, verificar cover hash se disponível
      if (coverHash && info.coverHash) {
        if (coverHash === info.coverHash) {
          // Cover igual, é o mesmo álbum!
          return info.path;
        }
      } else {
        // Sem cover hash para comparar, mas nome muito similar
        if (albumSimilarity >= 0.9) {
          return info.path;
        }
      }
    }
  }

  return null;
}

/**
 * Busca álbum existente apenas pelo cover hash e artista
 * Usado para agrupar músicas de playlist sem metadata enriquecida
 */
function findAlbumByCover(artist, coverHash, processedAlbums) {
  if (!coverHash) return null;

  const normalizedArtist = normalizeForComparison(artist);

  // Buscar em álbuns já processados
  for (const [key, info] of processedAlbums.entries()) {
    const existingNormalizedArtist = normalizeForComparison(info.artist);

    // Verificar se artista é o mesmo e cover é igual
    if (existingNormalizedArtist === normalizedArtist && info.coverHash === coverHash) {
      return info.path;
    }
  }

  return null;
}

/**
 * Calcula similaridade entre duas strings (0 a 1)
 * Usa algoritmo de distância de Levenshtein simplificado
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  // Calcular quantos caracteres são iguais
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      matches++;
    }
  }

  return matches / longer.length;
}

/**
 * Busca álbum correto no library_enriched para uma música
 */
function findAlbumForTrack(libraryData, trackMetadata) {
  const trackTitle = normalizeForComparison(trackMetadata.title);
  const trackArtist = normalizeForComparison(trackMetadata.artist);

  const matches = [];

  // Buscar na lista de álbuns e coletar todos os matches
  for (const album of libraryData.albums) {
    // Verificar se o artista bate
    const albumArtist = normalizeForComparison(album.artist);
    if (!albumArtist.includes(trackArtist) && !trackArtist.includes(albumArtist)) {
      continue;
    }

    // Verificar se alguma track do álbum bate
    for (const track of album.tracks) {
      const albumTrackTitle = normalizeForComparison(track.title);

      if (albumTrackTitle === trackTitle || albumTrackTitle.includes(trackTitle) || trackTitle.includes(albumTrackTitle)) {
        matches.push({
          artist: album.artist,
          album_name: album.album_name,
          album_id: album.album_id,
          mbid: album.mbid,
          total_tracks: album.expected_tracks || album.tracks.length,
          isLive: isLiveRecording(album.album_name),
          isPlaylist: isPlaylistName(album.album_name),
        });
        break; // Já encontrou match neste álbum, não precisa verificar outras tracks
      }
    }
  }

  // Se encontrou matches, filtrar álbuns live e playlists
  if (matches.length > 0) {
    // Filtrar apenas álbuns não-live e não-playlist
    const validMatches = matches.filter((m) => !m.isLive && !m.isPlaylist);

    if (validMatches.length > 0) {
      // Retornar o primeiro válido
      const { isLive, isPlaylist, ...result } = validMatches[0];
      return result;
    }

    // Se todos forem live ou playlists, não retornar nada (tratar como não encontrado)
    // Música será colocada em pasta numerada
    return {
      artist: trackMetadata.artist,
      album_name: null,
      album_id: null,
      mbid: null,
      total_tracks: null,
      is_unknown: true,
    };
  }

  // Se não encontrou, retorna info básica dos metadados
  // Marcar como "unknown" para tratamento especial
  return {
    artist: trackMetadata.artist,
    album_name: null, // null indica que não foi encontrado
    album_id: null,
    mbid: null,
    total_tracks: null,
    is_unknown: true, // Flag para identificar músicas sem álbum
  };
}

/**
 * Escaneia pasta de álbum numerado existente para determinar próximo número
 */
async function getNextTrackNumber(singlesDir) {
  try {
    const files = await readdir(singlesDir);
    const audioFiles = files.filter((f) => {
      const ext = extname(f).toLowerCase();
      return AUDIO_EXTENSIONS.includes(ext);
    });

    // Encontrar o maior número existente
    let maxNumber = 0;
    for (const file of audioFiles) {
      const match = file.match(/^(\d+)\s*-/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }

    return maxNumber + 1;
  } catch {
    // Pasta não existe ainda
    return 1;
  }
}

/**
 * Cria estrutura de pastas e copia arquivo
 */
async function copyToOrganized(sourcePath, targetPath) {
  const targetDir = dirname(targetPath);

  // Criar diretório se não existir
  await mkdir(targetDir, { recursive: true });

  // Verificar se arquivo já existe
  try {
    await access(targetPath);
    console.log(`   ⏭️  Já existe: ${basename(targetPath)}`);
    return false;
  } catch {
    // Arquivo não existe, pode copiar
  }

  // Copiar arquivo
  await copyFile(sourcePath, targetPath);
  return true;
}

/**
 * Salva cover do álbum
 */
async function saveCover(coverData, albumDir) {
  if (!coverData) return;

  const ext = coverData.format === "image/png" ? "png" : "jpg";
  const coverPath = join(albumDir, `cover.${ext}`);

  // Verificar se já existe
  try {
    await access(coverPath);
    return;
  } catch {
    // Cover não existe, salvar
  }

  await mkdir(albumDir, { recursive: true });
  await writeFile(coverPath, coverData.data);
}

/**
 * Busca arquivo de cover na pasta original
 */
async function findCoverInOriginalFolder(audioFilePath, coverFiles) {
  const audioDir = dirname(audioFilePath);

  // Buscar covers na mesma pasta ou pasta pai
  for (const coverPath of coverFiles) {
    const coverDir = dirname(coverPath);
    if (coverDir === audioDir || coverDir === dirname(audioDir)) {
      return coverPath;
    }
  }

  return null;
}

/**
 * Função principal
 */
async function main() {
  console.log("=".repeat(70));
  console.log("🎵 ORGANIZADOR DE MÚSICAS POR ÁLBUM");
  console.log("=".repeat(70));
  console.log();

  // Carregar library_enriched.json
  const enrichedFile = join(PROJECT_ROOT, "library_enriched.json");
  console.log(`📖 Carregando ${enrichedFile}...`);

  let libraryData;
  try {
    libraryData = JSON.parse(await readFile(enrichedFile, "utf-8"));
    console.log(`✅ Carregado: ${libraryData.albums.length} álbuns identificados`);
  } catch (error) {
    console.error(`❌ Erro ao carregar library_enriched.json: ${error.message}`);
    process.exit(1);
  }

  console.log();

  // Escanear pasta downloads
  console.log(`📁 Escaneando ${DOWNLOADS_DIR}...`);
  const { audioFiles, coverFiles } = await scanDirectory(DOWNLOADS_DIR);
  console.log(`✅ Encontrados: ${audioFiles.length} arquivos de áudio, ${coverFiles.length} covers`);
  console.log();

  // Separar arquivos de álbuns e playlists
  console.log(`📋 Separando álbuns e playlists...`);
  const albumFiles = [];
  const playlistFiles = [];

  for (const audioFile of audioFiles) {
    if (isFromPlaylist(audioFile)) {
      playlistFiles.push(audioFile);
    } else {
      albumFiles.push(audioFile);
    }
  }

  console.log(`   💿 Álbuns: ${albumFiles.length} arquivos`);
  console.log(`   🎶 Playlists: ${playlistFiles.length} arquivos`);
  console.log();

  // Criar pasta de saída
  console.log(`📂 Criando estrutura em ${OUTPUT_DIR}...`);
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log();

  // Processar arquivos em duas fases
  console.log("🔄 FASE 1: Processando álbuns...");
  console.log();

  const stats = {
    processed: 0,
    copied: 0,
    skipped: 0,
    ignoredLive: 0, // Contador de músicas ignoradas por serem LIVE
    errors: 0,
    albums: new Set(),
    merged: 0, // Contador de músicas que foram mescladas em álbuns existentes
    unknown: 0, // Contador de músicas sem álbum identificado
    fromAlbums: 0, // Músicas que já vinham de álbuns
    fromPlaylists: 0, // Músicas que vinham de playlists
    playlistMergedToAlbum: 0, // Músicas de playlist que foram para álbuns existentes
    playlistGroupedByCover: 0, // Músicas de playlist agrupadas por cover
  };

  // Map para rastrear álbuns já criados: key -> {artist, albumName, path, coverHash}
  const processedAlbums = new Map();

  // Map para rastrear contador de álbuns numerados por artista
  // Key: artistFolder, Value: { currentFolder: number, trackCount: number }
  const artistSinglesInfo = new Map();
  const MAX_SINGLES_PER_FOLDER = 20; // Máximo de músicas por pasta de álbum numerado

  // Map para rastrear álbuns agrupados por cover (artista + cover hash)
  const coverBasedAlbums = new Map();
  let coverAlbumCounter = 1;

  // FASE 1: Processar álbuns
  for (let i = 0; i < albumFiles.length; i++) {
    const audioFile = albumFiles[i];
    const progress = `[ÁLBUM ${i + 1}/${albumFiles.length}]`;

    try {
      // Extrair metadados
      console.log(`${progress} 📀 ${basename(audioFile)}`);
      const metadata = await getMetadata(audioFile);

      if (!metadata) {
        console.log(`   ❌ Erro ao ler metadados`);
        stats.errors++;
        continue;
      }

      // Ignorar músicas ou álbuns LIVE
      const filePath = audioFile;
      const title = metadata.title || "";
      const album = metadata.album || "";

      if (isLiveRecording(filePath) || isLiveRecording(title) || isLiveRecording(album)) {
        console.log(`   ⏭️  Ignorado: contém LIVE`);
        stats.ignoredLive++;
        console.log();
        continue;
      }

      // Processar álbum - usar estrutura do path
      const pathInfo = extractAlbumFromPath(audioFile);
      let albumInfo;

      if (pathInfo.isValid) {
        // Verificar se o nome do álbum não é uma playlist
        if (isPlaylistName(pathInfo.album)) {
          console.log(`   ⚠️  Nome de álbum é playlist: "${pathInfo.album}" - ignorando`);
          stats.skipped++;
          console.log();
          continue;
        } else {
          console.log(`   💿 Álbum detectado: ${pathInfo.artist} - ${pathInfo.album}`);
          albumInfo = {
            artist: pathInfo.artist,
            album_name: pathInfo.album,
            album_id: null,
            mbid: null,
            total_tracks: null,
            is_unknown: false,
          };
          stats.fromAlbums++;
        }
      } else {
        // Path inválido, marcar como unknown
        console.log(`   ⚠️  Path inválido - sem informação de álbum`);
        albumInfo = {
          artist: metadata.artist,
          album_name: null,
          is_unknown: true,
        };
      }

      // Variáveis para o processamento
      let albumDir;
      let artistFolder;
      let albumFolder;
      let isMerged = false;
      let isUnknown = false;
      let targetFileName;

      // Se não foi encontrado álbum, criar pasta com numerador usando nome do artista
      if (albumInfo.is_unknown) {
        console.log(`   ⚠️  ${albumInfo.artist} - Álbum não identificado`);

        artistFolder = sanitizeFolderName(albumInfo.artist);

        // Obter ou inicializar informações de albums numerados para este artista
        let singlesInfo = artistSinglesInfo.get(artistFolder);
        if (!singlesInfo) {
          singlesInfo = { currentFolder: 1, trackCount: 0 };
          artistSinglesInfo.set(artistFolder, singlesInfo);
        }

        // Se mudou de pasta ou é primeira vez, precisa verificar quantas músicas já existem
        const testAlbumFolder = `${artistFolder} ${singlesInfo.currentFolder.toString().padStart(2, "0")}`;
        const testAlbumDir = join(OUTPUT_DIR, artistFolder, testAlbumFolder);

        // Se trackCount é 0, significa que é primeira música nesta pasta ou acabou de mudar
        // Precisamos verificar quantas já existem
        if (singlesInfo.trackCount === 0) {
          const existingCount = (await getNextTrackNumber(testAlbumDir)) - 1;
          singlesInfo.trackCount = existingCount;
        }

        // Se a pasta atual já tem o máximo de músicas, criar nova pasta
        if (singlesInfo.trackCount >= MAX_SINGLES_PER_FOLDER) {
          singlesInfo.currentFolder++;
          singlesInfo.trackCount = 0;

          // Recalcular para nova pasta
          const newAlbumFolder = `${artistFolder} ${singlesInfo.currentFolder.toString().padStart(2, "0")}`;
          const newAlbumDir = join(OUTPUT_DIR, artistFolder, newAlbumFolder);
          const existingCount = (await getNextTrackNumber(newAlbumDir)) - 1;
          singlesInfo.trackCount = existingCount;
        }

        // Criar pasta com numerador usando nome do artista
        albumFolder = `${artistFolder} ${singlesInfo.currentFolder.toString().padStart(2, "0")}`;
        albumDir = join(OUTPUT_DIR, artistFolder, albumFolder);

        // Incrementar contador de tracks nesta pasta
        singlesInfo.trackCount++;

        // Numerar as músicas dentro da pasta do álbum numerado
        const trackNumStr = singlesInfo.trackCount.toString().padStart(2, "0");
        const originalExt = extname(audioFile);
        const trackTitle = sanitizeFolderName(metadata.title);
        targetFileName = `${trackNumStr} - ${trackTitle}${originalExt}`;

        isUnknown = true;
        stats.unknown++;

        console.log(`   📁 Álbum numerado: ${artistFolder}/${albumFolder}/ (track ${singlesInfo.trackCount})`);
      } else {
        // Última verificação: garantir que album_name não é uma playlist
        if (isPlaylistName(albumInfo.album_name)) {
          console.log(`   ⚠️  Nome de álbum é playlist: "${albumInfo.album_name}" - criando pasta numerada`);

          artistFolder = sanitizeFolderName(albumInfo.artist);

          let singlesInfo = artistSinglesInfo.get(artistFolder);
          if (!singlesInfo) {
            singlesInfo = { currentFolder: 1, trackCount: 0 };
            artistSinglesInfo.set(artistFolder, singlesInfo);
          }

          const testAlbumFolder = `${artistFolder} ${singlesInfo.currentFolder.toString().padStart(2, "0")}`;
          const testAlbumDir = join(OUTPUT_DIR, artistFolder, testAlbumFolder);

          if (singlesInfo.trackCount === 0) {
            const existingCount = (await getNextTrackNumber(testAlbumDir)) - 1;
            singlesInfo.trackCount = existingCount;
          }

          if (singlesInfo.trackCount >= MAX_SINGLES_PER_FOLDER) {
            singlesInfo.currentFolder++;
            singlesInfo.trackCount = 0;

            const newAlbumFolder = `${artistFolder} ${singlesInfo.currentFolder.toString().padStart(2, "0")}`;
            const newAlbumDir = join(OUTPUT_DIR, artistFolder, newAlbumFolder);
            const existingCount = (await getNextTrackNumber(newAlbumDir)) - 1;
            singlesInfo.trackCount = existingCount;
          }

          albumFolder = `${artistFolder} ${singlesInfo.currentFolder.toString().padStart(2, "0")}`;
          albumDir = join(OUTPUT_DIR, artistFolder, albumFolder);
          singlesInfo.trackCount++;

          const trackNumStr = singlesInfo.trackCount.toString().padStart(2, "0");
          const originalExt = extname(audioFile);
          const trackTitle = sanitizeFolderName(metadata.title);
          targetFileName = `${trackNumStr} - ${trackTitle}${originalExt}`;

          isUnknown = true;
          stats.unknown++;

          console.log(`   📁 Álbum numerado: ${artistFolder}/${albumFolder}/ (track ${singlesInfo.trackCount})`);
        } else {
          console.log(`   🎤 ${albumInfo.artist} - ${albumInfo.album_name}`);

          // Verificar se já existe pasta para este álbum
          const existingAlbumPath = findExistingAlbumFolder(albumInfo.artist, albumInfo.album_name, metadata.cover_hash, processedAlbums);

          if (existingAlbumPath) {
            // Usar pasta existente
            albumDir = existingAlbumPath;
            const parts = albumDir.split("/");
            albumFolder = parts[parts.length - 1];
            artistFolder = parts[parts.length - 2];
            console.log(`   🔗 Mesclando com álbum existente: ${artistFolder}/${albumFolder}/`);
            isMerged = true;
          } else {
            // Criar nova pasta
            artistFolder = sanitizeFolderName(albumInfo.artist);
            albumFolder = sanitizeFolderName(albumInfo.album_name);
            albumDir = join(OUTPUT_DIR, artistFolder, albumFolder);

            // Registrar novo álbum
            const albumKey = `${artistFolder}/${albumFolder}`;
            processedAlbums.set(albumKey, {
              artist: albumInfo.artist,
              albumName: albumInfo.album_name,
              path: albumDir,
              coverHash: metadata.cover_hash,
            });
          }

          // Criar nome do arquivo com numeração de track
          const trackNumber = metadata.track_number || 0;
          const trackNumStr = trackNumber > 0 ? trackNumber.toString().padStart(2, "0") : "00";
          const originalExt = extname(audioFile);
          const trackTitle = sanitizeFolderName(metadata.title);
          targetFileName = `${trackNumStr} - ${trackTitle}${originalExt}`;
        }
      }

      const targetPath = join(albumDir, targetFileName);

      // Copiar arquivo
      const copied = await copyToOrganized(audioFile, targetPath);

      if (copied) {
        console.log(`   ✅ Copiado como: ${targetFileName}`);
        if (!isMerged) {
          console.log(`      Destino: ${artistFolder}/${albumFolder}/`);
        }
        stats.copied++;
        stats.albums.add(`${artistFolder}/${albumFolder}`);
        if (isMerged) {
          stats.merged++;
        }

        // Salvar cover embutido
        if (metadata.cover_data) {
          await saveCover(metadata.cover_data, albumDir);
        }

        // Buscar e copiar cover externo
        const externalCover = await findCoverInOriginalFolder(audioFile, coverFiles);
        if (externalCover) {
          const coverExt = extname(externalCover);
          const coverTarget = join(albumDir, `cover${coverExt}`);
          try {
            await copyFile(externalCover, coverTarget);
            console.log(`   🖼️  Cover copiado`);
          } catch (error) {
            // Ignore se já existe
          }
        }
      } else {
        stats.skipped++;
      }

      stats.processed++;
      console.log();
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
      stats.errors++;
      console.log();
    }
  }

  // FASE 2: Processar playlists
  console.log();
  console.log("=".repeat(70));
  console.log("🔄 FASE 2: Processando playlists...");
  console.log("=".repeat(70));
  console.log();

  for (let i = 0; i < playlistFiles.length; i++) {
    const audioFile = playlistFiles[i];
    const progress = `[PLAYLIST ${i + 1}/${playlistFiles.length}]`;

    try {
      // Extrair metadados
      console.log(`${progress} 📀 ${basename(audioFile)}`);
      const metadata = await getMetadata(audioFile);

      if (!metadata) {
        console.log(`   ❌ Erro ao ler metadados`);
        stats.errors++;
        continue;
      }

      // Ignorar músicas LIVE
      const filePath = audioFile;
      const title = metadata.title || "";
      const album = metadata.album || "";

      if (isLiveRecording(filePath) || isLiveRecording(title) || isLiveRecording(album)) {
        console.log(`   ⏭️  Ignorado: contém LIVE`);
        stats.ignoredLive++;
        console.log();
        continue;
      }

      stats.fromPlaylists++;
      console.log(`   🎶 Música de playlist`);

      // Estratégia 1: Buscar álbum existente por similaridade + cover
      let existingAlbumPath = null;
      if (metadata.cover_hash) {
        // Buscar por cover primeiro (match exato)
        existingAlbumPath = findAlbumByCover(metadata.artist, metadata.cover_hash, processedAlbums);

        if (existingAlbumPath) {
          console.log(`   ✅ Match por cover - usando álbum existente`);
        }
      }

      // Estratégia 2: Buscar em library_enriched
      let albumInfo = null;
      if (!existingAlbumPath) {
        albumInfo = findAlbumForTrack(libraryData, metadata);

        if (!albumInfo.is_unknown) {
          console.log(`   📚 Encontrado no MusicBrainz: ${albumInfo.album_name}`);

          // Verificar se já existe álbum com esse nome
          existingAlbumPath = findExistingAlbumFolder(albumInfo.artist, albumInfo.album_name, metadata.cover_hash, processedAlbums);

          if (existingAlbumPath) {
            console.log(`   🔗 Mesclando com álbum existente`);
            stats.playlistMergedToAlbum++;
          }
        } else {
          console.log(`   ⚠️  Não encontrado no MusicBrainz`);
        }
      } else {
        stats.playlistMergedToAlbum++;
      }

      // Estratégia 3: Agrupar por cover se não houver metadata enriquecida
      if (!existingAlbumPath && (!albumInfo || albumInfo.is_unknown)) {
        if (metadata.cover_hash) {
          console.log(`   🖼️  Agrupando por cover hash`);

          // Criar chave única por artista + cover
          const coverKey = `${sanitizeFolderName(metadata.artist)}::${metadata.cover_hash}`;

          if (!coverBasedAlbums.has(coverKey)) {
            // Criar novo álbum baseado em cover
            const albumName = `${metadata.artist} ${coverAlbumCounter.toString().padStart(2, "0")}`;
            coverAlbumCounter++;

            const artistFolder = sanitizeFolderName(metadata.artist);
            const albumFolder = sanitizeFolderName(albumName);
            const albumDir = join(OUTPUT_DIR, artistFolder, albumFolder);

            coverBasedAlbums.set(coverKey, {
              path: albumDir,
              artist: metadata.artist,
              albumName: albumName,
              coverHash: metadata.cover_hash,
              trackCount: 0,
            });

            // Registrar em processedAlbums também
            const albumKey = `${artistFolder}/${albumFolder}`;
            processedAlbums.set(albumKey, {
              artist: metadata.artist,
              albumName: albumName,
              path: albumDir,
              coverHash: metadata.cover_hash,
            });

            console.log(`   📁 Novo álbum por cover: ${albumName}`);
          }

          const coverAlbumInfo = coverBasedAlbums.get(coverKey);
          existingAlbumPath = coverAlbumInfo.path;
          coverAlbumInfo.trackCount++;

          albumInfo = {
            artist: coverAlbumInfo.artist,
            album_name: coverAlbumInfo.albumName,
            is_unknown: false,
          };

          stats.playlistGroupedByCover++;
        } else {
          // Sem cover, criar pasta numerada
          console.log(`   ⚠️  Sem cover - criando pasta numerada`);

          const artistFolder = sanitizeFolderName(metadata.artist);
          let singlesInfo = artistSinglesInfo.get(artistFolder);

          if (!singlesInfo) {
            singlesInfo = { currentFolder: 1, trackCount: 0 };
            artistSinglesInfo.set(artistFolder, singlesInfo);
          }

          const testAlbumFolder = `${artistFolder} ${singlesInfo.currentFolder.toString().padStart(2, "0")}`;
          const testAlbumDir = join(OUTPUT_DIR, artistFolder, testAlbumFolder);

          if (singlesInfo.trackCount === 0) {
            const existingCount = (await getNextTrackNumber(testAlbumDir)) - 1;
            singlesInfo.trackCount = existingCount;
          }

          if (singlesInfo.trackCount >= MAX_SINGLES_PER_FOLDER) {
            singlesInfo.currentFolder++;
            singlesInfo.trackCount = 0;
          }

          const albumFolder = `${artistFolder} ${singlesInfo.currentFolder.toString().padStart(2, "0")}`;
          existingAlbumPath = join(OUTPUT_DIR, artistFolder, albumFolder);
          singlesInfo.trackCount++;

          albumInfo = {
            artist: metadata.artist,
            album_name: albumFolder,
            is_unknown: true,
          };

          stats.unknown++;
        }
      }

      // Copiar arquivo para o destino
      let albumDir, artistFolder, albumFolder, targetFileName;

      if (existingAlbumPath) {
        albumDir = existingAlbumPath;
        const parts = albumDir.split("/");
        albumFolder = parts[parts.length - 1];
        artistFolder = parts[parts.length - 2];
      } else {
        // Criar novo álbum com info do MusicBrainz
        artistFolder = sanitizeFolderName(albumInfo.artist);
        albumFolder = sanitizeFolderName(albumInfo.album_name);
        albumDir = join(OUTPUT_DIR, artistFolder, albumFolder);

        const albumKey = `${artistFolder}/${albumFolder}`;
        processedAlbums.set(albumKey, {
          artist: albumInfo.artist,
          albumName: albumInfo.album_name,
          path: albumDir,
          coverHash: metadata.cover_hash,
        });
      }

      // Determinar número da track
      const trackNumber = metadata.track_number || 0;
      const trackNumStr = trackNumber > 0 ? trackNumber.toString().padStart(2, "0") : "00";
      const originalExt = extname(audioFile);
      const trackTitle = sanitizeFolderName(metadata.title);
      targetFileName = `${trackNumStr} - ${trackTitle}${originalExt}`;

      const targetPath = join(albumDir, targetFileName);

      // Copiar arquivo
      const copied = await copyToOrganized(audioFile, targetPath);

      if (copied) {
        console.log(`   ✅ Copiado: ${artistFolder}/${albumFolder}/`);
        stats.copied++;
        stats.albums.add(`${artistFolder}/${albumFolder}`);

        // Salvar cover
        if (metadata.cover_data) {
          await saveCover(metadata.cover_data, albumDir);
        }

        const externalCover = await findCoverInOriginalFolder(audioFile, coverFiles);
        if (externalCover) {
          const coverExt = extname(externalCover);
          const coverTarget = join(albumDir, `cover${coverExt}`);
          try {
            await copyFile(externalCover, coverTarget);
          } catch (error) {
            // Ignore se já existe
          }
        }
      } else {
        stats.skipped++;
      }

      stats.processed++;
      console.log();
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
      stats.errors++;
      console.log();
    }
  }

  // Relatório final
  console.log("=".repeat(70));
  console.log("📊 RELATÓRIO FINAL");
  console.log("=".repeat(70));
  console.log(`📀 Arquivos processados: ${stats.processed}`);
  console.log();
  console.log("📂 Origem:");
  console.log(`   💿 De álbuns: ${stats.fromAlbums}`);
  console.log(`   🎶 De playlists: ${stats.fromPlaylists}`);
  console.log();
  console.log("📊 Resultados:");
  console.log(`   ✅ Copiados: ${stats.copied}`);
  console.log(`   🔗 Mesclados em álbuns: ${stats.merged}`);
  console.log(`   🎵 Playlists → álbuns existentes: ${stats.playlistMergedToAlbum}`);
  console.log(`   🖼️  Playlists agrupadas por cover: ${stats.playlistGroupedByCover}`);
  console.log(`   ⚠️  Sem identificação (pastas numeradas): ${stats.unknown}`);
  console.log(`   ⏭️  Já existiam: ${stats.skipped}`);
  console.log(`   🚫 Ignorados (LIVE): ${stats.ignoredLive}`);
  console.log(`   ❌ Erros: ${stats.errors}`);
  console.log();
  console.log(`💿 Álbuns únicos criados: ${stats.albums.size}`);
  console.log();
  console.log(`📂 Pasta organizada: ${OUTPUT_DIR}`);
  console.log("=".repeat(70));
}

main().catch((error) => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});
