import { WebSearch } from '../src/web-search.js';

/**
 * Teste simples do Google Search
 */
async function testGoogleSearch() {
  const webSearch = new WebSearch();

  console.log('🔍 Testando Google Search diretamente\n');

  const queries = [
    'Radiohead',
    'OK Computer album',
    'Inception movie',
    'David Bowie'
  ];

  for (const query of queries) {
    console.log(`\nBuscando: "${query}"`);
    console.log('-'.repeat(50));
    
    try {
      const results = await webSearch.searchGoogle(query, 3);
      
      if (results && results.length > 0) {
        console.log(`✅ ${results.length} resultados encontrados:\n`);
        results.forEach((result, index) => {
          console.log(`${index + 1}. ${result.title}`);
          console.log(`   ${result.snippet}`);
          console.log(`   ${result.url}\n`);
        });
      } else {
        console.log('❌ Nenhum resultado encontrado');
      }
    } catch (error) {
      console.error('❌ Erro:', error.message);
    }
    
    // Aguarda um pouco entre as buscas
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

testGoogleSearch();
