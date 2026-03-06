#!/usr/bin/env node
/**
 * plex-cli.js — Controlador central para os agentes do Plex Server
 *
 * Uso direto:
 *   node plex-cli.js                          → menu interativo
 *   node plex-cli.js <comando>                → executa diretamente
 *   node plex-cli.js --help                   → lista comandos
 *
 * Exemplos:
 *   node plex-cli.js music:fix-all-tags
 *   node plex-cli.js series:curate:dry
 *   node plex-cli.js plex:status
 *   node plex-cli.js test:all
 */

import { spawn } from "child_process";
import readline from "readline";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);

// ─── Cores ANSI ───────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};
const c = (color, str) => `${C[color]}${str}${C.reset}`;
const bold = (str) => `${C.bold}${str}${C.reset}`;

// ─── Definição dos comandos ───────────────────────────────────────────────────
const MUSIC_DIR = path.join(ROOT, "agents", "MusicCurator");
const SERIES_DIR = path.join(ROOT, "agents", "SeriesCurator");
const STORMBRINGER_DIR = path.join(ROOT, "agents", "Stormbringer");
const TIDECALLER_DIR = path.join(ROOT, "agents", "TideCaller");

/**
 * Cada entrada:
 *  id       — chave usada na CLI (ex: "music:fix-all-tags")
 *  label    — texto exibido no menu
 *  group    — agrupamento visual
 *  cwd      — diretório de execução
 *  cmd      — comando principal
 *  args     — argumentos
 *  sudo     — true se precisar de sudo
 */
const COMMANDS = [
  // ── Música ──────────────────────────────────────────────────────────────────
  {
    id: "music:consolidate",
    label: "Consolidar biblioteca de música (normaliza pastas + tags)",
    group: "🎵  Música",
    cwd: MUSIC_DIR,
    cmd: "node",
    args: ["src/full-library-consolidation.js"],
  },
  {
    id: "music:fix-all-tags",
    label: "Corrigir TODAS as tags ALBUM incorretas na biblioteca",
    group: "🎵  Música",
    cwd: MUSIC_DIR,
    cmd: "node",
    args: ["src/fix-all-album-tags.js"],
  },
  {
    id: "music:fix-all-tags:dry",
    label: "Corrigir tags ALBUM — DRY RUN (sem alterações)",
    group: "🎵  Música",
    cwd: MUSIC_DIR,
    cmd: "node",
    args: ["src/fix-all-album-tags.js", "--dry-run"],
  },
  {
    id: "music:fix-tags",
    label: "Corrigir tags apenas dos álbuns curados",
    group: "🎵  Música",
    cwd: MUSIC_DIR,
    cmd: "node",
    args: ["src/fix-curated-tags.js"],
  },
  {
    id: "music:fix-tags:dry",
    label: "Corrigir tags dos álbuns curados — DRY RUN",
    group: "🎵  Música",
    cwd: MUSIC_DIR,
    cmd: "node",
    args: ["src/fix-curated-tags.js", "--dry-run"],
  },
  {
    id: "music:test",
    label: "Rodar testes do MusicCurator",
    group: "🎵  Música",
    cwd: MUSIC_DIR,
    cmd: "npm",
    args: ["test"],
  },

  // ── Séries ───────────────────────────────────────────────────────────────────
  {
    id: "series:curate",
    label: "Curar biblioteca de séries (renomeia pastas + episódios + tags)",
    group: "📺  Séries",
    cwd: SERIES_DIR,
    cmd: "node",
    args: ["index.js"],
    sudo: true,
  },
  {
    id: "series:curate:dry",
    label: "Curar séries — DRY RUN (sem alterações)",
    group: "📺  Séries",
    cwd: SERIES_DIR,
    cmd: "node",
    args: ["index.js", "--dry-run"],
    sudo: true,
  },
  {
    id: "series:fix-tags",
    label: "Corrigir tags de vídeo dos episódios já curados",
    group: "📺  Séries",
    cwd: SERIES_DIR,
    cmd: "node",
    args: ["src/fix-series-tags.js"],
    sudo: true,
  },
  {
    id: "series:fix-tags:dry",
    label: "Corrigir tags de séries — DRY RUN",
    group: "📺  Séries",
    cwd: SERIES_DIR,
    cmd: "node",
    args: ["src/fix-series-tags.js", "--dry-run"],
    sudo: true,
  },
  {
    id: "series:test",
    label: "Rodar testes do SeriesCurator",
    group: "📺  Séries",
    cwd: SERIES_DIR,
    cmd: "npm",
    args: ["test"],
  },

  // ── Stormbringer (Torrent) ───────────────────────────────────────────────────
  {
    id: "stormbringer:start",
    label: "Iniciar Stormbringer (daemon de downloads)",
    group: "⚡  Stormbringer",
    cwd: STORMBRINGER_DIR,
    cmd: "node",
    args: ["src/index.js"],
  },
  {
    id: "stormbringer:search",
    label: "Buscar torrent interativamente",
    group: "⚡  Stormbringer",
    cwd: STORMBRINGER_DIR,
    cmd: "node",
    args: ["src/cli.js", "search"],
  },
  {
    id: "stormbringer:downloads",
    label: "Listar status dos downloads",
    group: "⚡  Stormbringer",
    cwd: STORMBRINGER_DIR,
    cmd: "node",
    args: ["src/downloadManagerCli.js", "status"],
  },
  {
    id: "stormbringer:plex-organize",
    label: "Organizar downloads baixados nas pastas do Plex",
    group: "⚡  Stormbringer",
    cwd: STORMBRINGER_DIR,
    cmd: "node",
    args: ["src/plexOrganizer.js"],
  },
  {
    id: "stormbringer:plex-organize:dry",
    label: "Organizar downloads — DRY RUN (sem mover arquivos)",
    group: "⚡  Stormbringer",
    cwd: STORMBRINGER_DIR,
    cmd: "node",
    args: ["src/plexOrganizer.js", "--dry-run"],
  },
  {
    id: "stormbringer:test",
    label: "Rodar testes do Stormbringer",
    group: "⚡  Stormbringer",
    cwd: STORMBRINGER_DIR,
    cmd: "npm",
    args: ["test"],
  },

  // ── TideCaller (Tidal) ─────────────────────────────────────────────────────
  {
    id: "tidecaller:rip",
    label: "Baixar URL do Tidal (álbum / faixa / playlist) via streamrip",
    group: "🌊  TideCaller",
    cwd: TIDECALLER_DIR,
    cmd: "bash",
    args: ["scripts/rip.sh", "url"],
  },
  {
    id: "tidecaller:download-artists",
    label: "Baixar discografias dos artistas em artist_urls.txt",
    group: "🌊  TideCaller",
    cwd: TIDECALLER_DIR,
    cmd: "bash",
    args: ["scripts/download_artists.sh"],
  },
  {
    id: "tidecaller:organize",
    label: "Organizar downloads do Tidal na biblioteca de música",
    group: "🌊  TideCaller",
    cwd: TIDECALLER_DIR,
    cmd: "bash",
    args: ["scripts/organize_albums.sh"],
  },
  {
    id: "tidecaller:enrich",
    label: "Enriquecer metadados via MusicBrainz",
    group: "🌊  TideCaller",
    cwd: TIDECALLER_DIR,
    cmd: "bash",
    args: ["scripts/enrich_metadata.sh"],
  },

  // ── Testes ───────────────────────────────────────────────────────────────────
  {
    id: "test:all",
    label: "Rodar TODOS os testes (todos os agentes)",
    group: "🧪  Testes",
    cwd: ROOT,
    cmd: "bash",
    args: ["-c", `cd "${MUSIC_DIR}" && npm test; cd "${SERIES_DIR}" && npm test; cd "${STORMBRINGER_DIR}" && npm test`],
  },
  {
    id: "test:music",
    label: "Testes MusicCurator (unitários + integração)",
    group: "🧪  Testes",
    cwd: MUSIC_DIR,
    cmd: "npm",
    args: ["test"],
  },
  {
    id: "test:series",
    label: "Testes SeriesCurator (unitários + integração)",
    group: "🧪  Testes",
    cwd: SERIES_DIR,
    cmd: "npm",
    args: ["test"],
  },
  {
    id: "test:stormbringer",
    label: "Testes Stormbringer",
    group: "🧪  Testes",
    cwd: STORMBRINGER_DIR,
    cmd: "npm",
    args: ["test"],
  },

  // ── Plex / Docker ────────────────────────────────────────────────────────────
  {
    id: "plex:status",
    label: "Status dos containers Docker",
    group: "🐳  Docker / Plex",
    cwd: ROOT,
    cmd: "docker",
    args: ["compose", "ps"],
  },
  {
    id: "plex:restart",
    label: "Reiniciar container do Plex",
    group: "🐳  Docker / Plex",
    cwd: ROOT,
    cmd: "docker",
    args: ["compose", "restart", "plex"],
  },
  {
    id: "plex:start",
    label: "Subir todos os containers",
    group: "🐳  Docker / Plex",
    cwd: ROOT,
    cmd: "docker",
    args: ["compose", "up", "-d"],
  },
  {
    id: "plex:stop",
    label: "Parar todos os containers",
    group: "🐳  Docker / Plex",
    cwd: ROOT,
    cmd: "docker",
    args: ["compose", "stop"],
  },
  {
    id: "plex:logs",
    label: "Ver logs do Plex (últimas 50 linhas)",
    group: "🐳  Docker / Plex",
    cwd: ROOT,
    cmd: "docker",
    args: ["compose", "logs", "--tail=50", "-f", "plex"],
  },
  {
    id: "plex:scan",
    label: "Forçar Scan Library no Plex (via API)",
    group: "🐳  Docker / Plex",
    cwd: ROOT,
    cmd: "bash",
    args: [
      "-c",
      // Usa a API local do Plex para disparar um refresh
      `curl -s -o /dev/null -w "HTTP %{http_code}" "http://localhost:32400/library/sections/all/refresh?X-Plex-Token=${process.env.PLEX_TOKEN || ""}" && echo " — Scan disparado"`,
    ],
  },
];

// ─── Execução de um comando ───────────────────────────────────────────────────
function run(command) {
  return new Promise((resolve) => {
    const { cmd, args, cwd, sudo } = command;

    const finalCmd = sudo ? "sudo" : cmd;
    const finalArgs = sudo ? [cmd, ...args] : args;

    console.log();
    console.log(c("dim", `▶  ${finalCmd} ${finalArgs.join(" ")}  (em ${path.relative(ROOT, cwd) || "."})`));
    console.log(c("dim", "─".repeat(70)));

    const child = spawn(finalCmd, finalArgs, {
      cwd,
      stdio: "inherit",
      env: { ...process.env },
    });

    child.on("close", (code) => {
      console.log();
      if (code === 0) {
        console.log(c("green", `✅  Concluído com sucesso`));
      } else {
        console.log(c("red", `❌  Processo encerrado com código ${code}`));
      }
      resolve(code);
    });

    child.on("error", (err) => {
      console.error(c("red", `❌  Erro ao iniciar: ${err.message}`));
      resolve(1);
    });
  });
}

// ─── Header ──────────────────────────────────────────────────────────────────
function printHeader() {
  console.clear();
  console.log();
  console.log(bold(c("cyan", "  ██████╗ ██╗     ███████╗██╗  ██╗     ██████╗██╗     ██╗")));
  console.log(bold(c("cyan", "  ██╔══██╗██║     ██╔════╝╚██╗██╔╝    ██╔════╝██║     ██║")));
  console.log(bold(c("cyan", "  ██████╔╝██║     █████╗   ╚███╔╝     ██║     ██║     ██║")));
  console.log(bold(c("cyan", "  ██╔═══╝ ██║     ██╔══╝   ██╔██╗     ██║     ██║     ██║")));
  console.log(bold(c("cyan", "  ██║     ███████╗███████╗██╔╝ ██╗    ╚██████╗███████╗██║")));
  console.log(bold(c("cyan", "  ╚═╝     ╚══════╝╚══════╝╚═╝  ╚═╝     ╚═════╝╚══════╝╚═╝")));
  console.log();
  console.log(c("dim", `  Raiz: ${ROOT}`));
  console.log();
}

// ─── Listagem de help ─────────────────────────────────────────────────────────
function printHelp() {
  printHeader();
  console.log(bold("  Uso:") + "  node plex-cli.js [comando]\n");

  let currentGroup = null;
  for (const cmd of COMMANDS) {
    if (cmd.group !== currentGroup) {
      currentGroup = cmd.group;
      console.log(`\n  ${bold(cmd.group)}`);
    }
    const id = c("yellow", cmd.id.padEnd(28));
    const label = c("dim", cmd.label);
    const sudo = cmd.sudo ? c("red", " (sudo)") : "";
    console.log(`    ${id} ${label}${sudo}`);
  }
  console.log();
}

// ─── Menu interativo ──────────────────────────────────────────────────────────
async function interactiveMenu() {
  // Agrupa comandos por grupo
  const groups = [];
  const groupMap = {};
  for (const cmd of COMMANDS) {
    if (!groupMap[cmd.group]) {
      groupMap[cmd.group] = [];
      groups.push({ name: cmd.group, items: groupMap[cmd.group] });
    }
    groupMap[cmd.group].push(cmd);
  }

  while (true) {
    printHeader();

    // Lista grupos com números
    const allItems = [];
    let currentGroup = null;
    for (const cmd of COMMANDS) {
      if (cmd.group !== currentGroup) {
        currentGroup = cmd.group;
        console.log(`  ${bold(cmd.group)}`);
      }
      const num = String(allItems.length + 1).padStart(3);
      const id = c("yellow", cmd.id.padEnd(28));
      const label = c("dim", cmd.label);
      const sudo = cmd.sudo ? c("red", " ⚑") : "";
      console.log(`  ${c("dim", num)}  ${id} ${label}${sudo}`);
      allItems.push(cmd);
    }

    console.log();
    console.log(c("dim", "  ⚑ = requer sudo   |   0 = sair"));
    console.log();

    const answer = await prompt(c("cyan", "  → Escolha o número: "));
    const trimmed = answer.trim();

    if (trimmed === "0" || trimmed === "q" || trimmed === "exit") {
      console.log(c("dim", "\n  Até logo!\n"));
      process.exit(0);
    }

    const idx = parseInt(trimmed, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= allItems.length) {
      console.log(c("red", "\n  Opção inválida."));
      await sleep(800);
      continue;
    }

    const selected = allItems[idx];
    console.log(`\n  ${bold("Executando:")} ${c("yellow", selected.label)}\n`);

    await run(selected);
    await prompt(c("dim", "\n  Pressione ENTER para voltar ao menu..."));
  }
}

// ─── Utilitários ─────────────────────────────────────────────────────────────
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Entry point ─────────────────────────────────────────────────────────────
const cliArg = process.argv[2];

if (!cliArg || cliArg === "--help" || cliArg === "-h") {
  if (!cliArg) {
    // Modo interativo
    await interactiveMenu();
  } else {
    printHelp();
  }
} else {
  // Modo direto: node plex-cli.js <id>
  const command = COMMANDS.find((c) => c.id === cliArg);
  if (!command) {
    console.error(c("red", `\nComando desconhecido: "${cliArg}"`));
    console.error(c("dim", `Use --help para ver os comandos disponíveis.\n`));
    process.exit(1);
  }
  console.log(`\n${bold("Plex CLI")} — ${c("yellow", command.label)}`);
  const code = await run(command);
  process.exit(code ?? 0);
}
