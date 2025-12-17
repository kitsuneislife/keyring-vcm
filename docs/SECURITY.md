# Guia de Segurança e Boas Práticas

> ⚠️ **ATENÇÃO**: Este documento contém informações críticas de segurança.  
> Leia com atenção antes de usar o sistema em produção.

---

# Guia de Segurança

## 🔐 Melhores Práticas de Segurança

### 1. Gestão de Master Key

#### ✅ FAÇA

```javascript
// Em produção: use variáveis de ambiente
const masterKeyHex = process.env.MASTER_KEY;
const masterKey = importMasterKey(masterKeyHex);

// Ou use um KMS (AWS, GCP, Azure)
const masterKey = await kms.decrypt(encryptedMasterKey);

// Ou use um vault (HashiCorp Vault)
const masterKey = await vault.read('secret/master-key');
```

#### ❌ NÃO FAÇA

```javascript
// NUNCA hardcode a chave
const masterKey = Buffer.from('abc123...', 'hex'); // ❌

// NUNCA comite no repositório
const config = { masterKey: '...' }; // ❌

// NUNCA envie por HTTP sem TLS
fetch('http://...', { body: masterKey }); // ❌
```

### 2. Video IDs

#### ✅ FAÇA

```javascript
// Use UUIDs
import { randomUUID } from 'crypto';
const videoId = randomUUID(); // 'a1b2c3d4-...'

// Ou combine user + timestamp + random
const videoId = `user-${userId}-${Date.now()}-${randomBytes(8).toString('hex')}`;

// Valide antes de usar
if (!isValidVideoId(videoId)) {
  throw new Error('Invalid video ID');
}
```

#### ❌ NÃO FAÇA

```javascript
// IDs sequenciais (previsíveis)
const videoId = `video-${counter++}`; // ❌

// Dados sensíveis no ID
const videoId = `cpf-12345678900`; // ❌

// IDs reutilizados
const videoId = 'temp-video'; // ❌
```

### 3. Transmissão de Dados

#### ✅ FAÇA

```javascript
// Sempre use HTTPS/TLS
const response = await fetch('https://api.exemplo.com/upload', {
  method: 'POST',
  body: encryptedChunk,
  headers: {
    'Content-Type': 'application/octet-stream'
  }
});

// Com autenticação
headers: {
  'Authorization': `Bearer ${token}`,
  'X-Video-Id': videoId
}
```

### 4. Validação e Sanitização

```javascript
// Valide todos os inputs
function validateEncryptionParams(params) {
  if (!params.masterKey || params.masterKey.length !== 32) {
    throw new Error('Invalid master key');
  }
  
  if (!params.videoId || typeof params.videoId !== 'string') {
    throw new Error('Invalid video ID');
  }
  
  if (params.videoId.length > 255) {
    throw new Error('Video ID too long');
  }
  
  // Sanitize videoId (remover caracteres perigosos)
  const sanitizedId = params.videoId.replace(/[^a-zA-Z0-9\-_]/g, '');
  
  return { ...params, videoId: sanitizedId };
}
```

### 5. Tratamento de Erros

```javascript
// Não vaze informações sensíveis em erros
try {
  await decryptFile({ ... });
} catch (error) {
  // ❌ NÃO
  console.error('Decryption failed:', error, masterKey);
  
  // ✅ SIM
  console.error('Decryption failed for video:', videoId);
  logger.error('Decryption error', { videoId, error: error.message });
}

// Log seguro
function secureLog(message, data) {
  const sanitized = { ...data };
  delete sanitized.masterKey;
  delete sanitized.videoKey;
  console.log(message, sanitized);
}
```

### 6. Limpeza de Memória

```javascript
// Limpe buffers sensíveis após uso
function secureCleanup(buffer) {
  if (Buffer.isBuffer(buffer)) {
    buffer.fill(0);
  }
}

// Exemplo
let masterKey = generateMasterKey();
try {
  await encryptFile({ masterKey, ... });
} finally {
  secureCleanup(masterKey);
  masterKey = null;
}
```

## 🔒 Checklist de Segurança

### Antes de ir para produção:

- [ ] Master key armazenada em local seguro (KMS/Vault)
- [ ] Master key NUNCA commitada no código
- [ ] Video IDs são únicos e não previsíveis
- [ ] Toda comunicação usa HTTPS/TLS
- [ ] Logs não expõem chaves ou dados sensíveis
- [ ] Tratamento de erros não vaza informações
- [ ] Validação de todos os inputs
- [ ] Rate limiting implementado
- [ ] Monitoramento e alertas configurados
- [ ] Plano de rotação de chaves definido
- [ ] Backup seguro da master key
- [ ] Testes de segurança executados

## 🚨 Resposta a Incidentes

### Se a master key for comprometida:

1. **Rotação Imediata**
   ```javascript
   const newMasterKey = generateMasterKey();
   
   // Re-encriptar todos os vídeos
   for (const video of allVideos) {
     const decrypted = await decryptFile({
       masterKey: oldMasterKey,
       videoId: video.id,
       ...
     });
     
     await encryptFile({
       masterKey: newMasterKey,
       videoId: video.id,
       ...
     });
   }
   ```

2. **Auditoria**
   - Verificar logs de acesso
   - Identificar vídeos potencialmente comprometidos
   - Notificar usuários afetados

3. **Prevenção**
   - Revisar políticas de acesso
   - Atualizar procedimentos
   - Implementar controles adicionais

## 📊 Monitoramento

### Métricas de Segurança

```javascript
// Taxa de falhas de decriptação
const failureRate = failedDecryptions / totalDecryptions;
if (failureRate > 0.01) {
  alert('High decryption failure rate - possible attack');
}

// Tentativas de videoId inválido
if (invalidVideoIdAttempts > threshold) {
  alert('Multiple invalid video ID attempts from IP');
}

// Anomalias de uso
if (decryptionsPerMinute > normalRate * 10) {
  alert('Unusual decryption activity detected');
}
```

## 🔐 Conformidade

### GDPR

```javascript
// Direito ao esquecimento
async function deleteUserVideos(userId) {
  const videos = await getUserVideos(userId);
  
  for (const video of videos) {
    // Delete encrypted files
    await deleteFile(video.encryptedPath);
    
    // Delete metadata
    await deleteMetadata(video.id);
  }
  
  // Log deletion
  await auditLog('USER_DATA_DELETED', { userId });
}
```

### LGPD / Outras Regulações

- Mantenha logs de acesso por período definido
- Implemente controles de acesso baseados em função
- Documente processos de criptografia
- Realize auditorias periódicas

---

**Lembre-se: Segurança é um processo contínuo, não um estado final.**
