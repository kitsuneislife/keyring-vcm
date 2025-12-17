import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  encryptFile,
  decryptFile,
  encryptBuffer,
  decryptBuffer,
  generateMasterKey
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDir = path.join(__dirname, 'temp');

// Cria diretório de teste
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

test('File Crypto - encriptação/decriptação de arquivo pequeno', async () => {
  const inputPath = path.join(testDir, 'test-small.bin');
  const encryptedPath = path.join(testDir, 'test-small.enc');
  const decryptedPath = path.join(testDir, 'test-small.dec');

  // Cria arquivo de teste (100KB)
  const testData = crypto.randomBytes(100 * 1024);
  fs.writeFileSync(inputPath, testData);

  const masterKey = generateMasterKey();
  const videoId = 'test-video-small';

  // Encripta
  const encStats = await encryptFile({
    inputPath,
    outputPath: encryptedPath,
    masterKey,
    videoId
  });

  assert.ok(encStats.totalChunks >= 1);
  assert.strictEqual(encStats.bytesProcessed, testData.length);

  // Decripta
  const decStats = await decryptFile({
    inputPath: encryptedPath,
    outputPath: decryptedPath,
    masterKey,
    videoId
  });

  assert.ok(decStats.chunksProcessed >= 1);

  // Verifica bit-by-bit
  const decryptedData = fs.readFileSync(decryptedPath);
  assert.deepStrictEqual(decryptedData, testData, 'Dados devem ser idênticos');

  // Cleanup
  fs.unlinkSync(inputPath);
  fs.unlinkSync(encryptedPath);
  fs.unlinkSync(decryptedPath);
});

test('File Crypto - encriptação/decriptação de arquivo grande (múltiplos chunks)', async () => {
  const inputPath = path.join(testDir, 'test-large.bin');
  const encryptedPath = path.join(testDir, 'test-large.enc');
  const decryptedPath = path.join(testDir, 'test-large.dec');

  // Cria arquivo de teste (2MB = ~4 chunks)
  const testData = crypto.randomBytes(2 * 1024 * 1024);
  fs.writeFileSync(inputPath, testData);

  const masterKey = generateMasterKey();
  const videoId = 'test-video-large';

  // Encripta
  const encStats = await encryptFile({
    inputPath,
    outputPath: encryptedPath,
    masterKey,
    videoId
  });

  assert.ok(encStats.totalChunks >= 4);

  // Decripta
  await decryptFile({
    inputPath: encryptedPath,
    outputPath: decryptedPath,
    masterKey,
    videoId
  });

  // Verifica bit-by-bit
  const decryptedData = fs.readFileSync(decryptedPath);
  assert.deepStrictEqual(decryptedData, testData);

  // Cleanup
  fs.unlinkSync(inputPath);
  fs.unlinkSync(encryptedPath);
  fs.unlinkSync(decryptedPath);
});

test('File Crypto - encoding base64', async () => {
  const inputPath = path.join(testDir, 'test-b64.bin');
  const encryptedPath = path.join(testDir, 'test-b64.txt');
  const decryptedPath = path.join(testDir, 'test-b64.dec');

  const testData = crypto.randomBytes(50 * 1024);
  fs.writeFileSync(inputPath, testData);

  const masterKey = generateMasterKey();
  const videoId = 'test-video-b64';

  // Encripta com base64
  await encryptFile({
    inputPath,
    outputPath: encryptedPath,
    masterKey,
    videoId,
    encoding: 'base64'
  });

  // Verifica que arquivo é texto
  const encryptedText = fs.readFileSync(encryptedPath, 'utf8');
  assert.ok(/^[A-Za-z0-9+/=\n]+$/.test(encryptedText), 'Deve ser base64 válido');

  // Decripta
  await decryptFile({
    inputPath: encryptedPath,
    outputPath: decryptedPath,
    masterKey,
    videoId,
    encoding: 'base64'
  });

  // Verifica
  const decryptedData = fs.readFileSync(decryptedPath);
  assert.deepStrictEqual(decryptedData, testData);

  // Cleanup
  fs.unlinkSync(inputPath);
  fs.unlinkSync(encryptedPath);
  fs.unlinkSync(decryptedPath);
});

test('Buffer Crypto - encriptação/decriptação em memória', async () => {
  const testData = crypto.randomBytes(100 * 1024);
  const masterKey = generateMasterKey();
  const videoId = 'test-buffer';

  // Encripta
  const chunks = await encryptBuffer({
    data: testData,
    masterKey,
    videoId
  });

  assert.ok(Array.isArray(chunks));
  assert.ok(chunks.length >= 1);

  // Decripta
  const decrypted = await decryptBuffer({
    chunks,
    masterKey,
    videoId
  });

  assert.deepStrictEqual(decrypted, testData);
});

test('File Crypto - chave errada deve falhar', async () => {
  const inputPath = path.join(testDir, 'test-wrongkey.bin');
  const encryptedPath = path.join(testDir, 'test-wrongkey.enc');
  const decryptedPath = path.join(testDir, 'test-wrongkey.dec');

  const testData = crypto.randomBytes(50 * 1024);
  fs.writeFileSync(inputPath, testData);

  const masterKey1 = generateMasterKey();
  const masterKey2 = generateMasterKey();
  const videoId = 'test-video';

  // Encripta com chave1
  await encryptFile({
    inputPath,
    outputPath: encryptedPath,
    masterKey: masterKey1,
    videoId
  });

  // Tenta decriptar com chave2
  await assert.rejects(
    decryptFile({
      inputPath: encryptedPath,
      outputPath: decryptedPath,
      masterKey: masterKey2,
      videoId
    }),
    /Falha na autenticação/
  );

  // Cleanup
  fs.unlinkSync(inputPath);
  fs.unlinkSync(encryptedPath);
  if (fs.existsSync(decryptedPath)) {
    fs.unlinkSync(decryptedPath);
  }
});

test('File Crypto - arquivo inexistente deve falhar', async () => {
  const masterKey = generateMasterKey();
  
  await assert.rejects(
    async () => await encryptFile({
      inputPath: 'non-existent-file.bin',
      outputPath: path.join(testDir, 'output.enc'),
      masterKey,
      videoId: 'test'
    }),
    /Arquivo de entrada não encontrado/
  );
  
  await assert.rejects(
    async () => await decryptFile({
      inputPath: 'non-existent-encrypted.enc',
      outputPath: path.join(testDir, 'output.bin'),
      masterKey,
      videoId: 'test'
    }),
    /Arquivo criptografado não encontrado/
  );
});

test('File Crypto - validação de path traversal', async () => {
  const masterKey = generateMasterKey();
  
  await assert.rejects(
    async () => await encryptFile({
      inputPath: '../../../etc/passwd',
      outputPath: path.join(testDir, 'output.enc'),
      masterKey,
      videoId: 'test'
    }),
    /Path traversal/
  );
});

test('File Crypto - validação de encoding inválido', async () => {
  const inputPath = path.join(testDir, 'test-encoding-val.bin');
  const outputPath = path.join(testDir, 'test-encoding-val.enc');
  fs.writeFileSync(inputPath, Buffer.from('test data'));
  
  const masterKey = generateMasterKey();
  
  await assert.rejects(
    async () => await encryptFile({
      inputPath,
      outputPath,
      masterKey,
      videoId: 'test',
      encoding: 'utf8' // Encoding inválido
    }),
    /Encoding inválido/
  );
  
  fs.unlinkSync(inputPath);
});

test('File Crypto - validação de chunkSize customizado', async () => {
  const inputPath = path.join(testDir, 'test-chunk-val.bin');
  const outputPath = path.join(testDir, 'test-chunk-val.enc');
  fs.writeFileSync(inputPath, Buffer.alloc(2048));
  
  const masterKey = generateMasterKey();
  
  await assert.rejects(
    async () => await encryptFile({
      inputPath,
      outputPath,
      masterKey,
      videoId: 'test',
      chunkSize: 512 // Muito pequeno
    }),
    /Chunk size deve ser no mínimo/
  );
  
  fs.unlinkSync(inputPath);
});

// Cleanup do diretório de testes após todos os testes
test('Cleanup', () => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
