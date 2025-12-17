# Especificação Criptográfica

## 🔒 Visão Geral

Este documento descreve os algoritmos, parâmetros e garantias criptográficas do sistema **Video Chunk Crypto**.

---

## 🔑 Algoritmos Utilizados

### Criptografia Simétrica

**AES-256-GCM** (Advanced Encryption Standard - Galois/Counter Mode)

| Parâmetro       | Valor                 | Justificativa                                    |
|-----------------|-----------------------|--------------------------------------------------|
| Algoritmo       | AES                   | Padrão NIST FIPS 197, amplamente auditado        |
| Tamanho da chave| 256 bits (32 bytes)   | Segurança máxima, resistente a ataques quânticos futuros |
| Modo            | GCM                   | AEAD (Authenticated Encryption with Associated Data) |
| Tamanho do IV   | 96 bits (12 bytes)    | Recomendação NIST SP 800-38D                     |
| Tag de autenticação | 128 bits (16 bytes) | Resistente a ataques de forging                 |

**Referências:**
- NIST FIPS 197 (AES)
- NIST SP 800-38D (GCM)

### Derivação de Chaves

**HKDF** (HMAC-based Key Derivation Function)

| Parâmetro    | Valor              | Justificativa                          |
|--------------|--------------------|----------------------------------------|
| Hash         | SHA-256            | Padrão NIST FIPS 180-4                 |
| Salt         | SHA-256(videoId)   | Derivação determinística e única       |
| Info         | "@kitsuneislife/keyring-vcm-v1" | Context binding               |
| Output       | 32 bytes           | Mesmo tamanho da master key            |

**Processo:**

```
1. Extract:
   salt = SHA256(videoId)
   prk = HMAC-SHA256(salt, masterKey)

2. Expand:
   info = "@kitsuneislife/keyring-vcm-v1"
   videoKey = HMAC-SHA256(prk, info || 0x01)[0:32]
```

**Referências:**
- RFC 5869 (HKDF)
- NIST SP 800-56C

### Hashing

**SHA-256** (Secure Hash Algorithm 256)

Usado para:
- AAD (Additional Authenticated Data)
- Integridade de manifests
- Verificação de arquivos

| Parâmetro        | Valor     |
|------------------|-----------|
| Output size      | 256 bits  |
| Block size       | 512 bits  |
| Collision resistance | 2^128  |

**Referências:**
- NIST FIPS 180-4

---

## 🔐 Modelo Criptográfico

### Hierarquia de Chaves

```
[Master Key] ← Gerada uma vez, 32 bytes aleatórios
      ↓ HKDF(masterKey, videoId)
[Video Key 1] [Video Key 2] ... [Video Key N]
      ↓              ↓                 ↓
   AES-GCM       AES-GCM           AES-GCM
      ↓              ↓                 ↓
  [Chunks]       [Chunks]          [Chunks]
```

**Propriedades:**

1. **Isolamento**: Chaves de vídeos diferentes são criptograficamente independentes
2. **Determinismo**: Mesmo videoId sempre gera mesma chave
3. **Revogação**: Trocar master key invalida todas as chaves derivadas
4. **Escala**: Suporta infinitos vídeos com uma master key

### Geração de Chaves

#### Master Key

```
masterKey = CSPRNG(32 bytes)
```

**CSPRNG**: Cryptographically Secure Pseudo-Random Number Generator

No Node.js: `crypto.randomBytes()` usa:
- **Linux/macOS**: `/dev/urandom`
- **Windows**: `BCryptGenRandom()`

**Entropia mínima**: 256 bits

**Validações:**
- ✅ Tamanho exato: 32 bytes
- ✅ Não pode ser todos zeros
- ✅ Pelo menos 16 bytes únicos (verificação básica de entropia)

#### Video Key

```
videoKey = HKDF(
  hash    = SHA-256,
  salt    = SHA256(videoId),
  ikm     = masterKey,
  info    = "@kitsuneislife/keyring-vcm-v1",
  length  = 32
)
```

**Garantias:**
- Mesmo se `videoId` for previsível, `videoKey` é segura
- Resistente a ataques de related-key
- Forward secrecy (se master key for rotacionada)

---

## 📦 Formato do Chunk Criptografado

### Estrutura Binária

```
┌─────────────┬──────────────┬────────────────┬───────────────┐
│ Chunk Index │      IV      │   Auth Tag     │  Ciphertext   │
│   4 bytes   │   12 bytes   │   16 bytes     │   N bytes     │
│  uint32 BE  │   random     │   GCM tag      │   encrypted   │
└─────────────┴──────────────┴────────────────┴───────────────┘
     0-3           4-15           16-31            32-N
```

### Detalhes dos Campos

#### 1. Chunk Index (4 bytes)
- **Formato**: Unsigned 32-bit Big Endian
- **Range**: 0 a 4.294.967.295
- **Uso**: 
  - Proteção contra reordenação
  - Parte do AAD
  - Identificação do chunk

#### 2. IV (12 bytes)
- **Geração**: `crypto.randomBytes(12)`
- **Propriedades**:
  - ✅ Aleatório
  - ✅ **NUNCA reutilizado** (crítico para GCM)
  - ✅ Único por chunk
- **Segurança**: Probabilidade de colisão < 2^-96

#### 3. Authentication Tag (16 bytes)
- **Gerado por**: AES-GCM durante criptografia
- **Protege**:
  - Ciphertext (integridade)
  - AAD (autenticidade do contexto)
- **Verificação**: Falha imediata se modificado

#### 4. Ciphertext (N bytes)
- **Tamanho**: Igual ao plaintext (GCM não adiciona padding)
- **Máximo recomendado**: 512KB por chunk
- **Mínimo**: 1 byte

### Overhead

```
Overhead fixo = 4 + 12 + 16 = 32 bytes

Para chunk de 512KB:
Overhead % = (32 / 524288) * 100 = 0.006%
```

---

## 🛡️ Additional Authenticated Data (AAD)

### Propósito

AAD permite autenticar metadados **sem criptografá-los**.

### Construção

```
AAD = SHA256(videoId || chunkIndex)

Onde:
- videoId: UTF-8 string
- chunkIndex: uint32 big-endian
```

### Código (conceitual)

```javascript
function createAAD(videoId, chunkIndex) {
  const videoIdBuffer = Buffer.from(videoId, 'utf8');
  const indexBuffer = Buffer.allocUnsafe(4);
  indexBuffer.writeUInt32BE(chunkIndex, 0);
  
  const combined = Buffer.concat([videoIdBuffer, indexBuffer]);
  return crypto.createHash('sha256').update(combined).digest();
}
```

### Proteções do AAD

| Ataque                  | Proteção                                    |
|-------------------------|---------------------------------------------|
| Reordenação de chunks   | Index alterado → AAD diferente → falha tag |
| Substituição entre vídeos | videoId diferente → AAD diferente → falha |
| Replay attack           | Contexto diferente → AAD diferente → falha  |
| Modificação de metadata | Incluído no AAD → verificado pelo tag      |

---

## 🔒 Processo de Criptografia

### Passo a Passo

```
1. INPUT
   - plaintext: Buffer de dados (até 512KB)
   - videoKey: 32 bytes (derivada via HKDF)
   - videoId: string
   - chunkIndex: uint32

2. DERIVAÇÃO
   videoKey = HKDF(masterKey, videoId)

3. GERAÇÃO DE IV
   iv = crypto.randomBytes(12)

4. CRIAÇÃO DE AAD
   aad = SHA256(videoId || uint32BE(chunkIndex))

5. CRIPTOGRAFIA
   cipher = AES-256-GCM(key=videoKey, iv=iv)
   cipher.setAAD(aad)
   ciphertext = cipher.update(plaintext) + cipher.final()
   authTag = cipher.getAuthTag()

6. SERIALIZAÇÃO
   output = chunkIndex || iv || authTag || ciphertext
```

### Diagrama

```
[Plaintext] ──┐
              │
              ├──→ [AES-256-GCM] ──→ [Ciphertext]
              │          ↑                 ↓
[Video Key] ──┤          │           [Auth Tag]
              │    ┌─────┴─────┐
[IV (random)] ┤    │           │
              │    │   [AAD]   │
[AAD] ────────┘    │           │
                   └───────────┘
                 (videoId+index)
```

---

## 🔓 Processo de Descriptografia

### Passo a Passo

```
1. INPUT
   - encryptedChunk: Buffer serializado
   - videoKey: 32 bytes
   - videoId: string

2. PARSING
   chunkIndex = encryptedChunk[0:4].readUInt32BE()
   iv = encryptedChunk[4:16]
   authTag = encryptedChunk[16:32]
   ciphertext = encryptedChunk[32:]

3. RECRIAÇÃO DE AAD
   aad = SHA256(videoId || uint32BE(chunkIndex))

4. DESCRIPTOGRAFIA
   decipher = AES-256-GCM(key=videoKey, iv=iv)
   decipher.setAAD(aad)
   decipher.setAuthTag(authTag)
   
   plaintext = decipher.update(ciphertext) + decipher.final()
                                              ↑
                                        VERIFICA TAG
                                        (falha se inválido)

5. OUTPUT
   plaintext: Buffer restaurado
```

### Validações Automáticas

GCM verifica automaticamente:
- ✅ Auth tag corresponde ao ciphertext
- ✅ AAD não foi alterado
- ✅ Nenhum bit foi modificado

**Se qualquer verificação falhar**: `Error: Unsupported state or unable to authenticate data`

---

## 🎯 Garantias Criptográficas

### Confidencialidade

**Afirmação**: Sem a chave correta, o ciphertext é indistinguível de random.

**Baseado em**:
- AES-256 é IND-CPA (Indistinguishability under Chosen-Plaintext Attack)
- GCM mantém essa propriedade
- IV único garante diferentes ciphertexts para mesmo plaintext

**Nível de segurança**: 256 bits

### Autenticidade

**Afirmação**: Impossível modificar ou forjar chunks sem a chave.

**Baseado em**:
- GCM é AEAD (Authenticated Encryption with Associated Data)
- Auth tag de 128 bits
- Resistência a forging: 2^128

**Proteções**:
- Modificação: detectada pelo tag
- Forging: computacionalmente inviável
- Truncation: AAD protege contra remoção de chunks

### Integridade

**Afirmação**: Qualquer modificação é detectada.

**Mecanismo**:
- GCM Polynomial MAC (GMAC)
- Verifica ciphertext + AAD
- Falha imediata se alterado

**Probabilidade de falha**: < 2^-128

### Não-Reordenação

**Afirmação**: Chunks fora de ordem são detectados.

**Mecanismo**:
- Chunk index no AAD
- AAD verificado pelo auth tag
- Reordenar → AAD incorreto → tag inválido

### Resistência a Replay

**Afirmação**: Não é possível reusar chunks em contextos diferentes.

**Mecanismo**:
- videoId no AAD
- Contexto diferente → AAD diferente → falha
- IV único previne replay do mesmo chunk

---

## ⚠️ Considerações de Segurança

### Reuso de IV (CRÍTICO)

**NUNCA reutilize IV com a mesma chave!**

```
Se IV₁ = IV₂ e Key₁ = Key₂:
  - Confidencialidade comprometida
  - Possível recuperação de plaintext
  - Auth tag pode ser forjado
```

**Nossa proteção**:
- IV gerado com `crypto.randomBytes()` (CSPRNG)
- Probabilidade de colisão: 2^-96 (astronomicamente baixa)
- Cada chunk tem novo IV

### Limites do GCM

**Máximo de dados por (Key, IV)**:
- Teórico: 2^39 - 256 bits (~68 GB)
- Prático: 2^32 bits (~512 MB)

**Nossa abordagem**:
- Chunk máximo: 10MB (muito abaixo do limite)
- IV único por chunk (sem reuso de par Key+IV)

### Tamanho do AAD

**Máximo**: 2^64 - 1 bits

**Nosso uso**:
- AAD = 32 bytes (SHA-256 output)
- Muito abaixo do limite

---

## 🔬 Análise de Resistência

### Contra Força Bruta

| Alvo           | Espaço de chaves | Tentativas (50% sucesso) | Tempo (1 trilhão/s) |
|----------------|------------------|--------------------------|---------------------|
| Master Key     | 2^256            | 2^255                    | 10^58 anos          |
| Video Key      | 2^256            | 2^255                    | 10^58 anos          |
| Auth Tag       | 2^128            | 2^127                    | 10^19 anos          |

**Conclusão**: Seguro contra força bruta até com computadores quânticos.

### Contra Ataques Criptanalíticos

| Ataque                    | Status          | Proteção                       |
|---------------------------|-----------------|--------------------------------|
| Key recovery              | ✅ Resistente   | AES-256 sem ataques práticos   |
| Related-key attack        | ✅ Resistente   | HKDF isola chaves              |
| Chosen-plaintext attack   | ✅ Resistente   | GCM é IND-CPA                  |
| Chosen-ciphertext attack  | ✅ Resistente   | Auth tag previne modificação   |
| Timing attack             | ⚠️ Mitigado     | Usamos constantTimeCompare     |
| Side-channel attack       | ⚠️ Parcial      | Depende de OpenSSL nativo      |

### Contra Ataques Quânticos

| Algoritmo   | Vulnerabilidade Quântica          | Pós-Quântico          |
|-------------|-----------------------------------|-----------------------|
| AES-256     | Grover (2^128 operações)          | Seguro na prática     |
| SHA-256     | Parcialmente vulnerável           | Considerar SHA-3      |
| HKDF        | Depende de SHA-256                | Atualizar hash        |

**Recomendação futura**: Migrar para SHA-3 quando pós-quântico for padrão.

---

## 📊 Comparação com Alternativas

| Aspecto              | AES-256-GCM (nossa escolha) | AES-256-CBC+HMAC | ChaCha20-Poly1305 |
|----------------------|-----------------------------|--------------------|-------------------|
| Confidencialidade    | ✅ 256 bits                 | ✅ 256 bits        | ✅ 256 bits       |
| Autenticação         | ✅ Integrada (AEAD)         | ⚠️ Separada        | ✅ Integrada      |
| Performance (HW)     | ✅ AES-NI                   | ✅ AES-NI          | ❌ Software       |
| Performance (SW)     | ⚠️ Médio                    | ⚠️ Médio           | ✅ Rápido         |
| Padrão NIST          | ✅ Sim                      | ✅ Sim             | ❌ Não (RFC)      |
| Padding              | ✅ Não necessário           | ⚠️ Necessário      | ✅ Não            |
| Simplicidade         | ✅ Alta                     | ⚠️ Média           | ✅ Alta           |

**Justificativa da escolha**:
- Hardware moderno tem AES-NI (aceleração nativa)
- AEAD simplifica implementação (menos erros)
- Amplamente auditado e padronizado
- Suportado nativamente pelo Node.js crypto

---

## 🔐 Recomendações de Uso

### DO ✅

1. **Gere master key UMA VEZ**
   ```javascript
   const masterKey = generateMasterKey();
   // Salve em vault/KMS
   ```

2. **Use videoIds únicos**
   ```javascript
   const videoId = crypto.randomUUID();
   ```

3. **Valide inputs**
   ```javascript
   validateMasterKey(key);
   validateVideoId(id);
   ```

4. **Verifique integridade**
   ```javascript
   const hash = await calculateFileHash('original.mp4');
   // Salve hash para verificação futura
   ```

5. **Rotacione chaves periodicamente**
   ```javascript
   // Anualmente ou após comprometimento
   const newMasterKey = generateMasterKey();
   // Re-encripte todos os vídeos
   ```

### DON'T ❌

1. **Nunca reutilize videoId**
   ```javascript
   // ❌ ERRADO
   const videoId = 'temp-video';
   ```

2. **Nunca hardcode chaves**
   ```javascript
   // ❌ ERRADO
   const masterKey = Buffer.from('abc123...', 'hex');
   ```

3. **Nunca ignore erros de autenticação**
   ```javascript
   // ❌ ERRADO
   try {
     await decryptFile(...);
   } catch (e) {
     console.log('Tentando mesmo assim...');
   }
   ```

4. **Nunca modifique chunks manualmente**
   ```javascript
   // ❌ ERRADO
   chunk.ciphertext[0] ^= 0x01; // Vai falhar na descriptografia
   ```

---

## 📚 Referências

### Padrões e Especificações

1. **NIST FIPS 197** - Advanced Encryption Standard (AES)
2. **NIST SP 800-38D** - Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM)
3. **RFC 5869** - HMAC-based Extract-and-Expand Key Derivation Function (HKDF)
4. **NIST FIPS 180-4** - Secure Hash Standard (SHS)
5. **NIST SP 800-56C** - Recommendation for Key-Derivation Methods

### Literatura

1. McGrew & Viega (2004) - "The Galois/Counter Mode of Operation (GCM)"
2. Krawczyk & Eronen (2010) - "HMAC-based Extract-and-Expand Key Derivation Function"
3. Bellare & Namprempre (2000) - "Authenticated Encryption: Relations among notions"

### Implementações de Referência

- OpenSSL (usado pelo Node.js crypto)
- BoringSSL (Google)
- LibreSSL

---

**Versão:** 1.0.0  
**Data:** 2024-12-15  
**Autor:** Sistema Video Chunk Crypto  
**Revisão:** Anual ou após descoberta de vulnerabilidade
