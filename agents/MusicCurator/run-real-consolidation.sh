#!/bin/bash

# Script para executar consolidação real do Wo Fat com correções de permissão
echo "🎵 MusicCurador - Consolidação Real Wo Fat"
echo "=================================================================================="
echo "⚠️  ATENÇÃO: CONSOLIDAÇÃO FÍSICA REAL!"
echo "⚠️  Este script vai:"
echo "   - Corrigir permissões dos arquivos"
echo "   - Mover e renomear arquivos de música"
echo "   - Consolidar álbuns duplicados fisicamente"
echo "   - Aplicar tag [CURATED] aos nomes"
echo "=================================================================================="

WO_FAT_PATH="/home/zegkreist/Documents/Pessoal/plex_server/music/Wo Fat"

# Verifica se o diretório existe
if [ ! -d "$WO_FAT_PATH" ]; then
    echo "❌ Erro: Diretório Wo Fat não encontrado: $WO_FAT_PATH"
    exit 1
fi

echo "📂 Verificando permissões..."
OWNER=$(stat -c '%U' "$WO_FAT_PATH")
echo "   Proprietário atual: $OWNER"

if [ "$OWNER" != "zegkreist" ]; then
    echo "🔧 Corrigindo permissões..."
    sudo chown -R zegkreist:zegkreist "$WO_FAT_PATH"
    echo "✅ Permissões corrigidas"
else
    echo "✅ Permissões já estão corretas"
fi

echo ""
echo "📊 Estado atual do diretório:"
ls -la "$WO_FAT_PATH" | head -5
echo "..."
echo ""

echo "❓ Tem certeza que deseja continuar com a consolidação física?"
echo "💡 Pressione ENTER para continuar ou Ctrl+C para cancelar..."
read -r

echo ""
echo "🚀 Executando consolidação física real..."
echo ""

# Executa o script Node.js com consolidação real
node << 'EOF'
import dotenv from "dotenv";
import { AllFather } from "@plex-agents/allfather";
import { AlbumConsolidator } from "./src/album-consolidator.js";

dotenv.config();

async function runRealConsolidation() {
  try {
    const artistPath = "/home/zegkreist/Documents/Pessoal/plex_server/music/Wo Fat";

    console.log("🧠 Inicializando AllFather...");
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
    console.log("🔧 Inicializando consolidador...");

    const consolidator = new AlbumConsolidator(allfather);

    // Configurações para consolidação REAL
    const options = {
      dryRun: false,              // ← CONSOLIDAÇÃO FÍSICA REAL!
      skipCurated: true,          // Pula álbuns já curados
      similarityThreshold: 0.95,  // Alto para segurança
      normalizeToTitleCase: true, // Aplica Title Case + tag [CURATED]
    };

    console.log("⚙️  Opções de CONSOLIDAÇÃO REAL:");
    console.log(`   - Consolidação física: ${!options.dryRun ? "ATIVADA" : "Desativada"}`);
    console.log(`   - Threshold similaridade: ${(options.similarityThreshold * 100)}%`);
    console.log(`   - Normalização Title Case: ${options.normalizeToTitleCase ? "SIM" : "NÃO"}`);

    console.log("\n🔥 INICIANDO CONSOLIDAÇÃO FÍSICA...");
    console.log("   - Arquivos serão MOVIDOS (não copiados)");
    console.log("   - Numeração será limpa e reaplicada");
    console.log("   - Tag [CURATED] será adicionada");

    const result = await consolidator.consolidateArtistAlbums(artistPath, "Wo Fat", options);

    // Relatório final
    console.log("\n" + "=".repeat(80));
    console.log("📊 RELATÓRIO FINAL DA CONSOLIDAÇÃO REAL");
    console.log("=".repeat(80));

    if (result.consolidationResults) {
      const successful = result.consolidationResults.filter(cr => cr.result.success).length;
      const failed = result.consolidationResults.filter(cr => !cr.result.success).length;
      const totalTracks = result.consolidationResults.reduce((sum, cr) => 
        sum + (cr.result.movedTracks?.length || 0), 0);

      console.log(`✅ Consolidações bem-sucedidas: ${successful}`);
      console.log(`❌ Consolidações com erro: ${failed}`);
      console.log(`🎵 Total de faixas reorganizadas: ${totalTracks}`);

      if (successful > 0) {
        console.log("\n🎯 Álbuns consolidados fisicamente:");
        for (const cr of result.consolidationResults.filter(cr => cr.result.success)) {
          console.log(`   ✅ "${cr.correctName}" - ${cr.result.movedTracks?.length || 0} faixas`);
        }
      }

      if (failed > 0) {
        console.log("\n💥 Consolidações com erro:");
        for (const cr of result.consolidationResults.filter(cr => !cr.result.success)) {
          console.log(`   ❌ "${cr.correctName}" - ${cr.result.error}`);
        }
      }
    } else {
      console.log("📀 Nenhum grupo de álbuns similares encontrado");
    }

    console.log("\n✅ CONSOLIDAÇÃO REAL CONCLUÍDA!");
    
  } catch (error) {
    console.error("\n❌ Erro na consolidação:", error.message);
    process.exit(1);
  }
}

runRealConsolidation();
EOF

echo ""
echo "📁 Estado final do diretório:"
ls -la "$WO_FAT_PATH" | grep -E "\[CURATED\]|^d"

echo ""
echo "✅ Script concluído!"
echo "💡 Verifique o diretório Wo Fat para confirmar os resultados"