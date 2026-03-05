import dotenv from "dotenv";
import { AllFather } from "@plex-agents/allfather";
import { AlbumConsolidator } from "../src/album-consolidator.js";

dotenv.config();

/**
 * Script para gerenciar lista de playlists conhecidas
 *
 * USO:
 * node examples/manage-playlists.js [comando] [nome]
 *
 * COMANDOS:
 * - list: Lista todas as playlists conhecidas
 * - add [nome]: Adiciona uma playlist à lista
 * - remove [nome]: Remove uma playlist da lista
 * - check [nome]: Verifica se um nome é uma playlist conhecida
 */
async function main() {
  try {
    const command = process.argv[2];
    const playlistName = process.argv.slice(3).join(" ");

    if (!command) {
      console.error("❌ Uso: node examples/manage-playlists.js [comando] [nome]");
      console.error("\nComandos disponíveis:");
      console.error("  list                  - Lista todas as playlists conhecidas");
      console.error("  add [nome]            - Adiciona uma playlist");
      console.error("  remove [nome]         - Remove uma playlist");
      console.error("  check [nome]          - Verifica se é uma playlist conhecida");
      console.error("\nExemplos:");
      console.error("  node examples/manage-playlists.js list");
      console.error('  node examples/manage-playlists.js add "My Favorite Songs"');
      console.error("  node examples/manage-playlists.js remove ShroomTrip");
      console.error('  node examples/manage-playlists.js check "Viagem light"');
      process.exit(1);
    }

    const allfather = new AllFather();
    const consolidator = new AlbumConsolidator(allfather);

    console.log("🎵 Gerenciador de Playlists Conhecidas");
    console.log("=".repeat(80));

    switch (command.toLowerCase()) {
      case "list":
        const playlists = consolidator.listKnownPlaylists();
        console.log(`\n📋 Playlists conhecidas (${playlists.length}):\n`);
        if (playlists.length === 0) {
          console.log("   (nenhuma)");
        } else {
          playlists.forEach((name, index) => {
            console.log(`   ${index + 1}. ${name}`);
          });
        }
        break;

      case "add":
        if (!playlistName) {
          console.error("❌ Especifique o nome da playlist");
          process.exit(1);
        }
        consolidator.addKnownPlaylist(playlistName);
        console.log(`\n✅ Playlist "${playlistName}" adicionada!`);
        console.log("\n⚠️  ATENÇÃO: Esta alteração só vale para esta sessão.");
        console.log("   Para tornar permanente, edite o arquivo:");
        console.log("   agents/MusicCurator/src/album-consolidator.js");
        console.log("   e adicione à constante KNOWN_PLAYLISTS");
        break;

      case "remove":
        if (!playlistName) {
          console.error("❌ Especifique o nome da playlist");
          process.exit(1);
        }
        consolidator.removeKnownPlaylist(playlistName);
        console.log(`\n✅ Playlist "${playlistName}" removida!`);
        break;

      case "check":
        if (!playlistName) {
          console.error("❌ Especifique o nome para verificar");
          process.exit(1);
        }
        const isPlaylist = consolidator.isKnownPlaylist(playlistName);
        if (isPlaylist) {
          console.log(`\n✅ "${playlistName}" é uma playlist conhecida`);
        } else {
          console.log(`\n❌ "${playlistName}" NÃO é uma playlist conhecida`);
        }
        break;

      default:
        console.error(`❌ Comando desconhecido: ${command}`);
        console.error("   Comandos válidos: list, add, remove, check");
        process.exit(1);
    }

    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("\n❌ Erro:", error.message);
    process.exit(1);
  }
}

main();
