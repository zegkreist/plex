#!/usr/bin/env node
/**
 * Gera um relatório HTML interativo da biblioteca enriquecida
 */

import { readFile, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");

/**
 * Gera o HTML
 */
function generateHTML(data) {
  // Análise por artista
  const artistStats = {};

  for (const album of data.albums) {
    if (!artistStats[album.artist]) {
      artistStats[album.artist] = {
        total_tracks: 0,
        albums: 0,
        complete_albums: 0,
        incomplete_albums: 0,
      };
    }

    artistStats[album.artist].total_tracks += album.downloaded_tracks;
    artistStats[album.artist].albums++;

    if (album.is_complete === true) {
      artistStats[album.artist].complete_albums++;
    } else if (album.is_complete === false) {
      artistStats[album.artist].incomplete_albums++;
    }
  }

  // Adicionar singles
  for (const single of data.singles) {
    if (!artistStats[single.artist]) {
      artistStats[single.artist] = {
        total_tracks: 0,
        albums: 0,
        complete_albums: 0,
        incomplete_albums: 0,
      };
    }
    artistStats[single.artist].total_tracks++;
  }

  // Top artistas
  const topArtists = Object.entries(artistStats)
    .sort((a, b) => b[1].total_tracks - a[1].total_tracks)
    .slice(0, 30);

  // Álbuns incompletos com percentual
  const incompleteAlbums = data.albums
    .filter((a) => a.is_complete === false && a.expected_tracks > 0)
    .map((a) => ({
      ...a,
      completeness: (a.downloaded_tracks / a.expected_tracks) * 100,
    }))
    .sort((a, b) => b.completeness - a.completeness);

  const almostComplete = incompleteAlbums.filter((a) => a.completeness >= 75);
  const mediumComplete = incompleteAlbums.filter((a) => a.completeness >= 50 && a.completeness < 75);
  const lessComplete = incompleteAlbums.filter((a) => a.completeness < 50);

  const completeAlbums = data.albums.filter((a) => a.is_complete === true);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📊 Biblioteca Musical - Análise</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
      padding: 20px;
      line-height: 1.6;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      background: white;
      border-radius: 15px;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      text-align: center;
    }

    .header h1 {
      color: #667eea;
      font-size: 2.5em;
      margin-bottom: 10px;
    }

    .header .date {
      color: #666;
      font-size: 0.9em;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: white;
      border-radius: 15px;
      padding: 25px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
      transition: transform 0.3s, box-shadow 0.3s;
    }

    .stat-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    }

    .stat-card .label {
      color: #666;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }

    .stat-card .value {
      font-size: 2.5em;
      font-weight: bold;
      color: #667eea;
    }

    .stat-card .subtext {
      color: #999;
      font-size: 0.85em;
      margin-top: 5px;
    }

    .section {
      background: white;
      border-radius: 15px;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }

    .section h2 {
      color: #667eea;
      margin-bottom: 20px;
      font-size: 1.8em;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .chart-container {
      position: relative;
      height: 400px;
      margin-bottom: 20px;
    }

    .artist-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }

    .artist-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 10px;
      transition: transform 0.3s;
      cursor: pointer;
    }

    .artist-card:hover {
      transform: scale(1.05);
    }

    .artist-card .name {
      font-size: 1.2em;
      font-weight: bold;
      margin-bottom: 10px;
    }

    .artist-card .stats {
      font-size: 0.9em;
      opacity: 0.9;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }

    table thead {
      background: #667eea;
      color: white;
    }

    table th {
      padding: 15px;
      text-align: left;
      font-weight: 600;
    }

    table td {
      padding: 12px 15px;
      border-bottom: 1px solid #eee;
    }

    table tbody tr:hover {
      background: #f8f9ff;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #eee;
      border-radius: 10px;
      overflow: hidden;
      margin-top: 5px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      transition: width 0.3s;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
      margin-left: 10px;
    }

    .badge.complete {
      background: #10b981;
      color: white;
    }

    .badge.almost {
      background: #f59e0b;
      color: white;
    }

    .badge.medium {
      background: #ef4444;
      color: white;
    }

    .badge.low {
      background: #6b7280;
      color: white;
    }

    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 2px solid #eee;
    }

    .tab {
      padding: 12px 24px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1em;
      font-weight: 600;
      color: #666;
      border-bottom: 3px solid transparent;
      transition: all 0.3s;
    }

    .tab:hover {
      color: #667eea;
    }

    .tab.active {
      color: #667eea;
      border-bottom-color: #667eea;
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    .filter-bar {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .filter-bar input {
      flex: 1;
      min-width: 250px;
      padding: 12px 20px;
      border: 2px solid #eee;
      border-radius: 10px;
      font-size: 1em;
      transition: border-color 0.3s;
    }

    .filter-bar input:focus {
      outline: none;
      border-color: #667eea;
    }

    @media (max-width: 768px) {
      .header h1 {
        font-size: 1.8em;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .artist-grid {
        grid-template-columns: 1fr;
      }

      table {
        font-size: 0.85em;
      }

      .chart-container {
        height: 300px;
      }
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #999;
    }

    .empty-state svg {
      width: 80px;
      height: 80px;
      margin-bottom: 20px;
      opacity: 0.3;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎵 Biblioteca Musical</h1>
      <p class="date">Gerado em ${new Date(data.metadata.generated_at).toLocaleString("pt-BR")}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Total de Faixas</div>
        <div class="value">${data.metadata.total_tracks}</div>
        <div class="subtext">${data.metadata.found} encontradas no MusicBrainz</div>
      </div>
      <div class="stat-card">
        <div class="label">Álbuns</div>
        <div class="value">${data.albums.length}</div>
        <div class="subtext">${completeAlbums.length} completos • ${incompleteAlbums.length} incompletos</div>
      </div>
      <div class="stat-card">
        <div class="label">Artistas</div>
        <div class="value">${Object.keys(artistStats).length}</div>
        <div class="subtext">Top 30 mostrados abaixo</div>
      </div>
      <div class="stat-card">
        <div class="label">Taxa de Sucesso</div>
        <div class="value">${Math.round((data.metadata.found / data.metadata.total_tracks) * 100)}%</div>
        <div class="subtext">${data.metadata.requests_made} requests ao MusicBrainz</div>
      </div>
    </div>

    <div class="section">
      <h2>📊 Distribuição de Álbuns</h2>
      <div class="chart-container">
        <canvas id="albumsChart"></canvas>
      </div>
    </div>

    <div class="section">
      <h2>🎤 Top 30 Artistas</h2>
      <div class="chart-container">
        <canvas id="artistsChart"></canvas>
      </div>
      <div class="artist-grid">
        ${topArtists
          .map(
            ([artist, stats], index) => `
          <div class="artist-card">
            <div class="name">#${index + 1} ${artist}</div>
            <div class="stats">
              🎵 ${stats.total_tracks} faixas<br>
              💿 ${stats.albums} álbuns
              ${stats.complete_albums > 0 ? `<br>✅ ${stats.complete_albums} completos` : ""}
              ${stats.incomplete_albums > 0 ? `<br>⚠️ ${stats.incomplete_albums} incompletos` : ""}
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>

    <div class="section">
      <h2>📀 Álbuns</h2>
      <div class="tabs">
        <button class="tab active" onclick="switchTab('almost')">
          ⭐ Quase Completos (${almostComplete.length})
        </button>
        <button class="tab" onclick="switchTab('medium')">
          🔶 Médio (${mediumComplete.length})
        </button>
        <button class="tab" onclick="switchTab('low')">
          🔻 Pouco (${lessComplete.length})
        </button>
        <button class="tab" onclick="switchTab('complete')">
          ✅ Completos (${completeAlbums.length})
        </button>
      </div>

      <div class="filter-bar">
        <input type="text" id="searchInput" placeholder="🔍 Buscar por artista ou álbum..." onkeyup="filterTable()">
      </div>

      <div id="almost" class="tab-content active">
        ${generateAlbumTable(almostComplete, "almost")}
      </div>

      <div id="medium" class="tab-content">
        ${generateAlbumTable(mediumComplete, "medium")}
      </div>

      <div id="low" class="tab-content">
        ${generateAlbumTable(lessComplete, "low")}
      </div>

      <div id="complete" class="tab-content">
        ${generateCompleteAlbumTable(completeAlbums)}
      </div>
    </div>
  </div>

  <script>
    const artistsData = ${JSON.stringify(topArtists)};
    const albumsData = {
      almost: ${almostComplete.length},
      medium: ${mediumComplete.length},
      low: ${lessComplete.length},
      complete: ${completeAlbums.length}
    };

    // Gráfico de álbuns
    new Chart(document.getElementById('albumsChart'), {
      type: 'doughnut',
      data: {
        labels: [
          'Quase Completos (≥75%)',
          'Médio (50-75%)',
          'Pouco (<50%)',
          'Completos'
        ],
        datasets: [{
          data: [albumsData.almost, albumsData.medium, albumsData.low, albumsData.complete],
          backgroundColor: [
            '#f59e0b',
            '#ef4444',
            '#6b7280',
            '#10b981'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              font: { size: 14 }
            }
          },
          title: {
            display: true,
            text: 'Status dos Álbuns',
            font: { size: 18, weight: 'bold' }
          }
        }
      }
    });

    // Gráfico de artistas
    new Chart(document.getElementById('artistsChart'), {
      type: 'bar',
      data: {
        labels: artistsData.map(a => a[0]),
        datasets: [{
          label: 'Faixas',
          data: artistsData.map(a => a[1].total_tracks),
          backgroundColor: 'rgba(102, 126, 234, 0.8)',
          borderColor: 'rgba(102, 126, 234, 1)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            grid: { display: false }
          },
          y: {
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Número de Faixas por Artista',
            font: { size: 18, weight: 'bold' }
          }
        }
      }
    });

    function switchTab(tabName) {
      // Remove active de todos
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Ativa o selecionado
      event.target.classList.add('active');
      document.getElementById(tabName).classList.add('active');
      
      // Limpa busca
      document.getElementById('searchInput').value = '';
    }

    function filterTable() {
      const input = document.getElementById('searchInput').value.toLowerCase();
      const activeTab = document.querySelector('.tab-content.active');
      const rows = activeTab.querySelectorAll('tbody tr');

      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(input) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;
}

function generateAlbumTable(albums, type) {
  if (albums.length === 0) {
    return '<div class="empty-state">Nenhum álbum nesta categoria</div>';
  }

  const badgeClass = type;

  return `
    <table>
      <thead>
        <tr>
          <th>Artista</th>
          <th>Álbum</th>
          <th>Progresso</th>
          <th>Faixas</th>
          <th>Completude</th>
        </tr>
      </thead>
      <tbody>
        ${albums
          .map(
            (album) => `
          <tr>
            <td><strong>${album.artist}</strong></td>
            <td>${album.album_name}</td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${album.completeness}%"></div>
              </div>
            </td>
            <td>${album.downloaded_tracks}/${album.expected_tracks} <span class="badge ${badgeClass}">-${album.missing_tracks}</span></td>
            <td><strong>${album.completeness.toFixed(1)}%</strong></td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function generateCompleteAlbumTable(albums) {
  if (albums.length === 0) {
    return '<div class="empty-state">Nenhum álbum completo ainda</div>';
  }

  // Ordenar por número de faixas
  const sorted = [...albums].sort((a, b) => b.downloaded_tracks - a.downloaded_tracks);

  return `
    <table>
      <thead>
        <tr>
          <th>Artista</th>
          <th>Álbum</th>
          <th>Faixas</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${sorted
          .map(
            (album) => `
          <tr>
            <td><strong>${album.artist}</strong></td>
            <td>${album.album_name}</td>
            <td>${album.downloaded_tracks}</td>
            <td><span class="badge complete">✓ Completo</span></td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

/**
 * Função principal
 */
async function main() {
  const inputFile = join(PROJECT_ROOT, "library_enriched.json");
  const outputFile = join(PROJECT_ROOT, "library_report.html");

  console.log("=".repeat(60));
  console.log("📊 Gerador de Relatório HTML");
  console.log("=".repeat(60));
  console.log();

  console.log(`📖 Carregando ${inputFile}...`);
  const data = JSON.parse(await readFile(inputFile, "utf-8"));

  console.log("🎨 Gerando HTML...");
  const html = generateHTML(data);

  console.log(`💾 Salvando em ${outputFile}...`);
  await writeFile(outputFile, html, "utf-8");

  console.log();
  console.log("=".repeat(60));
  console.log("✅ Relatório gerado com sucesso!");
  console.log(`📂 Abra o arquivo: ${outputFile}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});
