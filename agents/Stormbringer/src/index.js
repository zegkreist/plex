#!/usr/bin/env node

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar configuração
const configPath = join(__dirname, "..", "config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

console.log(chalk.bold.cyan("\n╔═══════════════════════════════════════════╗"));
console.log(chalk.bold.cyan("║   🎬 Torrent Download Manager 🎵          ║"));
console.log(chalk.bold.cyan("╚═══════════════════════════════════════════╝\n"));

console.log(chalk.bold("Comandos disponíveis:\n"));
console.log(chalk.green("  npm run search") + "          - Buscar torrents");
console.log(chalk.green("  npm run download") + "        - Buscar e baixar torrent");
console.log(chalk.green("  npm run track-series") + "    - Adicionar série para rastreamento");
console.log(chalk.green("  npm run check-series") + "    - Verificar novos episódios");

console.log();
console.log(chalk.bold("Downloads:\n"));
console.log(chalk.cyan("  npm run downloads:list") + "    - Listar downloads ativos");
console.log(chalk.cyan("  npm run downloads:status") + "  - Ver estatísticas gerais");
console.log(chalk.cyan("  npm run downloads:clear") + "   - Limpar downloads completos");
console.log(chalk.cyan("  npm run downloads:info <n>") + " - Ver detalhes do download #n");

console.log();
console.log(chalk.bold("Plex Server:\n"));
console.log(chalk.magenta("  npm run plex:preview") + "     - Preview da organização (dry-run)");
console.log(chalk.magenta("  npm run plex:organize") + "    - Organizar arquivos para Plex");

console.log();
console.log(chalk.bold("Ou use o CLI diretamente:\n"));
console.log(chalk.yellow("  node src/cli.js search"));
console.log(chalk.yellow("  node src/cli.js download"));
console.log(chalk.yellow("  node src/cli.js track-series"));
console.log(chalk.yellow("  node src/cli.js list-tracked"));
console.log(chalk.yellow("  node src/cli.js check-series"));
console.log(chalk.yellow("  node src/cli.js start-monitor"));
console.log();
console.log(chalk.gray("Para mais informações, leia o README.md\n"));
