import dotenv from "dotenv";
import { AllFather } from "@plex-agents/allfather";
import { AlbumConsolidator } from "../src/album-consolidator.js";
import { exec } from "child_process";
import { promisify } from "util";

dotenv.config();

const execAsync = promisify(exec);

/**
 * CONSOLIDAÇÃO REAL do Wo Fat com correção automática de permissões
 */
async function realWoFatConsolidation() {
  try {
    const artistPath = "/home/zegkreist/Documents/Pessoal/plex_server/music/Wo Fat";

    console.log("🎵 MusicCurador - CONSOLIDAÇÃO REAL WO FAT");
    console.log("=".repeat(80));
    console.log("⚠️  ATENÇÃO: CONSOLIDAÇÃO FÍSICA ATIVADA!");
    console.log("⚠️  Este script vai:");
    console.log("   - Corrigir permissões automaticamente");
    console.log("   - MOVER arquivos de música (sem duplicar)");
    console.log("   - Limpar numeração duplicada");
    console.log("   - Aplicar tag [CURATED] aos nomes");
    console.log("   - Remover pastas vazias");
    console.log("=".repeat(80));

    // Verifica e corrige permissões
    console.log("\n🔧 Verificando permissões...");
    try {
      const { stdout } = await execAsync(`stat -c '%U' "${artistPath}"`);
      const owner = stdout.trim();
      console.log(`   Proprietário atual: ${owner}`);

      if (owner !== "zegkreist") {
        console.log("🔧 Corrigindo permissões...");
        await execAsync(`sudo chown -R zegkreist:zegkreist "${artistPath}"`);
        console.log("✅ Permissões corrigidas");
      } else {
        console.log("✅ Permissões já estão corretas");
      }
    } catch (error) {
      console.log("⚠️  Erro verificando permissões, tentando continuar...");
    }

    // Inicializa AllFather
    console.log("\n🧠 Inicializando AllFather...");
    const allfather = new AllFather({
      ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      model: process.env.OLLAMA_DEFAULT_MODEL || "deepseek-r1:7b",
      temperature: 0.1,
    });

    // Verifica conexão
    if (!(await allfather.checkConnection())) {
      console.error("❌ Ollama não está conectado. Execute: ollama serve");
      process.exit(1);
    }

    console.log("✅ AllFather conectado!");

    // Verifica modelo de visão
    const hasVision = await allfather.hasModel("llama3.2-vision");
    if (hasVision) {
      console.log("✅ Modelo de visão disponível");
    } else {
      console.log("⚠️  Modelo de visão não encontrado, usando apenas hashing");
    }

    console.log("🔧 Inicializando consolidador...");
    const consolidator = new AlbumConsolidator(allfather);

    // Configurações REAIS
    const options = {
      dryRun: false, // ← CONSOLIDAÇÃO FÍSICA REAL!
      skipCurated: true, // Pula já curados
      similarityThreshold: 0.95, // Alto para segurança
      normalizeToTitleCase: true, // Title Case + [CURATED]
    };

    console.log("\n⚙️  Configurações REAIS:");
    console.log(`   - Consolidação física: ${!options.dryRun ? "✅ ATIVADA" : "❌ Desativada"}`);
    console.log(`   - Threshold similaridade: ${options.similarityThreshold * 100}%`);
    console.log(`   - Pular já curados: ${options.skipCurated ? "SIM" : "NÃO"}`);
    console.log(`   - Normalização Title Case: ${options.normalizeToTitleCase ? "SIM" : "NÃO"}`);

    console.log("\n🔥 MUDANÇAS QUE SERÃO APLICADAS:");
    console.log("   📦 Arquivos serão MOVIDOS (não copiados)");
    console.log("   🔢 Numeração limpa: '01 - Nome Limpo.flac'");
    console.log("   🏷️  Tag [CURATED] aplicada aos álbuns");
    console.log("   🗑️  Pastas vazias removidas");

    // Confirmação final
    console.log("\n❓ Confirma a consolidação física REAL?");
    console.log("💡 Aguardando 5 segundos... (Ctrl+C para cancelar)");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("\n🚀 INICIANDO CONSOLIDAÇÃO FÍSICA REAL...\n");

    // Executa consolidação REAL
    const result = await consolidator.consolidateArtistAlbums(artistPath, "Wo Fat", options);

    // Relatório detalhado
    console.log("\n" + "=".repeat(80));
    console.log("📊 RELATÓRIO FINAL - CONSOLIDAÇÃO REAL WO FAT");
    console.log("=".repeat(80));

    const groups = result.groups?.length || 0;
    const consolidations = result.consolidationResults?.length || 0;

    console.log(`📀 Grupos de álbuns similares encontrados: ${groups}`);
    console.log(`🔧 Consolidações executadas: ${consolidations}`);

    if (result.consolidationResults) {
      const successful = result.consolidationResults.filter((cr) => cr.result.success);
      const failed = result.consolidationResults.filter((cr) => !cr.result.success);
      const totalTracks = successful.reduce((sum, cr) => sum + (cr.result.movedTracks?.length || 0), 0);

      console.log(`✅ Consolidações bem-sucedidas: ${successful.length}`);
      console.log(`❌ Consolidações com erro: ${failed.length}`);
      console.log(`🎵 Total de faixas reorganizadas: ${totalTracks}`);

      if (successful.length > 0) {
        console.log("\n🎯 ÁLBUNS CONSOLIDADOS COM SUCESSO:");
        successful.forEach((cr) => {
          console.log(`   ✅ "${cr.correctName}"`);
          console.log(`      └── ${cr.result.movedTracks?.length || 0} faixas organizadas`);
        });
      }

      if (failed.length > 0) {
        console.log("\n💥 CONSOLIDAÇÕES COM ERRO:");
        failed.forEach((cr) => {
          console.log(`   ❌ "${cr.correctName}"`);
          console.log(`      └── Erro: ${cr.result.error}`);
        });
      }

      // Lista álbuns com tag CURATED
      try {
        const { stdout } = await execAsync(`ls -la "${artistPath}" | grep "\\[CURATED\\]"`);
        if (stdout.trim()) {
          console.log("\n🏷️  ÁLBUNS COM TAG [CURATED]:");
          stdout.split("\n").forEach((line) => {
            if (line.includes("[CURATED]")) {
              const name = line.split(" ").slice(8).join(" ");
              console.log(`   🎵 ${name}`);
            }
          });
        }
      } catch (e) {
        // Nenhum álbum curado encontrado ou erro no comando
      }
    } else {
      console.log("📀 Nenhuma consolidação foi necessária");
      console.log("💡 Todos os álbuns já estão organizados ou não há duplicatas");
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ CONSOLIDAÇÃO REAL CONCLUÍDA!");
    console.log("💡 Verifique o diretório Wo Fat para confirmar as mudanças");
    console.log(`📂 Caminho: ${artistPath}`);
    console.log("=".repeat(80));
  } catch (error) {
    console.error("\n❌ ERRO CRÍTICO na consolidação:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

realWoFatConsolidation();
