import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { AllFather } from "@plex-agents/allfather";

const execFileAsync = promisify(execFile);

// Nomes conhecidos de playlists que devem ser ignorados
const KNOWN_PLAYLISTS = ["ShroomTrip", "Viagem light", "Hotline Miami Soundtrack", "Balanço Groove Brasil 70's"];

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
    this.knownPlaylists = KNOWN_PLAYLISTS;
  }

  /**
   * Converte uma string para Title Case (formato padrão de CDs)
   * Exemplo: "the dark side of the moon" → "The Dark Side Of The Moon"
   */
  toTitleCase(str) {
    return str
      .toLowerCase()
      .split(/\s+/)
      .map((word) => {
        // Capitaliza primeira letra
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }

  /**
   * Normaliza nome de álbum para formato padrão de CDs
   * mantendo tags técnicas em colchetes e usando Title Case
   */
  normalizeAlbumName(albumName) {
    // Remove apenas informações de remaster redundantes, mantém o resto
    let cleaned = albumName
      // Remove "remastered" entre parênteses: "(remastered 2024)"
      .replace(/\s*\(remastered[^)]*\)/gi, "")
      // Remove palavra "remastered" solta
      .replace(/\s*remastered\s*/gi, " ")
      // Remove múltiplos espaços
      .replace(/\s+/g, " ")
      .trim();

    // Separa texto principal das tags em colchetes
    const tagMatches = cleaned.match(/(\[[^\]]+\])/g) || [];
    const mainText = cleaned.replace(/\s*\[[^\]]+\]/g, "").trim();

    // Converte texto principal para Title Case
    const normalizedMain = this.toTitleCase(mainText);

    // Reconstrói com tags no final
    const tags = tagMatches.length > 0 ? " " + tagMatches.join(" ") : "";

    return normalizedMain + tags;
  }

  /**
   * Verifica se dois nomes normalizados são equivalentes
   */
  areNamesEquivalent(name1, name2) {
    const normalized1 = this.normalizeAlbumName(name1);
    const normalized2 = this.normalizeAlbumName(name2);

    return normalized1.toLowerCase() === normalized2.toLowerCase();
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
          // Pula playlists conhecidas
          if (this.knownPlaylists.includes(entry.name)) {
            console.log(`⏭️  Pulando playlist conhecida: ${entry.name}`);
            continue;
          }

          const albumPath = path.join(artistPath, entry.name);

          // Verifica se já foi curado (arquivo .curated ou tag no nome)
          const isCurated = (await this.isAlreadyCurated(albumPath)) || entry.name.includes("[CURATED]");

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
   * Extrai nome limpo da faixa removendo numeração e extensão
   */
  extractCleanTrackName(filename) {
    // Remove extensão
    const nameWithoutExt = path.parse(filename).name;

    // Remove numeração no início: "01 -", "1.", "Track 01", etc.
    const cleanName = nameWithoutExt
      .replace(/^\d{1,3}\s*[-\.\s]+/, "") // Remove "01 - ", "1. ", "01. "
      .replace(/^Track\s*\d{1,3}\s*[-\.\s]*/i, "") // Remove "Track 01 - "
      .replace(/^\d{1,3}\s+/, "") // Remove "01 "
      .trim();

    return cleanName || nameWithoutExt; // Fallback para nome original se limpeza falhar
  }

  /**
   * Move e renomeia arquivos de música para o álbum consolidado
   */
  async moveAndRenameTrack(sourceTrackPath, targetAlbumPath, trackNumber, trackName) {
    try {
      const ext = path.extname(sourceTrackPath);
      const paddedNumber = trackNumber.toString().padStart(2, "0");

      // Extrai nome limpo da faixa (sem numeração existente)
      const cleanTrackName = this.extractCleanTrackName(trackName);
      const sanitizedName = this.sanitizeFilename(cleanTrackName);

      const newFileName = `${paddedNumber} - ${sanitizedName}${ext}`;
      const targetPath = path.join(targetAlbumPath, newFileName);

      // Move o arquivo (em vez de copiar) usando rename
      await fs.rename(sourceTrackPath, targetPath);
      console.log(`  📦 Movido: ${path.basename(sourceTrackPath)} → ${newFileName}`);

      return targetPath;
    } catch (error) {
      console.error(`❌ Erro ao mover faixa: ${error.message}`);
      throw error;
    }
  }

  /**
   * Normaliza a numeração das faixas de um álbum individual
   * Remove numerações bagunçadas como "102 - ", "Track 05 - " e aplicar numeração sequencial limpa
   */
  async normalizeAlbumTracks(album, dryRun = true) {
    console.log(`🔢 Normalizando numeração de: "${album.name}"`);

    if (dryRun) {
      console.log(`  🔍 Modo dry-run - simulação apenas`);

      // Simulação: mostra o que seria feito
      for (let i = 0; i < album.tracks.length; i++) {
        const track = album.tracks[i];
        const cleanTrackName = this.extractCleanTrackName(track.name);
        const newNumber = (i + 1).toString().padStart(2, "0");
        const newName = `${newNumber} - ${cleanTrackName}${path.extname(track.path)}`;

        console.log(`    ${path.basename(track.path)} → ${newName}`);
      }
      return { success: true, message: "Dry-run de normalização concluído", normalizedTracks: album.tracks.length };
    }

    try {
      const movedTracks = [];
      let trackNumber = 1;

      // Renomeia cada faixa com numeração sequencial limpa
      for (const track of album.tracks) {
        const ext = path.extname(track.path);
        const paddedNumber = trackNumber.toString().padStart(2, "0");

        // Extrai nome limpo da faixa (sem numeração existente)
        const cleanTrackName = this.extractCleanTrackName(track.name);
        const sanitizedName = this.sanitizeFilename(cleanTrackName);

        const newFileName = `${paddedNumber} - ${sanitizedName}${ext}`;
        const targetPath = path.join(album.path, newFileName);

        // Se o nome já está correto, pula
        if (path.basename(track.path) === newFileName) {
          console.log(`  ✅ Já correto: ${newFileName}`);
          trackNumber++;
          continue;
        }

        // Move/renomeia o arquivo
        await fs.rename(track.path, targetPath);
        console.log(`  📦 Renomeado: ${path.basename(track.path)} → ${newFileName}`);

        movedTracks.push(targetPath);
        trackNumber++;
      }

      console.log(`✅ Numeração normalizada: ${movedTracks.length} faixas renomeadas`);

      return {
        success: true,
        normalizedTracks: movedTracks.length,
        message: `${movedTracks.length} faixas renumeradas sequencialmente`,
      };
    } catch (error) {
      console.error(`❌ Erro na normalização: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Normaliza um álbum completo (nome via AllFather + tracks) sem consolidação
   * Verifica o nome correto do álbum via AllFather e normaliza as faixas
   */
  async normalizeCompleteAlbum(album, artistPath, options = {}) {
    const { dryRun = true, normalizeToTitleCase = true } = options;

    console.log(`🎵 Normalizando álbum completo: "${album.name}"`);

    if (dryRun) {
      console.log(`  🔍 Modo dry-run - simulação apenas`);

      // Simulação do nome via AllFather
      console.log(`  🧠 Verificaria nome correto via AllFather...`);

      // Simulação das tracks
      for (let i = 0; i < album.tracks.length; i++) {
        const track = album.tracks[i];
        const cleanTrackName = this.extractCleanTrackName(track.name);
        const newNumber = (i + 1).toString().padStart(2, "0");
        const newName = `${newNumber} - ${cleanTrackName}${path.extname(track.path)}`;

        console.log(`    ${path.basename(track.path)} → ${newName}`);
      }

      return {
        success: true,
        message: "Dry-run de normalização completa concluído",
        normalizedTracks: album.tracks.length,
        albumRenamed: false,
        correctAlbumName: album.name,
      };
    }

    try {
      // 1. Determina nome correto via AllFather com estratégia robusta
      console.log(`🧠 Verificando nome correto via AllFather...`);

      const coverUrl = album.coverPath ? `file://${album.coverPath}` : null;

      // Coleta todas as faixas para análise
      const allTracks = [];
      for (const track of album.tracks) {
        const cleanName = this.extractCleanTrackName(track.name);
        allTracks.push(cleanName);
      }

      let correctAlbumName = album.name;
      let metadata = null;
      let albumRenamed = false;

      // Estratégia robusta: tenta com cada faixa até encontrar metadados
      console.log(`🔍 Tentando descobrir álbum via ${allTracks.length} faixas...`);
      for (const trackName of allTracks) {
        try {
          const trackMetadata = await this.allfather.getMusicMetadata(trackName, album.artist, {
            coverImageUrl: coverUrl,
            includeGenre: true,
          });

          if (trackMetadata && trackMetadata.album) {
            correctAlbumName = trackMetadata.album;
            metadata = trackMetadata;
            console.log(`✅ Álbum descoberto via "${trackName}": "${correctAlbumName}"`);
            if (trackMetadata.year) {
              console.log(`📅 Ano: ${trackMetadata.year}`);
            }
            break;
          }
        } catch (error) {
          // Continua tentando com próxima faixa
          console.log(`⚠️  Falha na consulta de "${trackName}": ${error.message}`);
        }

        // Pequena pausa entre consultas
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Se encontrou um nome válido, processa-o
      if (correctAlbumName !== album.name && metadata && metadata.album) {
        correctAlbumName = normalizeToTitleCase ? this.normalizeAlbumName(metadata.album) : metadata.album;

        // Adiciona ano se disponível
        if (metadata.year && !correctAlbumName.includes(metadata.year)) {
          const yearMatch = correctAlbumName.match(/\(\d{4}\)/);
          if (!yearMatch) {
            // Insere ano antes das tags técnicas se existirem
            const tagMatch = correctAlbumName.match(/^(.+?)(\s*\[.+\].*)?$/);
            if (tagMatch) {
              correctAlbumName = `${tagMatch[1].trim()} (${metadata.year})${tagMatch[2] || ""}`;
            } else {
              correctAlbumName = `${correctAlbumName} (${metadata.year})`;
            }
          }
        }

        // Adiciona tag [CURATED] se normalização estiver ativa
        if (normalizeToTitleCase && !correctAlbumName.includes("[CURATED]")) {
          correctAlbumName = correctAlbumName + " [CURATED]";
        }

        console.log(`✅ Nome final determinado: "${correctAlbumName}"`);
      } else {
        // Fallback: aplica normalização no nome atual
        if (normalizeToTitleCase) {
          correctAlbumName = this.normalizeAlbumName(album.name);
          if (!correctAlbumName.includes("[CURATED]")) {
            correctAlbumName = correctAlbumName + " [CURATED]";
          }
        }
        console.log(`⚠️  AllFather não encontrou metadados após múltiplas tentativas. Usando nome normalizado: "${correctAlbumName}"`);
      }

      // 2. Renomeia pasta do álbum se necessário
      let finalAlbumPath = album.path;

      if (correctAlbumName !== album.name) {
        const sanitizedName = this.sanitizeFilename(correctAlbumName);
        const newAlbumPath = path.join(artistPath, sanitizedName);

        // Verifica se o novo nome já existe
        try {
          await fs.access(newAlbumPath);
          console.log(`⚠️  Pasta "${correctAlbumName}" já existe. Mantendo nome original.`);
        } catch {
          // Pasta não existe, pode renomear
          await fs.rename(album.path, newAlbumPath);
          console.log(`📂 Álbum renomeado: "${album.name}" → "${correctAlbumName}"`);
          finalAlbumPath = newAlbumPath;
          albumRenamed = true;
        }
      }

      // 3. Normaliza as faixas no álbum (possivelmente renomeado)
      const updatedAlbum = {
        ...album,
        name: correctAlbumName,
        path: finalAlbumPath,
        // Atualiza paths das tracks se a pasta foi renomeada
        tracks: albumRenamed
          ? album.tracks.map((track) => ({
              ...track,
              path: track.path.replace(album.path, finalAlbumPath),
            }))
          : album.tracks,
      };

      const trackResult = await this.normalizeAlbumTracks(updatedAlbum, false);

      if (!trackResult.success) {
        return {
          success: false,
          error: trackResult.error,
          albumRenamed: albumRenamed,
          correctAlbumName: correctAlbumName,
        };
      }

      // 4. Atualiza tags embutidas nos arquivos de áudio
      console.log(`🏷️  Atualizando tags de áudio...`);
      const tagResult = await this.updateAlbumTags(finalAlbumPath, correctAlbumName, album.artist);
      if (!tagResult.success) {
        console.warn(`  ⚠️  Algumas tags não puderam ser atualizadas (${tagResult.failed} falha(s))`);
      }

      console.log(`✅ Álbum completo normalizado: "${correctAlbumName}"`);

      return {
        success: true,
        message: `Álbum "${correctAlbumName}" normalizado com ${trackResult.normalizedTracks} faixas`,
        normalizedTracks: trackResult.normalizedTracks,
        albumRenamed: albumRenamed,
        correctAlbumName: correctAlbumName,
        metadata: metadata,
        finalAlbumPath: finalAlbumPath,
        tagsUpdated: tagResult.updated,
      };
    } catch (error) {
      console.error(`❌ Erro na normalização completa: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Reescreve as tags de metadados de um arquivo de áudio via ffmpeg sem re-encodar.
   * Funciona com FLAC, MP3, M4A, OGG, etc.
   *
   * @param {string} filePath  Caminho absoluto do arquivo
   * @param {Object} tags      Mapa chave→valor das tags a sobrescrever (ex: { ALBUM: 'Foo', TRACKNUMBER: '1' })
   * @returns {boolean}        true se sucesso, false se erro
   */
  async writeAudioTags(filePath, tags) {
    const ext = path.extname(filePath);
    // Escreve em /tmp para evitar erros de permissão em pastas owned by root
    const tmpPath = path.join(os.tmpdir(), `curator_tagtmp_${Date.now()}_${process.pid}${ext}`);

    try {
      const args = ["-i", filePath, "-c", "copy", "-map_metadata", "0", "-y"];

      for (const [key, value] of Object.entries(tags)) {
        if (value !== null && value !== undefined && value !== "") {
          args.push("-metadata", `${key}=${value}`);
        }
      }

      args.push(tmpPath);

      await execFileAsync("ffmpeg", args, { timeout: 60000 });
      // Copia sobre o original (funciona mesmo em diretórios owned by root)
      await fs.copyFile(tmpPath, filePath);
      await fs.unlink(tmpPath);

      console.log(`  🏷️  Tags gravadas: ${path.basename(filePath)}`);
      return true;
    } catch (error) {
      // Limpa arquivo temporário se existir
      try {
        await fs.unlink(tmpPath);
      } catch {}
      console.error(`  ⚠️  Erro ao gravar tags de ${path.basename(filePath)}: ${error.message}`);
      return false;
    }
  }

  /**
   * Atualiza as tags ALBUM, ALBUMARTIST, DATE e TRACKNUMBER de todos os arquivos
   * de música em uma pasta de álbum.
   *
   * A tag [CURATED] e demais tags técnicas em colchetes são removidas antes de
   * gravar, pois são apenas marcadores internos do curator.
   *
   * @param {string}  albumPath    Caminho da pasta do álbum
   * @param {string}  albumName    Nome do álbum (pode conter [CURATED] e ano)
   * @param {string}  artistName   Nome do artista (para ALBUMARTIST)
   * @param {Object}  opts
   * @param {boolean} opts.dryRun  Apenas simula, não altera arquivos
   */
  async updateAlbumTags(albumPath, albumName, artistName = null, { dryRun = false } = {}) {
    const musicFiles = await this.findMusicFiles(albumPath);
    musicFiles.sort((a, b) => a.name.localeCompare(b.name));

    if (musicFiles.length === 0) {
      console.log("  ⚠️  Nenhum arquivo de música encontrado para atualizar tags");
      return { success: true, updated: 0 };
    }

    // Extrai ano do nome antes de limpar (para usar na tag DATE)
    const yearMatch = albumName.match(/\((\d{4})\)/);
    const year = yearMatch ? yearMatch[1] : null;

    // Remove tudo entre [] e () — tags técnicas, ano, remaster, etc.
    const albumTitle = albumName
      .replace(/\s*\[[^\]]+\]/g, "") // remove [CURATED], [FLAC], [MP4], etc.
      .replace(/\s*\([^)]+\)/g, "") // remove (2020), (Remastered), (Deluxe), etc.
      .replace(/\s+/g, " ")
      .trim();

    console.log(`  🏷️  Atualizando tags de ${musicFiles.length} faixas em "${albumTitle}"...`);
    if (dryRun) {
      musicFiles.forEach((f, i) => {
        const num = String(i + 1);
        console.log(`    [dry-run] ${f.name} → ALBUM="${albumTitle}"` + (year ? `, DATE="${year}"` : "") + (artistName ? `, ALBUMARTIST="${artistName}"` : "") + `, TRACKNUMBER="${num}"`);
      });
      return { success: true, updated: musicFiles.length, dryRun: true };
    }

    let updated = 0;
    let failed = 0;

    for (let i = 0; i < musicFiles.length; i++) {
      const file = musicFiles[i];
      const tags = {
        ALBUM: albumTitle,
        TRACKNUMBER: String(i + 1),
      };
      if (artistName) tags.ALBUMARTIST = artistName;
      if (year) tags.DATE = year;

      const ok = await this.writeAudioTags(file.path, tags);
      if (ok) updated++;
      else failed++;
    }

    console.log(`  ✅ Tags: ${updated}/${musicFiles.length} atualizadas${failed > 0 ? `, ${failed} falha(s)` : ""}`);
    return { success: failed === 0, updated, failed };
  }

  /**
   * Sanitiza nome de arquivo removendo caracteres inválidos
   */
  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, "") // Remove caracteres inválidos
      .replace(/\s+/g, " ") // Normaliza espaços
      .trim()
      .substring(0, 200); // Limite de tamanho
  }

  /**
   * Cria pasta do álbum consolidado
   */
  async createConsolidatedAlbumFolder(artistPath, correctAlbumName) {
    const sanitizedName = this.sanitizeFilename(correctAlbumName);
    const albumPath = path.join(artistPath, sanitizedName);

    try {
      await fs.mkdir(albumPath, { recursive: true });
      console.log(`📁 Pasta criada: ${sanitizedName}`);
      return albumPath;
    } catch (error) {
      console.error(`❌ Erro ao criar pasta: ${error.message}`);
      throw error;
    }
  }

  /**
   * Copia arquivo de cover para o álbum consolidado
   */
  async copyCoverToConsolidatedAlbum(sourceCoverPath, targetAlbumPath) {
    if (!sourceCoverPath) return null;

    try {
      const ext = path.extname(sourceCoverPath);
      const targetCoverPath = path.join(targetAlbumPath, `cover${ext}`);

      await fs.copyFile(sourceCoverPath, targetCoverPath);
      console.log(`  🎨 Cover copiado: cover${ext}`);

      return targetCoverPath;
    } catch (error) {
      console.error(`❌ Erro ao copiar cover: ${error.message}`);
      return null;
    }
  }

  /**
   * Formata nome de álbum para nome de pasta
   */
  formatAlbumFolderName(albumName) {
    return this.sanitizeFilename(albumName);
  }

  /**
   * Remove pasta de álbum original após consolidação
   */
  async removeOriginalAlbumFolder(folderPath) {
    try {
      const entries = await fs.readdir(folderPath);
      const nonHiddenEntries = entries.filter((entry) => !entry.startsWith("."));

      if (nonHiddenEntries.length === 0) {
        // Pasta totalmente vazia
        await fs.rm(folderPath, { recursive: true });
        console.log(`  🗑️ Pasta vazia removida: ${path.basename(folderPath)}`);
      } else {
        // Verifica se sobrou apenas arquivos de cover/metadados
        const musicExtensions = [".flac", ".mp3", ".m4a", ".wav", ".ogg", ".opus"];
        const coverExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp"];
        const metadataFiles = [".curated", "album.nfo", "folder.txt", "desktop.ini", "thumbs.db"];

        const hasMusicFiles = nonHiddenEntries.some((entry) => {
          const ext = path.extname(entry).toLowerCase();
          return musicExtensions.includes(ext);
        });

        if (!hasMusicFiles) {
          // Só tem covers/metadados, pode remover tudo
          console.log(`  🧹 Removendo pasta original: ${path.basename(folderPath)} (só restaram covers/metadados)`);

          // Lista o que será removido
          for (const entry of nonHiddenEntries) {
            console.log(`    - Removendo: ${entry}`);
          }

          await fs.rm(folderPath, { recursive: true });
          console.log(`  ✅ Pasta original removida completamente`);
        } else {
          console.log(`  ⚠️ Pasta mantida: ${path.basename(folderPath)} (ainda contém ${nonHiddenEntries.length} arquivos de música)`);
        }
      }
    } catch (error) {
      console.error(`❌ Erro ao remover pasta: ${error.message}`);
    }
  }

  /**
   * Consolida fisicamente um grupo de álbuns
   */
  async consolidateAlbumGroup(artistPath, albumGroup, correctAlbumName, dryRun = true) {
    console.log(`🔄 Consolidando grupo: "${correctAlbumName}"`);

    // Separa álbuns curados e não curados
    const curatedAlbums = albumGroup.filter((a) => a.isCurated);
    const uncuratedAlbums = albumGroup.filter((a) => !a.isCurated);

    if (dryRun) {
      console.log(`  🔍 Modo dry-run - simulação apenas`);

      if (curatedAlbums.length > 0) {
        console.log(`  📌 Álbuns já curados no grupo: ${curatedAlbums.length}`);
        console.log(`  🔄 Álbuns a serem consolidados: ${uncuratedAlbums.length}`);
      }

      // Simulação: lista o que seria feito
      let trackNumber = 1;
      for (const album of albumGroup) {
        const curatedInfo = album.isCurated ? " [CURADO]" : "";
        console.log(`  📁 Do álbum: "${album.name}"${curatedInfo} (${album.tracks.length} faixas)`);
        for (const track of album.tracks) {
          console.log(`    ${trackNumber.toString().padStart(2, "0")} - ${track.name}`);
          trackNumber++;
        }
      }
      return { success: true, message: "Dry-run concluído" };
    }

    try {
      let consolidatedAlbumPath;
      let targetAlbum = null;

      // Se há álbum(s) curado(s) no grupo, usa o primeiro como destino
      if (curatedAlbums.length > 0) {
        targetAlbum = curatedAlbums[0];
        consolidatedAlbumPath = targetAlbum.path;

        console.log(`  📌 Usando álbum já curado como destino: "${targetAlbum.name}"`);

        // Se há múltiplos álbuns curados, isso é um problema - não deveria acontecer
        if (curatedAlbums.length > 1) {
          console.warn(`  ⚠️  Atenção: múltiplos álbuns curados detectados no mesmo grupo!`);
        }

        // Se o nome correto é diferente do álbum curado, renomeia a pasta
        const expectedName = this.formatAlbumFolderName(correctAlbumName);
        const currentName = path.basename(consolidatedAlbumPath);

        if (currentName !== expectedName) {
          console.log(`  📝 Renomeando álbum curado: "${currentName}" → "${expectedName}"`);
          const newPath = path.join(path.dirname(consolidatedAlbumPath), expectedName);
          await fs.rename(consolidatedAlbumPath, newPath);
          consolidatedAlbumPath = newPath;

          // Atualiza o caminho no objeto do álbum
          targetAlbum.path = consolidatedAlbumPath;
        }
      } else {
        // Comportamento normal: cria nova pasta consolidada
        consolidatedAlbumPath = await this.createConsolidatedAlbumFolder(artistPath, correctAlbumName);
      }

      // 2. Copia cover se necessário (só se não há álbum curado com cover)
      const needsCover = !targetAlbum || !targetAlbum.coverPath;
      if (needsCover) {
        const albumWithCover = albumGroup.find((a) => a.coverPath);
        if (albumWithCover) {
          await this.copyCoverToConsolidatedAlbum(albumWithCover.coverPath, consolidatedAlbumPath);
        }
      }

      // 3. Move e renomeia faixas apenas dos álbuns não curados
      const albumsToMove = uncuratedAlbums;

      if (albumsToMove.length === 0) {
        console.log(`  ✅ Nenhum álbum não curado para mover - grupo já consolidado`);
        return {
          success: true,
          consolidatedAlbumPath,
          movedTracks: [],
          message: `Grupo já consolidado em álbum curado`,
        };
      }

      // Determina número inicial da faixa
      let trackNumber = 1;
      if (targetAlbum) {
        // Se há álbum curado, começa após as faixas existentes
        trackNumber = targetAlbum.tracks.length + 1;
        console.log(`  📊 Iniciando numeração da faixa ${trackNumber} (após ${targetAlbum.tracks.length} faixas existentes)`);
      }

      const movedTracks = [];

      for (const album of albumsToMove) {
        console.log(`  📦 Processando álbum: "${album.name}"`);

        for (const track of album.tracks) {
          const newTrackPath = await this.moveAndRenameTrack(track.path, consolidatedAlbumPath, trackNumber, track.name);
          movedTracks.push(newTrackPath);
          trackNumber++;
        }
      }

      // 4. Remove pastas originais apenas dos álbuns não curados
      for (const album of albumsToMove) {
        // Só remove se não for a pasta consolidada
        if (album.path !== consolidatedAlbumPath) {
          await this.removeOriginalAlbumFolder(album.path);
        }
      }

      // 5. Atualiza tags embutidas nos arquivos de áudio do álbum consolidado
      const artistName = albumGroup[0]?.artist || null;
      console.log(`🏷️  Atualizando tags de áudio do álbum consolidado...`);
      const tagResult = await this.updateAlbumTags(consolidatedAlbumPath, correctAlbumName, artistName);
      if (!tagResult.success) {
        console.warn(`  ⚠️  Algumas tags não puderam ser atualizadas (${tagResult.failed} falha(s))`);
      }

      console.log(`✅ Consolidação concluída: ${movedTracks.length} faixas organizadas`);

      return {
        success: true,
        consolidatedAlbumPath,
        movedTracks,
        tagsUpdated: tagResult.updated,
        message: `${movedTracks.length} faixas consolidadas em "${correctAlbumName}"`,
      };
    } catch (error) {
      console.error(`❌ Erro na consolidação: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
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
   * Adiciona um nome à lista de playlists conhecidas
   */
  addKnownPlaylist(playlistName) {
    if (!this.knownPlaylists.includes(playlistName)) {
      this.knownPlaylists.push(playlistName);
      console.log(`✅ Playlist "${playlistName}" adicionada à lista de exclusão`);
    }
  }

  /**
   * Remove um nome da lista de playlists conhecidas
   */
  removeKnownPlaylist(playlistName) {
    const index = this.knownPlaylists.indexOf(playlistName);
    if (index !== -1) {
      this.knownPlaylists.splice(index, 1);
      console.log(`✅ Playlist "${playlistName}" removida da lista de exclusão`);
    }
  }

  /**
   * Lista todas as playlists conhecidas
   */
  listKnownPlaylists() {
    return [...this.knownPlaylists];
  }

  /**
   * Verifica se um nome é uma playlist conhecida
   */
  isKnownPlaylist(name) {
    return this.knownPlaylists.includes(name);
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
   * Determina o nome correto do álbum usando AllFather com múltiplas estratégias
   */
  async determineCorrectAlbumName(albumGroup, options = {}) {
    const { normalizeToTitleCase = true } = options;

    console.log(`🧠 Determinando nome correto para grupo de ${albumGroup.length} álbuns...`);

    try {
      // Pega o primeiro cover disponível
      const coverAlbum = albumGroup.find((a) => a.coverPath);
      const coverUrl = coverAlbum ? `file://${coverAlbum.coverPath}` : null;

      // Coleta todas as faixas do grupo para análise
      const allTracks = [];
      for (const album of albumGroup) {
        for (const track of album.tracks) {
          // Extrai nome limpo da faixa
          const cleanName = this.extractCleanTrackName(track.name);
          allTracks.push(cleanName);
        }
      }

      // Prepara os candidatos
      const candidates = albumGroup.map((album) => ({
        albumName: album.name,
        trackCount: album.trackCount,
        path: album.path,
        normalizedName: this.normalizeAlbumName(album.name),
      }));

      let correctAlbumName = null;
      let metadata = null;

      // ESTRATÉGIA 1: Tenta com cada faixa até encontrar metadados
      console.log(`🔍 Tentando descobrir álbum via ${allTracks.length} faixas...`);
      for (const trackName of allTracks) {
        try {
          const trackMetadata = await this.allfather.getMusicMetadata(trackName, albumGroup[0].artist, {
            coverImageUrl: coverUrl,
            includeGenre: true,
          });

          if (trackMetadata && trackMetadata.album) {
            correctAlbumName = trackMetadata.album;
            metadata = trackMetadata;
            console.log(`✅ Álbum descoberto via "${trackName}": "${correctAlbumName}"`);
            if (trackMetadata.year) {
              console.log(`📅 Ano: ${trackMetadata.year}`);
            }
            break;
          }
        } catch (error) {
          // Continua tentando com próxima faixa
          console.log(`⚠️  Falha na consulta de "${trackName}": ${error.message}`);
        }

        // Pequena pausa entre consultas
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // ESTRATÉGIA 2: Se ainda não encontrou, tenta busca pela primeira faixa mais popular
      if (!correctAlbumName && allTracks.length > 0) {
        console.log(`🔍 Tentando com busca mais específica...`);

        // Ordena tracks por popularidade (assumindo que nomes mais simples são mais populares)
        const sortedTracks = allTracks.sort((a, b) => a.length - b.length);

        try {
          const firstTrack = sortedTracks[0];
          const trackMetadata = await this.allfather.getMusicMetadata(firstTrack, albumGroup[0].artist, {
            includeGenre: true,
            includeLyrics: false,
          });

          if (trackMetadata && trackMetadata.album) {
            correctAlbumName = trackMetadata.album;
            metadata = trackMetadata;
            console.log(`✅ Álbum descoberto em segunda tentativa: "${correctAlbumName}"`);
          }
        } catch (error) {
          console.log(`⚠️  Segunda estratégia falhou: ${error.message}`);
        }
      }

      // Se encontrou um nome de álbum válido
      if (correctAlbumName) {
        let finalName = normalizeToTitleCase ? this.normalizeAlbumName(correctAlbumName) : correctAlbumName;

        // Adiciona ano se disponível
        if (metadata && metadata.year && !finalName.includes(metadata.year)) {
          const yearMatch = finalName.match(/\(\d{4}\)/);
          if (!yearMatch) {
            // Insere ano antes das tags técnicas se existirem
            const tagMatch = finalName.match(/^(.+?)(\s*\[.+\].*)?$/);
            if (tagMatch) {
              finalName = `${tagMatch[1].trim()} (${metadata.year})${tagMatch[2] || ""}`;
            } else {
              finalName = `${finalName} (${metadata.year})`;
            }
          }
        }

        // Adiciona tag de curadoria se normalização estiver ativa
        if (normalizeToTitleCase && !finalName.includes("[CURATED]")) {
          finalName = finalName + " [CURATED]";
        }

        console.log(`✅ Nome final determinado: "${finalName}"`);

        // Encontra o candidato mais similar ao resultado
        const bestMatch = this.findBestMatchingCandidate(finalName, candidates);

        return {
          correctName: finalName,
          originalName: correctAlbumName,
          metadata: metadata,
          bestMatchCandidate: bestMatch,
          allCandidates: candidates,
          discoveredViaTracks: allTracks.filter((_, i) => i === 0), // Primeira faixa que funcionou
        };
      }

      // FALLBACK: Escolhe o álbum com mais músicas
      console.log(`⚠️  AllFather não conseguiu determinar nome do álbum após múltiplas tentativas`);

      const largestAlbum = albumGroup.reduce((prev, current) => (current.trackCount > prev.trackCount ? current : prev));

      let correctName = normalizeToTitleCase ? this.normalizeAlbumName(largestAlbum.name) : largestAlbum.name;

      // Adiciona tag de curadoria se normalização estiver ativa
      if (normalizeToTitleCase && !correctName.includes("[CURATED]")) {
        correctName = correctName + " [CURATED]";
      }

      console.log(`📦 Usando fallback - álbum com mais faixas: "${correctName}"`);

      return {
        correctName: correctName,
        originalName: largestAlbum.name,
        metadata: null,
        bestMatchCandidate: { albumName: correctName, trackCount: largestAlbum.trackCount },
        allCandidates: candidates,
        fallbackUsed: true,
      };
    } catch (error) {
      console.error(`❌ Erro crítico ao determinar nome: ${error.message}`);

      // Fallback de emergência
      const largestAlbum = albumGroup.reduce((prev, current) => (current.trackCount > prev.trackCount ? current : prev));

      let correctName = normalizeToTitleCase ? this.normalizeAlbumName(largestAlbum.name) : largestAlbum.name;

      // Adiciona tag de curadoria se normalização estiver ativa
      if (normalizeToTitleCase && !correctName.includes("[CURATED]")) {
        correctName = correctName + " [CURATED]";
      }

      return {
        correctName: correctName,
        originalName: largestAlbum.name,
        metadata: null,
        bestMatchCandidate: { albumName: correctName, trackCount: largestAlbum.trackCount },
        allCandidates: candidates,
        error: error.message,
        emergencyFallback: true,
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

      // Mostra nome original se foi normalizado
      if (result.originalName && result.originalName !== result.correctName) {
        console.log(`   Nome original: ${result.originalName}`);
        console.log(`   🔄 Normalizado para Title Case: ${result.correctName}`);
      }

      console.log(`   Álbuns encontrados:`);

      for (const album of group) {
        const marker = album.name === result.bestMatchCandidate?.albumName ? "✓" : " ";
        const normalizedName = this.normalizeAlbumName(album.name);
        const normalizationInfo = normalizedName !== album.name ? ` → ${normalizedName}` : "";
        console.log(`   ${marker} - ${album.name}${normalizationInfo} (${album.trackCount} faixas)`);
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
    const {
      dryRun = true,
      skipCurated = true,
      similarityThreshold = 0.85,
      normalizeToTitleCase = true,
      normalizeAllTracks = false, // Nova opção para normalizar tracks mesmo sem consolidação
    } = options;

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
      const normalizedName = normalizeToTitleCase ? ` (→ ${this.normalizeAlbumName(album.name)})` : "";
      console.log(`   [${curatedMark}] ${album.name}${normalizedName} - ${album.trackCount} faixas`);
    }

    // Estratégia inteligente de curadoria:
    // Se há pelo menos 1 álbum não curado, processa TODOS os álbuns (curados e não curados)
    // pois pode haver consolidação entre álbuns curados e não curados
    const uncuratedAlbums = albums.filter((a) => !a.isCurated);
    const curatedAlbums = albums.filter((a) => a.isCurated);

    let albumsToProcess;
    let shouldProcessAll = false;

    if (uncuratedAlbums.length === 0) {
      // Todos os álbuns já estão curados
      console.log("\n✅ Todos os álbuns já foram curados!");
      return { groups: [], results: [] };
    } else if (uncuratedAlbums.length > 0 && curatedAlbums.length > 0) {
      // Há álbuns curados E não curados - precisa verificar TODOS para possíveis consolidações
      console.log(`\n🔍 Encontrados ${uncuratedAlbums.length} álbuns não curados e ${curatedAlbums.length} já curados`);
      console.log("📋 Processando TODOS os álbuns para detectar possíveis consolidações entre curados e não curados");
      albumsToProcess = albums; // Processa todos
      shouldProcessAll = true;
    } else {
      // Só há álbuns não curados - comportamento normal
      albumsToProcess = skipCurated ? albums.filter((a) => !a.isCurated) : albums;

      if (skipCurated && albumsToProcess.length < albums.length) {
        console.log(`\n⏭️  Pulando ${albums.length - albumsToProcess.length} álbuns já curados`);
      }
    }

    // Agrupa por similaridade de cover
    const groups = await this.groupAlbumsByCover(albumsToProcess, similarityThreshold);

    // Se não há duplicatas mas normalizeAllTracks está ativado, normaliza tracks individualmente
    if (groups.length === 0 && normalizeAllTracks) {
      console.log("\n🎵 Nenhuma duplicata encontrada, mas iniciando normalização completa (nome via AllFather + tracks)...");

      // Para normalização individual, só processa álbuns não curados
      const albumsForNormalization = shouldProcessAll ? uncuratedAlbums : albumsToProcess;
      const normalizationResults = [];

      for (let i = 0; i < albumsForNormalization.length; i++) {
        const album = albumsForNormalization[i];
        console.log(`\n--- Normalizando ${i + 1}/${albumsForNormalization.length} ---`);

        // Usa normalização completa (nome via AllFather + tracks)
        const result = await this.normalizeCompleteAlbum(album, artistPath, { dryRun, normalizeToTitleCase });
        normalizationResults.push({
          albumName: album.name,
          result: result,
          correctAlbumName: result.correctAlbumName || album.name,
        });

        // Se não for dry-run e a normalização foi bem-sucedida, marca como curado
        if (!dryRun && result.success) {
          await this.markAsCurated(result.finalAlbumPath || album.path, {
            correctAlbumName: result.correctAlbumName || album.name,
            originalAlbums: [album.name],
            normalizedOnly: true, // Indica que foi apenas normalização, não consolidação
            normalizationMetadata: result,
            allFatherMetadata: result.metadata, // Metadados do AllFather
            albumRenamed: result.albumRenamed, // Indica se o álbum foi renomeado
            consolidatedAt: new Date().toISOString(),
            tracksCount: album.tracks.length,
          });
        }
      }

      // Relatório de normalização
      const successfulNormalizations = normalizationResults.filter((nr) => nr.result.success);
      const failedNormalizations = normalizationResults.filter((nr) => !nr.result.success);

      console.log("\n" + "=".repeat(80));
      console.log("📊 RELATÓRIO DE NORMALIZAÇÃO COMPLETA");
      console.log("=".repeat(80));
      console.log(`✅ Normalizações bem-sucedidas: ${successfulNormalizations.length}`);
      console.log(`❌ Normalizações com erro: ${failedNormalizations.length}`);

      if (successfulNormalizations.length > 0) {
        console.log("\n🎯 Álbuns normalizados:");
        for (const nr of successfulNormalizations) {
          const albumRenamed = nr.result.albumRenamed ? " (renomeado)" : "";
          const metadataInfo = nr.result.metadata ? " [via AllFather]" : " [normalização básica]";
          console.log(`   ✅ "${nr.correctAlbumName}"${albumRenamed}${metadataInfo} - ${nr.result.normalizedTracks} faixas renumeradas`);
        }
      }

      if (failedNormalizations.length > 0) {
        console.log("\n💥 Falhas na normalização:");
        for (const nr of failedNormalizations) {
          console.log(`   ❌ "${nr.albumName}" - ${nr.result.error}`);
        }
      }

      return { groups: [], results: [], normalizationResults };
    }

    if (groups.length === 0) {
      console.log("\n✅ Nenhuma duplicata encontrada!");
      return { groups: [], results: [] };
    }

    console.log(`\n🔍 Processando ${groups.length} grupos de álbuns similares...`);

    // Determina o nome correto para cada grupo
    const results = [];

    for (let i = 0; i < groups.length; i++) {
      console.log(`\n--- Grupo ${i + 1}/${groups.length} ---`);
      const result = await this.determineCorrectAlbumName(groups[i], { normalizeToTitleCase });
      results.push(result);

      // Pequena pausa entre requisições
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Gera relatório
    this.generateConsolidationReport(groups, results);

    // Se não for dry-run, faz consolidação física
    if (!dryRun) {
      console.log("\n🔧 Iniciando consolidação física dos álbuns...");
      const consolidationResults = [];

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const result = results[i];

        console.log(`\n--- Consolidando Grupo ${i + 1}/${groups.length} ---`);

        // Consolida fisicamente o grupo de álbuns
        const consolidationResult = await this.consolidateAlbumGroup(
          artistPath,
          group,
          result.correctName,
          false, // Não é dry-run
        );

        consolidationResults.push({
          groupIndex: i,
          result: consolidationResult,
          correctName: result.correctName,
        });

        // Marca como curado se a consolidação foi bem-sucedida
        if (consolidationResult.success) {
          await this.markAsCurated(consolidationResult.consolidatedAlbumPath, {
            correctAlbumName: result.correctName,
            originalAlbums: group.map((a) => a.name),
            groupId: i,
            metadata: result.metadata,
            consolidatedAt: new Date().toISOString(),
            tracksCount: consolidationResult.movedTracks?.length || 0,
          });
        } else {
          console.error(`❌ Falha na consolidação do grupo ${i + 1}: ${consolidationResult.error}`);
        }
      }

      // Relatório final da consolidação
      console.log("\n" + "=".repeat(80));
      console.log("📊 RELATÓRIO DE CONSOLIDAÇÃO");
      console.log("=".repeat(80));

      const successfulConsolidations = consolidationResults.filter((cr) => cr.result.success);
      const failedConsolidations = consolidationResults.filter((cr) => !cr.result.success);

      console.log(`✅ Consolidações bem-sucedidas: ${successfulConsolidations.length}`);
      console.log(`❌ Consolidações com erro: ${failedConsolidations.length}`);

      if (successfulConsolidations.length > 0) {
        console.log("\n🎯 Álbuns consolidados:");
        for (const cr of successfulConsolidations) {
          console.log(`   ✅ "${cr.correctName}" - ${cr.result.movedTracks?.length || 0} faixas`);
        }
      }

      if (failedConsolidations.length > 0) {
        console.log("\n💥 Falhas na consolidação:");
        for (const cr of failedConsolidations) {
          console.log(`   ❌ "${cr.correctName}" - ${cr.result.error}`);
        }
      }

      return { groups, results, consolidationResults };
    } else {
      console.log("\n🔍 Modo dry-run ativo - nenhuma alteração foi salva");
    }

    return { groups, results };
  }
}
