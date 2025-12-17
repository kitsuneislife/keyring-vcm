import { test } from 'node:test';
import assert from 'node:assert';
import { createAAD, validateAAD } from '../src/utils/aad.js';

test('AAD - deve criar AAD válido', () => {
  const aad = createAAD('video-123', 0);

  assert.ok(Buffer.isBuffer(aad));
  assert.strictEqual(aad.length, 32);
});

test('AAD - deve ser determinístico', () => {
  const aad1 = createAAD('video-123', 5);
  const aad2 = createAAD('video-123', 5);

  assert.deepStrictEqual(aad1, aad2);
});

test('AAD - videoIds diferentes devem gerar AADs diferentes', () => {
  const aad1 = createAAD('video-1', 0);
  const aad2 = createAAD('video-2', 0);

  assert.notDeepStrictEqual(aad1, aad2);
});

test('AAD - índices diferentes devem gerar AADs diferentes', () => {
  const aad1 = createAAD('video-123', 0);
  const aad2 = createAAD('video-123', 1);

  assert.notDeepStrictEqual(aad1, aad2);
});

test('AAD - deve validar videoId', () => {
  assert.throws(
    () => createAAD('', 0),
    /videoId deve ser uma string não vazia/
  );

  assert.throws(
    () => createAAD(null, 0),
    /videoId deve ser uma string não vazia/
  );
});

test('AAD - deve validar chunkIndex', () => {
  assert.throws(
    () => createAAD('video-123', -1),
    /chunkIndex deve ser uint32/
  );

  assert.throws(
    () => createAAD('video-123', 4294967296), // 2^32
    /chunkIndex deve ser uint32/
  );

  assert.throws(
    () => createAAD('video-123', 1.5),
    /chunkIndex deve ser uint32/
  );
});

test('AAD - validateAAD deve validar corretamente', () => {
  const validAAD = createAAD('video-123', 0);
  assert.strictEqual(validateAAD(validAAD), true);

  assert.strictEqual(validateAAD(Buffer.alloc(16)), false);
  assert.strictEqual(validateAAD(null), false);
  assert.strictEqual(validateAAD('string'), false);
});
