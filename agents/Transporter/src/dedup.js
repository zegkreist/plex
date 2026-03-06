import fs from "fs";
import path from "path";
import { normalizeForComparison, calculateSimilarity } from "./strings.js";

/**
 * Procura pasta de álbum compatível já existente para deduplicação.
 *
 * Estratégia (em ordem de prioridade):
 *  1. Verifica `processedAlbums` da sessão atual (by normalized artist + fuzzy album name)
 *  2. Verifica subpastas físicas em `artistDir` (fuzzy name match ≥ 0.85)
 *
 * @param {string} artist - Nome do artista
 * @param {string} album  - Nome do álbum (pode conter tags de qualidade)
 * @param {string} artistDir - Caminho do diretório do artista no destino
 * @param {Map}    processedAlbums - Álbuns criados nesta sessão: key → { artist, albumName, path }
 * @returns {string|null} Caminho da pasta existente, ou null se não encontrado
 */
export function findExistingAlbumDir(artist, album, artistDir, processedAlbums) {
  const normalizedArtist = normalizeForComparison(artist);
  const normalizedAlbum = normalizeForComparison(album);

  // 1. Álbuns já processados nesta sessão
  for (const [, info] of processedAlbums) {
    if (normalizeForComparison(info.artist) !== normalizedArtist) continue;
    const sim = calculateSimilarity(normalizedAlbum, normalizeForComparison(info.albumName));
    if (sim >= 0.85) return info.path;
  }

  // 2. Pastas físicas no diretório do artista
  if (!fs.existsSync(artistDir)) return null;
  for (const sub of fs.readdirSync(artistDir)) {
    const subPath = path.join(artistDir, sub);
    if (!fs.statSync(subPath).isDirectory()) continue;
    const sim = calculateSimilarity(normalizedAlbum, normalizeForComparison(sub));
    if (sim >= 0.85) return subPath;
  }

  return null;
}
