/**
 * Detecção de gravações ao vivo.
 */

const LIVE_PATTERNS = [
  /\blive\b/,      // "live" como palavra completa
  /\(live\)/,      // "(live)"
  /ao\s*vivo/,     // "ao vivo", "aovivo"
  /ao[-_]vivo/,    // "ao-vivo", "ao_vivo"
];

/**
 * Retorna true se o texto indica uma gravação ao vivo.
 * Suporta inglês ("live") e português ("ao vivo").
 * Insensível a maiúsculas/minúsculas e acentos.
 */
export function isLiveRecording(text) {
  if (!text) return false;
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos
  return LIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}
