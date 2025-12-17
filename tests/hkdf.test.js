import { test } from 'node:test';
import assert from 'node:assert';
import {
  generateMasterKey,
  deriveVideoKey,
  exportMasterKey,
  importMasterKey
} from '../src/utils/hkdf.js';
import { CONFIG } from '../src/config.js';

test('HKDF - generateMasterKey deve gerar 32 bytes', () => {
  const key = generateMasterKey();
  assert.strictEqual(key.length, CONFIG.CRYPTO.KEY_LENGTH);
  assert.ok(Buffer.isBuffer(key));
});

test('HKDF - deriveVideoKey deve derivar chave determinística', () => {
  const masterKey = generateMasterKey();
  const videoId = 'video-123';

  const key1 = deriveVideoKey(masterKey, videoId);
  const key2 = deriveVideoKey(masterKey, videoId);

  assert.strictEqual(key1.length, CONFIG.CRYPTO.KEY_LENGTH);
  assert.deepStrictEqual(key1, key2, 'Chaves derivadas devem ser iguais');
});

test('HKDF - videoIds diferentes devem gerar chaves diferentes', () => {
  const masterKey = generateMasterKey();

  const key1 = deriveVideoKey(masterKey, 'video-1');
  const key2 = deriveVideoKey(masterKey, 'video-2');

  assert.notDeepStrictEqual(key1, key2, 'Chaves devem ser diferentes');
});

test('HKDF - masterKeys diferentes devem gerar chaves diferentes', () => {
  const masterKey1 = generateMasterKey();
  const masterKey2 = generateMasterKey();
  const videoId = 'video-123';

  const key1 = deriveVideoKey(masterKey1, videoId);
  const key2 = deriveVideoKey(masterKey2, videoId);

  assert.notDeepStrictEqual(key1, key2, 'Chaves devem ser diferentes');
});

test('HKDF - export/import deve ser reversível', () => {
  const original = generateMasterKey();
  const exported = exportMasterKey(original);
  const imported = importMasterKey(exported);

  assert.deepStrictEqual(original, imported);
});

test('HKDF - deriveVideoKey deve validar masterKey', () => {
  assert.throws(
    () => deriveVideoKey(Buffer.alloc(16), 'video-123'),
    /Master key deve ter 32 bytes/
  );
});

test('HKDF - deriveVideoKey deve validar videoId', () => {
  const masterKey = generateMasterKey();

  assert.throws(
    () => deriveVideoKey(masterKey, ''),
    /Video ID deve ser uma string não vazia/
  );

  assert.throws(
    () => deriveVideoKey(masterKey, null),
    /Video ID deve ser uma string não vazia/
  );
});
