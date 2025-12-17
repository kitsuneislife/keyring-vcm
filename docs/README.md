# 📚 Documentação Técnica - Video Chunk Crypto

Bem-vindo à documentação completa do **Video Chunk Crypto**, um sistema profissional de criptografia de vídeo por chunks usando AES-256-GCM.

---

## 📖 Documentos Disponíveis

### Para Iniciantes

- **[README.md](../README.md)** - Introdução rápida, instalação e uso básico
- **[Exemplos](../examples/)** - Código prático para começar rapidamente

### Documentação Técnica

1. **[Arquitetura do Sistema](./ARCHITECTURE.md)**
   - Visão geral da arquitetura
   - Fluxo de dados
   - Módulos e responsabilidades
   - Princípios de design

2. **[Referência da API](./API.md)**
   - Todas as funções disponíveis
   - Parâmetros e retornos
   - Exemplos de uso
   - Exceções e tratamento de erros

3. **[Especificações Criptográficas](./CRYPTO.md)**
   - Algoritmos utilizados (AES-256-GCM, HKDF, SHA-256)
   - Formato dos chunks
   - Garantias de segurança
   - Análise de resistência a ataques
   - Comparação com alternativas

4. **[Guia de Segurança](./SECURITY.md)**
   - Melhores práticas
   - Gestão de chaves
   - Validação de inputs
   - Proteção contra ataques
   - Checklist de segurança
   - Resposta a incidentes

### Deploy e Operações

5. **[Guia de Deploy](./DEPLOYMENT.md)**
   - Configuração de ambientes
   - Docker e Kubernetes
   - Monitoramento e métricas
   - Logging estruturado
   - Rotação de chaves
   - Backup e recuperação
   - Hardening de segurança

6. **[Troubleshooting](./TROUBLESHOOTING.md)**
   - Problemas comuns e soluções
   - Erros de criptografia
   - Problemas de performance
   - Debugging avançado
   - Ferramentas de diagnóstico

---

## 🎯 Começar Rápido

### 1. Instalação
```bash
npm install @kitsuneislife/keyring-vcm
```

### 2. Uso Básico
```javascript
import { generateMasterKey, encryptFile, decryptFile } from '@kitsuneislife/keyring-vcm';

const masterKey = generateMasterKey();

await encryptFile({
  inputPath: 'video.mp4',
  outputPath: 'video.encrypted',
  masterKey,
  videoId: 'video-001'
});

await decryptFile({
  inputPath: 'video.encrypted',
  outputPath: 'video-restored.mp4',
  masterKey,
  videoId: 'video-001'
});
```

### 3. Explore os Exemplos
```bash
node examples/basic-usage.js
node examples/buffer-usage.js
node examples/streaming-usage.js
```

---

## 🔍 Navegação por Tópico

### Segurança

- [Garantias Criptográficas](./CRYPTO.md#garantias-criptográficas)
- [Gestão de Chaves](./SECURITY.md#gestão-de-master-key)
- [Proteções Implementadas](./ARCHITECTURE.md#proteções-implementadas)
- [Validações](./API.md#validação-e-segurança)

### Performance

- [Otimizações](./ARCHITECTURE.md#performance)
- [Benchmarks](./ARCHITECTURE.md#métricas-típicas)
- [Worker Threads](./DEPLOYMENT.md#worker-threads)
- [Caching](./DEPLOYMENT.md#caching)

### Operações

- [Monitoramento](./DEPLOYMENT.md#monitoramento)
- [Logging](./DEPLOYMENT.md#logging)
- [Backup](./DEPLOYMENT.md#backup-e-recuperação)
- [Resposta a Incidentes](./DEPLOYMENT.md#resposta-a-incidentes)

### Desenvolvimento

- [Arquitetura de Módulos](./ARCHITECTURE.md#módulos-principais)
- [Extensibilidade](./ARCHITECTURE.md#extensibilidade)
- [Testes](./ARCHITECTURE.md#testabilidade)
- [Contribuindo](../README.md#contribuindo)

---

## 🔐 Conceitos Fundamentais

### Chunk

**Unidade básica de processamento**. O sistema divide vídeos em chunks de 512KB (configurável), criptografa cada um independentemente, permitindo:
- Streaming eficiente
- Retry granular
- Processamento paralelo
- Upload/download seletivo

### Master Key

**Chave raiz do sistema**. Gerada uma vez, armazenada com segurança (KMS/Vault), usada para derivar chaves específicas por vídeo via HKDF.

### Video Key

**Chave derivada** da master key + videoId usando HKDF. Garante isolamento criptográfico entre vídeos.

### AAD (Additional Authenticated Data)

**Metadados autenticados** sem serem criptografados. Protege contra reordenação e substituição de chunks.

### AEAD (Authenticated Encryption with Associated Data)

**Modo de criptografia** que garante confidencialidade + integridade + autenticação em uma única operação (AES-GCM).

---

## 📊 Fluxo de Trabalho Típico

### Desenvolvimento

```
1. Ler documentação (você está aqui! ✅)
2. Instalar pacote
3. Explorar exemplos
4. Implementar no projeto
5. Executar testes
6. Validar segurança
```

### Produção

```
1. Gerar master key
2. Armazenar em KMS/Vault
3. Configurar ambiente
4. Deploy (Docker/K8s)
5. Configurar monitoramento
6. Testar recuperação
7. Go-live
8. Manter e otimizar
```

---

## 🛠️ Casos de Uso

### 1. Upload Seguro para Cloud

```javascript
// Encripta no cliente antes de upload
const chunks = await encryptBuffer({
  data: videoBuffer,
  masterKey: clientKey,
  videoId: uploadId
});

// Upload paralelo
await Promise.all(
  chunks.map((chunk, i) => uploadToS3(`${uploadId}/chunk-${i}`, chunk))
);
```

### 2. Streaming Protegido

```javascript
// Server-side streaming
videoStream
  .pipe(new EncryptionStream(videoKey, videoId))
  .pipe(new ChunkSerializationStream())
  .pipe(httpResponse);
```

### 3. Armazenamento Seguro

```javascript
// Encripta antes de salvar
await encryptFile({
  inputPath: 'sensitive-video.mp4',
  outputPath: 'storage/encrypted.bin',
  masterKey,
  videoId: generateUUID()
});
```

---

## ⚡ FAQ Rápido

**P: É seguro para produção?**  
R: Sim! Usa algoritmos padrão NIST (AES-256-GCM, SHA-256), amplamente auditados.

**P: Qual o overhead de tamanho?**  
R: ~0.006% (32 bytes por chunk de 512KB).

**P: Suporta arquivos grandes?**  
R: Sim, até 50GB por padrão (configurável). Usa streaming, não carrega em memória.

**P: Precisa de dependências externas?**  
R: Não! Zero dependências, usa apenas crypto nativo do Node.js.

**P: Como rotaciono chaves?**  
R: Veja [Rotação de Chaves](./DEPLOYMENT.md#rotação-de-chaves).

**P: E se perder a master key?**  
R: **Impossível recuperar**. Mantenha backups seguros em múltiplos locais.

**P: Posso usar no browser?**  
R: Atualmente apenas Node.js. WebCrypto support é roadmap futuro.

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Veja áreas de interesse:

- [ ] Suporte a WebCrypto (browser)
- [ ] Implementação de Base85 encoding
- [ ] Compressão opcional antes da criptografia
- [ ] CLI tool
- [ ] Mais exemplos e tutoriais

---

## 📞 Suporte

**Documentação:** Você está aqui! 📚  
**Exemplos:** [`/examples`](../examples/)  
**Testes:** [`/tests`](../tests/)  
**Issues:** GitHub Issues  
**Segurança:** security@example.com (para vulnerabilidades)

---

## 📅 Changelog

### v1.0.0 (2024-12-15)

**Funcionalidades:**
- ✅ Criptografia AES-256-GCM
- ✅ Derivação de chaves HKDF
- ✅ Streaming de arquivos
- ✅ Validações de segurança
- ✅ Verificação de integridade
- ✅ Rate limiting
- ✅ Documentação completa

**Segurança:**
- ✅ Validação rigorosa de inputs
- ✅ Proteção contra timing attacks
- ✅ Proteção contra path traversal
- ✅ Verificação de entropia de chaves
- ✅ Limpeza segura de memória

---

## 🎓 Recursos de Aprendizado

### Para Iniciantes

1. Leia o [README](../README.md)
2. Execute [exemplos básicos](../examples/basic-usage.js)
3. Entenda [conceitos fundamentais](#conceitos-fundamentais)

### Para Desenvolvedores

1. Estude a [Arquitetura](./ARCHITECTURE.md)
2. Leia a [Referência da API](./API.md)
3. Implemente casos de uso

### Para DevOps

1. [Guia de Deploy](./DEPLOYMENT.md)
2. [Monitoramento](./DEPLOYMENT.md#monitoramento)
3. [Troubleshooting](./TROUBLESHOOTING.md)

### Para Security Engineers

1. [Especificações Criptográficas](./CRYPTO.md)
2. [Guia de Segurança](./SECURITY.md)
3. [Análise de Ameaças](./CRYPTO.md#análise-de-resistência)

---

## 📖 Índice Completo de Documentação

```
docs/
├── README.md                  # Este arquivo
├── ARCHITECTURE.md            # Arquitetura do sistema
├── API.md                     # Referência completa da API
├── CRYPTO.md                  # Especificações criptográficas
├── SECURITY.md                # Guia de segurança
├── DEPLOYMENT.md              # Deploy e operações
└── TROUBLESHOOTING.md         # Solução de problemas
```

---

## ✨ Próximos Passos

1. **Novo Usuário?** → Comece com o [README](../README.md)
2. **Implementando?** → Veja a [API](./API.md) e [Exemplos](../examples/)
3. **Deploy?** → Leia [DEPLOYMENT.md](./DEPLOYMENT.md)
4. **Problemas?** → Consulte [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
5. **Segurança?** → Estude [CRYPTO.md](./CRYPTO.md) e [SECURITY.md](./SECURITY.md)

---

**Desenvolvido com ❤️ e foco em segurança máxima.**

**Versão da Documentação:** 1.0.0  
**Última Atualização:** 2024-12-15
