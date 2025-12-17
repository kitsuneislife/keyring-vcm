# Guia de Deploy e Produção

## 🚀 Preparação para Produção

### Checklist Pré-Deploy

- [ ] Testes completos executados (`npm test`)
- [ ] Master key gerada e armazenada com segurança
- [ ] Variáveis de ambiente configuradas
- [ ] Limites de rate limiting definidos
- [ ] Monitoramento configurado
- [ ] Logs estruturados implementados
- [ ] Plano de backup definido
- [ ] Documentação atualizada

---

## 🔐 Gestão de Chaves em Produção

### Opção 1: Variáveis de Ambiente

**Desenvolvimento/Staging:**

```bash
# .env (NUNCA commite este arquivo)
MASTER_KEY=a1b2c3d4e5f6...

# Em produção, use secrets management do provider
```

**Código:**
```javascript
import { importMasterKey } from 'video-chunk-crypto';

const masterKey = importMasterKey(process.env.MASTER_KEY);
```

### Opção 2: AWS KMS

```javascript
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';

async function getMasterKey() {
  const client = new KMSClient({ region: 'us-east-1' });
  
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(encryptedMasterKey, 'base64')
  });
  
  const response = await client.send(command);
  return response.Plaintext;
}

const masterKey = await getMasterKey();
```

### Opção 3: HashiCorp Vault

```javascript
import vault from 'node-vault';

async function getMasterKey() {
  const client = vault({
    apiVersion: 'v1',
    endpoint: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN
  });
  
  const result = await client.read('secret/data/master-key');
  return Buffer.from(result.data.data.key, 'hex');
}
```

### Opção 4: Google Cloud KMS

```javascript
import { KeyManagementServiceClient } from '@google-cloud/kms';

async function getMasterKey() {
  const client = new KeyManagementServiceClient();
  
  const name = client.cryptoKeyPath(
    projectId,
    locationId,
    keyRingId,
    cryptoKeyId
  );
  
  const [result] = await client.decrypt({
    name,
    ciphertext: encryptedMasterKey
  });
  
  return result.plaintext;
}
```

---

## 🏗️ Arquitetura de Deploy

### Arquitetura Básica

```
┌──────────────┐
│   Client     │
└──────┬───────┘
       │ HTTPS
       ↓
┌──────────────┐
│ Load Balancer│
└──────┬───────┘
       │
   ┌───┴───┐
   ↓       ↓
┌─────┐ ┌─────┐
│ API │ │ API │  ← Video Chunk Crypto
│ Node│ │ Node│
└──┬──┘ └──┬──┘
   │       │
   └───┬───┘
       ↓
┌──────────────┐
│  S3/Blob     │  ← Encrypted chunks
│  Storage     │
└──────────────┘
```

### Arquitetura Escalável

```
┌──────────┐
│ Client   │
└────┬─────┘
     │
     ↓
┌──────────┐      ┌──────────────┐
│   CDN    │──────│ Encrypted    │
│          │      │ Chunks Cache │
└────┬─────┘      └──────────────┘
     │
     ↓
┌──────────┐      ┌──────────────┐
│   WAF    │──────│ Rate Limiter │
└────┬─────┘      └──────────────┘
     │
     ↓
┌──────────┐      ┌──────────────┐
│   API    │──────│ KMS/Vault    │
│ Gateway  │      │ (Master Key) │
└────┬─────┘      └──────────────┘
     │
     ↓
┌──────────────────────────────┐
│   Worker Pool (Crypto)       │
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │Node │ │Node │ │Node │   │
│  └─────┘ └─────┘ └─────┘   │
└────┬─────────────────────────┘
     │
     ↓
┌──────────────────────────────┐
│  Distributed Storage         │
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ S3  │ │Azure│ │ GCS │   │
│  └─────┘ └─────┘ └─────┘   │
└──────────────────────────────┘
```

---

## 🐳 Docker

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copia apenas package.json primeiro (cache)
COPY package*.json ./

# Instala dependências (nenhuma externa!)
RUN npm ci --only=production

# Copia código
COPY src/ ./src/

# Cria usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expõe porta (se for API)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node healthcheck.js || exit 1

CMD ["node", "src/index.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  video-crypto:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MASTER_KEY=${MASTER_KEY}
    volumes:
      - ./storage:/app/storage
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

---

## ☸️ Kubernetes

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: video-crypto
spec:
  replicas: 3
  selector:
    matchLabels:
      app: video-crypto
  template:
    metadata:
      labels:
        app: video-crypto
    spec:
      containers:
      - name: video-crypto
        image: your-registry/video-crypto:1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: MASTER_KEY
          valueFrom:
            secretKeyRef:
              name: video-crypto-secrets
              key: master-key
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: video-crypto-secrets
type: Opaque
stringData:
  master-key: "your-master-key-hex-here"
```

---

## 🔧 Configuração por Ambiente

### development.js

```javascript
export default {
  masterKey: process.env.DEV_MASTER_KEY,
  chunkSize: 512 * 1024,
  storage: {
    type: 'local',
    path: './dev-storage'
  },
  rateLimit: {
    maxRequests: 1000,
    windowMs: 60000
  },
  logging: {
    level: 'debug'
  }
};
```

### production.js

```javascript
export default {
  masterKey: process.env.MASTER_KEY, // De KMS/Vault
  chunkSize: 512 * 1024,
  storage: {
    type: 's3',
    bucket: process.env.S3_BUCKET,
    region: process.env.AWS_REGION
  },
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000
  },
  logging: {
    level: 'info',
    format: 'json'
  },
  monitoring: {
    enabled: true,
    metrics: ['throughput', 'errors', 'latency']
  }
};
```

---

## 📊 Monitoramento

### Métricas Essenciais

```javascript
import { Counter, Histogram, Gauge } from 'prom-client';

// Contador de operações
const encryptionCounter = new Counter({
  name: 'video_crypto_encryptions_total',
  help: 'Total de encriptações',
  labelNames: ['status']
});

// Latência
const encryptionDuration = new Histogram({
  name: 'video_crypto_encryption_duration_seconds',
  help: 'Duração da encriptação',
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

// Chunks em processamento
const activeChunks = new Gauge({
  name: 'video_crypto_active_chunks',
  help: 'Chunks sendo processados'
});

// Uso
async function encryptWithMetrics(options) {
  const start = Date.now();
  activeChunks.inc();
  
  try {
    const result = await encryptFile(options);
    encryptionCounter.inc({ status: 'success' });
    return result;
  } catch (error) {
    encryptionCounter.inc({ status: 'error' });
    throw error;
  } finally {
    activeChunks.dec();
    const duration = (Date.now() - start) / 1000;
    encryptionDuration.observe(duration);
  }
}
```

### Dashboard Grafana

```json
{
  "dashboard": {
    "title": "Video Crypto Metrics",
    "panels": [
      {
        "title": "Encryptions/sec",
        "targets": [
          {
            "expr": "rate(video_crypto_encryptions_total[1m])"
          }
        ]
      },
      {
        "title": "P95 Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, video_crypto_encryption_duration_seconds)"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(video_crypto_encryptions_total{status=\"error\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

---

## 📝 Logging

### Structured Logging

```javascript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  redact: {
    paths: ['masterKey', 'videoKey', '*.masterKey', '*.videoKey'],
    censor: '[REDACTED]'
  }
});

// Uso
logger.info({ videoId, chunks: 10 }, 'Encryption started');
logger.error({ videoId, error: err.message }, 'Encryption failed');
logger.debug({ videoId, chunkIndex: 5 }, 'Chunk encrypted');
```

### Log Correlation

```javascript
import { randomUUID } from 'crypto';

class EncryptionSession {
  constructor(videoId) {
    this.sessionId = randomUUID();
    this.videoId = videoId;
    this.startTime = Date.now();
  }

  log(level, message, data = {}) {
    logger[level]({
      sessionId: this.sessionId,
      videoId: this.videoId,
      duration: Date.now() - this.startTime,
      ...data
    }, message);
  }
}

// Uso
const session = new EncryptionSession('video-123');
session.log('info', 'Started encryption');
session.log('info', 'Completed', { chunks: 100 });
```

---

## 🔒 Hardening de Segurança

### 1. Restrições de Rede

```javascript
// Firewall rules (iptables example)
// Apenas HTTPS
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j DROP

// Rate limiting no nginx
limit_req_zone $binary_remote_addr zone=crypto:10m rate=10r/s;

server {
  location /api/encrypt {
    limit_req zone=crypto burst=20 nodelay;
    proxy_pass http://backend;
  }
}
```

### 2. Filesystem

```bash
# Permissões estritas
chmod 600 storage/encrypted/*
chown app:app storage/encrypted

# Montagem read-only onde possível
mount -o ro /mnt/input
```

### 3. Process Isolation

```javascript
// PM2 ecosystem.config.js
module.exports = {
  apps: [{
    name: 'video-crypto',
    script: './src/index.js',
    instances: 4,
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    // Isolamento
    uid: 'app',
    gid: 'app',
    // Restart em caso de crash
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

---

## 🔄 Rotação de Chaves

### Processo

```javascript
async function rotateKeys(oldMasterKey, newMasterKey) {
  const videos = await getAllVideoIds();
  
  logger.info({ total: videos.length }, 'Starting key rotation');
  
  for (const videoId of videos) {
    try {
      // 1. Decripta com chave antiga
      await decryptFile({
        inputPath: `encrypted/${videoId}.enc`,
        outputPath: `temp/${videoId}.mp4`,
        masterKey: oldMasterKey,
        videoId
      });
      
      // 2. Re-encripta com chave nova
      await encryptFile({
        inputPath: `temp/${videoId}.mp4`,
        outputPath: `encrypted/${videoId}.new.enc`,
        masterKey: newMasterKey,
        videoId
      });
      
      // 3. Substitui arquivo antigo
      await fs.rename(
        `encrypted/${videoId}.new.enc`,
        `encrypted/${videoId}.enc`
      );
      
      // 4. Remove temporário
      await fs.unlink(`temp/${videoId}.mp4`);
      
      logger.info({ videoId }, 'Rotated successfully');
      
    } catch (error) {
      logger.error({ videoId, error: error.message }, 'Rotation failed');
    }
  }
}
```

---

## 📦 Backup e Recuperação

### Estratégia de Backup

```javascript
// 1. Backup da master key (CRÍTICO)
// Múltiplas cópias em locais seguros
await saveToVault(masterKey, 'primary');
await saveToVault(masterKey, 'secondary');
await saveToVault(masterKey, 'offline-backup');

// 2. Backup dos arquivos criptografados
// S3 com versionamento
aws s3 sync ./encrypted s3://backup-bucket/encrypted \
  --storage-class GLACIER

// 3. Backup dos manifests
await backupManifests();
```

### Teste de Recuperação

```bash
#!/bin/bash
# disaster-recovery-test.sh

# 1. Simula perda de dados
rm -rf ./encrypted/*

# 2. Restaura do backup
aws s3 sync s3://backup-bucket/encrypted ./encrypted

# 3. Recupera master key do vault
MASTER_KEY=$(vault read -field=key secret/master-key)

# 4. Testa descriptografia
node test-decrypt.js

# 5. Valida integridade
node verify-integrity.js
```

---

## 🚨 Resposta a Incidentes

### Plano de Ação

1. **Detecção**
   ```javascript
   // Alerta automático
   if (errorRate > 0.01) {
     alert.critical('High decryption error rate');
   }
   ```

2. **Contenção**
   ```bash
   # Bloqueia novos uploads
   kubectl scale deployment video-crypto --replicas=0
   
   # Analisa logs
   kubectl logs -l app=video-crypto --tail=1000
   ```

3. **Investigação**
   ```javascript
   // Audit log
   const suspiciousActivity = await queryLogs({
     timeRange: 'last-1h',
     filters: {
       errorType: 'authentication-failure',
       count: { gt: 10 }
     }
   });
   ```

4. **Recuperação**
   ```bash
   # Rotaciona chaves se comprometidas
   npm run rotate-keys
   
   # Re-deploy
   kubectl rollout restart deployment/video-crypto
   ```

---

## 📈 Otimizações de Performance

### Worker Threads

```javascript
import { Worker } from 'worker_threads';

class EncryptionWorkerPool {
  constructor(size = 4) {
    this.workers = [];
    this.queue = [];
    
    for (let i = 0; i < size; i++) {
      this.workers.push(new Worker('./crypto-worker.js'));
    }
  }

  async encrypt(options) {
    const worker = await this.getAvailableWorker();
    return new Promise((resolve, reject) => {
      worker.once('message', resolve);
      worker.once('error', reject);
      worker.postMessage({ action: 'encrypt', options });
    });
  }
}
```

### Caching

```javascript
import NodeCache from 'node-cache';

const videoKeyCache = new NodeCache({
  stdTTL: 3600, // 1 hora
  maxKeys: 1000
});

function getCachedVideoKey(masterKey, videoId) {
  const cacheKey = `${videoId}`;
  
  let videoKey = videoKeyCache.get(cacheKey);
  
  if (!videoKey) {
    videoKey = deriveVideoKey(masterKey, videoId);
    videoKeyCache.set(cacheKey, videoKey);
  }
  
  return videoKey;
}
```

---

## ✅ Checklist de Go-Live

### Pré-produção

- [ ] Testes de carga executados
- [ ] Limites de recursos definidos
- [ ] Alertas configurados
- [ ] Runbooks criados
- [ ] Equipe treinada

### Produção

- [ ] Deploy gradual (canary)
- [ ] Monitoramento ativo
- [ ] Logs sendo coletados
- [ ] Backups automatizados
- [ ] Plano de rollback pronto

### Pós-deploy

- [ ] Verificação de métricas
- [ ] Testes de sanidade
- [ ] Documentação atualizada
- [ ] Postmortem (se issues)

---

**Versão:** 1.0.0  
**Última atualização:** 2024-12-15
