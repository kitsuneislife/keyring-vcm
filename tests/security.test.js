import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import {
  ValidationError,
  SecurityError,
  validateMasterKey,
  validateVideoId,
  validateChunkSize,
  validateChunkIndex,
  validateBuffer,
  validateEncoding,
  sanitizeVideoId,
  validateFilePath,
  constantTimeCompare,
  randomDelay,
  secureWipe,
  RateLimiter
} from '../src/utils/security.js';

test('ValidationError - deve criar erro customizado', () => {
  const error = new ValidationError('Test message', 'testField');
  
  assert.ok(error instanceof Error);
  assert.ok(error instanceof ValidationError);
  assert.strictEqual(error.message, 'Test message');
  assert.strictEqual(error.field, 'testField');
  assert.strictEqual(error.name, 'ValidationError');
});

test('SecurityError - deve criar erro de segurança', () => {
  const error = new SecurityError('Security issue', 'TEST_CODE');
  
  assert.ok(error instanceof Error);
  assert.ok(error instanceof SecurityError);
  assert.strictEqual(error.message, 'Security issue');
  assert.strictEqual(error.code, 'TEST_CODE');
  assert.strictEqual(error.name, 'SecurityError');
});

test('validateMasterKey - deve aceitar chave válida', () => {
  const validKey = crypto.randomBytes(32);
  assert.doesNotThrow(() => validateMasterKey(validKey));
});

test('validateMasterKey - deve rejeitar chave nula', () => {
  assert.throws(
    () => validateMasterKey(null),
    /Master key é obrigatória/
  );
});

test('validateMasterKey - deve rejeitar não-buffer', () => {
  assert.throws(
    () => validateMasterKey('not a buffer'),
    /Master key deve ser um Buffer/
  );
});

test('validateMasterKey - deve rejeitar tamanho incorreto', () => {
  assert.throws(
    () => validateMasterKey(Buffer.alloc(16)),
    /Master key deve ter exatamente 32 bytes/
  );

  assert.throws(
    () => validateMasterKey(Buffer.alloc(64)),
    /Master key deve ter exatamente 32 bytes/
  );
});

test('validateMasterKey - deve rejeitar chave vazia (todos zeros)', () => {
  const emptyKey = Buffer.alloc(32, 0);
  assert.throws(
    () => validateMasterKey(emptyKey),
    /Master key não pode ser vazia/
  );
});

test('validateMasterKey - deve rejeitar baixa entropia', () => {
  // Chave com apenas 10 bytes únicos
  const lowEntropyKey = Buffer.alloc(32, 0);
  for (let i = 0; i < 10; i++) {
    lowEntropyKey[i] = i;
  }
  
  assert.throws(
    () => validateMasterKey(lowEntropyKey),
    /entropia insuficiente/
  );
});

test('validateVideoId - deve aceitar ID válido', () => {
  assert.doesNotThrow(() => validateVideoId('video-123'));
  assert.doesNotThrow(() => validateVideoId('a'));
  assert.doesNotThrow(() => validateVideoId('test_video:v1.0'));
  assert.doesNotThrow(() => validateVideoId('ABC-123_test:v2.final'));
});

test('validateVideoId - deve rejeitar ID vazio ou nulo', () => {
  assert.throws(() => validateVideoId(''), /Video ID é obrigatório/);
  assert.throws(() => validateVideoId(null), /Video ID é obrigatório/);
  assert.throws(() => validateVideoId(undefined), /Video ID é obrigatório/);
});

test('validateVideoId - deve rejeitar não-string', () => {
  assert.throws(
    () => validateVideoId(123),
    /Video ID deve ser uma string/
  );
});

test('validateVideoId - deve rejeitar ID muito longo', () => {
  const longId = 'a'.repeat(257);
  assert.throws(
    () => validateVideoId(longId),
    /não pode exceder 256 caracteres/
  );
});

test('validateVideoId - deve rejeitar caracteres inválidos', () => {
  assert.throws(() => validateVideoId('test@video'), /caracteres inválidos/);
  assert.throws(() => validateVideoId('test#123'), /caracteres inválidos/);
  assert.throws(() => validateVideoId('test/video'), /caracteres inválidos/);
  assert.throws(() => validateVideoId('test\\video'), /caracteres inválidos/);
  assert.throws(() => validateVideoId('test video'), /caracteres inválidos/);
});

test('validateChunkSize - deve aceitar tamanhos válidos', () => {
  assert.doesNotThrow(() => validateChunkSize(1024));
  assert.doesNotThrow(() => validateChunkSize(524288));
  assert.doesNotThrow(() => validateChunkSize(1048576));
});

test('validateChunkSize - deve rejeitar não-inteiro', () => {
  assert.throws(() => validateChunkSize(1024.5), /deve ser um número inteiro/);
  assert.throws(() => validateChunkSize('1024'), /deve ser um número inteiro/);
});

test('validateChunkSize - deve rejeitar tamanho muito pequeno', () => {
  assert.throws(
    () => validateChunkSize(512),
    /deve ser no mínimo 1024 bytes/
  );
});

test('validateChunkSize - deve rejeitar tamanho muito grande', () => {
  assert.throws(
    () => validateChunkSize(10 * 1024 * 1024 + 1),
    /não pode exceder/
  );
});

test('validateChunkIndex - deve aceitar índices válidos', () => {
  assert.doesNotThrow(() => validateChunkIndex(0));
  assert.doesNotThrow(() => validateChunkIndex(100));
  assert.doesNotThrow(() => validateChunkIndex(50000));
});

test('validateChunkIndex - deve rejeitar não-inteiro', () => {
  assert.throws(() => validateChunkIndex(10.5), /deve ser um número inteiro/);
  assert.throws(() => validateChunkIndex('10'), /deve ser um número inteiro/);
});

test('validateChunkIndex - deve rejeitar índice negativo', () => {
  assert.throws(() => validateChunkIndex(-1), /não pode ser negativo/);
  assert.throws(() => validateChunkIndex(-100), /não pode ser negativo/);
});

test('validateChunkIndex - deve rejeitar índice maior que uint32', () => {
  assert.throws(
    () => validateChunkIndex(0xFFFFFFFF + 1),
    /excede uint32 máximo/
  );
});

test('validateChunkIndex - deve rejeitar índice acima do limite de segurança', () => {
  assert.throws(
    () => validateChunkIndex(100001),
    /excede o limite de segurança/
  );
});

test('validateBuffer - deve aceitar buffer válido', () => {
  const buffer = Buffer.from('test data');
  assert.doesNotThrow(() => validateBuffer(buffer));
  assert.doesNotThrow(() => validateBuffer(buffer, 'customField'));
});

test('validateBuffer - deve rejeitar buffer nulo', () => {
  assert.throws(() => validateBuffer(null), /buffer é obrigatório/);
  assert.throws(() => validateBuffer(null, 'myBuffer'), /myBuffer é obrigatório/);
});

test('validateBuffer - deve rejeitar não-buffer', () => {
  assert.throws(() => validateBuffer('not a buffer'), /deve ser um Buffer/);
  assert.throws(() => validateBuffer([1, 2, 3]), /deve ser um Buffer/);
});

test('validateBuffer - deve rejeitar buffer vazio', () => {
  assert.throws(() => validateBuffer(Buffer.alloc(0)), /não pode estar vazio/);
});

test('validateEncoding - deve aceitar encodings válidos', () => {
  assert.doesNotThrow(() => validateEncoding('binary'));
  assert.doesNotThrow(() => validateEncoding('base64'));
  assert.doesNotThrow(() => validateEncoding('hex'));
  assert.doesNotThrow(() => validateEncoding(undefined)); // Optional
  assert.doesNotThrow(() => validateEncoding(null)); // Optional
});

test('validateEncoding - deve rejeitar não-string', () => {
  assert.throws(() => validateEncoding(123), /deve ser uma string/);
  assert.throws(() => validateEncoding({}), /deve ser uma string/);
});

test('validateEncoding - deve rejeitar encoding inválido', () => {
  assert.throws(() => validateEncoding('utf8'), /Encoding inválido/);
  assert.throws(() => validateEncoding('ascii'), /Encoding inválido/);
  assert.throws(() => validateEncoding('invalid'), /Encoding inválido/);
});

test('sanitizeVideoId - deve remover caracteres perigosos', () => {
  assert.strictEqual(sanitizeVideoId('test@video#123'), 'testvideo123');
  assert.strictEqual(sanitizeVideoId('video/test\\name'), 'videotestname');
  assert.strictEqual(sanitizeVideoId('test video name'), 'testvideoname');
  assert.strictEqual(sanitizeVideoId('valid-video_123:v1.0'), 'valid-video_123:v1.0');
});

test('sanitizeVideoId - deve lidar com entrada não-string', () => {
  assert.strictEqual(sanitizeVideoId(123), '');
  assert.strictEqual(sanitizeVideoId(null), '');
  assert.strictEqual(sanitizeVideoId(undefined), '');
  assert.strictEqual(sanitizeVideoId({}), '');
});

test('validateFilePath - deve aceitar caminhos válidos', () => {
  assert.doesNotThrow(() => validateFilePath('/path/to/file.txt'));
  assert.doesNotThrow(() => validateFilePath('relative/path/file.bin'));
  assert.doesNotThrow(() => validateFilePath('C:\\Users\\test\\file.mp4'));
});

test('validateFilePath - deve rejeitar caminho vazio', () => {
  assert.throws(() => validateFilePath(''), /filePath é obrigatório/);
  assert.throws(() => validateFilePath(null), /filePath é obrigatório/);
  assert.throws(() => validateFilePath(null, 'customPath'), /customPath é obrigatório/);
});

test('validateFilePath - deve rejeitar não-string', () => {
  assert.throws(() => validateFilePath(123), /deve ser uma string/);
  assert.throws(() => validateFilePath(['path']), /deve ser uma string/);
});

test('validateFilePath - deve detectar path traversal', () => {
  assert.throws(() => validateFilePath('../../../etc/passwd'), /Path traversal detectado/);
  assert.throws(() => validateFilePath('path/../../../secret'), /Path traversal detectado/);
  assert.throws(() => validateFilePath('..\\..\\windows\\system32'), /Path traversal detectado/);
});

test('validateFilePath - deve rejeitar caminho muito longo', () => {
  const longPath = 'a/'.repeat(3000);
  assert.throws(() => validateFilePath(longPath), /muito longo/);
});

test('constantTimeCompare - deve comparar buffers iguais corretamente', () => {
  const buf1 = Buffer.from('test data');
  const buf2 = Buffer.from('test data');
  assert.strictEqual(constantTimeCompare(buf1, buf2), true);
});

test('constantTimeCompare - deve detectar buffers diferentes', () => {
  const buf1 = Buffer.from('test data');
  const buf2 = Buffer.from('different');
  assert.strictEqual(constantTimeCompare(buf1, buf2), false);
});

test('constantTimeCompare - deve rejeitar tamanhos diferentes', () => {
  const buf1 = Buffer.from('short');
  const buf2 = Buffer.from('much longer buffer');
  assert.strictEqual(constantTimeCompare(buf1, buf2), false);
});

test('constantTimeCompare - deve rejeitar não-buffers', () => {
  assert.strictEqual(constantTimeCompare('string', Buffer.from('test')), false);
  assert.strictEqual(constantTimeCompare(Buffer.from('test'), 'string'), false);
  assert.strictEqual(constantTimeCompare('string', 'string'), false);
});

test('randomDelay - deve retornar promise', async () => {
  const start = Date.now();
  await randomDelay(5, 15);
  const elapsed = Date.now() - start;
  
  assert.ok(elapsed >= 5);
  assert.ok(elapsed < 50); // Margem generosa
});

test('randomDelay - deve usar valores padrão', async () => {
  const start = Date.now();
  await randomDelay();
  const elapsed = Date.now() - start;
  
  assert.ok(elapsed >= 10);
  assert.ok(elapsed < 100);
});

test('secureWipe - deve limpar buffer', () => {
  const buffer = Buffer.from('sensitive data');
  secureWipe(buffer);
  
  assert.ok(buffer.every(byte => byte === 0));
});

test('secureWipe - deve lidar com não-buffer', () => {
  assert.doesNotThrow(() => secureWipe('not a buffer'));
  assert.doesNotThrow(() => secureWipe(null));
  assert.doesNotThrow(() => secureWipe(undefined));
});

test('RateLimiter - deve permitir requests dentro do limite', () => {
  const limiter = new RateLimiter(3, 1000);
  
  assert.strictEqual(limiter.check('user1'), true);
  assert.strictEqual(limiter.check('user1'), true);
  assert.strictEqual(limiter.check('user1'), true);
});

test('RateLimiter - deve bloquear após exceder limite', () => {
  const limiter = new RateLimiter(2, 1000);
  
  assert.strictEqual(limiter.check('user2'), true);
  assert.strictEqual(limiter.check('user2'), true);
  assert.strictEqual(limiter.check('user2'), false); // Excedeu
  assert.strictEqual(limiter.check('user2'), false); // Continua bloqueado
});

test('RateLimiter - deve separar diferentes chaves', () => {
  const limiter = new RateLimiter(2, 1000);
  
  assert.strictEqual(limiter.check('userA'), true);
  assert.strictEqual(limiter.check('userA'), true);
  assert.strictEqual(limiter.check('userA'), false); // userA bloqueado
  
  assert.strictEqual(limiter.check('userB'), true); // userB ainda ok
  assert.strictEqual(limiter.check('userB'), true);
});

test('RateLimiter - deve resetar após janela', async () => {
  const limiter = new RateLimiter(2, 50); // 50ms window
  
  assert.strictEqual(limiter.check('user3'), true);
  assert.strictEqual(limiter.check('user3'), true);
  assert.strictEqual(limiter.check('user3'), false);
  
  // Aguarda janela expirar
  await new Promise(resolve => setTimeout(resolve, 60));
  
  assert.strictEqual(limiter.check('user3'), true); // Reset
});

test('RateLimiter - reset deve limpar chave específica', () => {
  const limiter = new RateLimiter(1, 1000);
  
  assert.strictEqual(limiter.check('user4'), true);
  assert.strictEqual(limiter.check('user4'), false);
  
  limiter.reset('user4');
  
  assert.strictEqual(limiter.check('user4'), true); // Resetado
});

test('RateLimiter - cleanup deve remover entradas expiradas', async () => {
  const limiter = new RateLimiter(5, 50);
  
  limiter.check('user5');
  limiter.check('user6');
  
  assert.strictEqual(limiter.requests.size, 2);
  
  await new Promise(resolve => setTimeout(resolve, 60));
  
  limiter.cleanup();
  
  assert.strictEqual(limiter.requests.size, 0);
});

test('RateLimiter - deve aceitar parâmetros customizados', () => {
  const limiter = new RateLimiter(10, 5000);
  
  assert.strictEqual(limiter.maxRequests, 10);
  assert.strictEqual(limiter.windowMs, 5000);
});
