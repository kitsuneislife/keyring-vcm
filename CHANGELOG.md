# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [1.0.0] - 2024-12-15

### 🎉 Lançamento Inicial

#### ✨ Funcionalidades

**Core Criptográfico**
- Criptografia AES-256-GCM com autenticação integrada (AEAD)
- Derivação de chaves via HKDF (HMAC-based Key Derivation Function)
- AAD (Additional Authenticated Data) para proteção contra reordenação
- IV único e aleatório por chunk (12 bytes)
- Auth tag de 128 bits para integridade

**Gestão de Chaves**
- Geração segura de master keys (CSPRNG)
- Derivação isolada de chaves por vídeo
- Export/Import de chaves em formato hexadecimal
- Validação de entropia e tamanho

**Processamento de Arquivos**
- Chunking automático de 512KB (configurável)
- Streaming de arquivos (zero carregamento em memória)
- Suporte a arquivos até 50GB
- Encoding opcional (binary, base64, hex)

**Operações em Memória**
- `encryptBuffer()` para dados em RAM
- `decryptBuffer()` para restauração em RAM
- Ideal para upload/download em chunks

**Streams**
- `EncryptionStream` - Transform stream de criptografia
- `DecryptionStream` - Transform stream de descriptografia
- `ChunkSerializationStream` - Serialização binária
- `ChunkDeserializationStream` - Parsing binário
- `TextEncodingStream` - Conversão para texto
- `TextDecodingStream` - Parsing de texto

#### 🛡️ Segurança

**Validações**
- Validação rigorosa de master keys (tamanho, entropia)
- Validação de videoId (formato, caracteres permitidos)
- Validação de chunk size e index
- Validação de caminhos (proteção path traversal)
- Validação de encodings

**Proteções**
- Rate limiting configurável (`RateLimiter`)
- Constant-time comparison (proteção timing attacks)
- Secure wipe de buffers sensíveis
- Limites de segurança (tamanho de arquivo, chunks, etc.)
- Sanitização de videoIds

**Erros Customizados**
- `ValidationError` - Erros de validação de parâmetros
- `SecurityError` - Erros de segurança com códigos

#### 🔍 Integridade

**Verificações**
- Hash SHA-256 de arquivos
- Manifests com metadados e checksums
- Validação de manifests
- Comparação de integridade entre arquivos
- `HashStream` para hashing durante processamento

#### 📊 Observabilidade

**Estatísticas**
- Total de chunks processados
- Bytes processados
- Erros por chunk
- Performance metrics

#### 📚 Documentação

**Completa e Profissional**
- README.md com introdução e quick start
- docs/ARCHITECTURE.md - Arquitetura do sistema
- docs/API.md - Referência completa da API
- docs/CRYPTO.md - Especificações criptográficas detalhadas
- docs/SECURITY.md - Guia de segurança e boas práticas
- docs/DEPLOYMENT.md - Deploy, Docker, Kubernetes, monitoramento
- docs/TROUBLESHOOTING.md - Solução de problemas comuns
- docs/README.md - Índice da documentação

**Exemplos**
- examples/basic-usage.js - Uso básico
- examples/buffer-usage.js - Operações em memória
- examples/streaming-usage.js - Streaming com progresso
- examples/multi-video.js - Múltiplos vídeos

#### 🧪 Testes

**Cobertura Completa**
- tests/hkdf.test.js - Derivação de chaves
- tests/aad.test.js - AAD e proteções
- tests/chunk-crypto.test.js - Criptografia de chunks
- tests/integration.test.js - Testes end-to-end

**Casos Testados**
- ✅ Geração e validação de chaves
- ✅ Derivação determinística (HKDF)
- ✅ Criptografia/descriptografia bit-by-bit
- ✅ Detecção de corrupção
- ✅ Detecção de alteração de índice
- ✅ Proteção contra chave errada
- ✅ Proteção contra videoId errado
- ✅ Arquivos pequenos e grandes
- ✅ Encoding base64 e hex
- ✅ Operações em memória

#### ⚡ Performance

**Otimizações**
- Streaming nativo do Node.js
- Zero cópias desnecessárias
- Uso de crypto nativo (OpenSSL via C++)
- Backpressure automático
- Chunk size otimizado (512KB)

**Benchmarks Típicos**
- ~200-230 MB/s throughput
- <1ms para derivação de chave
- <0.1ms para criação de AAD

#### 📦 Estrutura do Projeto

```
video-chunk-crypto/
├── src/
│   ├── index.js           # API pública
│   ├── config.js          # Configurações
│   ├── core/              # Módulos principais
│   │   ├── chunk-crypto.js
│   │   ├── encryption-stream.js
│   │   ├── decryption-stream.js
│   │   └── file-crypto.js
│   └── utils/             # Utilitários
│       ├── hkdf.js
│       ├── aad.js
│       ├── security.js    # 🆕 Validações
│       └── integrity.js   # 🆕 Verificações
├── tests/                 # Testes completos
├── examples/              # Exemplos práticos
├── docs/                  # Documentação técnica
├── package.json
├── README.md
└── LICENSE
```

#### 🔧 Configurações

**Constantes**
- `CONFIG.CHUNK_SIZE` - 512KB (524.288 bytes)
- `CONFIG.CRYPTO.ALGORITHM` - aes-256-gcm
- `CONFIG.CRYPTO.KEY_LENGTH` - 32 bytes
- `CONFIG.CRYPTO.IV_LENGTH` - 12 bytes
- `CONFIG.CRYPTO.AUTH_TAG_LENGTH` - 16 bytes

**Limites de Segurança**
- `SECURITY_LIMITS.MAX_FILE_SIZE` - 50GB
- `SECURITY_LIMITS.MAX_CHUNKS_PER_VIDEO` - 100.000
- `SECURITY_LIMITS.MAX_VIDEO_ID_LENGTH` - 255
- `SECURITY_LIMITS.MAX_CHUNK_SIZE` - 10MB
- `SECURITY_LIMITS.MIN_CHUNK_SIZE` - 1KB

#### 🎯 Garantias

**Criptográficas**
- ✅ Confidencialidade (256 bits)
- ✅ Integridade (auth tag)
- ✅ Autenticação (AAD)
- ✅ Proteção contra reordenação
- ✅ Proteção contra replay
- ✅ Proteção contra substituição

**Operacionais**
- ✅ 100% reversível (bit-by-bit equality)
- ✅ Streaming eficiente
- ✅ Retry granular por chunk
- ✅ Zero dependências externas
- ✅ Node.js 18+ compatível

---

## [Unreleased]

### 🚀 Roadmap Futuro

#### Em Consideração

- [ ] Suporte a WebCrypto (browser)
- [ ] Encoding Base85
- [ ] Compressão opcional (antes da criptografia)
- [ ] CLI tool
- [ ] Suporte a ChaCha20-Poly1305
- [ ] Manifest automático
- [ ] Verificação de integridade post-decrypt
- [ ] Worker pool integrado
- [ ] Métricas Prometheus nativas
- [ ] Suporte a TypeScript (types)

---

## Notas de Versão

### Sobre Semantic Versioning

- **MAJOR** (X.0.0): Breaking changes na API pública
- **MINOR** (1.X.0): Novas features (backward compatible)
- **PATCH** (1.0.X): Bug fixes e patches de segurança

### Política de Segurança

Patches de segurança são lançados imediatamente e comunicados via:
- GitHub Security Advisories
- NPM Security
- Changelog

### Depreciação

Funcionalidades depreciadas serão mantidas por no mínimo uma MAJOR version antes da remoção.

---

**Última Atualização:** 2024-12-15  
**Versão Atual:** 1.0.0
