# Plex Agents 🤖

Coleção de agents especializados para automatizar e gerenciar diferentes aspectos do servidor Plex.

## 📦 Agents Disponíveis

### 🎵 [MusicCurator](./MusicCurator)

Agent responsável por organizar e curar a biblioteca de música do Plex.

**Funcionalidades:**

- Escaneia automaticamente a biblioteca de música
- Organiza faixas e álbuns
- Atualiza e corrige metadados
- Gera estatísticas da biblioteca

[Ver documentação completa →](./MusicCurator/README.md)

## 🏗️ Estrutura

Cada agent é um projeto Node.js independente com sua própria estrutura:

```
agents/
├── MusicCurator/        # Agent de curadoria de música
│   ├── src/            # Código fonte
│   ├── index.js        # Ponto de entrada
│   ├── package.json    # Dependências
│   └── README.md       # Documentação
│
└── [FuturoAgent]/      # Próximos agents...
```

## 🚀 Como usar

Cada agent pode ser executado independentemente:

```bash
# Navegar até o agent
cd agents/MusicCurator

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações

# Executar
npm start
```

## 🎯 Filosofia dos Agents

Cada agent segue estes princípios:

1. **Independência**: Cada agent é autossuficiente
2. **Especialização**: Um agent = uma responsabilidade
3. **Configurável**: Variáveis de ambiente para flexibilidade
4. **Resiliente**: Tratamento de erros e reconexão automática
5. **Observável**: Logs claros do que está acontecendo

## 🔮 Próximos Agents (Ideias)

- **MovieCurator**: Organização de filmes e séries
- **SubtitleManager**: Gerenciamento de legendas
- **QualityMonitor**: Monitora qualidade de streams
- **BackupAgent**: Backups automáticos das configurações
- **NotificationAgent**: Notificações de novos conteúdos
- **MetadataEnhancer**: Enriquecimento de metadados
- **CollectionManager**: Gerenciamento de coleções

## 🛠️ Desenvolvendo um novo Agent

Para criar um novo agent, siga a estrutura do MusicCurator:

1. Criar pasta para o agent
2. Inicializar projeto Node.js
3. Estrutura básica:
   - `index.js` - Entry point
   - `src/` - Lógica do agent
   - `package.json` - Dependências
   - `.env.example` - Configurações
   - `README.md` - Documentação

## 📝 Requisitos

- Node.js 18+ (para suporte a ES Modules)
- npm ou yarn
- Servidor Plex rodando
- Token de autenticação Plex

## 🤝 Contribuindo

Agents são modulares e independentes. Sinta-se livre para:

- Adicionar novos agents
- Melhorar agents existentes
- Reportar bugs
- Sugerir funcionalidades

## 📄 Licença

Projeto pessoal para uso próprio.
