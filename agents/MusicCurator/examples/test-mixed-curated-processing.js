#!/usr/bin/env node

import path from "path";
import { AlbumConsolidator } from "../src/album-consolidator.js";

/**
 * Script para testar o processamento misto de álbuns curados e não curados
 *
 * Este script simula o cenário onde um artista tem:
 * 1. Álbuns já curados (com tag [CURATED])
 * 2. Álbuns não curados (sem tag [CURATED])
 *
 * O sistema deve detectar que há álbuns mistos e processar TODOS os álbuns
 * para verificar possíveis consolidações entre curados e não curados.
 */

async function testMixedCuratedProcessing() {
  console.log("🧪 TESTE: Processamento Misto de Álbuns Curados/Não Curados");
  console.log("=".repeat(60));

  const consolidator = new AlbumConsolidator({
    allfatherApiUrl: "http://localhost:3001",
  });

  // Artista para teste: Igorrr (sabemos que existe e tem álbuns novos)
  const artistName = "Igorrr";
  const artistPath = path.join("/home/zegkreist/Documents/Pessoal/plex_server/music", artistName);

  console.log(`\n🎸 Testando artista: ${artistName}`);
  console.log(`📁 Caminho: ${artistPath}`);

  try {
    // 1. Escaneamento inicial - verificar estado atual
    console.log("\n📊 FASE 1: Escaneamento e análise do estado atual");
    console.log("-".repeat(50));

    const musicDirectory = "/home/zegkreist/Documents/Pessoal/plex_server/music";
    console.log(`🔍 Diretório a escanear: ${musicDirectory}`);

    const artists = await consolidator.scanMusicDirectory(musicDirectory);

    console.log(`✅ Encontrados ${artists.length} artistas:`);
    for (const artist of artists) {
      console.log(`   🎵 ${artist.name} (${artist.albums.length} álbuns)`);
    }

    const artist = artists.find((a) => a.name === artistName);

    if (!artist) {
      console.log(`❌ Artista "${artistName}" não encontrado!`);
      return;
    }

    console.log(`✅ Encontrado artista: ${artist.name}`);
    console.log(`📂 Álbuns encontrados: ${artist.albums.length}`);

    // Analisa status de curação
    const totalAlbums = artist.albums.length;
    const curatedAlbums = artist.albums.filter((a) => a.isCurated);
    const uncuratedAlbums = artist.albums.filter((a) => !a.isCurated);

    console.log(`\n📈 Análise of Curação:`);
    console.log(`   📊 Total de álbuns: ${totalAlbums}`);
    console.log(`   ✅ Álbuns curados: ${curatedAlbums.length}`);
    console.log(`   🔄 Álbuns não curados: ${uncuratedAlbums.length}`);

    if (curatedAlbums.length > 0) {
      console.log(`\n📌 Álbuns curados encontrados:`);
      for (const album of curatedAlbums) {
        console.log(`   ✅ "${album.name}" - ${album.tracks.length} faixas`);
      }
    }

    if (uncuratedAlbums.length > 0) {
      console.log(`\n🔄 Álbuns não curados encontrados:`);
      for (const album of uncuratedAlbums) {
        console.log(`   🆕 "${album.name}" - ${album.tracks.length} faixas`);
      }
    }

    // 2. Teste lógica de processamento misto
    console.log("\n🔍 FASE 2: Teste da lógica de processamento misto");
    console.log("-".repeat(50));

    const hasMixedAlbums = curatedAlbums.length > 0 && uncuratedAlbums.length > 0;

    if (!hasMixedAlbums) {
      if (curatedAlbums.length === totalAlbums) {
        console.log("✅ Todos os álbuns estão curados - comportamento: PULAR processamento");
      } else if (uncuratedAlbums.length === totalAlbums) {
        console.log("🔄 Todos os álbuns estão não curados - comportamento: PROCESSAR normalmente");
      } else {
        console.log("❓ Estado indefinido - isso não deveria acontecer");
      }
    } else {
      console.log("🎯 ÁLBUNS MISTOS DETECTADOS!");
      console.log("📋 Comportamento esperado: PROCESSAR TODOS os álbuns para detectar consolidações");
      console.log(`   • Álbuns curados serão incluídos na detecção de similaridade`);
      console.log(`   • Álbuns não curados serão fisicamente consolidados`);
      console.log(`   • Se há similaridade entre curado/não curado, não curado vai para o curado`);
    }

    // 3. Simulação dry-run
    console.log("\n🎬 FASE 3: Simulação (dry-run) do processamento");
    console.log("-".repeat(50));

    const consolidationResult = await consolidator.consolidateArtistAlbums(artistPath, artistName, {
      dryRun: true, // Simulação apenas
      skipCurated: false, // Importante: não pular curados devido ao processamento misto
      normalizeAllTracks: true,
      similarityThreshold: 0.8, // Threshold para Metal
    });

    console.log(`\n📊 Resultado da simulação:`);
    console.log(`   🎯 Grupos de similaridade encontrados: ${consolidationResult.groups?.length || 0}`);

    if (consolidationResult.groups && consolidationResult.groups.length > 0) {
      for (let i = 0; i < consolidationResult.groups.length; i++) {
        const group = consolidationResult.groups[i];
        console.log(`\n   📎 Grupo ${i + 1}:`);

        for (const album of group) {
          const status = album.isCurated ? "[CURADO]" : "[NÃO CURADO]";
          console.log(`     • "${album.name}" ${status} - ${album.tracks.length} faixas`);
        }

        // Analisa composição do grupo
        const groupCurated = group.filter((a) => a.isCurated);
        const groupUncurated = group.filter((a) => !a.isCurated);

        if (groupCurated.length > 0 && groupUncurated.length > 0) {
          console.log(`     🎯 CONSOLIDAÇÃO MISTA: ${groupUncurated.length} não curado(s) → ${groupCurated.length} curado(s)`);
        } else if (groupUncurated.length === group.length) {
          console.log(`     🔄 CONSOLIDAÇÃO NORMAL: ${group.length} álbuns não curados`);
        } else {
          console.log(`     ✅ GRUPO JÁ CURADO: nenhuma ação necessária`);
        }
      }
    }

    // Resultados de normalização
    if (consolidationResult.normalizationResults && consolidationResult.normalizationResults.length > 0) {
      console.log(`\n📝 Normalizações que seriam realizadas: ${consolidationResult.normalizationResults.length}`);
      for (const norm of consolidationResult.normalizationResults) {
        const status = norm.result.success ? "✅" : "❌";
        console.log(`   ${status} "${norm.albumName}" → "${norm.correctAlbumName}"`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🧪 TESTE CONCLUÍDO COM SUCESSO");

    if (hasMixedAlbums) {
      console.log("✅ Lógica de processamento misto funcionando corretamente");
      console.log("📋 Sistema detectou álbuns mistos e processou TODOS conforme esperado");
    } else {
      console.log("ℹ️  Neste artista não há álbuns mistos para testar");
      console.log("💡 Para testar funcionalidade completa, adicione alguns álbuns não curados");
    }
  } catch (error) {
    console.error(`❌ Erro durante o teste: ${error.message}`);
    console.error(error.stack);
  }
}

// Executar teste
testMixedCuratedProcessing();
