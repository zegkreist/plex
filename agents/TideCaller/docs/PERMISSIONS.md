# 🔒 Gerenciamento de Permissões - Streamrip Docker

## 📋 Problema Resolvido

Os arquivos criados dentro de containers Docker são, por padrão, criados como usuário root. Isso causava problemas quando você tentava acessar ou modificar os arquivos das pastas `config/` e `downloads/` no seu sistema host.

## ✅ Solução Implementada

O projeto agora está configurado para criar arquivos com as permissões do seu usuário atual, não como root.

### O que foi modificado:

1. **Dockerfile**: Criação de usuário não-root com mesmo UID/GID do host
2. **docker-compose.yml**: Configuração para executar com seu usuário
3. **Scripts (rip.sh e tidal.sh)**: Exportam automaticamente seu UID/GID
4. **fix_permissions.sh**: Script para corrigir permissões de arquivos existentes

## 🚀 Como Funciona

### Arquivos Novos

Quando você usar o streamrip agora, todos os arquivos criados nas pastas `config/` e `downloads/` terão automaticamente as permissões do seu usuário.

```bash
# Todos esses comandos criarão arquivos com suas permissões
./rip.sh config open
./rip.sh url https://tidal.com/album/123
./tidal.sh menu
```

### Arquivos Existentes

Se você já tinha arquivos criados como root, use o script de correção:

```bash
./fix_permissions.sh
```

Este script irá:

- Detectar seu UID e GID automaticamente
- Alterar o proprietário de todos os arquivos em `config/` e `downloads/`
- Configurar permissões de leitura para todos os usuários

## 🔧 Detalhes Técnicos

### Variáveis de Ambiente

Os scripts exportam automaticamente:

```bash
export USER_ID=$(id -u)    # Seu UID (geralmente 1000)
export GROUP_ID=$(id -g)   # Seu GID (geralmente 1000)
```

### Dockerfile

```dockerfile
# Aceita UID e GID como argumentos
ARG USER_ID=1000
ARG GROUP_ID=1000

# Cria usuário com mesmo UID/GID do host
RUN groupadd -g ${GROUP_ID} streamrip && \
    useradd -u ${USER_ID} -g ${GROUP_ID} -m -s /bin/bash streamrip

# Executa como usuário não-root
USER streamrip
```

### docker-compose.yml

```yaml
build:
  args:
    USER_ID: ${USER_ID:-1000}
    GROUP_ID: ${GROUP_ID:-1000}
user: "${USER_ID:-1000}:${GROUP_ID:-1000}"
```

## 📊 Verificando Permissões

### Verificar permissões atuais:

```bash
ls -la config/
ls -la downloads/
```

**Saída esperada:**

```
drwxr-xr-x 4 seu_usuario seu_usuario 4096 Mar  4 15:53 config
drwxr-xr-x 2 seu_usuario seu_usuario 4096 Mar  4 15:27 downloads
```

### Verificar seu UID/GID:

```bash
id
```

**Saída exemplo:**

```
uid=1000(seu_usuario) gid=1000(seu_usuario) grupos=...
```

## 🛠️ Troubleshooting

### Problema: Arquivos ainda são criados como root

**Solução 1**: Reconstruir a imagem

```bash
docker-compose build --no-cache
```

**Solução 2**: Verificar se os scripts estão exportando USER_ID

```bash
# No início de rip.sh e tidal.sh deve ter:
export USER_ID=$(id -u)
export GROUP_ID=$(id -g)
```

### Problema: Não consigo acessar arquivos existentes

**Solução**: Execute o script de correção

```bash
./fix_permissions.sh
```

Se pedir senha sudo, isso é normal. O script precisa de privilégios para alterar permissões.

### Problema: Permissões ainda estão erradas após correção

**Verificar manualmente:**

```bash
# Seu UID
id -u

# GID
id -g

# Corrigir manualmente
sudo chown -R $(id -u):$(id -g) config/ downloads/
chmod -R u+rwX,g+rX,o+rX config/ downloads/
```

### Problema: Imagem não reconhece USER_ID

**Verificar variáveis:**

```bash
echo "UID: $USER_ID"
echo "GID: $GROUP_ID"

# Se vazias, exporte manualmente
export USER_ID=$(id -u)
export GROUP_ID=$(id -g)
```

## 📝 Permissões Recomendadas

### Para config/

```bash
# Diretório acessível por você, leitura para outros
chmod 755 config/
# Arquivos dentro podem ser mais restritivos
chmod 644 config/.config/streamrip/config.toml  # Contém credenciais
```

### Para downloads/

```bash
# Diretório e arquivos acessíveis por você, leitura para outros
chmod 755 downloads/
chmod 644 downloads/**/*
```

## 🔄 Workflow Normal

Com as mudanças implementadas, o workflow normal é:

1. **Primeira vez**: Execute `./install_streamrip.sh`
2. **Configure**: Execute `./rip.sh config open`
3. **Use normalmente**: `./rip.sh url ...` ou `./tidal.sh menu`
4. **Arquivos criados**: Automaticamente com suas permissões

Se encontrar problemas: Execute `./fix_permissions.sh`

## 💡 Dicas de Segurança

1. **config.toml contém credenciais**: Mantenha-o privado

   ```bash
   chmod 600 config/.config/streamrip/config.toml
   ```

2. **Não compartilhe o diretório config/** no git
   - Já está no `.gitignore`

3. **Backups**: Faça backup do seu config.toml

   ```bash
   cp config/.config/streamrip/config.toml config.toml.backup
   ```

4. **Tokens sensíveis**: Não compartilhe `tidal_tokens.txt`
   - Já está no `.gitignore`

## 📚 Referências

- [Docker User Namespace](https://docs.docker.com/engine/security/userns-remap/)
- [Docker Compose User](https://docs.docker.com/compose/compose-file/05-services/#user)
- [Linux File Permissions](https://www.linux.com/training-tutorials/understanding-linux-file-permissions/)

## ✅ Checklist de Verificação

Após as mudanças, verifique:

- [ ] Arquivos em `config/` pertencem ao seu usuário
- [ ] Arquivos em `downloads/` pertencem ao seu usuário
- [ ] Você consegue editar `config.toml` sem sudo
- [ ] Downloads funcionam sem erros de permissão
- [ ] `./fix_permissions.sh` funciona corretamente
- [ ] Imagem foi reconstruída com `docker-compose build`

## 🎯 Resumo Rápido

```bash
# Corrigir permissões de arquivos existentes
./fix_permissions.sh

# Reconstruir imagem (apenas se mudou Dockerfile)
docker-compose build --no-cache

# Usar normalmente - arquivos virão com suas permissões
./rip.sh url <URL>
./tidal.sh menu
```

Pronto! Agora suas pastas `config/` e `downloads/` sempre terão as permissões corretas! 🎉
