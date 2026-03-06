# 🔧 Configuração do Streamrip - Guia

Após executar `./rip.sh config open`, o arquivo de configuração será criado em:

```
./config/.config/streamrip/config.toml
```

## 📝 Principais configurações a editar

### 1. Credenciais

Você precisa adicionar suas credenciais de um ou mais serviços:

#### Qobuz

```toml
[qobuz]
use_auth_token = false
email_or_userid = "seu_email@exemplo.com"
password_or_token = "sua_senha"
app_id = ""
quality = 3  # 0-4 (veja tabela abaixo)
download_booklets = true
```

#### Tidal

```toml
[tidal]
user_id = "seu_user_id"
country_code = "BR"  # ou US, UK, etc.
access_token = "seu_access_token"
refresh_token = "seu_refresh_token"
token_expiry = ""
quality = 3  # 0-3 para Tidal
```

#### Deezer

```toml
[deezer]
arl = "sua_arl_token"
quality = 2  # 0-2 para Deezer
use_deezloader = true
deezloader_warnings = true
```

#### SoundCloud

```toml
[soundcloud]
client_id = ""
app_version = ""
quality = 0  # SoundCloud geralmente é 0 ou 1
```

### 2. Configurações de Download

```toml
[downloads]
folder = "/downloads"  # ⚠️ IMPORTANTE: Use /downloads (não altere!)
source_subdirectories = true
folder_format = "{albumartist} - {title} ({year})"
track_format = "{tracknumber}. {artist} - {title}"
restrict_characters = true
restrict_ascii = false
```

**⚠️ IMPORTANTE - Caminho de Downloads:**

O caminho **DEVE SER** `/downloads`:

- ✅ **CORRETO**: `folder = "/downloads"`
- ❌ **ERRADO**: `folder = "/config/StreamripDownloads"`
- ❌ **ERRADO**: `folder = "/config/downloads"`
- ❌ **ERRADO**: Qualquer outro caminho

Dentro do container Docker, `/downloads` é mapeado para `./downloads/` no seu sistema host. Usar outro caminho fará com que os arquivos sejam salvos no lugar errado.

Se você já configurou errado e tem arquivos salvos em outro lugar, execute:

```bash
./move_downloads.sh
```

### 3. Conversão de Áudio

```toml
[conversion]
enabled = false  # Defina como true para converter
codec = "FLAC"   # Opções: FLAC, MP3, OPUS, AAC, ALAC, OGG
sampling_rate = 48000
bit_depth = 24
lossy_bitrate = 320  # Para MP3/AAC/OPUS
```

### 4. Metadados

```toml
[metadata]
set_playlist_to_album = true
new_tracknumbers = false
embed_cover = true
cover_size = 1200
cover_format = "jpeg"
```

### 5. Miscelânea

```toml
[misc]
version = "2.1.0"
check_for_updates = true
concurrent_downloads = 3
max_search_results = 100
download_youtube_videos = false
```

## 🔑 Como obter credenciais

### Qobuz

1. Use seu email e senha da conta Qobuz
2. Você precisa de uma assinatura premium

### Tidal

Para obter os tokens do Tidal, você tem algumas opções:

#### Opção 1: Usando tidal-dl (Recomendado)

1. Instale o tidal-dl:

```bash
pip3 install tidal-dl
```

2. Execute e faça login:

```bash
tidal-dl
```

3. Os tokens serão salvos em `~/.tidal-dl.token.json`

4. Copie os valores `user_id`, `country_code`, `access_token`, `refresh_token`, e `token_expiry` para o seu `config.toml`

#### Opção 2: Usar streamrip-tidal-auth

Existe uma ferramenta dedicada para obter tokens do Tidal:

```bash
# No seu host (fora do Docker)
pip3 install git+https://github.com/exislow/tidal-oauth-cli.git

# Execute para fazer login
tidal-oauth-cli

# Siga as instruções para login via browser
```

Os tokens aparecerão no terminal.

#### Opção 3: Manualmente via API

1. Acesse: https://github.com/yaronzz/Tidal-Media-Downloader
2. Siga as instruções para obter tokens via browser
3. Use a ferramenta PYTHON para extrair os tokens

#### Campos necessários no config.toml:

```toml
[tidal]
user_id = "123456789"           # Seu user ID do Tidal
country_code = "BR"             # BR, US, UK, etc.
access_token = "token_aqui"     # Token de acesso (JWT)
refresh_token = "refresh_aqui"  # Token para renovar o access_token
token_expiry = "1234567890"     # Unix timestamp da expiração
quality = 3                     # 0-3 (veja tabela de qualidades)
```

**Nota:** Os tokens do Tidal expiram após 7 dias. Se você não usar por uma semana, precisará obter novos tokens.

### Deezer

Para obter o ARL token:

1. Faça login no Deezer no navegador
2. Abra as Ferramentas de Desenvolvedor (F12)
3. Vá para Application/Storage > Cookies > https://www.deezer.com
4. Procure pelo cookie chamado `arl`
5. Copie o valor

### SoundCloud

O SoundCloud geralmente funciona sem autenticação para músicas públicas.

## 📊 Tabela de Qualidades

### Qobuz e Tidal

- **0**: 128 kbps (MP3/AAC)
- **1**: 320 kbps (MP3/AAC)
- **2**: 16 bit, 44.1 kHz (FLAC - qualidade CD)
- **3**: 24 bit, até 96 kHz (Hi-Res)
- **4**: 24 bit, até 192 kHz (Hi-Res - apenas Qobuz)

### Deezer

- **0**: 128 kbps MP3
- **1**: 320 kbps MP3
- **2**: 1411 kbps FLAC (16 bit, 44.1 kHz)

## 💡 Dicas de Configuração

1. **Qualidade recomendada**:
   - Para melhor qualidade: `quality = 3` (Qobuz/Tidal)
   - Para economia de espaço: `quality = 1` (320 kbps)

2. **Conversão**:
   - Se você usa dispositivos com espaço limitado, habilite conversão para MP3 320kbps
   - FLAC mantém qualidade original sem perda

3. **Organização**:
   - O formato padrão de pastas é bom para a maioria dos casos
   - Ajuste `folder_format` e `track_format` conforme sua preferência

4. **Downloads Concorrentes**:
   - `concurrent_downloads = 3` é um bom padrão
   - Não aumente muito para evitar rate limiting

5. **Covers**:
   - `cover_size = 1200` é bom para qualidade visual
   - Reduza para 600-800 se quiser economizar espaço

## 🛠️ Exemplo de Configuração Básica

Configuração mínima para começar a usar o Qobuz:

```toml
[qobuz]
use_auth_token = false
email_or_userid = "seu_email@exemplo.com"
password_or_token = "sua_senha_aqui"
quality = 3  # Alta qualidade

[downloads]
folder = "/downloads"
folder_format = "{albumartist} - {title} ({year})"
track_format = "{tracknumber}. {artist} - {title}"

[metadata]
embed_cover = true
cover_size = 1200

[misc]
concurrent_downloads = 3
```

## ⚠️ Notas Importantes

1. **Backup**: Faça backup do seu `config.toml` após configurar
2. **Segurança**: Não compartilhe seu arquivo de configuração (contém suas credenciais)
3. **Atualizações**: Após atualizar o Docker, verifique se há novos campos no config
4. **Teste**: Teste com um álbum pequeno antes de baixar discografias completas

## 📚 Recursos

- [Documentação oficial do config](https://github.com/nathom/streamrip/wiki/Configuration)
- [FAQ do streamrip](https://github.com/nathom/streamrip/wiki/FAQ)
- [Troubleshooting](https://github.com/nathom/streamrip/wiki/Troubleshooting)
