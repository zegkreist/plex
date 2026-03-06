/**
 * Utilitários de manipulação de strings para nomes de mídia.
 */

/**
 * Remove caracteres inválidos em nomes de arquivo/pasta e normaliza espaços.
 */
export function sanitizeName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove tags de qualidade, anos e termos de edição de nomes de álbum.
 * Ex: "OK Computer (1997) [FLAC]" → "OK Computer"
 *     "In Utero (Deluxe Edition)"  → "In Utero"
 */
export function cleanAlbumName(name) {
  return (
    name
      // Remove blocos [...] com palavras de qualidade: [FLAC], [24bit Hi-Res Web], etc.
      .replace(/\s*\[[^\]]*(?:flac|mp3|aac|opus|lossless|hi[-.]?res|web|remaster|deluxe|24bit|vinyl)[^\]]*\].*$/i, "")
      // Remove blocos (...) com palavras de qualidade: (Deluxe Edition), (Remastered), etc.
      .replace(/\s*\([^)]*(?:flac|mp3|aac|opus|lossless|hi[-.]?res|web|remaster|deluxe|edition|24bit|vinyl)[^)]*\).*$/i, "")
      // Remove ano solto entre parênteses no final: (1997)
      .replace(/\s*\(\d{4}\)\s*$/, "")
      // Remove palavras de edição/remaster no final sem parênteses
      .replace(/\s*\(?(?:remastered?|deluxe\s+edition|expanded\s+edition|special\s+edition|anniversary\s+edition|bonus\s+tracks?)\)?$/i, "")
      // Remove número de 2-3 dígitos solto no final (artefato de bitrate)
      .replace(/\s*\d{2,3}\s*$/, "")
      .trim()
  );
}

/**
 * Normaliza string para comparação fuzzy.
 * Remove acentos, anos, "remaster", "deluxe", "live", caracteres especiais.
 * "OK Computer (Remastered)" → "okcomputer"
 */
export function normalizeForComparison(str) {
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
 * Similaridade simplificada entre duas strings (0 a 1).
 * Usa proporção de caracteres em comum vs o comprimento da string maior.
 */
export function calculateSimilarity(str1, str2) {
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
