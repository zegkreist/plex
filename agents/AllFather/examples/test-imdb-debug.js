import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Teste de debug para IMDB
 */
async function testIMDBDirect() {
  console.log("🎬 Testando busca direta no IMDB\n");

  const titles = ["Inception", "The Matrix", "Breaking Bad", "Stranger Things"];

  for (const title of titles) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Buscando: "${title}"`);
    console.log("=".repeat(60));

    try {
      const searchUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(title)}&s=tt&ttype=ft,tv&ref_=fn_ft`;
      console.log(`URL: ${searchUrl}`);

      const response = await axios.get(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 10000,
      });

      console.log(`Status: ${response.status}`);
      console.log(`Content-Length: ${response.data.length} bytes`);

      const $ = cheerio.load(response.data);

      // Debug: Vamos ver diferentes seletores possíveis
      console.log("\n🔍 Debugging seletores:");

      const selectors = [".ipc-metadata-list-summary-item", ".find-result-item", ".findResult", '[data-testid="find-results-section-title"]', ".ipc-metadata-list", "section.ipc-page-section", "ul.ipc-metadata-list"];

      for (const selector of selectors) {
        const elements = $(selector);
        console.log(`  ${selector}: ${elements.length} elementos encontrados`);
      }

      // Tenta diferentes seletores
      const firstResult = $(".ipc-metadata-list-summary-item").first();

      if (firstResult.length > 0) {
        console.log("\n✅ Primeiro resultado encontrado!");

        // Debug: Mostra HTML do resultado
        console.log("\n📄 HTML do primeiro resultado:");
        console.log(firstResult.html().substring(0, 500) + "...\n");

        const titleText = firstResult.find(".ipc-metadata-list-summary-item__t").text().trim();
        const link = firstResult.find("a").attr("href");

        console.log(`Título (seletor .ipc-metadata-list-summary-item__t): ${titleText || "N/A"}`);
        console.log(`Link: ${link || "N/A"}`);

        // Tenta outros seletores de título
        console.log("\n🔍 Tentando outros seletores de título:");
        console.log(`  h3: ${firstResult.find("h3").text().trim() || "N/A"}`);
        console.log(`  .ipc-metadata-list-summary-item__title: ${firstResult.find(".ipc-metadata-list-summary-item__title").text().trim() || "N/A"}`);
        console.log(`  a: ${firstResult.find("a").text().trim() || "N/A"}`);

        // Extrai metadata
        const metadataItems = firstResult.find(".ipc-metadata-list-summary-item__li");
        console.log(`\nMetadata items (.ipc-metadata-list-summary-item__li): ${metadataItems.length}`);

        if (metadataItems.length > 0) {
          metadataItems.each((i, el) => {
            console.log(`  - ${$(el).text().trim()}`);
          });
        } else {
          console.log("\n🔍 Tentando outros seletores de metadata:");
          const altSelectors = [".ipc-inline-list__item", "span", "li"];
          altSelectors.forEach((sel) => {
            const items = firstResult.find(sel);
            console.log(`  ${sel}: ${items.length} items`);
            if (items.length > 0 && items.length < 10) {
              items.slice(0, 5).each((i, el) => {
                const text = $(el).text().trim();
                if (text) console.log(`    - ${text.substring(0, 50)}`);
              });
            }
          });
        }
      } else {
        console.log("\n❌ Nenhum resultado encontrado com os seletores atuais");

        // Salva o HTML para análise
        const fs = await import("fs");
        const filename = `/tmp/imdb_${title.replace(/\s+/g, "_")}.html`;
        fs.writeFileSync(filename, response.data);
        console.log(`HTML salvo em: ${filename}`);
      }
    } catch (error) {
      console.error(`\n❌ Erro: ${error.message}`);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
      }
    }

    // Aguarda entre requisições
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

testIMDBDirect();
