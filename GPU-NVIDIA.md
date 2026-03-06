# Configuração GPU NVIDIA 🎮

Guia para configurar GPU NVIDIA com Docker e Ollama para acelerar inferência de modelos LLM.

## 🎯 Por que usar GPU?

Com GPU NVIDIA, os modelos LLM rodam **5-10x mais rápido** que apenas com CPU:

| Modelo           | CPU (tokens/s) | GPU (tokens/s) | Ganho |
| ---------------- | -------------- | -------------- | ----- |
| deepseek-r1:1.5b | ~10-20         | ~80-150        | 6-8x  |
| llama3.2:3b      | ~8-15          | ~60-100        | 6-7x  |
| deepseek-r1:7b   | ~3-6           | ~30-50         | 8-10x |

## 📋 Pré-requisitos

1. **GPU NVIDIA** compatível (GTX 1000 series ou mais nova)
2. **Driver NVIDIA** instalado
3. **Docker** instalado

### Verificar Driver NVIDIA

```bash
nvidia-smi
```

Deve mostrar informações da GPU. Se não funcionar, instale o driver:

```bash
# Ubuntu/Debian
ubuntu-drivers devices  # Ver drivers disponíveis
sudo ubuntu-drivers autoinstall  # Instalar automaticamente

# Ou instalar versão específica
sudo apt install nvidia-driver-535
```

Reinicie o sistema após instalar o driver.

## 🚀 Instalação Rápida

### Método 1: Script automático (recomendado)

```bash
sudo ./setup-nvidia-docker.sh
```

O script irá:

- Detectar sua distribuição
- Instalar NVIDIA Container Toolkit
- Configurar Docker
- Testar a instalação

### Método 2: Instalação manual

#### Ubuntu/Debian

```bash
# 1. Configurar repositório
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# 2. Instalar
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# 3. Configurar Docker
sudo nvidia-ctk runtime configure --runtime=docker

# 4. Reiniciar Docker
sudo systemctl restart docker
```

#### Fedora/RHEL/CentOS

```bash
# 1. Configurar repositório
curl -s -L https://nvidia.github.io/libnvidia-container/stable/rpm/nvidia-container-toolkit.repo | \
    sudo tee /etc/yum.repos.d/nvidia-container-toolkit.repo

# 2. Instalar
sudo yum install -y nvidia-container-toolkit

# 3. Configurar Docker
sudo nvidia-ctk runtime configure --runtime=docker

# 4. Reiniciar Docker
sudo systemctl restart docker
```

## 🧪 Testar Instalação

### Teste básico

```bash
docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi
```

Deve mostrar a saída do `nvidia-smi` de dentro do container.

### Teste com Ollama

```bash
# Reiniciar Ollama com nova configuração
docker-compose down ollama
docker-compose up -d ollama

# Verificar logs (deve mencionar GPU)
docker-compose logs ollama

# Testar modelo
docker exec ollama ollama run deepseek-r1:1.5b "Olá! Teste de GPU."
```

### Verificar uso da GPU

Em outro terminal, enquanto o modelo está rodando:

```bash
watch -n 1 nvidia-smi
```

Você deve ver:

- Processo `ollama` listado
- Uso de memória GPU aumentando
- GPU Utilization > 0%

## ⚙️ Configuração

### docker-compose.yml

O arquivo já está configurado para usar GPU:

```yaml
ollama:
  image: ollama/ollama:latest
  container_name: ollama
  user: "${PUID:-1000}:${PGID:-1000}"
  runtime: nvidia
  environment:
    - NVIDIA_VISIBLE_DEVICES=all
    - NVIDIA_DRIVER_CAPABILITIES=compute,utility
    - HOME=/home/ollama
    - OLLAMA_MODELS=/home/ollama/.ollama
  ports:
    - "11434:11434"
  volumes:
    - ./ollama:/home/ollama/.ollama
  restart: unless-stopped
```

### Usar GPU específica

Se você tem múltiplas GPUs e quer usar apenas uma:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          device_ids: ["0"] # Apenas GPU 0
          capabilities: [gpu]
```

### Limitar VRAM

Para limitar uso de memória da GPU:

```yaml
environment:
  - CUDA_VISIBLE_DEVICES=0
  - NVIDIA_VISIBLE_DEVICES=all
  - NVIDIA_DRIVER_CAPABILITIES=compute,utility
```

## 📊 Monitoramento

### Monitoramento em tempo real

```bash
watch -n 1 nvidia-smi
```

### Informações detalhadas

```bash
nvidia-smi dmon  # Device monitoring
nvidia-smi pmon  # Process monitoring
```

### Logs do Ollama

```bash
docker-compose logs -f ollama | grep -i gpu
```

## 🔧 Troubleshooting

### "could not select device driver"

```bash
# Verificar se nvidia-container-toolkit está instalado
dpkg -l | grep nvidia-container-toolkit

# Configurar novamente
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

### "nvidia-smi: command not found" no container

```bash
# Verificar driver no host
nvidia-smi

# Reinstalar nvidia-container-toolkit
sudo apt-get install --reinstall nvidia-container-toolkit
sudo systemctl restart docker
```

### GPU não aparece no Ollama

```bash
# Verificar logs
docker-compose logs ollama

# Reiniciar com logs detalhados
docker-compose down ollama
docker-compose up ollama  # Sem -d para ver logs
```

### "Failed to initialize NVML"

```bash
# Pode ser problema de driver
sudo apt-get install --reinstall nvidia-driver-535

# Ou reiniciar o sistema
sudo reboot
```

### Container não inicia após adicionar GPU

```bash
# Verificar se compose foi atualizado
docker-compose config

# Remover container antigo
docker-compose down ollama
docker rm -f ollama

# Recriar
docker-compose up -d ollama
```

## 💡 Dicas de Performance

### 1. Modelos recomendados por VRAM

| VRAM GPU | Modelos Recomendados                   |
| -------- | -------------------------------------- |
| 4GB      | deepseek-r1:1.5b, llama3.2:3b          |
| 6GB      | deepseek-r1:7b, mistral:7b             |
| 8GB+     | llama3.1:8b, codellama:13b             |
| 12GB+    | mixtral:8x7b, llama3.1:70b (quantized) |

### 2. Otimizar temperatura da GPU

```bash
# Monitorar temperatura
watch -n 1 nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader

# Se > 80°C, considere:
# - Melhorar ventilação
# - Limpar GPU
# - Reduzir clock (se necessário)
```

### 3. Batch processing

Para processar múltiplas requisições, o AllFather tem método `batchAnalyzeTracks()` que usa a GPU de forma eficiente.

### 4. Persistent containers

Manter o container rodando evita overhead de carregar modelo:

```bash
# Container já está configurado com restart: unless-stopped
docker-compose ps
```

## 📈 Benchmarks

### Comparação CPU vs GPU (deepseek-r1:1.5b)

```bash
# Teste
time docker exec ollama ollama run deepseek-r1:1.5b "Escreva um parágrafo sobre IA"
```

**Resultados típicos:**

- CPU (8 cores): ~15 tokens/s, 10-15s total
- GPU (RTX 3060): ~100 tokens/s, 2-3s total
- GPU (RTX 4090): ~150 tokens/s, 1-2s total

## 🔗 Links Úteis

- [NVIDIA Container Toolkit - Documentação Oficial](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
- [Ollama GPU Support](https://github.com/ollama/ollama/blob/main/docs/gpu.md)
- [Docker GPU Support](https://docs.docker.com/config/containers/resource_constraints/#gpu)

## ✅ Checklist Final

- [ ] Driver NVIDIA instalado (`nvidia-smi` funciona)
- [ ] NVIDIA Container Toolkit instalado
- [ ] Docker reiniciado após instalação
- [ ] Teste com container CUDA passou
- [ ] `docker-compose.yml` configurado com GPU
- [ ] Ollama reiniciado
- [ ] GPU aparece nos logs do Ollama
- [ ] Modelo roda mais rápido que antes

---

**Configuração concluída!** Agora seus modelos LLM rodarão muito mais rápido com a GPU NVIDIA! 🚀
