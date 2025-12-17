import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import {
  EncryptedChunk,
  encryptChunk,
  decryptChunk
} from '../src/core/chunk-crypto.js';
import { generateMasterKey, deriveVideoKey } from '../src/utils/hkdf.js';

test('EncryptedChunk - serialização/deserialização binária', () => {
  const chunk = new EncryptedChunk(
    5,
    crypto.randomBytes(12),
    crypto.randomBytes(16),
    Buffer.from('test data')
  );

  const buffer = chunk.toBuffer();
  const restored = EncryptedChunk.fromBuffer(buffer);

  assert.strictEqual(restored.index, chunk.index);
  assert.deepStrictEqual(restored.iv, chunk.iv);
  assert.deepStrictEqual(restored.tag, chunk.tag);
  assert.deepStrictEqual(restored.ciphertext, chunk.ciphertext);
});

test('EncryptedChunk - serialização/deserialização texto base64', () => {
  const chunk = new EncryptedChunk(
    10,
    crypto.randomBytes(12),
    crypto.randomBytes(16),
    Buffer.from('test data')
  );

  const text = chunk.toText('base64');
  const restored = EncryptedChunk.fromText(text, 'base64');

  assert.strictEqual(restored.index, chunk.index);
  assert.deepStrictEqual(restored.iv, chunk.iv);
  assert.deepStrictEqual(restored.tag, chunk.tag);
  assert.deepStrictEqual(restored.ciphertext, chunk.ciphertext);
});

test('Chunk Crypto - encriptação/decriptação básica', () => {
  const masterKey = generateMasterKey();
  const videoId = 'video-test';
  const videoKey = deriveVideoKey(masterKey, videoId);
  const plaintext = Buffer.from('Hello, World!');

  const encrypted = encryptChunk(plaintext, videoKey, videoId, 0);
  const decrypted = decryptChunk(encrypted, videoKey, videoId);

  assert.deepStrictEqual(decrypted, plaintext);
});

test('Chunk Crypto - chunks grandes (512KB)', () => {
  const masterKey = generateMasterKey();
  const videoId = 'video-large';
  const videoKey = deriveVideoKey(masterKey, videoId);
  const plaintext = crypto.randomBytes(512 * 1024);

  const encrypted = encryptChunk(plaintext, videoKey, videoId, 0);
  const decrypted = decryptChunk(encrypted, videoKey, videoId);

  assert.deepStrictEqual(decrypted, plaintext);
});

test('Chunk Crypto - IVs diferentes para chunks diferentes', () => {
  const masterKey = generateMasterKey();
  const videoId = 'video-test';
  const videoKey = deriveVideoKey(masterKey, videoId);
  const plaintext = Buffer.from('Same data');

  const chunk1 = encryptChunk(plaintext, videoKey, videoId, 0);
  const chunk2 = encryptChunk(plaintext, videoKey, videoId, 1);

  assert.notDeepStrictEqual(chunk1.iv, chunk2.iv, 'IVs devem ser diferentes');
  assert.notDeepStrictEqual(chunk1.ciphertext, chunk2.ciphertext, 'Ciphertexts devem ser diferentes');
});

test('Chunk Crypto - detecção de corrupção do ciphertext', () => {
  const masterKey = generateMasterKey();
  const videoId = 'video-test';
  const videoKey = deriveVideoKey(masterKey, videoId);
  const plaintext = Buffer.from('Test data');

  const encrypted = encryptChunk(plaintext, videoKey, videoId, 0);

  // Corrompe o ciphertext
  encrypted.ciphertext[0] ^= 0xFF;

  assert.throws(
    () => decryptChunk(encrypted, videoKey, videoId),
    /Falha na autenticação/
  );
});

test('Chunk Crypto - detecção de alteração do índice', () => {
  const masterKey = generateMasterKey();
  const videoId = 'video-test';
  const videoKey = deriveVideoKey(masterKey, videoId);
  const plaintext = Buffer.from('Test data');

  const encrypted = encryptChunk(plaintext, videoKey, videoId, 0);

  // Altera o índice
  encrypted.index = 1;

  assert.throws(
    () => decryptChunk(encrypted, videoKey, videoId),
    /Falha na autenticação/,
    'Deve detectar alteração do índice via AAD'
  );
});

test('Chunk Crypto - chave errada deve falhar', () => {
  const masterKey1 = generateMasterKey();
  const masterKey2 = generateMasterKey();
  const videoId = 'video-test';
  const videoKey1 = deriveVideoKey(masterKey1, videoId);
  const videoKey2 = deriveVideoKey(masterKey2, videoId);
  const plaintext = Buffer.from('Secret data');

  const encrypted = encryptChunk(plaintext, videoKey1, videoId, 0);

  assert.throws(
    () => decryptChunk(encrypted, videoKey2, videoId),
    /Falha na autenticação/
  );
});

test('Chunk Crypto - videoId errado deve falhar', () => {
  const masterKey = generateMasterKey();
  const videoKey = deriveVideoKey(masterKey, 'video-1');
  const plaintext = Buffer.from('Test data');

  const encrypted = encryptChunk(plaintext, videoKey, 'video-1', 0);

  assert.throws(
    () => decryptChunk(encrypted, videoKey, 'video-2'),
    /Falha na autenticação/,
    'VideoId diferente deve falhar via AAD'
  );
});
