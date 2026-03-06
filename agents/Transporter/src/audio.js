import fs from "fs";
import path from "path";
import { cleanAlbumName } from "./strings.js";

/**
 * Extensões de arquivo de áudio suportadas (lowercase).
 */
export const AUDIO_EXTENSIONS = [".flac", ".mp3", ".m4a", ".ogg", ".opus", ".wav", ".aiff", ".wma", ".ape", ".alac"];

/**
 * Retorna true se o arquivo tem extensão de áudio suportada.
 */
export function isAudioFile(filePath) {
  return AUDIO_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

/**
 * Retorna true se o nome da pasta indica um disco (CD 1, Disc 2, Disk 1…).
 */
export function isDiscFolder(name) {
  return /^(cd|disc|disk)\s*\d/i.test(name);
}

/**
 * Retorna true se a pasta contém pelo menos um arquivo de áudio direto (não em subpastas).
 */
export function hasDirectAudio(dir) {
  return fs.readdirSync(dir).some((item) => {
    const full = path.join(dir, item);
    return !fs.statSync(full).isDirectory() && isAudioFile(full);
  });
}

/**
 * Retorna true se a pasta é uma release (contém áudio diretamente ou via subpastas de disco).
 * Retorna false se contém apenas subpastas não-disco → é uma pasta de artista.
 */
export function isReleaseFolder(dir) {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (!stat.isDirectory() && isAudioFile(full)) return true;
    if (stat.isDirectory() && isDiscFolder(item) && hasDirectAudio(full)) return true;
  }
  return false;
}

/**
 * Encontra todos os arquivos de áudio em um diretório (recursivo).
 */
export function findAudioFiles(dir, files = []) {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      findAudioFiles(full, files);
    } else if (isAudioFile(full)) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Parseia nome de pasta de álbum baixado para { artist, year, album }.
 *
 * Formatos suportados:
 *   "Artist - Year - Album"           ex: "Judas Priest - 2001 - Demolition"
 *   "Artist - Album (Year) [quality]" ex: "Radiohead - OK Computer (1997) [FLAC]"
 *   "Artist - Album"                  ex: "Pink Floyd - The Wall"
 *   "Album (Year)"                    ex: quando artista vem do diretório pai
 */
export function parseAlbumFolderName(folderName) {
  // Padrão: Artist - Year - Album
  let m = folderName.match(/^(.+?)\s+-\s+(\d{4})\s+-\s+(.+)$/);
  if (m) {
    return { artist: m[1].trim(), year: m[2], album: cleanAlbumName(m[3]) };
  }

  // Padrão: Artist - Album (Year…) [quality]
  m = folderName.match(/^(.+?)\s+-\s+(.+?)\s*[\[(](\d{4})[^\])]*/);
  if (m) {
    return { artist: m[1].trim(), year: m[3], album: cleanAlbumName(m[2]) };
  }

  // Padrão: Artist - Album (sem ano)
  m = folderName.match(/^(.+?)\s+-\s+(.+)$/);
  if (m) {
    return { artist: m[1].trim(), year: null, album: cleanAlbumName(m[2]) };
  }

  // Sem hífen: pode ser "Album (Year)" quando artista já é o dir pai
  m = folderName.match(/^(.+?)\s*[\[(](\d{4})[\])]/);
  if (m) {
    return { artist: "Unknown Artist", year: m[2], album: cleanAlbumName(m[1]) };
  }

  return { artist: "Unknown Artist", year: null, album: cleanAlbumName(folderName) };
}
