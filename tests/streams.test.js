import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { Readable, Writable, pipeline } from 'stream';
import { EncryptionStream, ChunkSerializationStream, TextEncodingStream } from '../src/core/encryption-stream.js';
import { DecryptionStream, ChunkDeserializationStream, TextDecodingStream } from '../src/core/decryption-stream.js';
import { EncryptedChunk } from '../src/core/chunk-crypto.js';
import { generateMasterKey, deriveVideoKey } from '../src/utils/hkdf.js';

test('ChunkSerializationStream - deve rejeitar input não-EncryptedChunk', async () => {
  const serializationStream = new ChunkSerializationStream();
  
  await assert.rejects(
    async () => {
      await new Promise((resolve, reject) => {
        serializationStream.on('error', reject);
        serializationStream.on('finish', resolve);
        serializationStream.write({ invalid: 'object' });
        serializationStream.end();
      });
    },
    /Entrada deve ser EncryptedChunk/
  );
});

test('TextEncodingStream - deve codificar para base64', async () => {
  const encodingStream = new TextEncodingStream('base64');
  const chunks = [];

  encodingStream.on('data', chunk => chunks.push(chunk));
  
  encodingStream.write(Buffer.from('test data'));
  encodingStream.end();

  await new Promise(resolve => encodingStream.on('end', resolve));
  
  assert.ok(chunks.length > 0);
  assert.ok(chunks[0].includes('\n')); // Verifica newline
});

test('TextEncodingStream - deve codificar para hex', async () => {
  const encodingStream = new TextEncodingStream('hex');
  const chunks = [];

  encodingStream.on('data', chunk => chunks.push(chunk));
  
  encodingStream.write(Buffer.from('test'));
  encodingStream.end();

  await new Promise(resolve => encodingStream.on('end', resolve));
  
  assert.ok(chunks.length > 0);
  const combined = chunks.join('').trim();
  assert.match(combined, /^[0-9a-f]+$/); // Apenas hex
});

test('ChunkDeserializationStream - deve lidar com buffer incompleto no _flush', async () => {
  const deserializationStream = new ChunkDeserializationStream();

  await assert.rejects(
    async () => {
      await new Promise((resolve, reject) => {
        deserializationStream.on('error', reject);
        deserializationStream.on('finish', resolve);
        // Escreve dados incompletos
        deserializationStream.write(Buffer.from([0, 0, 0, 10])); // Tamanho = 10 mas sem dados
        deserializationStream.end();
      });
    },
    /Buffer contém.*bytes não processados/
  );
});

test('DecryptionStream - deve rejeitar input não-EncryptedChunk', async () => {
  const masterKey = generateMasterKey();
  const videoKey = deriveVideoKey(masterKey, 'test-video');
  const decryptionStream = new DecryptionStream(videoKey, 'test-video');

  await assert.rejects(
    async () => {
      await new Promise((resolve, reject) => {
        decryptionStream.on('error', reject);
        decryptionStream.on('finish', resolve);
        decryptionStream.write('not a chunk');
        decryptionStream.end();
      });
    },
    /Entrada deve ser EncryptedChunk/
  );
});

test('TextDecodingStream - deve decodificar base64', async () => {
  const decodingStream = new TextDecodingStream('base64');
  const chunks = [];

  decodingStream.on('data', chunk => chunks.push(chunk));
  
  const encoded = Buffer.from('test data').toString('base64');
  decodingStream.write(encoded + '\n');
  decodingStream.end();

  await new Promise(resolve => decodingStream.on('end', resolve));
  
  const result = Buffer.concat(chunks);
  assert.deepStrictEqual(result, Buffer.from('test data'));
});

test('TextDecodingStream - deve decodificar hex', async () => {
  const decodingStream = new TextDecodingStream('hex');
  const chunks = [];

  decodingStream.on('data', chunk => chunks.push(chunk));
  
  const encoded = Buffer.from('test').toString('hex');
  decodingStream.write(encoded + '\n');
  decodingStream.end();

  await new Promise(resolve => decodingStream.on('end', resolve));
  
  const result = Buffer.concat(chunks);
  assert.deepStrictEqual(result, Buffer.from('test'));
});

test('EncryptionStream - deve processar chunk final no _flush', async () => {
  const masterKey = generateMasterKey();
  const videoKey = deriveVideoKey(masterKey, 'test-video');
  const encryptionStream = new EncryptionStream(videoKey, 'test-video', { chunkSize: 1024 });
  const chunks = [];

  encryptionStream.on('data', chunk => chunks.push(chunk));
  
  // Escreve menos que chunkSize para testar o flush
  encryptionStream.write(Buffer.from('small data'));
  encryptionStream.end();

  await new Promise(resolve => encryptionStream.on('end', resolve));
  
  assert.ok(chunks.length > 0);
  assert.strictEqual(encryptionStream.getStats().totalChunks, chunks.length);
});

test('DecryptionStream - getStats deve retornar estatísticas corretas', async () => {
  const masterKey = generateMasterKey();
  const videoKey = deriveVideoKey(masterKey, 'test-video');
  
  // Cria um chunk criptografado válido
  const plaintext = Buffer.from('test data for stats');
  const encryptionStream = new EncryptionStream(videoKey, 'test-video');
  const decryptionStream = new DecryptionStream(videoKey, 'test-video');

  const encryptedChunks = [];
  
  encryptionStream.on('data', chunk => encryptedChunks.push(chunk));
  encryptionStream.write(plaintext);
  encryptionStream.end();

  await new Promise(resolve => encryptionStream.on('end', resolve));

  decryptionStream.on('data', () => {});
  
  for (const chunk of encryptedChunks) {
    decryptionStream.write(chunk);
  }
  decryptionStream.end();

  await new Promise(resolve => decryptionStream.on('end', resolve));
  
  const stats = decryptionStream.getStats();
  assert.strictEqual(stats.chunksProcessed, 1);
  assert.strictEqual(stats.bytesProcessed, plaintext.length);
});
