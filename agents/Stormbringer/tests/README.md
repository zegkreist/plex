# 🧪 Suite de Testes

Testes de integração completos para o Torrent Download Manager.

## 📋 Visão Geral

Esta suite de testes inclui **testes reais de integração** (sem mocks) para todas as funcionalidades principais do sistema:

- ✅ **torrentSearch.test.js** - Busca real de torrents
- ✅ **metadataEnricher.test.js** - Busca de metadados via TMDB
- ✅ **seriesTracker.test.js** - Rastreamento de séries via TVMaze
- ✅ **downloadManager.test.js** - Download real de torrents

## 🚀 Executar Testes

### Todos os testes

```bash
npm test
```

### Testes com cobertura

```bash
npm run test:coverage
```

### Modo watch (desenvolvimento)

```bash
npm run test:watch
```

### Teste específico

```bash
npm test -- torrentSearch.test.js
```

## ⚙️ Configuração

### Variáveis de Ambiente (Opcional)

Para testes completos de metadados, configure:

```bash
export TMDB_API_KEY="sua_chave_aqui"
```

**Sem a chave TMDB:**

- ✅ Testes básicos ainda funcionam
- ⚠️ Testes de API retornam dados vazios (testam o fallback)

### Requisitos

- Node.js 18+
- Conexão com internet (testes fazem requisições reais)
- Espaço em disco (~100MB para testes de download)

## 📊 Estrutura dos Testes

### TorrentSearch (35 testes)

- Busca de filmes
- Busca de séries (episódio/temporada)
- Busca de música
- Sistema de ranqueamento
- Magnet links
- Utilitários

### MetadataEnricher (25 testes)

- Busca de metadados (TMDB)
- Geração de nomes padronizados
- Download de posters/fanart
- Criação de arquivos NFO
- Sanitização de nomes

### SeriesTracker (30 testes)

- Adicionar/remover séries
- Atualizar episódios
- Verificação de novos episódios (TVMaze)
- Persistência de dados
- Agendamento
- Ativar/desativar séries

### DownloadManager (28 testes)

- Download real de torrents
- Gerenciamento de torrents (pausar/retomar/remover)
- Eventos de progresso
- Organização de arquivos
- Formatação de dados
- Identificação de arquivos de vídeo

## ⏱️ Tempo de Execução

- **Rápidos** (<5s): Testes unitários, utilitários
- **Médios** (5-15s): APIs externas (TMDB, TVMaze)
- **Lentos** (15-60s): Downloads reais de torrents

**Total:** ~3-5 minutos para toda a suite

## 🎯 Cobertura de Código

Os testes cobrem:

- ✅ Fluxos principais (happy path)
- ✅ Casos extremos (edge cases)
- ✅ Tratamento de erros
- ✅ Validação de dados
- ✅ Integração real com APIs externas

Meta de cobertura: **>80%**

## 📝 Notas Importantes

### Testes Reais vs Mocks

**Por que testes reais?**

- ✅ Garantem que integrações funcionam de verdade
- ✅ Detectam mudanças em APIs externas
- ✅ Validam comportamento real do sistema

**Desvantagens:**

- ⏱️ Mais lentos
- 🌐 Requerem internet
- 🔄 Podem falhar se serviços externos estiverem fora

### Torrents de Teste

Os testes de download usam apenas torrents **legais e de domínio público**:

- Big Buck Bunny (vídeo de teste oficial)
- Outros torrents de Creative Commons

**Nenhum conteúdo pirata é usado nos testes!**

### Limpeza Automática

Todos os testes:

- ✅ Criam diretórios temporários
- ✅ Limpam após execução (beforeEach/afterEach)
- ✅ Não deixam lixo no sistema

## 🐛 Troubleshooting

### Testes falhando?

**Erro: Timeout**

```bash
# Aumentar timeout no jest.config
"testTimeout": 90000
```

**Erro: Cannot connect to tracker**

- Verifique sua conexão de internet
- Alguns ISPs bloqueiam trackers de torrent
- Use VPN se necessário

**Erro: API rate limit**

- APIs externas têm limites de requisições
- Aguarde alguns minutos
- Configure chave de API própria

**Erro: Module not found**

```bash
npm install
```

### Executar subset de testes

```bash
# Apenas testes rápidos (sem download)
npm test -- --testPathIgnorePatterns=downloadManager

# Apenas um arquivo
npm test torrentSearch.test.js

# Com padrão
npm test -- --testNamePattern="Busca de Filmes"
```

## 📈 CI/CD

Para integração contínua, considere:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test
  env:
    TMDB_API_KEY: ${{ secrets.TMDB_API_KEY }}
```

**Dica:** Use cache do npm para acelerar:

```yaml
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

## 🔒 Segurança

- ⚠️ Nunca commite chaves de API no código
- ✅ Use variáveis de ambiente
- ✅ Configure .env no .gitignore

## 📚 Recursos

- [Jest Documentation](https://jestjs.io/)
- [TMDB API](https://www.themoviedb.org/documentation/api)
- [TVMaze API](https://www.tvmaze.com/api)
- [WebTorrent](https://webtorrent.io/)

## 🤝 Contribuindo

Ao adicionar novas funcionalidades:

1. ✅ Adicione testes correspondentes
2. ✅ Mantenha testes reais (sem mocks quando possível)
3. ✅ Documente casos especiais
4. ✅ Verifique cobertura: `npm run test:coverage`

---

**Última atualização:** 2026-03-04
