# MusicCurator Agent 🎵

Agent responsável por organizar e curar a biblioteca de música do Plex.

## 📋 Funcionalidades

- 🔍 Escaneia automaticamente a biblioteca de música do Plex
- 🗂️ Organiza faixas e álbuns
- 🏷️ Atualiza e corrige metadados
- 📊 Gera estatísticas da biblioteca
- ⏰ Execução automática em intervalos configuráveis

## 🚀 Instalação

### 1. Instalar dependências

```bash
cd agents/MusicCurator
npm install
```

### 2. Configurar variáveis de ambiente

Copie o arquivo de exemplo e configure suas credenciais:

```bash
cp .env.example .env
```

Edite o `.env` e configure:

```bash
PLEX_URL=http://localhost:32400
PLEX_TOKEN=seu-token-aqui
MUSIC_PATH=/music
CURATOR_INTERVAL=3600000
```

#### Como obter o PLEX_TOKEN:

1. Abra o Plex Web (http://localhost:32400/web)
2. Vá em Settings > Account
3. Pressione `Ctrl + Shift + O` para abrir o console
4. Procure por "Token" ou acesse: Settings > Account > Show Token

Ou acesse diretamente: `http://localhost:32400/web/index.html#!/settings/account`

### 3. Executar o agent

```bash
# Modo produção
npm start

# Modo desenvolvimento (com hot-reload)
npm run dev
```

## 📁 Estrutura do projeto

```
MusicCurator/
├── index.js              # Ponto de entrada do agent
├── src/
│   └── curator.js        # Lógica principal de curadoria
├── package.json          # Dependências e scripts
├── .env.example          # Exemplo de configuração
└── README.md            # Este arquivo
```

## 🔧 Configuração

### Variáveis de ambiente

| Variável           | Descrição                      | Padrão                   |
| ------------------ | ------------------------------ | ------------------------ |
| `PLEX_URL`         | URL do servidor Plex           | `http://localhost:32400` |
| `PLEX_TOKEN`       | Token de autenticação          | -                        |
| `MUSIC_PATH`       | Caminho da biblioteca          | `/music`                 |
| `CURATOR_INTERVAL` | Intervalo entre execuções (ms) | `3600000` (1h)           |

## 🎯 Como funciona

1. **Inicialização**: Conecta ao servidor Plex e valida credenciais
2. **Scan**: Escaneia a biblioteca de música
3. **Organização**: Processa e organiza as faixas
4. **Metadados**: Atualiza informações das músicas
5. **Aguarda**: Espera o intervalo configurado e repete

## 📝 Próximas funcionalidades

- [ ] Detecção de músicas duplicadas
- [ ] Integração com MusicBrainz para metadados
- [ ] Organização automática de arquivos
- [ ] Geração de playlists inteligentes
- [ ] Notificações de novas músicas adicionadas
- [ ] API REST para controle do agent

## 🐛 Troubleshooting

### Erro de conexão com Plex

Certifique-se de que:

- O servidor Plex está rodando
- A URL está correta
- O token é válido

### Agent não encontra a biblioteca

Verifique se existe uma biblioteca do tipo "Music" no seu Plex.

## 📦 Dependências

- **axios**: Cliente HTTP para comunicação com Plex API
- **dotenv**: Gerenciamento de variáveis de ambiente

## 🤝 Contribuindo

Este é o primeiro agent do sistema. Novos agents seguirão estrutura similar.
