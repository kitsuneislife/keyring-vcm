import fs from 'fs';
import { pipeline } from 'stream/promises';
import { deriveVideoKey } from '../utils/hkdf.js';
import { EncryptionStream, ChunkSerializationStream, TextEncodingStream } from './encryption-stream.js';
import { DecryptionStream, ChunkDeserializationStream, TextDecodingStream } from './decryption-stream.js';
import {
  validateMasterKey,
  validateVideoId,
  validateFilePath,
  validateEncoding,
  validateChunkSize,
  SECURITY_LIMITS
} from '../utils/security.js';

/**
 * Criptografa um arquivo de vídeo
 * 
 * @param {Object} options
 * @param {string} options.inputPath - Caminho do arquivo de entrada
 * @param {string} options.outputPath - Caminho do arquivo de saída
 * @param {Buffer} options.masterKey - Master key
 * @param {string} options.videoId - ID único do vídeo
 * @param {string} [options.encoding] - 'binary', 'base64' ou 'hex'
 * @param {number} [options.chunkSize] - Tamanho do chunk (padrão: 512KB)
 * @returns {Promise<Object>} - Estatísticas do processo
 */
export async function encryptFile(options) {
  const {
    inputPath,
    outputPath,
    masterKey,
    videoId,
    encoding = 'binary',
    chunkSize
  } = options;

  // Validações de segurança
  validateFilePath(inputPath, 'inputPath');
  validateFilePath(outputPath, 'outputPath');
  validateMasterKey(masterKey);
  validateVideoId(videoId);
  validateEncoding(encoding);
  
  if (chunkSize !== undefined) {
    validateChunkSize(chunkSize);
  }

  // Verifica se arquivo existe
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo de entrada não encontrado: ${inputPath}`);
  }

  // Verifica tamanho do arquivo
  const stats = fs.statSync(inputPath);
  if (stats.size > SECURITY_LIMITS.MAX_FILE_SIZE) {
    throw new Error(
      `Arquivo excede o tamanho máximo permitido (${SECURITY_LIMITS.MAX_FILE_SIZE} bytes)`
    );
  }

  // Deriva chave do vídeo
  const videoKey = deriveVideoKey(masterKey, videoId);

  // Cria streams
  const inputStream = fs.createReadStream(inputPath);
  const encryptionStream = new EncryptionStream(videoKey, videoId, { chunkSize });
  const serializationStream = new ChunkSerializationStream();
  const outputStream = fs.createWriteStream(outputPath);

  // Pipeline de criptografia
  const streams = [
    inputStream,
    encryptionStream,
    serializationStream
  ];

  // Adiciona encoding se necessário
  if (encoding !== 'binary') {
    streams.push(new TextEncodingStream(encoding));
  }

  streams.push(outputStream);

  // Executa pipeline
  await pipeline(...streams);

  return encryptionStream.getStats();
}

/**
 * Descriptografa um arquivo de vídeo
 * 
 * @param {Object} options
 * @param {string} options.inputPath - Caminho do arquivo criptografado
 * @param {string} options.outputPath - Caminho do arquivo de saída
 * @param {Buffer} options.masterKey - Master key
 * @param {string} options.videoId - ID único do vídeo
 * @param {string} [options.encoding] - 'binary', 'base64' ou 'hex'
 * @returns {Promise<Object>} - Estatísticas do processo
 */
export async function decryptFile(options) {
  const {
    inputPath,
    outputPath,
    masterKey,
    videoId,
    encoding = 'binary'
  } = options;

  // Validações de segurança
  validateFilePath(inputPath, 'inputPath');
  validateFilePath(outputPath, 'outputPath');
  validateMasterKey(masterKey);
  validateVideoId(videoId);
  validateEncoding(encoding);

  // Verifica se arquivo existe
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo criptografado não encontrado: ${inputPath}`);
  }

  // Deriva chave do vídeo
  const videoKey = deriveVideoKey(masterKey, videoId);

  // Cria streams
  const inputStream = fs.createReadStream(inputPath);
  const streams = [inputStream];

  // Adiciona decoding se necessário
  if (encoding !== 'binary') {
    streams.push(new TextDecodingStream(encoding));
  }

  const deserializationStream = new ChunkDeserializationStream();
  const decryptionStream = new DecryptionStream(videoKey, videoId);
  const outputStream = fs.createWriteStream(outputPath);

  streams.push(
    deserializationStream,
    decryptionStream,
    outputStream
  );

  // Executa pipeline
  await pipeline(...streams);

  return decryptionStream.getStats();
}

/**
 * Criptografa um buffer em memória
 * 
 * @param {Object} options
 * @param {Buffer} options.data - Dados a criptografar
 * @param {Buffer} options.masterKey - Master key
 * @param {string} options.videoId - ID único do vídeo
 * @param {number} [options.chunkSize] - Tamanho do chunk
 * @returns {Promise<Buffer[]>} - Array de chunks criptografados
 */
export async function encryptBuffer(options) {
  const { data, masterKey, videoId, chunkSize } = options;

  const videoKey = deriveVideoKey(masterKey, videoId);
  const encryptionStream = new EncryptionStream(videoKey, videoId, { chunkSize });
  const serializationStream = new ChunkSerializationStream();
  const chunks = [];

  return new Promise((resolve, reject) => {
    serializationStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    serializationStream.on('end', () => {
      resolve(chunks);
    });

    serializationStream.on('error', reject);

    // Pipeline: encryption -> serialization
    pipeline(
      encryptionStream,
      serializationStream
    ).catch(reject);

    encryptionStream.write(data);
    encryptionStream.end();
  });
}

/**
 * Descriptografa chunks em memória
 * 
 * @param {Object} options
 * @param {Buffer[]} options.chunks - Array de chunks criptografados
 * @param {Buffer} options.masterKey - Master key
 * @param {string} options.videoId - ID único do vídeo
 * @returns {Promise<Buffer>} - Dados descriptografados
 */
export async function decryptBuffer(options) {
  const { chunks, masterKey, videoId } = options;

  const videoKey = deriveVideoKey(masterKey, videoId);
  const deserializationStream = new ChunkDeserializationStream();
  const decryptionStream = new DecryptionStream(videoKey, videoId);
  const plaintextChunks = [];

  return new Promise((resolve, reject) => {
    decryptionStream.on('data', (chunk) => {
      plaintextChunks.push(chunk);
    });

    decryptionStream.on('end', () => {
      resolve(Buffer.concat(plaintextChunks));
    });

    decryptionStream.on('error', reject);

    // Alimenta o pipeline
    pipeline(
      deserializationStream,
      decryptionStream
    ).catch(reject);

    // Escreve chunks
    for (const chunk of chunks) {
      deserializationStream.write(chunk);
    }
    deserializationStream.end();
  });
}
