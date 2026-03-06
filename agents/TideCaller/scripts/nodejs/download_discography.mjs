#!/usr/bin/env node
/**
 * Script para download de discografia de artistas
 * Permite busca parcial e gera comandos para baixar via Tidal
 */

import { readFile, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");

/**
 * Normaliza string para busca (remove acentos, lowercase)
 */
function normalizeString(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Busca artistas no library_enriched que contenham a query
 */
function searchArtists(libraryData, query) {
  const normalizedQuery = normalizeString(query);
  const artistStats = {};

  // Coletar todos os artistas únicos
  for (const album of libraryData.albums) {
    if (!artistStats[album.artist]) {
      artistStats[album.artist] = {
        name: album.artist,
        albums: [],
        total_tracks: 0,
      };
    }
    artistStats[album.artist].albums.push(album);
    artistStats[album.artist].total_tracks += album.downloaded_tracks;
  }

  // Filtrar artistas que contenham a query
  const matches = Object.values(artistStats).filter((artist) => {
    const normalizedName = normalizeString(artist.name);
    return normalizedName.includes(normalizedQuery);
  });

  // Ordenar por número de tracks (mais popular primeiro)
  matches.sort((a, b) => b.total_tracks - a.total_tracks);

  return matches;
}

/**
 * Busca artista no MusicBrainz e retorna URL do Tidal
 */
async function searchArtistInMusicBrainz(artistName) {
  const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2";
  const USER_AGENT = "StreamripTools/1.0 (https://github.com/streamrip)";

  try {
    const query = encodeURIComponent(artistName);
    const url = `${MUSICBRAINZ_API}/artist?query=${query}&fmt=json`;

    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.artists && data.artists.length > 0) {
      const artist = data.artists[0];

      // Buscar URL do Tidal nas relações
      const tidalRel = artist.relations?.find((rel) => rel.type === "streaming" && rel.url?.resource?.includes("tidal.com"));

      return {
        mbid: artist.id,
        name: artist.name,
        disambiguation: artist.disambiguation,
        score: artist.score,
        tidal_url: tidalRel?.url?.resource,
      };
    }

    return null;
  } catch (error) {
    console.error(`❌ Erro ao buscar ${artistName} no MusicBrainz:`, error.message);
    return null;
  }
}

/**
 * Extrai ID do artista de uma URL do Tidal
 */
function extractTidalArtistId(url) {
  const match = url.match(/tidal\.com\/browse\/artist\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Gera script de download para artistas
 */
async function generateDownloadScript(artists, outputFile) {
  let script = `#!/bin/bash
# Script de download de discografia - Gerado em ${new Date().toISOString()}
# Execute: chmod +x ${outputFile} && ${outputFile}

set -e

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Carregar funções do tidal.sh
source "$SCRIPT_DIR/tidal.sh"

echo "======================================================================"
echo "📀 Download de Discografias via Streamrip"
echo "======================================================================"
echo ""
echo "Artistas a baixar: ${artists.length}"
echo ""

`;

  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    script += `
echo "----------------------------------------------------------------------"
echo "🎤 [${i + 1}/${artists.length}] Baixando: ${artist.name}"
echo "   • Álbuns encontrados na biblioteca: ${artist.albums.length}"
echo "   • Total de faixas: ${artist.total_tracks}"
echo "----------------------------------------------------------------------"
echo ""

# Buscar artista no Tidal usando tidal.sh
cd "$PROJECT_ROOT"
tidal_search_artist "${artist.name}"

echo ""
echo "✅ Concluído: ${artist.name}"
echo ""

# Rate limit (respeitar servidores)
sleep 2

`;
  }

  script += `
echo "======================================================================"
echo "✅ DOWNLOAD CONCLUÍDO - Todos os artistas processados"
echo "======================================================================"
echo ""
echo "📂 Arquivos salvos em: $PROJECT_ROOT/downloads/"
echo ""
`;

  await writeFile(outputFile, script, "utf-8");

  // Tornar executável
  await execAsync(`chmod +x ${outputFile}`);
}

/**
 * Gera arquivo de URLs do Tidal para download manual
 */
async function generateUrlList(artists, outputFile) {
  let content = `# URLs de Artistas para Download - Gerado em ${new Date().toISOString()}\n`;
  content += `# Para baixar, use: docker-compose exec streamrip rip url <URL>\n\n`;

  for (const artist of artists) {
    content += `# ${artist.name} (${artist.albums.length} álbuns, ${artist.total_tracks} faixas)\n`;

    // Buscar URL do Tidal
    console.log(`🔎 Buscando ${artist.name} no MusicBrainz...`);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limit

    const mbData = await searchArtistInMusicBrainz(artist.name);

    if (mbData && mbData.tidal_url) {
      content += `${mbData.tidal_url}\n\n`;
    } else {
      content += `# URL não encontrada - busque manualmente em: https://tidal.com/search/artists?q=${encodeURIComponent(artist.name)}\n\n`;
    }
  }

  await writeFile(outputFile, content, "utf-8");
}

/**
 * Função principal
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("=".repeat(70));
    console.log("🎵 DOWNLOAD DE DISCOGRAFIA - Streamrip Helper");
    console.log("=".repeat(70));
    console.log();
    console.log("Uso:");
    console.log("  node download_discography.mjs <artista1> [artista2] [artista3] ...");
    console.log();
    console.log("Exemplos:");
    console.log('  node download_discography.mjs "Tim Maia"');
    console.log('  node download_discography.mjs "Fleshgod" "Gaupa" "Jorge Ben"');
    console.log();
    console.log("ℹ️  Busca parcial é suportada:");
    console.log('  "Tim" encontrará "Tim Maia"');
    console.log('  "Jorge" encontrará "Jorge Ben Jor"');
    console.log();
    process.exit(1);
  }

  const inputFile = join(PROJECT_ROOT, "library_enriched.json");
  console.log("=".repeat(70));
  console.log("🎵 DOWNLOAD DE DISCOGRAFIA");
  console.log("=".repeat(70));
  console.log();

  console.log(`📖 Carregando ${inputFile}...`);
  const libraryData = JSON.parse(await readFile(inputFile, "utf-8"));
  console.log(`✅ Carregado: ${libraryData.albums.length} álbuns`);
  console.log();

  // Buscar cada artista
  const selectedArtists = [];
  const notFound = [];

  for (const query of args) {
    console.log(`🔍 Buscando: "${query}"`);
    const matches = searchArtists(libraryData, query);

    if (matches.length === 0) {
      console.log(`   ❌ Nenhum artista encontrado`);
      notFound.push(query);
    } else if (matches.length === 1) {
      console.log(`   ✅ Encontrado: ${matches[0].name}`);
      console.log(`      └─ ${matches[0].albums.length} álbuns, ${matches[0].total_tracks} faixas`);
      selectedArtists.push(matches[0]);
    } else {
      // Múltiplas correspondências - usar a primeira (mais popular)
      console.log(`   ⚠️  Múltiplas correspondências (${matches.length}), usando: ${matches[0].name}`);
      console.log(`      └─ ${matches[0].albums.length} álbuns, ${matches[0].total_tracks} faixas`);
      if (matches.length <= 5) {
        console.log(
          `      Outras opções: ${matches
            .slice(1)
            .map((m) => m.name)
            .join(", ")}`,
        );
      }
      selectedArtists.push(matches[0]);
    }
    console.log();
  }

  if (selectedArtists.length === 0) {
    console.log("❌ Nenhum artista encontrado na biblioteca!");
    console.log();
    console.log("💡 Dica: Use a busca parcial. Exemplos:");
    console.log('   "Tim" para encontrar "Tim Maia"');
    console.log('   "Black Label" para encontrar "Black Label Society"');
    process.exit(1);
  }

  console.log("=".repeat(70));
  console.log("📝 RESUMO");
  console.log("=".repeat(70));
  console.log(`Artistas selecionados: ${selectedArtists.length}`);
  console.log();
  selectedArtists.forEach((artist, i) => {
    console.log(`${i + 1}. ${artist.name}`);
    console.log(`   └─ ${artist.albums.length} álbuns • ${artist.total_tracks} faixas`);
  });

  if (notFound.length > 0) {
    console.log();
    console.log(`⚠️  Não encontrados (${notFound.length}): ${notFound.join(", ")}`);
  }

  console.log();
  console.log("=".repeat(70));
  console.log("🔧 GERANDO SCRIPTS DE DOWNLOAD");
  console.log("=".repeat(70));
  console.log();

  // Gerar script bash
  const scriptFile = join(PROJECT_ROOT, "scripts", "download_artists.sh");
  console.log(`📝 Gerando script Bash: ${scriptFile}`);
  await generateDownloadScript(selectedArtists, scriptFile);
  console.log(`✅ Script criado!`);
  console.log();

  // Gerar lista de URLs
  const urlFile = join(PROJECT_ROOT, "artist_urls.txt");
  console.log(`📝 Gerando lista de URLs: ${urlFile}`);
  console.log(`⏱️  Buscando URLs no MusicBrainz (pode demorar)...`);
  console.log();
  await generateUrlList(selectedArtists, urlFile);
  console.log(`✅ Lista criada!`);
  console.log();

  console.log("=".repeat(70));
  console.log("✅ CONCLUÍDO");
  console.log("=".repeat(70));
  console.log();
  console.log("📂 Arquivos gerados:");
  console.log(`   • ${scriptFile}`);
  console.log(`   • ${urlFile}`);
  console.log();
  console.log("🚀 Para executar o download:");
  console.log(`   ./scripts/download_artists.sh`);
  console.log();
  console.log("   OU manualmente usando tidal.sh:");
  console.log(`   cd scripts && source tidal.sh`);
  console.log(`   tidal_search_artist "Nome do Artista"`);
  console.log();
}

main().catch((error) => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});
