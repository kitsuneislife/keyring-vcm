import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  calculateFileHash,
  calculateBufferHash,
  createManifest,
  validateManifest,
  HashStream,
  verifyFileIntegrity,
  generateIntegrityReport
} from '../src/utils/integrity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDir = path.join(__dirname, 'temp');

// Garante diretório de teste
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

test('calculateFileHash - deve calcular hash de arquivo', async () => {
  const testFile = path.join(testDir, 'hash-test.bin');
  const testData = Buffer.from('test data for hash');
  fs.writeFileSync(testFile, testData);

  const hash = await calculateFileHash(testFile);
  
  assert.ok(hash);
  assert.strictEqual(hash.length, 64); // SHA-256 hex = 64 caracteres
  assert.strictEqual(hash, crypto.createHash('sha256').update(testData).digest('hex'));

  fs.unlinkSync(testFile);
});

test('calculateFileHash - deve rejeitar arquivo inexistente', async () => {
  await assert.rejects(
    async () => await calculateFileHash('non-existent-file.bin'),
    /ENOENT/
  );
});

test('calculateBufferHash - deve calcular hash de buffer', () => {
  const buffer = Buffer.from('test buffer data');
  const hash = calculateBufferHash(buffer);

  assert.ok(hash);
  assert.strictEqual(hash.length, 64);
  assert.strictEqual(hash, crypto.createHash('sha256').update(buffer).digest('hex'));
});

test('createManifest - deve criar manifest válido', () => {
  const manifest = createManifest({
    videoId: 'test-video-123',
    totalChunks: 10,
    chunkSize: 524288,
    totalSize: 5242880,
    originalHash: 'abc123'
  });

  assert.ok(manifest);
  assert.strictEqual(manifest.videoId, 'test-video-123');
  assert.strictEqual(manifest.totalChunks, 10);
  assert.strictEqual(manifest.chunkSize, 524288);
  assert.strictEqual(manifest.totalSize, 5242880);
  assert.strictEqual(manifest.originalHash, 'abc123');
  assert.strictEqual(manifest.version, '1.0.0');
  assert.ok(manifest.timestamp);
  assert.ok(manifest.checksum);
  assert.strictEqual(manifest.checksum.length, 64);
});

test('createManifest - deve aceitar versão e timestamp customizados', () => {
  const customTimestamp = Date.now() - 1000;
  const manifest = createManifest({
    videoId: 'video-custom',
    totalChunks: 5,
    chunkSize: 1024,
    totalSize: 5120,
    originalHash: 'xyz789',
    timestamp: customTimestamp,
    version: '2.0.0'
  });

  assert.strictEqual(manifest.version, '2.0.0');
  assert.strictEqual(manifest.timestamp, customTimestamp);
});

test('validateManifest - deve validar manifest correto', () => {
  const manifest = createManifest({
    videoId: 'test-validate',
    totalChunks: 3,
    chunkSize: 1024,
    totalSize: 3072,
    originalHash: 'hash123'
  });

  const isValid = validateManifest(manifest);
  assert.strictEqual(isValid, true);
});

test('validateManifest - deve rejeitar manifest inválido', () => {
  // Manifest null
  assert.strictEqual(validateManifest(null), false);

  // Não é objeto
  assert.strictEqual(validateManifest('invalid'), false);

  // Faltam campos
  assert.strictEqual(validateManifest({}), false);
  assert.strictEqual(validateManifest({ videoId: 'test' }), false);

  // Checksum alterado
  const manifest = createManifest({
    videoId: 'tampered',
    totalChunks: 1,
    chunkSize: 1024,
    totalSize: 1024,
    originalHash: 'original'
  });
  manifest.checksum = 'fake-checksum';
  assert.strictEqual(validateManifest(manifest), false);

  // Dados alterados
  const manifest2 = createManifest({
    videoId: 'tampered2',
    totalChunks: 1,
    chunkSize: 1024,
    totalSize: 1024,
    originalHash: 'original'
  });
  manifest2.totalChunks = 999; // Altera dados
  assert.strictEqual(validateManifest(manifest2), false);
});

test('HashStream - deve calcular hash durante streaming', async () => {
  const testData = Buffer.from('streaming hash test data');
  const hashStream = new HashStream('sha256');
  const chunks = [];

  hashStream.on('data', chunk => chunks.push(chunk));

  hashStream.write(testData.slice(0, 10));
  hashStream.write(testData.slice(10));
  hashStream.end();

  await new Promise(resolve => hashStream.on('end', resolve));

  const result = Buffer.concat(chunks);
  assert.deepStrictEqual(result, testData);

  const hash = hashStream.getHash('hex');
  assert.strictEqual(hash, crypto.createHash('sha256').update(testData).digest('hex'));
});

test('HashStream - deve suportar diferentes algoritmos', async () => {
  const testData = Buffer.from('test data');
  const hashStream = new HashStream('sha512');

  hashStream.write(testData);
  hashStream.end();

  await new Promise(resolve => hashStream.on('end', resolve));

  const hash = hashStream.getHash('hex');
  assert.strictEqual(hash, crypto.createHash('sha512').update(testData).digest('hex'));
  assert.strictEqual(hash.length, 128); // SHA-512 = 128 hex chars
});

test('verifyFileIntegrity - arquivos idênticos devem retornar true', async () => {
  const file1 = path.join(testDir, 'integrity-1.bin');
  const file2 = path.join(testDir, 'integrity-2.bin');
  const testData = crypto.randomBytes(1024);

  fs.writeFileSync(file1, testData);
  fs.writeFileSync(file2, testData);

  const result = await verifyFileIntegrity(file1, file2);
  assert.strictEqual(result, true);

  fs.unlinkSync(file1);
  fs.unlinkSync(file2);
});

test('verifyFileIntegrity - arquivos diferentes devem retornar false', async () => {
  const file1 = path.join(testDir, 'integrity-3.bin');
  const file2 = path.join(testDir, 'integrity-4.bin');

  fs.writeFileSync(file1, Buffer.from('data 1'));
  fs.writeFileSync(file2, Buffer.from('data 2'));

  const result = await verifyFileIntegrity(file1, file2);
  assert.strictEqual(result, false);

  fs.unlinkSync(file1);
  fs.unlinkSync(file2);
});

test('generateIntegrityReport - deve gerar relatório completo', async () => {
  const testFile = path.join(testDir, 'report-test.bin');
  const testData = crypto.randomBytes(2048);
  fs.writeFileSync(testFile, testData);

  const report = await generateIntegrityReport(testFile);

  assert.ok(report);
  assert.strictEqual(report.filePath, testFile);
  assert.strictEqual(report.size, 2048);
  assert.strictEqual(report.algorithm, 'sha256');
  assert.ok(report.hash);
  assert.strictEqual(report.hash.length, 64);
  assert.ok(report.timestamp);
  assert.ok(report.modified);

  // Verifica hash
  const expectedHash = await calculateFileHash(testFile);
  assert.strictEqual(report.hash, expectedHash);

  fs.unlinkSync(testFile);
});
