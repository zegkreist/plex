import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseFile } from "music-metadata";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

/**
 * PlexOrganizer - Organiza arquivos de mídia seguindo convenções do Plex
 *
 * Convenções Plex:
 * - Séries: /TV Shows/Show Name (Year)/Season 01/Show Name - s01e01 - Episode Title.ext
 * - Filmes: /Movies/Movie Name (Year)/Movie Name (Year).ext
 *
 * Referência: https://support.plex.tv/articles/naming-and-organizing-your-movie-media-files/
 */
class PlexOrganizer {
  constructor(config) {
    this.config = config;
    this.sourceMovies = path.resolve(config.downloads.movies);
    this.sourceSeries = path.resolve(config.downloads.series);
    this.sourceMusic = path.resolve(config.downloads.music);

    const plex = config.plex || {};
    this.destMovies = plex.movies || process.env.MOVIES_PATH || path.join(REPO_ROOT, "movies");
    this.destSeries = plex.series || process.env.SERIES_PATH || path.join(REPO_ROOT, "tv");
    this.destMusic = plex.music || process.env.MUSIC_PATH || path.join(REPO_ROOT, "music");

    // Extensões de vídeo suportadas
    this.videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg"];

    // Extensões de áudio suportadas
    this.audioExtensions = [".flac", ".mp3", ".m4a", ".ogg", ".opus", ".wav", ".aiff", ".wma", ".ape", ".alac"];
  }

  /**
   * Organiza todos os arquivos
   */
  async organize() {
    console.log("\n🎬 Plex Organizer - Iniciando organização de mídia\n");

    // Criar diretórios de destino se não existirem
    this.ensureDir(this.destMovies);
    this.ensureDir(this.destSeries);
    this.ensureDir(this.destMusic);

    // Organizar filmes
    console.log("\n📽️  Organizando filmes...\n");
    await this.organizeMovies();

    // Organizar séries
    console.log("\n📺 Organizando séries...\n");
    await this.organizeSeries();

    // Organizar música
    console.log("\n🎵 Organizando música...\n");
    await this.organizeMusic();

    console.log("\n✅ Organização concluída!\n");
  }

  /**
   * Organiza filmes seguindo convenção Plex
   */
  async organizeMovies() {
    if (!fs.existsSync(this.sourceMovies)) {
      console.log("⚠️  Pasta de filmes não encontrada:", this.sourceMovies);
      return;
    }

    const items = fs.readdirSync(this.sourceMovies);
    let processed = 0;

    for (const item of items) {
      const itemPath = path.join(this.sourceMovies, item);
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        // Se é uma pasta, procurar arquivos de vídeo dentro
        const videoFiles = this.findVideoFiles(itemPath);

        for (const videoFile of videoFiles) {
          const movieInfo = this.parseMovieName(path.basename(videoFile));
          if (movieInfo) {
            await this.organizeMovieFile(videoFile, movieInfo, itemPath);
            processed++;
          }
        }
      } else if (this.isVideoFile(itemPath)) {
        // Se é um arquivo de vídeo diretamente
        const movieInfo = this.parseMovieName(item);
        if (movieInfo) {
          await this.organizeMovieFile(itemPath, movieInfo);
          processed++;
        }
      }
    }

    console.log(`✅ ${processed} filme(s) organizados`);
  }

  /**
   * Organiza séries seguindo convenção Plex
   */
  async organizeSeries() {
    if (!fs.existsSync(this.sourceSeries)) {
      console.log("⚠️  Pasta de séries não encontrada:", this.sourceSeries);
      return;
    }

    const items = fs.readdirSync(this.sourceSeries);
    let processed = 0;

    for (const item of items) {
      const itemPath = path.join(this.sourceSeries, item);
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        // Procurar arquivos de vídeo dentro da pasta
        const videoFiles = this.findVideoFiles(itemPath);

        for (const videoFile of videoFiles) {
          const episodeInfo = this.parseEpisodeName(path.basename(videoFile));
          if (episodeInfo) {
            await this.organizeEpisodeFile(videoFile, episodeInfo, itemPath);
            processed++;
          }
        }
      } else if (this.isVideoFile(itemPath)) {
        const episodeInfo = this.parseEpisodeName(item);
        if (episodeInfo) {
          await this.organizeEpisodeFile(itemPath, episodeInfo);
          processed++;
        }
      }
    }

    console.log(`✅ ${processed} episódio(s) organizados`);
  }

  /**
   * Organiza um arquivo de filme
   */
  async organizeMovieFile(sourceFile, movieInfo, sourceDir = null) {
    const { name, year } = movieInfo;
    const ext = path.extname(sourceFile);

    // Formato Plex: /Movies/Movie Name (Year)/Movie Name (Year).ext
    const movieFolderName = year ? `${name} (${year})` : name;
    const movieFolder = path.join(this.destMovies, this.sanitizeName(movieFolderName));
    const movieFileName = `${this.sanitizeName(movieFolderName)}${ext}`;
    const destFile = path.join(movieFolder, movieFileName);

    // Criar pasta do filme
    this.ensureDir(movieFolder);

    // Mover arquivo
    if (fs.existsSync(destFile)) {
      console.log(`⏭️  Pulando (já existe): ${movieFolderName}`);
      return;
    }

    console.log(`📦 ${name}${year ? ` (${year})` : ""}`);
    console.log(`   ${sourceFile} → ${destFile}`);

    try {
      // Mover arquivo principal
      this.moveFile(sourceFile, destFile);

      // Mover arquivos extras (poster, nfo, etc.) se existirem
      if (sourceDir) {
        this.moveExtraFiles(sourceDir, movieFolder);
      }

      console.log(`✅ Filme organizado: ${movieFolderName}`);
    } catch (err) {
      console.error(`❌ Erro ao organizar filme: ${err.message}`);
    }
  }

  /**
   * Organiza um arquivo de episódio
   */
  async organizeEpisodeFile(sourceFile, episodeInfo, sourceDir = null) {
    const { showName, season, episode, year, episodeTitle } = episodeInfo;
    const ext = path.extname(sourceFile);

    // Formato Plex: /TV Shows/Show Name (Year)/Season 01/Show Name - s01e01 - Episode Title.ext
    const showFolderName = year ? `${showName} (${year})` : showName;
    const showFolder = path.join(this.destSeries, this.sanitizeName(showFolderName));
    const seasonFolder = path.join(showFolder, `Season ${String(season).padStart(2, "0")}`);

    let episodeFileName = `${this.sanitizeName(showName)} - s${String(season).padStart(2, "0")}e${String(episode).padStart(2, "0")}`;
    if (episodeTitle) {
      episodeFileName += ` - ${this.sanitizeName(episodeTitle)}`;
    }
    episodeFileName += ext;

    const destFile = path.join(seasonFolder, episodeFileName);

    // Criar pastas
    this.ensureDir(showFolder);
    this.ensureDir(seasonFolder);

    // Mover arquivo
    if (fs.existsSync(destFile)) {
      console.log(`⏭️  Pulando (já existe): ${showName} - S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`);
      return;
    }

    console.log(`📺 ${showName} - S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}${episodeTitle ? ` - ${episodeTitle}` : ""}`);
    console.log(`   ${sourceFile} → ${destFile}`);

    try {
      // Mover arquivo principal
      this.moveFile(sourceFile, destFile);

      // Mover poster da série se existir (apenas uma vez)
      if (sourceDir) {
        const posterSource = path.join(path.dirname(sourceDir), "poster.jpg");
        const posterDest = path.join(showFolder, "poster.jpg");
        if (fs.existsSync(posterSource) && !fs.existsSync(posterDest)) {
          this.moveFile(posterSource, posterDest);
        }

        const nfoSource = path.join(path.dirname(sourceDir), "tvshow.nfo");
        const nfoDest = path.join(showFolder, "tvshow.nfo");
        if (fs.existsSync(nfoSource) && !fs.existsSync(nfoDest)) {
          this.moveFile(nfoSource, nfoDest);
        }
      }

      console.log(`✅ Episódio organizado`);
    } catch (err) {
      console.error(`❌ Erro ao organizar episódio: ${err.message}`);
    }
  }

  /**
   * Organiza música seguindo convenção Plex:
   * Music/Artist/Album (Year)/tracks
   */
  async organizeMusic() {
    if (!fs.existsSync(this.sourceMusic)) {
      console.log("⚠️  Pasta de música não encontrada:", this.sourceMusic);
      return;
    }

    let processed = 0;
    const processedAlbums = new Map();

    for (const item of fs.readdirSync(this.sourceMusic)) {
      const itemPath = path.join(this.sourceMusic, item);
      if (!fs.statSync(itemPath).isDirectory()) continue;

      if (this.isReleaseFolder(itemPath)) {
        // Case A: musicas/Artist - Album/[CD/]tracks
        const info = this.parseAlbumFolderName(item);
        processed += await this.moveRelease(itemPath, info.artist, info.album, info.year, processedAlbums);
      } else {
        // Case B: musicas/Artist/Album/[CD/]tracks  — top-level is artist name
        const artist = item;
        for (const sub of fs.readdirSync(itemPath)) {
          const subPath = path.join(itemPath, sub);
          if (!fs.statSync(subPath).isDirectory()) continue;
          if (this.isReleaseFolder(subPath)) {
            const info = this.parseAlbumFolderName(sub);
            // If the subfolder itself encodes the artist, prefer that; otherwise use parent
            const resolvedArtist = info.artist !== "Unknown Artist" ? info.artist : artist;
            processed += await this.moveRelease(subPath, resolvedArtist, info.album, info.year, processedAlbums);
          }
        }
        this.removeIfEmpty(itemPath);
      }
    }

    console.log(`✅ ${processed} faixa(s) de música organizadas`);
  }

  /**
   * Move todas as faixas de uma pasta de release para o destino Plex.
   * Detecta gravações ao vivo, deduplica álbuns com nomes similares e salva cover art.
   * Retorna o número de faixas movidas.
   */
  async moveRelease(releaseDir, artist, album, year, processedAlbums = new Map()) {
    // Detectar gravação ao vivo pelo nome da pasta ou do álbum
    const isLive = this.isLiveRecording(path.basename(releaseDir)) || this.isLiveRecording(album);
    const albumBase = year ? `${album} (${year})` : album;
    // Adicionar sufixo (Live) apenas se não estiver já no nome
    const albumFolderName = isLive && !this.isLiveRecording(album) ? `${albumBase} (Live)` : albumBase;

    const artistDir = path.join(this.destMusic, this.sanitizeName(artist));

    // Deduplicação: reusar pasta existente com nome similar
    let albumDir = this.findExistingAlbumDir(artist, album, artistDir, processedAlbums);
    const isMerged = !!albumDir;

    if (!albumDir) {
      albumDir = path.join(artistDir, this.sanitizeName(albumFolderName));
    }

    this.ensureDir(artistDir);
    this.ensureDir(albumDir);

    if (isMerged) {
      console.log(`🔗 ${artist} — ${albumFolderName}  (mesclando com pasta existente)`);
    } else {
      console.log(`🎵 ${artist} — ${albumFolderName}${isLive ? "  🎤 LIVE" : ""}`);
      processedAlbums.set(`${this.sanitizeName(artist)}/${this.sanitizeName(albumFolderName)}`, {
        artist,
        albumName: album,
        albumFolderName,
        path: albumDir,
      });
    }

    const audioFiles = this.findAudioFiles(releaseDir);
    let count = 0;

    for (const audioFile of audioFiles) {
      const relPath = path.relative(releaseDir, audioFile);
      const parts = relPath.split(path.sep);

      // Preservar sub-pasta de disco se existir (CD 1, Disc 2…)
      let destDir = albumDir;
      if (parts.length > 1 && this.isDiscFolder(parts[0])) {
        destDir = path.join(albumDir, this.sanitizeName(parts[0]));
        this.ensureDir(destDir);
      }

      const destFile = path.join(destDir, path.basename(audioFile));
      if (fs.existsSync(destFile)) continue;

      try {
        this.moveFile(audioFile, destFile);
        console.log(`   ✓ ${path.basename(audioFile)}`);
        count++;
      } catch (err) {
        console.error(`   ✗ ${path.basename(audioFile)}: ${err.message}`);
      }
    }

    // Salvar cover art do primeiro arquivo de áudio encontrado
    if (audioFiles.length > 0) {
      await this.saveCoverArt(albumDir, audioFiles[0]);
    }

    this.removeIfEmpty(releaseDir);
    return count;
  }

  /**
   * Retorna true se a pasta contém áudio diretamente ou via subpastas de disco (CD/Disc).
   * Retorna false se contém apenas subpastas não-disco (→ é uma pasta de artista).
   */
  isReleaseFolder(dir) {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (!stat.isDirectory() && this.isAudioFile(full)) return true;
      if (stat.isDirectory() && this.isDiscFolder(item)) {
        if (this.hasDirectAudio(full)) return true;
      }
    }
    return false;
  }

  isDiscFolder(name) {
    return /^(cd|disc|disk)\s*\d/i.test(name);
  }

  isAudioFile(filePath) {
    return this.audioExtensions.includes(path.extname(filePath).toLowerCase());
  }

  hasDirectAudio(dir) {
    return fs.readdirSync(dir).some((item) => {
      const full = path.join(dir, item);
      return !fs.statSync(full).isDirectory() && this.isAudioFile(full);
    });
  }

  /**
   * Parseia nome da pasta de álbum baixada.
   * Suporta:
   *   "Artist - Year - Album"          ex: "Judas Priest - 2001 - Demolition"
   *   "Artist - Album (Year) [quality]" ex: "Radiohead - OK Computer (1997) [FLAC]"
   *   "Album (Year)"                    ex: quando artista vem do diretório pai
   *   "Artist - Album"
   */
  parseAlbumFolderName(folderName) {
    // Padrão: Artist - Year - Album
    let m = folderName.match(/^(.+?)\s+-\s+(\d{4})\s+-\s+(.+)$/);
    if (m) {
      return { artist: m[1].trim(), year: m[2], album: this.cleanAlbumName(m[3]) };
    }

    // Padrão: Artist - Album (Year…) [quality]
    m = folderName.match(/^(.+?)\s+-\s+(.+?)\s*[\[(](\d{4})[^\])]*/);
    if (m) {
      return { artist: m[1].trim(), year: m[3], album: this.cleanAlbumName(m[2]) };
    }

    // Padrão: Artist - Album (sem ano)
    m = folderName.match(/^(.+?)\s+-\s+(.+)$/);
    if (m) {
      return { artist: m[1].trim(), year: null, album: this.cleanAlbumName(m[2]) };
    }

    // Sem hífen: pode ser apenas "Album (Year)" quando artista já é o dir pai
    m = folderName.match(/^(.+?)\s*[\[(](\d{4})[\])]/);
    if (m) {
      return { artist: "Unknown Artist", year: m[2], album: this.cleanAlbumName(m[1]) };
    }

    return { artist: "Unknown Artist", year: null, album: this.cleanAlbumName(folderName) };
  }

  cleanAlbumName(name) {
    return name
      .replace(/\s*[\[(][^\])"]*(?:flac|mp3|aac|opus|lossless|hi-res|web|remaster|deluxe)[^\])*[\])].*$/i, "")
      .replace(/\s*\(?(?:remastered?|deluxe edition|expanded edition|special edition|anniversary edition|bonus tracks?)\)?$/i, "")
      .replace(/\s*\d{2,3}\s*$/, "")
      .trim();
  }

  /**
   * Detecta se um texto indica gravação ao vivo (live, ao vivo, etc.)
   */
  isLiveRecording(text) {
    if (!text) return false;
    const normalized = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return [/\blive\b/, /\(live\)/, /ao\s*vivo/, /ao[-_]vivo/].some((p) => p.test(normalized));
  }

  /**
   * Normaliza string para comparação fuzzy.
   * Remove acentos, anos, remaster, deluxe, live, etc.
   */
  normalizeForComparison(str) {
    let s = String(str).toLowerCase();
    s = s.replace(/\s*\(?re[-\s]?master(?:ed)?\)?/gi, "");
    s = s.replace(/\s*\(?\d{4}\)?/g, "");
    s = s.replace(/\s*\(?(?:live|ao[-\s]?vivo)\)?/gi, "");
    s = s.replace(/\s*\(?(?:deluxe|edition|expanded|special|anniversary|bonus|complete|reissue)\)?/gi, "");
    return s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  }

  /**
   * Similaridade simplificada (caracteres em comum / maior string). Retorna 0-1.
   */
  calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    return matches / longer.length;
  }

  /**
   * Procura pasta de álbum compatível já existente no destino (deduplicação).
   * Verifica álbuns da sessão atual + subpastas físicas do artistDir.
   */
  findExistingAlbumDir(artist, album, artistDir, processedAlbums) {
    const normalizedAlbum = this.normalizeForComparison(album);
    const normalizedArtist = this.normalizeForComparison(artist);

    // Álbuns processados nesta sessão
    for (const [, info] of processedAlbums) {
      if (this.normalizeForComparison(info.artist) !== normalizedArtist) continue;
      const sim = this.calculateSimilarity(normalizedAlbum, this.normalizeForComparison(info.albumName));
      if (sim >= 0.85) return info.path;
    }

    // Pastas físicas já existentes no destino
    if (!fs.existsSync(artistDir)) return null;
    for (const sub of fs.readdirSync(artistDir)) {
      const subPath = path.join(artistDir, sub);
      if (!fs.statSync(subPath).isDirectory()) continue;
      const sim = this.calculateSimilarity(normalizedAlbum, this.normalizeForComparison(sub));
      if (sim >= 0.85) return subPath;
    }

    return null;
  }

  /**
   * Lê cover art do primeiro arquivo de áudio e salva como folder.jpg no álbum.
   * Silencioso se não houver cover ou ocorrer erro.
   */
  async saveCoverArt(albumDir, audioFile) {
    const coverPath = path.join(albumDir, "folder.jpg");
    if (fs.existsSync(coverPath)) return;
    try {
      const metadata = await parseFile(audioFile, { skipCovers: false });
      const pictures = metadata.common.picture;
      if (!pictures || pictures.length === 0) return;
      fs.writeFileSync(coverPath, pictures[0].data);
      console.log(`   🖼️  Cover art salvo: folder.jpg`);
    } catch {
      // Sem cover ou falha de leitura — ignorar
    }
  }

  /**
   * Encontra todos os arquivos de áudio em um diretório (recursivo)
   */
  findAudioFiles(dir, files = []) {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        this.findAudioFiles(full, files);
      } else if (this.audioExtensions.includes(path.extname(full).toLowerCase())) {
        files.push(full);
      }
    }
    return files;
  }

  /**
   * Remove diretório se estiver vazio (recursivo bottom-up)
   */
  removeIfEmpty(dir) {
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) this.removeIfEmpty(full);
    }
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  }

  /**
   * Parseia nome de filme
   * Formatos suportados:
   * - Movie Name (2020)
   * - Movie.Name.2020.1080p
   * - Movie Name [2020]
   */
  parseMovieName(filename) {
    // Remover extensão
    let name = filename.replace(/\.[^.]+$/, "");

    // Padrão: Nome (Ano) ou Nome [Ano] ou Nome.Ano
    const yearMatch = name.match(/[\[\(]?(\d{4})[\]\)]?/);
    let year = null;

    if (yearMatch) {
      year = yearMatch[1];
      // Remover ano e tudo depois dele
      name = name.substring(0, yearMatch.index).trim();
    }

    // Remover tags de qualidade e grupo
    name = name.replace(/\b(1080p|720p|480p|2160p|4K|BluRay|WEB-DL|WEBRip|HDRip|x264|x265|HEVC|AAC|DTS|DD5\.1|YIFY|RARBG|GalaxyTV|TGx).*$/i, "");

    // Substituir pontos e underscores por espaços
    name = name.replace(/[\._]/g, " ");

    // Limpar espaços extras
    name = name.replace(/\s+/g, " ").trim();

    if (!name) return null;

    return { name, year };
  }

  /**
   * Parseia nome de episódio
   * Formatos suportados:
   * - Show.Name.S01E01
   * - Show Name - s01e01
   * - Show.Name.1x01
   */
  parseEpisodeName(filename) {
    // Remover extensão
    let name = filename.replace(/\.[^.]+$/, "");

    // Padrão S01E01 ou s01e01
    let match = name.match(/[Ss](\d{1,2})[Ee](\d{1,2})/);

    if (!match) {
      // Padrão 1x01
      match = name.match(/(\d{1,2})x(\d{1,2})/);
    }

    if (!match) return null;

    const season = parseInt(match[1]);
    const episode = parseInt(match[2]);

    // Extrair nome do show (tudo antes do padrão S01E01)
    let showName = name.substring(0, match.index).trim();

    // Tentar extrair ano
    const yearMatch = showName.match(/[\[\(]?(\d{4})[\]\)]?/);
    let year = null;

    if (yearMatch) {
      year = yearMatch[1];
      showName = showName.substring(0, yearMatch.index).trim();
    }

    // Extrair título do episódio (tudo depois do padrão S01E01)
    let episodeTitle = name.substring(match.index + match[0].length).trim();

    // Remover separadores comuns
    episodeTitle = episodeTitle.replace(/^[\s\-_\.]+/, "");

    // Remover tags de qualidade
    episodeTitle = episodeTitle.replace(/\b(1080p|720p|480p|WEB-DL|WEBRip|HDTV|x264|x265|HEVC).*$/i, "");

    // Limpar nome do show
    showName = showName.replace(/[\._]/g, " ").replace(/\s+/g, " ").trim();
    // Remover separadores no final
    showName = showName.replace(/[\s\-_\.]+$/, "").trim();
    episodeTitle = episodeTitle.replace(/[\._]/g, " ").replace(/\s+/g, " ").trim();

    if (!showName) return null;

    return {
      showName,
      season,
      episode,
      year,
      episodeTitle: episodeTitle || null,
    };
  }

  /**
   * Encontra todos os arquivos de vídeo em um diretório (recursivo)
   */
  findVideoFiles(dir, files = []) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        this.findVideoFiles(fullPath, files);
      } else if (this.isVideoFile(fullPath)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Verifica se um arquivo é de vídeo
   */
  isVideoFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.videoExtensions.includes(ext);
  }

  /**
   * Move um arquivo com fallback para copy+unlink em filesystems diferentes
   */
  moveFile(src, dest) {
    try {
      fs.renameSync(src, dest);
    } catch (err) {
      if (err.code === "EXDEV") {
        fs.copyFileSync(src, dest);
        fs.unlinkSync(src);
      } else {
        throw err;
      }
    }
  }

  /**
   * Move arquivos extras (poster, nfo, fanart)
   */
  moveExtraFiles(sourceDir, destDir) {
    const extraFiles = ["poster.jpg", "fanart.jpg", "movie.nfo", "tvshow.nfo"];

    for (const file of extraFiles) {
      const sourcePath = path.join(sourceDir, file);
      const destPath = path.join(destDir, file);

      if (fs.existsSync(sourcePath) && !fs.existsSync(destPath)) {
        try {
          this.moveFile(sourcePath, destPath);
        } catch (err) {
          // Ignorar erros de mover extras
        }
      }
    }
  }

  /**
   * Sanitiza nome de arquivo/pasta
   */
  sanitizeName(name) {
    return name
      .replace(/[<>:"/\\|?*]/g, "") // Remover caracteres inválidos
      .replace(/\s+/g, " ") // Normalizar espaços
      .trim();
  }

  /**
   * Garante que um diretório existe
   */
  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Criado diretório: ${dir}`);
    }
  }

  /**
   * Modo dry-run: retorna o plano de organização sem mover nada.
   * Cada item: { type, source, dest, label }
   */
  async dryRun() {
    const plan = [];

    // ── filmes ──────────────────────────────────────────────────────────────
    if (fs.existsSync(this.sourceMovies)) {
      for (const item of fs.readdirSync(this.sourceMovies)) {
        const itemPath = path.join(this.sourceMovies, item);
        if (!fs.statSync(itemPath).isDirectory()) continue;
        for (const videoFile of this.findVideoFiles(itemPath)) {
          const info = this.parseMovieName(path.basename(videoFile));
          if (!info) continue;
          const folderName = this.sanitizeName(info.name + (info.year ? ` (${info.year})` : ""));
          plan.push({
            type: "movie",
            label: `${info.name}${info.year ? ` (${info.year})` : ""}`,
            source: videoFile,
            dest: path.join(this.destMovies, folderName, path.basename(videoFile)),
          });
        }
      }
    }

    // ── séries ──────────────────────────────────────────────────────────────
    if (fs.existsSync(this.sourceSeries)) {
      for (const item of fs.readdirSync(this.sourceSeries)) {
        const itemPath = path.join(this.sourceSeries, item);
        if (!fs.statSync(itemPath).isDirectory()) continue;
        for (const videoFile of this.findVideoFiles(itemPath)) {
          const info = this.parseEpisodeName(path.basename(videoFile));
          if (!info) continue;
          const showFolder = this.sanitizeName(info.showName + (info.year ? ` (${info.year})` : ""));
          const seasonFolder = `Season ${String(info.season).padStart(2, "0")}`;
          let epFile = `${this.sanitizeName(info.showName)} - s${String(info.season).padStart(2, "0")}e${String(info.episode).padStart(2, "0")}`;
          if (info.episodeTitle) epFile += ` - ${this.sanitizeName(info.episodeTitle)}`;
          epFile += path.extname(videoFile);
          plan.push({
            type: "series",
            label: `${info.showName} S${String(info.season).padStart(2, "0")}E${String(info.episode).padStart(2, "0")}`,
            source: videoFile,
            dest: path.join(this.destSeries, showFolder, seasonFolder, epFile),
          });
        }
      }
    }

    // ── música ──────────────────────────────────────────────────────────────
    if (fs.existsSync(this.sourceMusic)) {
      for (const item of fs.readdirSync(this.sourceMusic)) {
        const itemPath = path.join(this.sourceMusic, item);
        if (!fs.statSync(itemPath).isDirectory()) continue;

        const releases = this.isReleaseFolder(itemPath)
          ? [{ dir: itemPath, info: this.parseAlbumFolderName(item) }]
          : fs
              .readdirSync(itemPath)
              .filter((sub) => {
                const sp = path.join(itemPath, sub);
                return fs.statSync(sp).isDirectory() && this.isReleaseFolder(sp);
              })
              .map((sub) => {
                const info = this.parseAlbumFolderName(sub);
                if (info.artist === "Unknown Artist") info.artist = item;
                return { dir: path.join(itemPath, sub), info };
              });

        for (const { dir: releaseDir, info } of releases) {
          const albumLabel = info.year ? `${info.album} (${info.year})` : info.album;
          const artistDir = path.join(this.destMusic, this.sanitizeName(info.artist));
          const albumDir = path.join(artistDir, this.sanitizeName(albumLabel));

          for (const audioFile of this.findAudioFiles(releaseDir)) {
            const relPath = path.relative(releaseDir, audioFile);
            const parts = relPath.split(path.sep);
            const discSub = parts.length > 1 && this.isDiscFolder(parts[0]) ? this.sanitizeName(parts[0]) : null;
            const destDir = discSub ? path.join(albumDir, discSub) : albumDir;
            plan.push({
              type: "music",
              label: `${info.artist} — ${albumLabel}`,
              source: audioFile,
              dest: path.join(destDir, path.basename(audioFile)),
            });
          }
        }
      }
    }

    // ── print ────────────────────────────────────────────────────────────────
    console.log("\n🔍 Modo DRY RUN - Nenhum arquivo será movido\n");
    console.log("=".repeat(60));

    const byType = { movie: [], series: [], music: [] };
    for (const item of plan) byType[item.type].push(item);

    if (byType.movie.length) {
      console.log("\n📽️  FILMES:\n");
      for (const p of byType.movie) {
        console.log(`  🎬 ${p.label}`);
        console.log(`     ${p.source}`);
        console.log(`     → ${p.dest}\n`);
      }
    }
    if (byType.series.length) {
      console.log("\n📺 SÉRIES:\n");
      for (const p of byType.series) {
        console.log(`  📺 ${p.label}`);
        console.log(`     ${p.source}`);
        console.log(`     → ${p.dest}\n`);
      }
    }
    if (byType.music.length) {
      const albums = [...new Set(byType.music.map((p) => p.label))];
      console.log("\n🎵 MÚSICA:\n");
      for (const album of albums) {
        const tracks = byType.music.filter((p) => p.label === album);
        console.log(`  🎵 ${album}  [${tracks.length} faixa(s)]`);
        console.log(`     → ${path.dirname(tracks[0].dest)}\n`);
      }
    }

    const total = plan.length;
    console.log("=".repeat(60));
    console.log(`\n  Total: ${total} arquivo(s) a mover`);
    console.log("💡 Execute sem --dry-run para processar os arquivos\n");

    return plan;
  }
}

// Função principal
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("-d");
  const yes = args.includes("--yes") || args.includes("-y");

  // Carregar config
  const configPath = path.join(__dirname, "../config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  const organizer = new PlexOrganizer(config);

  if (dryRun) {
    await organizer.dryRun();
    return;
  }

  // Sempre mostrar dry-run antes de executar de verdade
  await organizer.dryRun();

  if (!yes) {
    // Pedir confirmação interativa
    const { createInterface } = await import("readline");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => rl.question("\n▶  Confirmar e mover arquivos? [s/N] ", resolve));
    rl.close();
    if (!["s", "S", "y", "Y"].includes(answer.trim())) {
      console.log("Cancelado.");
      return;
    }
  }

  await organizer.organize();
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("❌ Erro:", err.message);
    process.exit(1);
  });
}

export default PlexOrganizer;
