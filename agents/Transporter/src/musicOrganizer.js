/**
 * Transporter — Music Organizer
 *
 * Lê de uma ou mais pastas de origem (TideCaller ou Stormbringer),
 * detecta e normaliza a estrutura de pastas e move para a library do Plex.
 *
 * Formatos de origem suportados:
 *   A) (Artist - Album)/track             → release na raiz, artista embutido no nome
 *   B) (Artist - Year - Album)/track      → release na raiz com ano
 *   C) Artist/Album/track                 → artista como pasta pai
 *   D) Artist/Album/CD 1/track            → artista → álbum → disco → faixas
 *   E) Artist - Album (Year) [quality]/t  → formato streamrip/Tidal
 *
 * Destino padrão: plex_server/music/Artist/Album (Year)/tracks
 */

import fs from "fs";
import path from "path";
import {
  sanitizeName,
  isAudioFile,
  isDiscFolder,
  hasDirectAudio,
  isReleaseFolder,
  findAudioFiles,
  parseAlbumFolderName,
  moveFile,
  removeIfEmpty,
  saveCoverArt,
  findExistingAlbumDir,
  isLiveRecording,
  cleanAlbumName,
} from "./index.js";

export class MusicOrganizer {
  /**
   * @param {string}   destDir  - Pasta destino (ex: plex_server/music)
   * @param {object}   opts
   * @param {boolean}  opts.dryRun   - Apenas simula, não move nada
   * @param {boolean}  opts.verbose  - Log detalhado de cada faixa
   */
  constructor(destDir, { dryRun = false, verbose = false } = {}) {
    this.destDir = destDir;
    this.dryRun = dryRun;
    this.verbose = verbose;
    this.processedAlbums = new Map();
    this.stats = { moved: 0, skipped: 0, errors: 0, albums: 0 };
  }

  /**
   * Processa uma pasta de origem (pode ser TideCaller/downloads ou downloads/musicas).
   * @param {string} sourceDir
   * @param {string} [label]   - Nome da fonte para o log
   */
  async processSource(sourceDir, label = "") {
    if (!fs.existsSync(sourceDir)) {
      console.log(`⚠️  Pasta não encontrada: ${sourceDir}`);
      return;
    }

    const prefix = label ? `[${label}] ` : "";
    console.log(`\n📁 ${prefix}Escaneando ${sourceDir}...`);

    for (const item of fs.readdirSync(sourceDir)) {
      const itemPath = path.join(sourceDir, item);

      if (!fs.statSync(itemPath).isDirectory()) continue;

      if (isReleaseFolder(itemPath)) {
        // Caso A/B/E: a pasta raiz já é uma release
        const info = parseAlbumFolderName(item);
        await this._moveRelease(itemPath, info.artist, info.album, info.year, prefix);
      } else if (!this.dryRun) {
        // Pode ser: artista/álbum/... OU pasta residual (só imagens, sem áudio)
        this._cleanResidualFolder(itemPath, item, prefix);

        let hasRelease = false;
        for (const sub of fs.readdirSync(itemPath)) {
          const subPath = path.join(itemPath, sub);
          if (!fs.statSync(subPath).isDirectory()) continue;
          if (isReleaseFolder(subPath)) {
            hasRelease = true;
            const artist = item;
            const info = parseAlbumFolderName(sub);
            const resolvedArtist = info.artist !== "Unknown Artist" ? info.artist : artist;
            await this._moveRelease(subPath, resolvedArtist, info.album, info.year, prefix);
          }
        }
        if (!this.dryRun) removeIfEmpty(itemPath);

        // Pasta residual (só tem cover.jpg, sem áudio): mover cover e apagar pasta
        if (!this.dryRun && !hasRelease && fs.existsSync(itemPath)) {
          this._cleanResidualFolder(itemPath, item, prefix);
        }
      }
    }
  }

  /**
   * Move todas as faixas de uma release para o destino Plex.
   * @private
   */
  async _moveRelease(releaseDir, artist, album, year, logPrefix = "") {
    const live = isLiveRecording(path.basename(releaseDir)) || isLiveRecording(album);
    const albumLabel = year ? `${album} (${year})` : album;
    const albumFolderName = live && !isLiveRecording(album) ? `${albumLabel} (Live)` : albumLabel;
    const cleanArtist = sanitizeName(artist);
    const artistDir = path.join(this.destDir, cleanArtist);

    // Deduplicação: reusar pasta existente com nome similar
    let albumDir = findExistingAlbumDir(artist, album, artistDir, this.processedAlbums);
    const isMerge = !!albumDir;

    if (!albumDir) {
      albumDir = path.join(artistDir, sanitizeName(albumFolderName));
      this.processedAlbums.set(`${cleanArtist}/${sanitizeName(albumFolderName)}`, {
        artist,
        albumName: album,
        albumFolderName,
        path: albumDir,
      });
      this.stats.albums++;
    }

    const icon = live ? "🎤" : "🎵";
    const mergeNote = isMerge ? "  (mesclando)" : "";
    console.log(`${logPrefix}${icon} ${artist} — ${albumFolderName}${mergeNote}`);

    const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
    const audioFiles = findAudioFiles(releaseDir);
    let count = 0;

    for (const audioFile of audioFiles) {
      const relPath = path.relative(releaseDir, audioFile);
      const parts = relPath.split(path.sep);

      // Preservar sub-pasta de disco (CD 1, Disc 2…)
      let destDir = albumDir;
      if (parts.length > 1 && isDiscFolder(parts[0])) {
        destDir = path.join(albumDir, sanitizeName(parts[0]));
      }

      const destFile = path.join(destDir, path.basename(audioFile));

      if (fs.existsSync(destFile)) {
        if (this.verbose) console.log(`   ⏭️  ${path.basename(audioFile)}`);
        this.stats.skipped++;
        continue;
      }

      if (this.dryRun) {
        console.log(`   → ${destFile}`);
        count++;
        this.stats.moved++;
        continue;
      }

      try {
        moveFile(audioFile, destFile);
        if (this.verbose) console.log(`   ✓ ${path.basename(audioFile)}`);
        count++;
        this.stats.moved++;
      } catch (err) {
        console.error(`   ✗ ${path.basename(audioFile)}: ${err.message}`);
        this.stats.errors++;
      }
    }

    if (!this.dryRun) {
      // Mover imagens de capa existentes na pasta de origem
      this._moveImages(releaseDir, albumDir, IMAGE_EXTENSIONS);

      // Se não havia imagem, extrair cover art embutida no áudio
      if (audioFiles.length > 0) {
        await saveCoverArt(albumDir, audioFiles[0]);
      }

      // Remover pasta de origem (agora vazia)
      removeIfEmpty(releaseDir);
    }

    if (count > 0) {
      console.log(`   ✅ ${count} faixa(s) ${this.dryRun ? "a mover" : "movidas"}`);
    }

    return count;
  }

  /**
   * Trata pasta residual de release (áudio já movido, só reste cover/imagens).
   * Move o cover para o destino correto e apaga a pasta.
   * @private
   */
  _cleanResidualFolder(folderPath, folderName, logPrefix = "") {
    const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
    const files = fs.readdirSync(folderPath);
    const hasOnlyImages = files.length > 0 && files.every((f) => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()));

    if (!hasOnlyImages) return; // Tem outros arquivos, não mexer

    const info = parseAlbumFolderName(folderName);
    const albumLabel = info.year ? `${info.album} (${info.year})` : info.album;
    const artistDir = path.join(this.destDir, sanitizeName(info.artist !== "Unknown Artist" ? info.artist : folderName));
    const albumDir = findExistingAlbumDir(info.artist, info.album, artistDir, this.processedAlbums) ||
                     path.join(artistDir, sanitizeName(albumLabel));

    if (fs.existsSync(albumDir)) {
      this._moveImages(folderPath, albumDir, IMAGE_EXTENSIONS);
      console.log(`${logPrefix}🧹 ${folderName}  (pasta residual limpa)`);
    }

    removeIfEmpty(folderPath);
  }

  /**
   * Move imagens de capa da pasta de origem para o destino.
   * Prioriza: folder.jpg > cover.jpg > front.jpg > qualquer imagem encontrada.
   * Não sobrescreve se já existir.
   * @private
   */
  _moveImages(sourceDir, destDir, extensions) {
    const PRIORITY = ["folder.jpg", "folder.jpeg", "folder.png", "cover.jpg", "cover.jpeg", "cover.png", "front.jpg", "front.jpeg", "front.png"];
    const files = fs.readdirSync(sourceDir).filter((f) => extensions.includes(path.extname(f).toLowerCase()));
    if (files.length === 0) return;

    // Escolher a imagem com maior prioridade; fallback para a primeira encontrada
    const chosen = PRIORITY.find((p) => files.includes(p)) || files[0];
    const src = path.join(sourceDir, chosen);
    const dest = path.join(destDir, "folder.jpg");

    if (fs.existsSync(dest)) return;
    try {
      moveFile(src, dest);
      if (this.verbose) console.log(`   🖼️  cover → folder.jpg`);
    } catch (err) {
      console.error(`   ✗ cover: ${err.message}`);
    }
  }

  printStats() {
    console.log(`\n📊 Resumo:`);
    console.log(`   💿 Álbuns: ${this.stats.albums}`);
    console.log(`   ✅ Faixas movidas: ${this.stats.moved}`);
    console.log(`   ⏭️  Já existiam: ${this.stats.skipped}`);
    if (this.stats.errors > 0) {
      console.log(`   ❌ Erros: ${this.stats.errors}`);
    }
  }
}
