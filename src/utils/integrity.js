/**
 * Verificador de integridade para arquivos e chunks
 */

import crypto from 'crypto';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

/**
 * Calcula hash SHA-256 de um arquivo
 * 
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<string>} - Hash hex
 */
export async function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Calcula hash SHA-256 de um buffer
 * 
 * @param {Buffer} buffer
 * @returns {string} - Hash hex
 */
export function calculateBufferHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Cria um manifest com metadados e hash de integridade
 * 
 * @param {Object} options
 * @returns {Object} - Manifest
 */
export function createManifest(options) {
  const {
    videoId,
    totalChunks,
    chunkSize,
    totalSize,
    originalHash,
    timestamp = Date.now(),
    version = '1.0.0'
  } = options;

  const manifest = {
    version,
    videoId,
    timestamp,
    totalChunks,
    chunkSize,
    totalSize,
    originalHash,
    checksum: null
  };

  // Calcula checksum do manifest
  const manifestString = JSON.stringify({
    version,
    videoId,
    timestamp,
    totalChunks,
    chunkSize,
    totalSize,
    originalHash
  });

  manifest.checksum = crypto
    .createHash('sha256')
    .update(manifestString)
    .digest('hex');

  return manifest;
}

/**
 * Valida um manifest
 * 
 * @param {Object} manifest
 * @returns {boolean}
 */
export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return false;
  }

  const required = ['version', 'videoId', 'timestamp', 'totalChunks', 'chunkSize', 'checksum'];
  for (const field of required) {
    if (!(field in manifest)) {
      return false;
    }
  }

  // Recalcula checksum
  const manifestCopy = { ...manifest };
  const expectedChecksum = manifestCopy.checksum;
  delete manifestCopy.checksum;

  const calculatedChecksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(manifestCopy))
    .digest('hex');

  return expectedChecksum === calculatedChecksum;
}

/**
 * Stream que calcula hash durante o processamento
 */
export class HashStream extends Transform {
  constructor(algorithm = 'sha256') {
    super();
    this.hash = crypto.createHash(algorithm);
  }

  _transform(chunk, encoding, callback) {
    this.hash.update(chunk);
    this.push(chunk);
    callback();
  }

  getHash(encoding = 'hex') {
    return this.hash.digest(encoding);
  }
}

/**
 * Verifica integridade comparando hashes
 * 
 * @param {string} file1
 * @param {string} file2
 * @returns {Promise<boolean>}
 */
export async function verifyFileIntegrity(file1, file2) {
  const [hash1, hash2] = await Promise.all([
    calculateFileHash(file1),
    calculateFileHash(file2)
  ]);

  return hash1 === hash2;
}

/**
 * Gera relatório de integridade
 * 
 * @param {string} filePath
 * @returns {Promise<Object>}
 */
export async function generateIntegrityReport(filePath) {
  const stats = fs.statSync(filePath);
  const hash = await calculateFileHash(filePath);

  return {
    filePath,
    size: stats.size,
    hash,
    algorithm: 'sha256',
    timestamp: Date.now(),
    modified: stats.mtime.toISOString()
  };
}
