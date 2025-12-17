# Arquitetura do Sistema

## 📐 Visão Geral

O **Video Chunk Crypto** é um sistema de criptografia modular baseado em streaming, projetado para processar arquivos de vídeo de qualquer tamanho com segurança máxima e eficiência.

## 🏗️ Camadas da Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     API Pública (src/index.js)              │
│  - encryptFile()  - decryptFile()                           │
│  - encryptBuffer() - decryptBuffer()                        │
│  - generateMasterKey()                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Camada de Validação (utils/security.js)        │
│  - Validação de inputs                                      │
│  - Rate limiting                                            │
│  - Proteção contra ataques                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│           Camada de Processamento (core/)                   │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ file-crypto.js │  │ chunk-crypto │  │ *-stream.js    │  │
│  │ (Orquestração) │→ │ (Crypto AES) │→ │ (Streaming)    │  │
│  └────────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Camada Criptográfica (utils/)                  │
│  ┌──────────┐  ┌─────────┐  ┌──────────────┐               │
│  │ hkdf.js  │  │ aad.js  │  │ integrity.js │               │
│  │ (Keys)   │  │ (Auth)  │  │ (Hashing)    │               │
│  └──────────┘  └─────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Node.js Crypto Module (Nativo)                 │
│  - AES-256-GCM  - HKDF  - SHA-256  - Random                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxo de Dados

### Encriptação

```
[Arquivo Original]
      ↓
[Read Stream] → 64KB chunks em memória
      ↓
[EncryptionStream]
  • Acumula até 512KB
  • Para cada chunk:
    1. Deriva video key via HKDF
    2. Gera IV aleatório (12 bytes)
    3. Cria AAD (videoId + index)
    4. AES-256-GCM encrypt
    5. Captura auth tag
      ↓
[ChunkSerializationStream]
  • Monta estrutura binária:
    [index][iv][tag][ciphertext]
      ↓
[TextEncodingStream] (opcional)
  • Converte para base64/hex
      ↓
[Write Stream]
  • Salva em disco
```

### Descriptografia

```
[Arquivo Encriptado]
      ↓
[Read Stream]
      ↓
[TextDecodingStream] (se texto)
  • Decodifica base64/hex
      ↓
[ChunkDeserializationStream]
  • Parse do formato binário
  • Extrai: index, iv, tag, ciphertext
      ↓
[DecryptionStream]
  • Deriva mesma video key
  • Recria AAD
  • Verifica auth tag
  • AES-256-GCM decrypt
      ↓
[Write Stream]
  • Reconstrói arquivo original
```

---

## 🧩 Módulos Principais

### 1. **config.js**
Configurações centralizadas do sistema.

**Responsabilidades:**
- Tamanhos de chunk, IV, tag
- Algoritmos criptográficos
- Limites de segurança

### 2. **utils/hkdf.js**
Derivação de chaves (HKDF).

**Funções:**
- `generateMasterKey()` - Gera master key aleatória
- `deriveVideoKey(masterKey, videoId)` - Deriva chave por vídeo
- `exportMasterKey()` / `importMasterKey()` - Serialização

**Algoritmo:**
```
salt = SHA256(videoId)
prk = HMAC-SHA256(salt, masterKey)
videoKey = HMAC-SHA256(prk, info || 0x01)[0:32]
```

### 3. **utils/aad.js**
Additional Authenticated Data.

**Função:**
- `createAAD(videoId, chunkIndex)` - Cria AAD único

**Formato:**
```
AAD = SHA256(videoId || uint32BE(chunkIndex))
```

**Proteções:**
- ❌ Reordenação de chunks
- ❌ Substituição entre vídeos
- ❌ Replay attacks

### 4. **utils/security.js** ⭐ NOVO
Validações e proteções de segurança.

**Validações:**
- `validateMasterKey()` - Verifica tamanho e entropia
- `validateVideoId()` - Sanitização e formato
- `validateChunkSize()` - Limites min/max
- `validateChunkIndex()` - Uint32 e limites

**Proteções:**
- `constantTimeCompare()` - Timing-safe comparison
- `secureWipe()` - Limpa buffers sensíveis
- `RateLimiter` - Rate limiting em memória

**Limites:**
```javascript
MAX_FILE_SIZE: 50GB
MAX_CHUNKS_PER_VIDEO: 100.000
MAX_VIDEO_ID_LENGTH: 255
MAX_CHUNK_SIZE: 10MB
MIN_CHUNK_SIZE: 1KB
```

### 5. **utils/integrity.js** ⭐ NOVO
Verificação de integridade.

**Funções:**
- `calculateFileHash()` - SHA-256 de arquivos
- `createManifest()` - Metadados + checksum
- `validateManifest()` - Verifica integridade
- `verifyFileIntegrity()` - Compara hashes

**Manifest:**
```json
{
  "version": "1.0.0",
  "videoId": "...",
  "timestamp": 1734220800000,
  "totalChunks": 1024,
  "chunkSize": 524288,
  "totalSize": 536870912,
  "originalHash": "abc123...",
  "checksum": "def456..."
}
```

### 6. **core/chunk-crypto.js**
Criptografia de chunks individuais.

**Classes:**
- `EncryptedChunk` - Representa chunk criptografado
  - `toBuffer()` - Serializa
  - `fromBuffer()` - Deserializa
  - `toText()` / `fromText()` - Encoding texto

**Funções:**
- `encryptChunk(plaintext, videoKey, videoId, index)`
- `decryptChunk(encryptedChunk, videoKey, videoId)`

**Formato Binário:**
```
┌───────────┬──────┬──────┬─────────────┐
│ Index (4) │ IV(12)│ Tag(16)│ Cipher(N)│
└───────────┴──────┴──────┴─────────────┘
  uint32BE   random  GCM tag   encrypted
```

### 7. **core/encryption-stream.js**
Streams de criptografia.

**Classes:**
- `EncryptionStream` - Divide e criptografa
- `ChunkSerializationStream` - Serializa chunks
- `TextEncodingStream` - Converte para texto

**Pipeline:**
```javascript
fileStream
  .pipe(new EncryptionStream(key, id))
  .pipe(new ChunkSerializationStream())
  .pipe(new TextEncodingStream('base64'))
  .pipe(outputStream)
```

### 8. **core/decryption-stream.js**
Streams de descriptografia.

**Classes:**
- `ChunkDeserializationStream` - Parseia chunks
- `DecryptionStream` - Descriptografa
- `TextDecodingStream` - Decodifica texto

### 9. **core/file-crypto.js**
Operações de alto nível.

**Funções:**
- `encryptFile(options)` - Encripta arquivo completo
- `decryptFile(options)` - Descriptografa arquivo
- `encryptBuffer(options)` - Em memória
- `decryptBuffer(options)` - Em memória

**Orquestração:**
- Cria pipelines de streams
- Gerencia erros
- Retorna estatísticas

---

## 🔐 Modelo de Segurança

### Hierarquia de Chaves

```
[Master Key] (32 bytes, gerada uma vez)
      ↓ HKDF
[Video Key 1] [Video Key 2] ... [Video Key N]
      ↓              ↓                 ↓
   [Video 1]     [Video 2]        [Video N]
    ├─ Chunk 0    ├─ Chunk 0       ├─ Chunk 0
    ├─ Chunk 1    ├─ Chunk 1       ├─ Chunk 1
    └─ Chunk 2    └─ Chunk 2       └─ Chunk 2
```

**Vantagens:**
- ✅ Isolamento criptográfico entre vídeos
- ✅ Rotação simples (troca master key)
- ✅ Escala infinitamente
- ✅ Zero reuso de chaves

### Proteções Implementadas

| Ataque                | Proteção                      |
|-----------------------|-------------------------------|
| Modificação           | GCM Auth Tag                  |
| Reordenação           | AAD com chunk index           |
| Substituição          | AAD com videoId               |
| Replay                | IV único + AAD                |
| Timing                | constantTimeCompare()         |
| Weak keys             | Validação de entropia         |
| Path traversal        | Validação de caminhos         |
| DoS (tamanho)         | Limites de arquivo/chunk      |
| DoS (rate)            | RateLimiter                   |

---

## 📊 Performance

### Otimizações

1. **Streaming**
   - Zero carregamento em memória
   - Processamento incremental
   - Backpressure automático

2. **Buffers Nativos**
   - Node.js Buffer (C++)
   - Crypto nativo (OpenSSL)
   - Zero overhead de JavaScript

3. **Chunk Size**
   - 512KB: sweet spot
   - Balanceia I/O e CPU
   - Paralelização viável

### Métricas Típicas

| Operação           | Throughput | Latência |
|--------------------|------------|----------|
| Encrypt (10MB)     | ~200 MB/s  | ~50ms    |
| Decrypt (10MB)     | ~220 MB/s  | ~45ms    |
| HKDF               | N/A        | <1ms     |
| AAD                | N/A        | <0.1ms   |

**Nota:** Gargalo é I/O de disco, não CPU.

---

## 🧪 Testabilidade

### Estratégia de Testes

```
tests/
├── hkdf.test.js        → Derivação de chaves
├── aad.test.js         → AAD e proteções
├── chunk-crypto.test.js → Criptografia
└── integration.test.js  → End-to-end
```

**Cobertura:**
- ✅ Testes unitários (funções isoladas)
- ✅ Testes de integração (pipelines completos)
- ✅ Testes de segurança (ataques simulados)
- ✅ Testes de corrupção (bit-flip)
- ✅ Testes de validação (inputs inválidos)

---

## 🚀 Extensibilidade

### Pontos de Extensão

1. **Novos Encodings**
```javascript
// Adicionar em TextEncodingStream
class Base85EncodingStream extends Transform {
  // ...
}
```

2. **Algoritmos Alternativos**
```javascript
// Modificar CONFIG
CRYPTO: {
  ALGORITHM: 'chacha20-poly1305', // ao invés de aes-256-gcm
  // ...
}
```

3. **Storage Backends**
```javascript
// Criar novo stream de output
class S3OutputStream extends Writable {
  // Upload direto para S3
}
```

4. **Compressão**
```javascript
// Adicionar antes da criptografia
fileStream
  .pipe(zlib.createGzip())
  .pipe(encryptionStream)
  // ...
```

---

## 📦 Dependências

### Runtime

**ZERO dependências externas!**

Usa apenas módulos nativos do Node.js:
- `crypto` - Criptografia
- `stream` - Streams
- `fs` - Sistema de arquivos
- `node:test` - Testes (Node 18+)

### Justificativa

- ✅ Segurança (menos supply chain risk)
- ✅ Performance (código nativo C++)
- ✅ Estabilidade (APIs maduras)
- ✅ Tamanho (instalação rápida)

---

## 🔄 Versionamento

**Semantic Versioning (SemVer)**

- `MAJOR`: Breaking changes na API pública
- `MINOR`: Novas features (backward compatible)
- `PATCH`: Bug fixes e segurança

**Formato do Chunk:**
- Versão atual: 1.0 (implícito)
- Future: adicionar byte de versão no header

---

## 📝 Logs e Monitoring

### Pontos de Log Recomendados

```javascript
// Início de operação
logger.info('Encryption started', { videoId, fileSize });

// Progresso (a cada N chunks)
logger.debug('Progress', { videoId, chunksProcessed, percent });

// Conclusão
logger.info('Encryption completed', { videoId, totalChunks, duration });

// Erros
logger.error('Decryption failed', { videoId, chunkIndex, error });
```

### Métricas

- Taxa de sucesso/falha
- Throughput (MB/s)
- Latência (p50, p95, p99)
- Distribuição de tamanho de arquivo
- Rate limiting triggers

---

## 🎯 Princípios de Design

1. **Security First**
   - Validação rigorosa
   - Fail securely
   - Defense in depth

2. **Simplicity**
   - API clara e intuitiva
   - Código legível
   - Documentação completa

3. **Performance**
   - Streaming por padrão
   - Zero cópias desnecessárias
   - Código nativo quando possível

4. **Reliability**
   - Testes abrangentes
   - Error handling robusto
   - Validação de integridade

5. **Maintainability**
   - Modular
   - Bem documentado
   - Zero dependências externas

---

**Última atualização:** 2024-12-15  
**Versão da Arquitetura:** 1.0.0
