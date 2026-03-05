#!/usr/bin/env node

import path from "path";
import { AlbumConsolidator } from "../src/album-consolidator.js";

/**
 * Script para TESTE REAL do processamento misto de álbuns do Igorrr
 *
 * ATENÇÃO: Este script fará alterações físicas nos arquivos!
 * Use com cuidado.
 */

async function realIgorrrConsolidationTest() {
  console.log("🔥 TESTE REAL: Processamento Misto de Álbuns - Igorrr");
  console.log("=".repeat(60));
  console.log("⚠️  ATENÇÃO: Este script fará alterações FÍSICAS nos arquivos!");
  console.log("=".repeat(60));

  const consolidator = new AlbumConsolidator({
    allfatherApiUrl: "http://localhost:3001",
  });

  // Artista para teste: Igorrr (sabemos que tem álbuns mistos)
  const artistName = "Igorrr";
  const artistPath = path.join("/home/zegkreist/Documents/Pessoal/plex_server/music", artistName);

  console.log(`\n🎸 Processando artista: ${artistName}`);
  console.log(`📁 Caminho: ${artistPath}`);

  try {
    // Primeira verificação - estado atual
    console.log("\n📊 FASE 1: Verificação do estado atual");
    console.log("-".repeat(50));

    const musicDirectory = "/home/zegkreist/Documents/Pessoal/plex_server/music";
    const artists = await consolidator.scanMusicDirectory(musicDirectory);
    const artist = artists.find((a) => a.name === artistName);

    if (!artist) {
      console.log(`❌ Artista "${artistName}" não encontrado!`);
      return;
    }

    console.log(`✅ Encontrado artista: ${artist.name}`);
    console.log(`📂 Álbuns encontrados: ${artist.albums.length}`);

    // Analisa status de curação ANTES
    const totalAlbums = artist.albums.length;
    const curatedAlbumsBefore = artist.albums.filter((a) => a.isCurated);
    const uncuratedAlbumsBefore = artist.albums.filter((a) => !a.isCurated);

    console.log(`\n📈 Estado ANTES da consolidação:`);
    console.log(`   📊 Total de álbuns: ${totalAlbums}`);
    console.log(`   ✅ Álbuns curados: ${curatedAlbumsBefore.length}`);
    console.log(`   🔄 Álbuns não curados: ${uncuratedAlbumsBefore.length}`);

    if (curatedAlbumsBefore.length > 0) {
      console.log(`\n📌 Álbuns curados encontrados:`);
      for (const album of curatedAlbumsBefore) {
        console.log(`   ✅ "${album.name}" - ${album.tracks.length} faixas`);
      }
    }

    if (uncuratedAlbumsBefore.length > 0) {
      console.log(`\n🔄 Álbuns não curados encontrados (serão processados):`);
      for (const album of uncuratedAlbumsBefore) {
        console.log(`   🆕 "${album.name}" - ${album.tracks.length} faixas`);
      }
    }

    // Pausa para confirmação
    console.log("\n" + "⚠️ ".repeat(30));
    console.log("🔥 TESTE REAL - CONFIRMAÇÃO NECESSÁRIA");
    console.log("⚠️ ".repeat(30));
    console.log("Este processo irá:");
    console.log("• Detectar álbuns similares usando comparação de covers");
    console.log("• Consolidar álbuns não curados com curados (se houver similaridade)");
    console.log("• Normalizar nomes de álbuns via AllFather");
    console.log("• Renumerar faixas sequencialmente");
    console.log("• Mover arquivos fisicamente (não copiar)");
    console.log("• Remover pastas originais após consolidação");
    console.log("• Adicionar tag [CURATED] aos álbuns processados");
    console.log("");

    // Aguarda 10 segundos para o usuário cancelar se necessário
    console.log("⏳ Iniciando processamento em 10 segundos...");
    console.log("💡 Pressione Ctrl+C para cancelar");

    for (let i = 10; i > 0; i--) {
      process.stdout.write(`\r⏱️  ${i}s...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log(`\r✅ Iniciando processamento!`);

    // PROCESSAMENTO REAL
    console.log("\n🔥 FASE 2: Processamento real - SEM simulação!");
    console.log("-".repeat(50));

    const consolidationResult = await consolidator.consolidateArtistAlbums(artistPath, artistName, {
      dryRun: false, // *** REAL - Não é simulação! ***
      skipCurated: false, // Processa mistos (curados + não curados)
      normalizeAllTracks: true, // Normaliza tudo
      similarityThreshold: 0.75, // Threshold para eletrônica/experimental
      normalizeToTitleCase: true, // Usa Title Case
    });

    console.log("\n📊 FASE 3: Análise dos resultados");
    console.log("-".repeat(50));

    if (consolidationResult.groups && consolidationResult.groups.length > 0) {
      console.log(`🎯 Grupos consolidados: ${consolidationResult.groups.length}`);

      for (let i = 0; i < consolidationResult.groups.length; i++) {
        const group = consolidationResult.groups[i];
        console.log(`\n📎 Grupo ${i + 1} consolidado:`);
        for (const album of group) {
          const status = album.isCurated ? "[ERA CURADO]" : "[ERA NÃO CURADO]";
          console.log(`   • "${album.name}" ${status}`);
        }
      }
    } else {
      console.log("ℹ️  Nenhum grupo de álbuns similares foi encontrado para consolidação");
    }

    if (consolidationResult.results && consolidationResult.results.length > 0) {
      console.log(`\n🎯 Consolidações realizadas: ${consolidationResult.results.length}`);
      for (const result of consolidationResult.results) {
        console.log(`   ✅ "${result.correctName}"`);
      }
    }

    // Resultados de normalização
    if (consolidationResult.normalizationResults && consolidationResult.normalizationResults.length > 0) {
      const successfulNormalizations = consolidationResult.normalizationResults.filter((nr) => nr.result.success);
      const failedNormalizations = consolidationResult.normalizationResults.filter((nr) => !nr.result.success);

      console.log(`\n📝 Normalizações realizadas:`);
      console.log(`   ✅ Bem-sucedidas: ${successfulNormalizations.length}`);
      console.log(`   ❌ Com erro: ${failedNormalizations.length}`);

      if (successfulNormalizations.length > 0) {
        console.log(`\n🎯 Álbuns normalizados com sucesso:`);
        for (const norm of successfulNormalizations) {
          const albumRenamed = norm.result.albumRenamed ? " (renomeado)" : "";
          const metadataInfo = norm.result.metadata ? " [via AllFather]" : " [normalização básica]";
          console.log(`   ✅ "${norm.correctAlbumName}"${albumRenamed}${metadataInfo}`);
        }
      }

      if (failedNormalizations.length > 0) {
        console.log(`\n💥 Falhas na normalização:`);
        for (const norm of failedNormalizations) {
          console.log(`   ❌ "${norm.albumName}" - ${norm.result.error}`);
        }
      }
    }

    // Escaneamento final para verificar resultado
    console.log("\n📊 FASE 4: Verificação do estado final");
    console.log("-".repeat(50));

    const artistsAfter = await consolidator.scanMusicDirectory(musicDirectory);
    const artistAfter = artistsAfter.find((a) => a.name === artistName);

    if (artistAfter) {
      const totalAlbumsAfter = artistAfter.albums.length;
      const curatedAlbumsAfter = artistAfter.albums.filter((a) => a.isCurated);
      const uncuratedAlbumsAfter = artistAfter.albums.filter((a) => !a.isCurated);

      console.log(`📈 Estado APÓS a consolidação:`);
      console.log(`   📊 Total de álbuns: ${totalAlbumsAfter}`);
      console.log(`   ✅ Álbuns curados: ${curatedAlbumsAfter.length}`);
      console.log(`   🔄 Álbuns não curados: ${uncuratedAlbumsAfter.length}`);

      // Comparação
      const consolidatedCount = totalAlbums - totalAlbumsAfter;
      const newlyCuratedCount = curatedAlbumsAfter.length - curatedAlbumsBefore.length;

      if (consolidatedCount > 0) {
        console.log(`\n🎯 Resultado da consolidação:`);
        console.log(`   📉 Álbuns consolidados: ${consolidatedCount}`);
        console.log(`   📈 Novos álbuns curados: ${newlyCuratedCount}`);
      } else {
        console.log(`\n✅ Nenhum álbum foi fisicamente consolidado (sem duplicatas)`);
        console.log(`📝 Apenas normalização de nomes e numeração foi realizada`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🔥 TESTE REAL CONCLUÍDO COM SUCESSO!");
    console.log("=".repeat(60));
    console.log("✅ Processamento misto realizado");
    console.log("🎵 Arquivos foram fisicamente modificados");
    console.log("📁 Verificar resultados na pasta do artista");
  } catch (error) {
    console.error(`\n❌ ERRO durante o processamento real: ${error.message}`);
    console.error(error.stack);
    console.log("\n🚨 O processamento foi interrompido devido a erro!");
  }
}

// Executar teste real
realIgorrrConsolidationTest();
