# Guia de Troubleshooting

## 🔍 Problemas Comuns e Soluções

---

## ❌ Erros de Criptografia

### Erro: "Falha na autenticação do chunk"

**Sintomas:**
```
Error: Falha na autenticação do chunk 5: Unsupported state or unable to authenticate data
```

**Causas Possíveis:**

1. **Chave incorreta**
   ```javascript
   // Verifica se está usando a mesma master key
   const key1 = exportMasterKey(usedForEncryption);
   const key2 = exportMasterKey(usedForDecryption);
   console.log(key1 === key2); // Deve ser true
   ```

2. **VideoId diferente**
   ```javascript
   // Verifica videoId
   console.log('Encriptado com:', originalVideoId);
   console.log('Decriptando com:', currentVideoId);
   // Devem ser EXATAMENTE iguais
   ```

3. **Arquivo corrompido**
   ```javascript
   // Verifica integridade
   const stats = fs.statSync('encrypted-file');
   console.log('Tamanho:', stats.size);
   // Deve ser múltiplo de chunk + headers
   ```

4. **Encoding errado**
   ```javascript
   // Se encriptou com base64, decripte com base64
   await encryptFile({ ..., encoding: 'base64' });
   await decryptFile({ ..., encoding: 'base64' }); // Mesmo encoding!
   ```

**Solução:**
```javascript
// Debug completo
try {
  await decryptFile({
    inputPath: 'video.enc',
    outputPath: 'video.mp4',
    masterKey,
    videoId
  });
} catch (error) {
  console.error('Erro:', error.message);
  
  // Verifica arquivo
  console.log('Arquivo existe?', fs.existsSync('video.enc'));
  console.log('Tamanho:', fs.statSync('video.enc').size);
  
  // Verifica chave
  validateMasterKey(masterKey);
  
  // Verifica videoId
  validateVideoId(videoId);
  
  // Tenta ler primeiro chunk
  const firstChunk = fs.readFileSync('video.enc', { start: 0, end: 100 });
  console.log('Primeiros bytes:', firstChunk.toString('hex'));
}
```

---

### Erro: "Master key deve ter 32 bytes"

**Sintomas:**
```
ValidationError: Master key deve ter exatamente 32 bytes
```

**Causa:** Master key com tamanho incorreto.

**Solução:**
```javascript
// Verifica tamanho
console.log('Tamanho da chave:', masterKey.length);

// Se importou de hex, verifica formato
const hexKey = 'abc123...'; // Deve ter 64 caracteres (32 bytes em hex)
console.log('Tamanho hex:', hexKey.length); // Deve ser 64

// Gera nova chave se necessário
const newKey = generateMasterKey();
console.log('Nova chave:', newKey.length); // 32
```

---

### Erro: "Video ID contém caracteres inválidos"

**Sintomas:**
```
ValidationError: Video ID contém caracteres inválidos. Use apenas: a-z, A-Z, 0-9, -, _, :, .
```

**Causa:** VideoId com caracteres não permitidos.

**Solução:**
```javascript
// Sanitiza videoId
const userInput = 'user@123/video!';
const cleanId = sanitizeVideoId(userInput);
console.log(cleanId); // "user123video"

// Ou use UUID
import { randomUUID } from 'crypto';
const videoId = randomUUID(); // Sempre válido
```

---

## 🚫 Erros de Validação

### Erro: "Chunk index excede uint32 máximo"

**Sintomas:**
```
ValidationError: Chunk index excede uint32 máximo
```

**Causa:** Arquivo muito grande (mais de ~2TB com chunks de 512KB).

**Solução:**
```javascript
// Aumenta chunk size
await encryptFile({
  inputPath: 'huge-file.mp4',
  outputPath: 'huge-file.enc',
  masterKey,
  videoId,
  chunkSize: 10 * 1024 * 1024 // 10MB chunks
});
```

---

### Erro: "Arquivo excede o tamanho máximo permitido"

**Sintomas:**
```
Error: Arquivo excede o tamanho máximo permitido (53687091200 bytes)
```

**Causa:** Arquivo maior que 50GB.

**Solução:**
```javascript
// Opção 1: Divide arquivo manualmente
import { spawn } from 'child_process';

async function splitFile(inputPath, chunkSize = '10G') {
  return new Promise((resolve, reject) => {
    const split = spawn('split', ['-b', chunkSize, inputPath, 'part-']);
    split.on('close', (code) => {
      code === 0 ? resolve() : reject(new Error(`split failed: ${code}`));
    });
  });
}

await splitFile('huge-video.mp4', '10G');

// Encripta cada parte
for (const part of fs.readdirSync('.').filter(f => f.startsWith('part-'))) {
  await encryptFile({
    inputPath: part,
    outputPath: `${part}.enc`,
    masterKey,
    videoId: `${baseVideoId}-${part}`
  });
}

// Opção 2: Modifica SECURITY_LIMITS (não recomendado)
import { SECURITY_LIMITS } from '@kitsuneislife/keyring-vcm';
// SECURITY_LIMITS.MAX_FILE_SIZE = 100 * 1024 * 1024 * 1024; // 100GB
```

---

## 💾 Erros de I/O

### Erro: "ENOENT: no such file or directory"

**Sintomas:**
```
Error: ENOENT: no such file or directory, open 'video.mp4'
```

**Solução:**
```javascript
// Verifica se arquivo existe antes
import { access } from 'fs/promises';

try {
  await access('video.mp4');
  console.log('Arquivo existe');
} catch {
  console.error('Arquivo não encontrado');
}

// Usa caminho absoluto
import { resolve } from 'path';
const absolutePath = resolve(__dirname, 'video.mp4');
```

---

### Erro: "ENOSPC: no space left on device"

**Sintomas:**
```
Error: ENOSPC: no space left on device, write
```

**Solução:**
```bash
# Verifica espaço
df -h

# Limpa espaço
rm -rf /tmp/*
docker system prune -a
```

---

### Erro: "EMFILE: too many open files"

**Sintomas:**
```
Error: EMFILE: too many open files
```

**Solução:**
```bash
# Aumenta limite (Linux)
ulimit -n 65536

# Permanente
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf
```

```javascript
// No código: fecha streams explicitamente
const stream = fs.createReadStream('file');
stream.on('end', () => stream.destroy());
```

---

## 🐌 Problemas de Performance

### "Encriptação muito lenta"

**Diagnóstico:**
```javascript
import { performance } from 'perf_hooks';

const start = performance.now();

await encryptFile({
  inputPath: 'video.mp4',
  outputPath: 'video.enc',
  masterKey,
  videoId
});

const duration = performance.now() - start;
console.log(`Duração: ${duration}ms`);
console.log(`Taxa: ${fileSize / duration * 1000 / 1024 / 1024} MB/s`);
```

**Causas e Soluções:**

1. **Disco lento (HDD)**
   ```bash
   # Teste velocidade do disco
   dd if=/dev/zero of=testfile bs=1M count=1024
   
   # Solução: use SSD ou ajuste chunk size
   chunkSize: 1024 * 1024 // 1MB chunks para HDD
   ```

2. **CPU limitada**
   ```javascript
   // Usa worker threads para paralelizar
   import { Worker } from 'worker_threads';
   
   const workers = [];
   for (let i = 0; i < 4; i++) {
     workers.push(new Worker('./crypto-worker.js'));
   }
   ```

3. **Memória insuficiente**
   ```bash
   # Verifica uso de memória
   free -h
   
   # Aumenta se necessário
   node --max-old-space-size=4096 script.js
   ```

---

### "Alto uso de memória"

**Diagnóstico:**
```javascript
// Monitora memória
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Heap:', Math.round(usage.heapUsed / 1024 / 1024), 'MB');
}, 1000);
```

**Solução:**
```javascript
// Usa streaming (já é o padrão)
// NUNCA faça isso:
const data = fs.readFileSync('huge-file.mp4'); // ❌ Carrega tudo

// Faça isso:
await encryptFile({ ... }); // ✅ Streaming
```

---

## 🔐 Problemas de Segurança

### "Rate limit excedido"

**Sintomas:**
```
Error: Rate limit excedido
```

**Solução:**
```javascript
import { RateLimiter } from '@kitsuneislife/keyring-vcm';

const limiter = new RateLimiter(100, 60000); // 100 req/min

// Ajusta limites
const customLimiter = new RateLimiter(1000, 60000); // 1000 req/min

// Ou implementa backoff
async function encryptWithRetry(options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await encryptFile(options);
    } catch (error) {
      if (error.message.includes('Rate limit')) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Backoff exponencial
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

### "Path traversal detectado"

**Sintomas:**
```
SecurityError: Path traversal detectado
```

**Causa:** Caminho contém `..`

**Solução:**
```javascript
import { resolve, normalize } from 'path';

// Sanitiza caminho
function sanitizePath(userPath, baseDir = '/safe/directory') {
  const normalized = normalize(userPath);
  const resolved = resolve(baseDir, normalized);
  
  // Verifica que está dentro do baseDir
  if (!resolved.startsWith(baseDir)) {
    throw new Error('Invalid path');
  }
  
  return resolved;
}

const safePath = sanitizePath(userInput);
```

---

## 🔄 Problemas de Streaming

### Stream trava/não progride

**Diagnóstico:**
```javascript
import { pipeline } from 'stream/promises';

const inputStream = fs.createReadStream('video.mp4');
const encStream = new EncryptionStream(videoKey, videoId);

// Monitora eventos
inputStream.on('data', () => console.log('Input: data'));
inputStream.on('end', () => console.log('Input: end'));
inputStream.on('error', (e) => console.log('Input error:', e));

encStream.on('data', () => console.log('Enc: data'));
encStream.on('end', () => console.log('Enc: end'));
encStream.on('error', (e) => console.log('Enc error:', e));
```

**Soluções:**

1. **Backpressure issue**
   ```javascript
   // Ajusta highWaterMark
   const inputStream = fs.createReadStream('video.mp4', {
     highWaterMark: 64 * 1024 // 64KB
   });
   ```

2. **Stream não finalizado**
   ```javascript
   // Sempre use pipeline
   await pipeline(
     inputStream,
     encryptionStream,
     outputStream
   ); // Garante cleanup
   ```

---

## 🧪 Debugging Avançado

### Habilita debug logs

```javascript
// Define variável de ambiente
process.env.DEBUG = 'video-crypto:*';

// Ou use logger com nível debug
import pino from 'pino';

const logger = pino({ level: 'debug' });
```

### Trace completo de execução

```javascript
import { createHook } from 'async_hooks';

const hook = createHook({
  init(asyncId, type, triggerAsyncId) {
    console.log(`Init: ${type} (${asyncId})`);
  },
  before(asyncId) {
    console.log(`Before: ${asyncId}`);
  },
  after(asyncId) {
    console.log(`After: ${asyncId}`);
  }
});

hook.enable();

// Seu código aqui
await encryptFile({ ... });

hook.disable();
```

### Dump de chunk corrompido

```javascript
function dumpChunk(chunkBuffer) {
  console.log('Chunk size:', chunkBuffer.length);
  console.log('Index:', chunkBuffer.readUInt32BE(0));
  console.log('IV (hex):', chunkBuffer.slice(4, 16).toString('hex'));
  console.log('Tag (hex):', chunkBuffer.slice(16, 32).toString('hex'));
  console.log('Ciphertext (first 32 bytes):',
    chunkBuffer.slice(32, 64).toString('hex')
  );
}

// Lê e analisa
const chunk = fs.readFileSync('suspicious-chunk.bin');
dumpChunk(chunk);
```

---

## 📞 Quando Escalar para Suporte

### Colete estas informações:

1. **Versão do sistema**
   ```javascript
   import { version } from './package.json';
   console.log('Version:', version);
   console.log('Node:', process.version);
   console.log('Platform:', process.platform);
   ```

2. **Stack trace completo**
   ```javascript
   try {
     await operation();
   } catch (error) {
     console.error('Message:', error.message);
     console.error('Stack:', error.stack);
     console.error('Code:', error.code);
   }
   ```

3. **Configuração (sem dados sensíveis)**
   ```javascript
   console.log({
     chunkSize: options.chunkSize,
     encoding: options.encoding,
     fileSize: stats.size,
     // NÃO inclua: masterKey, videoKey, etc.
   });
   ```

4. **Logs relevantes**
   ```bash
   # Últimos 100 logs
   tail -n 100 app.log > debug-logs.txt
   ```

---

## 🔧 Ferramentas de Diagnóstico

### Script de Health Check

```javascript
import { encryptBuffer, decryptBuffer, generateMasterKey } from '@kitsuneislife/keyring-vcm';

async function healthCheck() {
  const tests = [];

  // Teste 1: Geração de chave
  tests.push({
    name: 'Generate Key',
    fn: () => {
      const key = generateMasterKey();
      if (key.length !== 32) throw new Error('Invalid key size');
    }
  });

  // Teste 2: Encrypt/Decrypt
  tests.push({
    name: 'Encrypt/Decrypt',
    fn: async () => {
      const data = Buffer.from('test data');
      const key = generateMasterKey();
      
      const encrypted = await encryptBuffer({
        data,
        masterKey: key,
        videoId: 'test'
      });
      
      const decrypted = await decryptBuffer({
        chunks: encrypted,
        masterKey: key,
        videoId: 'test'
      });
      
      if (Buffer.compare(data, decrypted) !== 0) {
        throw new Error('Data mismatch');
      }
    }
  });

  // Executa testes
  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.name}`);
    } catch (error) {
      console.error(`❌ ${test.name}:`, error.message);
    }
  }
}

healthCheck();
```

---

## 📚 Recursos Adicionais

- [Documentação da API](./API.md)
- [Especificações Criptográficas](./CRYPTO.md)
- [Guia de Deploy](./DEPLOYMENT.md)
- [Issues no GitHub](https://github.com/your-repo/issues)

---

**Versão:** 1.0.0  
**Última atualização:** 2024-12-15
