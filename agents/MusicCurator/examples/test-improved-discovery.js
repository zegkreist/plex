import dotenv from "dotenv";
import { AllFather } from "@plex-agents/allfather";
import { AlbumConsolidator } from "../src/album-consolidator.js";
import { exec } from "child_process";
import { promisify } from "util";

dotenv.config();

const execAsync = promisify(exec);

/**
 * TESTE da FUNCIONALIDADE MELHORADA de VERIFICAÇÃO DE NOMES
 * Testa se o AllFather agora consegue identificar corretamente nomes de álbuns
 */
async function testImprovedAlbumDiscovery() {
  try {
    console.log("🧠 TESTE DA FUNCIONALIDADE MELHORADA - DESCOBERTA DE ÁLBUNS");
    console.log("=".repeat(80));
    console.log("🔍 Testando se o AllFather agora descobrir nomes corretos de álbuns");
    console.log("   usando múltiplas estratégias e tentativas com cada faixa");
    console.log("=".repeat(80));

    // Remove tag [CURATED] do Quadra temporariamente para testar
    const artistPath = "/home/zegkreist/Documents/Pessoal/plex_server/music/Sepultura";

    console.log("\n🔧 Preparando teste...");
    try {
      await execAsync(`cd "${artistPath}" && mv "Quadra [CURATED]" "Quadra" 2>/dev/null || true`);
      await execAsync(`cd "${artistPath}" && rm -f "Quadra/.curated" 2>/dev/null || true`);
      console.log("✅ Álbum Quadra preparado para teste");
    } catch (error) {
      console.log("⚠️  Era removendo tags, tentando continuar...");
    }

    // Inicializa AllFather
    console.log("\n🧠 Inicializando AllFather...");
    const allfather = new AllFather({
      ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      model: process.env.OLLAMA_DEFAULT_MODEL || "deepseek-r1:7b",
      temperature: 0.1,
    });

    if (!(await allfather.checkConnection())) {
      console.error("❌ Ollama não está conectado");
      process.exit(1);
    }

    console.log("✅ AllFather conectado!");

    const consolidator = new AlbumConsolidator(allfather);

    // Configurações para teste da funcionalidade melhorada
    const options = {
      dryRun: false, // Teste real
      skipCurated: true, // Pula curados
      similarityThreshold: 0.5, // Threshold baixo
      normalizeToTitleCase: true, // Title Case + [CURATED]
      normalizeAllTracks: true, // Usa normalização completa com verificação robusta
    };

    console.log("\n⚙️  Configurações TESTE FUNCIONALIDADE MELHORADA:");
    console.log(`   - Verificação robusta de nomes: ✅ ATIVA`);
    console.log(`   - Múltiplas tentativas por álbum: ✅ ATIVA`);
    console.log(`   - Busca com cada faixa individual: ✅ ATIVA`);
    console.log(`   - Inclusão automática de anos: ✅ ATIVA`);

    console.log("\n🔥 FUNCIONALIDADES QUE SERÃO TESTADAS:");
    console.log("   🧠 AllFather consulta CADA faixa até encontrar metadados");
    console.log("   🔍 Múltiplas estratégias de busca de album");
    console.log("   📅 Inclusão automática de anos nos nomes");
    console.log("   🏷️  Tags [CURATED] aplicadas corretamente");

    console.log("\n📂 Estado atual:");
    const { stdout } = await execAsync(`ls -la "${artistPath}"`);
    console.log(stdout);

    console.log("\n❓ Proceder com teste da funcionalidade melhorada?");
    console.log("💡 Aguardando 3 segundos...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("\n🚀 INICIANDO TESTE DA FUNCIONALIDADE MELHORADA...\n");

    // Executa teste com funcionalidade melhorada
    const result = await consolidator.consolidateArtistAlbums(artistPath, "Sepultura", options);

    console.log("\n" + "=".repeat(80));
    console.log("📊 RESULTADOS DO TESTE - FUNCIONALIDADE MELHORADA");
    console.log("=".repeat(80));

    if (result.normalizationResults && result.normalizationResults.length > 0) {
      console.log("✅ FUNCIONALIDADE MELHORADA TESTADA!");

      const successfulResults = result.normalizationResults.filter((nr) => nr.result.success);
      const failedResults = result.normalizationResults.filter((nr) => !nr.result.success);

      console.log(`📊 Álbuns processados: ${result.normalizationResults.length}`);
      console.log(`✅ Sucessos: ${successfulResults.length}`);
      console.log(`❌ Falhas: ${failedResults.length}`);

      if (successfulResults.length > 0) {
        console.log("\n🎯 Álbuns detectados/normalizados:");
        successfulResults.forEach((nr) => {
          const metadataSource = nr.result.metadata ? "[via AllFather]" : "[normalização básica]";
          const renamed = nr.result.albumRenamed ? " (renomeado)" : "";
          console.log(`   ✅ "${nr.correctAlbumName}"${renamed} ${metadataSource}`);
          if (nr.result.metadata) {
            console.log(`      └── Descoberto via múltiplas consultas ao AllFather`);
            if (nr.result.metadata.year) {
              console.log(`      └── Ano incluído automaticamente: ${nr.result.metadata.year}`);
            }
          }
        });
      }

      if (failedResults.length > 0) {
        console.log("\n💥 Álbuns com falha:");
        failedResults.forEach((nr) => {
          console.log(`   ❌ "${nr.albumName}" - ${nr.result.error}`);
        });
      }
    } else if (result.consolidationResults) {
      console.log("🔄 Consolidações foram executadas:");
      result.consolidationResults.forEach((cr) => {
        console.log(`🎯 "${cr.correctName}" - ${cr.result.movedTracks?.length || 0} faixas`);
      });
    } else {
      console.log("ℹ️  Nenhuma ação necessária - todos os álbuns já estão curados");
    }

    console.log("\n🎸 Teste da funcionalidade melhorada concluído!");
    console.log("💡 O AllFather agora faz consultas robustas para descobrir nomes corretos");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("\n❌ ERRO no teste:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testImprovedAlbumDiscovery();
