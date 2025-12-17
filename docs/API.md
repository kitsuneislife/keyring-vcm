# Referência Completa da API

## 📚 Índice

- [Gerenciamento de Chaves](#gerenciamento-de-chaves)
- [Operações de Arquivo](#operações-de-arquivo)
- [Operações em Memória](#operações-em-memória)
- [Streams](#streams)
- [Validação e Segurança](#validação-e-segurança)
- [Integridade](#integridade)
- [Utilitários](#utilitários)

---

## Gerenciamento de Chaves

### `generateMasterKey()`

Gera uma master key criptograficamente segura.

**Sintaxe:**
```javascript
const masterKey = generateMasterKey();
```

**Retorna:**
- `Buffer` - Master key de 32 bytes (256 bits)

**Exceções:**
- `SecurityError` - Se entropia insuficiente

**Exemplo:**
```javascript
import { generateMasterKey, exportMasterKey } from '@kitsuneislife/keyring-vcm';

const masterKey = generateMasterKey();
const hex = exportMasterKey(masterKey);

console.log(hex); // "a1b2c3d4..."
```

**Notas:**
- ⚠️ Gere UMA VEZ e armazene com segurança
- Use KMS, Vault, ou variáveis de ambiente
- NUNCA commite no código

---

### `deriveVideoKey(masterKey, videoId)`

Deriva uma chave específica para um vídeo usando HKDF.

**Sintaxe:**
```javascript
const videoKey = deriveVideoKey(masterKey, videoId);
```

**Parâmetros:**
- `masterKey` (Buffer) - Master key de 32 bytes
- `videoId` (string) - ID único do vídeo (1-255 chars)

**Retorna:**
- `Buffer` - Video key de 32 bytes

**Exceções:**
- `ValidationError` - Parâmetros inválidos
- `SecurityError` - Master key fraca

**Exemplo:**
```javascript
const masterKey = generateMasterKey();
const videoKey = deriveVideoKey(masterKey, 'video-123');
// Mesmo videoId sempre gera mesma chave
```

**Notas:**
- Determinístico: mesma entrada = mesma saída
- Isolamento criptográfico entre vídeos
- Use UUIDs ou IDs únicos

---

### `exportMasterKey(masterKey)`

Exporta master key como string hexadecimal.

**Sintaxe:**
```javascript
const hexString = exportMasterKey(masterKey);
```

**Parâmetros:**
- `masterKey` (Buffer) - Master key

**Retorna:**
- `string` - Representação hexadecimal (64 chars)

**Exceções:**
- `ValidationError` - Master key inválida

**Exemplo:**
```javascript
const masterKey = generateMasterKey();
const hex = exportMasterKey(masterKey);

// Salvar em ambiente seguro
process.env.MASTER_KEY = hex;
```

---

### `importMasterKey(hexString)`

Importa master key de string hexadecimal.

**Sintaxe:**
```javascript
const masterKey = importMasterKey(hexString);
```

**Parâmetros:**
- `hexString` (string) - Master key em hex (64 chars)

**Retorna:**
- `Buffer` - Master key de 32 bytes

**Exceções:**
- `ValidationError` - Formato inválido
- `SecurityError` - Chave fraca

**Exemplo:**
```javascript
const hex = process.env.MASTER_KEY;
const masterKey = importMasterKey(hex);
```

---

## Operações de Arquivo

### `encryptFile(options)`

Encripta um arquivo usando streaming.

**Sintaxe:**
```javascript
const stats = await encryptFile(options);
```

**Parâmetros (objeto):**

| Campo        | Tipo   | Obrigatório | Descrição                          |
|--------------|--------|-------------|------------------------------------|
| inputPath    | string | ✅          | Caminho do arquivo original        |
| outputPath   | string | ✅          | Caminho do arquivo criptografado   |
| masterKey    | Buffer | ✅          | Master key (32 bytes)              |
| videoId      | string | ✅          | ID único do vídeo                  |
| encoding     | string | ❌          | 'binary' (padrão), 'base64', 'hex' |
| chunkSize    | number | ❌          | Tamanho do chunk (padrão: 512KB)   |

**Retorna:**
- `Promise<Object>` - Estatísticas:
  ```javascript
  {
    totalChunks: number,    // Total de chunks gerados
    bytesProcessed: number  // Bytes processados
  }
  ```

**Exceções:**
- `ValidationError` - Parâmetros inválidos
- `Error` - Arquivo não encontrado ou I/O error
- `SecurityError` - Arquivo muito grande

**Exemplo:**
```javascript
const stats = await encryptFile({
  inputPath: 'video.mp4',
  outputPath: 'video.encrypted',
  masterKey,
  videoId: 'user-123-vid-001',
  encoding: 'binary'
});

console.log(`Criados ${stats.totalChunks} chunks`);
```

**Limites:**
- Tamanho máximo: 50GB
- Chunk size: 1KB - 10MB

---

### `decryptFile(options)`

Descriptografa um arquivo.

**Sintaxe:**
```javascript
const stats = await decryptFile(options);
```

**Parâmetros (objeto):**

| Campo        | Tipo   | Obrigatório | Descrição                          |
|--------------|--------|-------------|------------------------------------|
| inputPath    | string | ✅          | Arquivo criptografado              |
| outputPath   | string | ✅          | Arquivo restaurado                 |
| masterKey    | Buffer | ✅          | Mesma master key                   |
| videoId      | string | ✅          | Mesmo videoId                      |
| encoding     | string | ❌          | Mesmo encoding usado na criptografia |

**Retorna:**
- `Promise<Object>` - Estatísticas:
  ```javascript
  {
    chunksProcessed: number,
    bytesProcessed: number,
    errors: Array  // Vazio se sucesso
  }
  ```

**Exceções:**
- `ValidationError` - Parâmetros inválidos
- `Error` - Falha na autenticação (chave/videoId errado)
- `Error` - Arquivo corrompido

**Exemplo:**
```javascript
try {
  const stats = await decryptFile({
    inputPath: 'video.encrypted',
    outputPath: 'video-restored.mp4',
    masterKey,
    videoId: 'user-123-vid-001'
  });
  
  console.log('Restaurado com sucesso!');
} catch (error) {
  if (error.message.includes('autenticação')) {
    console.error('Chave ou videoId incorreto!');
  }
}
```

---

## Operações em Memória

### `encryptBuffer(options)`

Encripta dados em memória.

**Sintaxe:**
```javascript
const chunks = await encryptBuffer(options);
```

**Parâmetros (objeto):**

| Campo      | Tipo   | Obrigatório | Descrição                       |
|------------|--------|-------------|---------------------------------|
| data       | Buffer | ✅          | Dados a criptografar            |
| masterKey  | Buffer | ✅          | Master key                      |
| videoId    | string | ✅          | ID do vídeo                     |
| chunkSize  | number | ❌          | Tamanho do chunk                |

**Retorna:**
- `Promise<Buffer[]>` - Array de chunks criptografados

**Exemplo:**
```javascript
const videoBuffer = fs.readFileSync('video.mp4');

const encryptedChunks = await encryptBuffer({
  data: videoBuffer,
  masterKey,
  videoId: 'buffer-001'
});

// Upload chunks individualmente
for (const [index, chunk] of encryptedChunks.entries()) {
  await uploadToS3(`video/chunk-${index}`, chunk);
}
```

---

### `decryptBuffer(options)`

Descriptografa chunks em memória.

**Sintaxe:**
```javascript
const data = await decryptBuffer(options);
```

**Parâmetros (objeto):**

| Campo      | Tipo     | Obrigatório | Descrição                    |
|------------|----------|-------------|------------------------------|
| chunks     | Buffer[] | ✅          | Array de chunks criptografados |
| masterKey  | Buffer   | ✅          | Master key                   |
| videoId    | string   | ✅          | ID do vídeo                  |

**Retorna:**
- `Promise<Buffer>` - Dados descriptografados

**Exemplo:**
```javascript
// Download chunks
const chunks = await Promise.all(
  [0, 1, 2].map(i => downloadFromS3(`video/chunk-${i}`))
);

const videoBuffer = await decryptBuffer({
  chunks,
  masterKey,
  videoId: 'buffer-001'
});

fs.writeFileSync('video.mp4', videoBuffer);
```

---

## Streams

### `EncryptionStream`

Transform stream que divide e criptografa dados.

**Construtor:**
```javascript
new EncryptionStream(videoKey, videoId, options)
```

**Parâmetros:**
- `videoKey` (Buffer) - Chave derivada do vídeo
- `videoId` (string) - ID do vídeo
- `options` (Object):
  - `chunkSize` (number) - Tamanho do chunk

**Eventos:**
- `data` - Emite `EncryptedChunk` objects
- `end` - Stream finalizado
- `error` - Erro durante processamento

**Métodos:**
- `getStats()` - Retorna `{ totalChunks, bytesProcessed }`

**Exemplo:**
```javascript
import { EncryptionStream } from '@kitsuneislife/keyring-vcm';
import fs from 'fs';

const videoKey = deriveVideoKey(masterKey, 'video-001');
const encStream = new EncryptionStream(videoKey, 'video-001');

fs.createReadStream('video.mp4')
  .pipe(encStream)
  .on('data', chunk => {
    console.log(`Chunk ${chunk.index} encriptado`);
  })
  .on('end', () => {
    const stats = encStream.getStats();
    console.log(`Total: ${stats.totalChunks} chunks`);
  });
```

---

### `DecryptionStream`

Transform stream que descriptografa chunks.

**Construtor:**
```javascript
new DecryptionStream(videoKey, videoId, options)
```

**Parâmetros:**
- `videoKey` (Buffer) - Chave derivada
- `videoId` (string) - ID do vídeo
- `options` (Object) - Opções do stream

**Eventos:**
- `data` - Emite Buffer com dados descriptografados
- `end` - Stream finalizado
- `error` - Falha na autenticação ou corrupção

**Métodos:**
- `getStats()` - Retorna estatísticas

**Exemplo:**
```javascript
import { DecryptionStream, ChunkDeserializationStream } from '@kitsuneislife/keyring-vcm';

const videoKey = deriveVideoKey(masterKey, 'video-001');
const deserStream = new ChunkDeserializationStream();
const decStream = new DecryptionStream(videoKey, 'video-001');

fs.createReadStream('video.encrypted')
  .pipe(deserStream)
  .pipe(decStream)
  .pipe(fs.createWriteStream('video.mp4'));
```

---

### `ChunkSerializationStream`

Serializa `EncryptedChunk` para Buffer.

**Construtor:**
```javascript
new ChunkSerializationStream(options)
```

**Exemplo:**
```javascript
encryptionStream
  .pipe(new ChunkSerializationStream())
  .pipe(outputStream);
```

---

### `ChunkDeserializationStream`

Deserializa Buffer para `EncryptedChunk`.

**Construtor:**
```javascript
new ChunkDeserializationStream(options)
```

---

### `TextEncodingStream`

Converte Buffer para texto.

**Construtor:**
```javascript
new TextEncodingStream(encoding, options)
```

**Parâmetros:**
- `encoding` (string) - 'base64' ou 'hex'

**Exemplo:**
```javascript
serializationStream
  .pipe(new TextEncodingStream('base64'))
  .pipe(fs.createWriteStream('video.txt'));
```

---

### `TextDecodingStream`

Converte texto para Buffer.

**Construtor:**
```javascript
new TextDecodingStream(encoding, options)
```

---

## Validação e Segurança

### `validateMasterKey(masterKey)`

Valida master key.

**Exceções:**
- `ValidationError` - Tamanho incorreto
- `SecurityError` - Entropia insuficiente

**Exemplo:**
```javascript
try {
  validateMasterKey(myKey);
} catch (error) {
  console.error('Chave inválida:', error.message);
}
```

---

### `validateVideoId(videoId)`

Valida video ID.

**Exceções:**
- `ValidationError` - Formato inválido, muito longo, etc.

**Regras:**
- 1-255 caracteres
- Apenas: a-z, A-Z, 0-9, -, _, :, .

---

### `sanitizeVideoId(videoId)`

Remove caracteres não permitidos.

**Sintaxe:**
```javascript
const clean = sanitizeVideoId(userInput);
```

**Exemplo:**
```javascript
const videoId = sanitizeVideoId('user@123/video!');
// Resultado: "user123video"
```

---

### `constantTimeCompare(bufferA, bufferB)`

Compara buffers sem timing leak.

**Retorna:**
- `boolean` - True se iguais

**Exemplo:**
```javascript
const isValid = constantTimeCompare(expectedTag, receivedTag);
```

---

### `secureWipe(buffer)`

Limpa buffer sensível da memória.

**Sintaxe:**
```javascript
secureWipe(masterKey);
```

**Exemplo:**
```javascript
let tempKey = Buffer.from(sensitiveData);
try {
  // Usa a chave
} finally {
  secureWipe(tempKey);
  tempKey = null;
}
```

---

### `RateLimiter`

Rate limiting em memória.

**Construtor:**
```javascript
new RateLimiter(maxRequests, windowMs)
```

**Parâmetros:**
- `maxRequests` (number) - Máximo de requests (padrão: 100)
- `windowMs` (number) - Janela em ms (padrão: 60000)

**Métodos:**
- `check(key)` - Verifica se permite (retorna boolean)
- `reset(key)` - Reset para chave específica
- `cleanup()` - Remove entradas expiradas

**Exemplo:**
```javascript
const limiter = new RateLimiter(10, 60000); // 10 req/min

if (limiter.check(userId)) {
  await encryptFile({ ... });
} else {
  throw new Error('Rate limit excedido');
}
```

---

## Integridade

### `calculateFileHash(filePath)`

Calcula SHA-256 de um arquivo.

**Sintaxe:**
```javascript
const hash = await calculateFileHash(filePath);
```

**Retorna:**
- `Promise<string>` - Hash hexadecimal

**Exemplo:**
```javascript
const originalHash = await calculateFileHash('video.mp4');
// Após encrypt/decrypt
const restoredHash = await calculateFileHash('restored.mp4');

if (originalHash === restoredHash) {
  console.log('✅ Integridade verificada!');
}
```

---

### `verifyFileIntegrity(file1, file2)`

Compara hashes de dois arquivos.

**Retorna:**
- `Promise<boolean>` - True se idênticos

**Exemplo:**
```javascript
const isIdentical = await verifyFileIntegrity(
  'original.mp4',
  'restored.mp4'
);
```

---

### `createManifest(options)`

Cria manifest com metadados.

**Parâmetros:**
```javascript
{
  videoId: string,
  totalChunks: number,
  chunkSize: number,
  totalSize: number,
  originalHash: string
}
```

**Retorna:**
- `Object` - Manifest com checksum

**Exemplo:**
```javascript
const manifest = createManifest({
  videoId: 'video-001',
  totalChunks: 1024,
  chunkSize: 524288,
  totalSize: 536870912,
  originalHash: await calculateFileHash('video.mp4')
});

fs.writeFileSync('manifest.json', JSON.stringify(manifest));
```

---

### `validateManifest(manifest)`

Valida integridade do manifest.

**Retorna:**
- `boolean` - True se válido

---

## Utilitários

### `createAAD(videoId, chunkIndex)`

Cria Additional Authenticated Data.

**Retorna:**
- `Buffer` - AAD de 32 bytes

---

### `EncryptedChunk`

Classe que representa chunk criptografado.

**Propriedades:**
- `index` (number) - Índice do chunk
- `iv` (Buffer) - IV de 12 bytes
- `tag` (Buffer) - Auth tag de 16 bytes
- `ciphertext` (Buffer) - Dados criptografados

**Métodos:**
- `toBuffer()` - Serializa para binário
- `fromBuffer(buffer)` - Deserializa (estático)
- `toText(encoding)` - Converte para texto
- `fromText(text, encoding)` - Parse de texto (estático)
- `get size()` - Tamanho total em bytes

**Exemplo:**
```javascript
const chunk = encryptChunk(data, key, id, 0);
const buffer = chunk.toBuffer();
const text = chunk.toText('base64');

// Recuperar
const restored = EncryptedChunk.fromBuffer(buffer);
const fromText = EncryptedChunk.fromText(text, 'base64');
```

---

## Constantes

### `CONFIG`

Configurações do sistema.

```javascript
import { CONFIG } from '@kitsuneislife/keyring-vcm';

console.log(CONFIG.CHUNK_SIZE);  // 524288 (512KB)
console.log(CONFIG.CRYPTO.ALGORITHM);  // 'aes-256-gcm'
```

---

### `SECURITY_LIMITS`

Limites de segurança.

```javascript
import { SECURITY_LIMITS } from '@kitsuneislife/keyring-vcm';

console.log(SECURITY_LIMITS.MAX_FILE_SIZE);  // 50GB
console.log(SECURITY_LIMITS.MAX_CHUNKS_PER_VIDEO);  // 100000
```

---

## Exceções

### `ValidationError`

Erro de validação de parâmetros.

**Propriedades:**
- `message` (string) - Descrição do erro
- `field` (string) - Campo que falhou

---

### `SecurityError`

Erro de segurança.

**Propriedades:**
- `message` (string) - Descrição
- `code` (string) - Código do erro

**Códigos:**
- `WEAK_KEY` - Chave fraca
- `TOO_MANY_CHUNKS` - Limite excedido
- `PATH_TRAVERSAL` - Ataque detectado

---

**Versão da API:** 1.0.0  
**Última atualização:** 2024-12-15
