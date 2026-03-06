import fs from "fs";
import path from "path";
import { parseFile } from "music-metadata";

/**
 * Garante que um diretório existe (cria recursivamente se necessário).
 */
export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Move um arquivo com fallback para copy+unlink em filesystems diferentes (EXDEV).
 * Cria o diretório destino automaticamente se não existir.
 */
export function moveFile(src, dest) {
  ensureDir(path.dirname(dest));
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
 * Remove diretório se estiver vazio (bottom-up recursivo).
 * Silencioso se não existir.
 */
export function removeIfEmpty(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) removeIfEmpty(full);
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

/**
 * Lê a cover art embutida no primeiro arquivo de áudio e salva como folder.jpg no álbum.
 * Silencioso se não houver cover ou ocorrer erro.
 */
export async function saveCoverArt(albumDir, audioFile) {
  const coverPath = path.join(albumDir, "folder.jpg");
  if (fs.existsSync(coverPath)) return;
  try {
    const metadata = await parseFile(audioFile, { skipCovers: false });
    const pictures = metadata.common.picture;
    if (!pictures || pictures.length === 0) return;
    ensureDir(albumDir);
    fs.writeFileSync(coverPath, pictures[0].data);
  } catch {
    // sem cover ou falha de leitura — ignorar silenciosamente
  }
}
