/**
 * Módulo de validação e segurança
 * 
 * Implementa validações rigorosas e proteções contra ataques comuns
 */

import { CONFIG } from '../config.js';

/**
 * Limites de segurança
 */
export const SECURITY_LIMITS = {
  MAX_VIDEO_ID_LENGTH: 255,
  MIN_VIDEO_ID_LENGTH: 1,
  MAX_CHUNK_SIZE: 10 * 1024 * 1024, // 10MB
  MIN_CHUNK_SIZE: 1024, // 1KB
  MAX_FILE_SIZE: 50 * 1024 * 1024 * 1024, // 50GB
  MAX_CHUNKS_PER_VIDEO: 100000,
  VIDEO_ID_PATTERN: /^[a-zA-Z0-9\-_:.]+$/
};

/**
 * Erros customizados
 */
export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class SecurityError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
  }
}

/**
 * Valida master key
 * 
 * @param {Buffer} masterKey
 * @throws {ValidationError}
 */
export function validateMasterKey(masterKey) {
  if (!masterKey) {
    throw new ValidationError('Master key é obrigatória', 'masterKey');
  }

  if (!Buffer.isBuffer(masterKey)) {
    throw new ValidationError('Master key deve ser um Buffer', 'masterKey');
  }

  if (masterKey.length !== CONFIG.CRYPTO.KEY_LENGTH) {
    throw new ValidationError(
      `Master key deve ter exatamente ${CONFIG.CRYPTO.KEY_LENGTH} bytes`,
      'masterKey'
    );
  }

  // Verifica se não é uma chave vazia (todos zeros)
  const isEmpty = masterKey.every(byte => byte === 0);
  if (isEmpty) {
    throw new SecurityError('Master key não pode ser vazia (todos zeros)', 'WEAK_KEY');
  }

  // Verifica entropia mínima (simples check)
  const uniqueBytes = new Set(masterKey).size;
  if (uniqueBytes < 16) {
    throw new SecurityError('Master key tem entropia insuficiente', 'WEAK_KEY');
  }
}

/**
 * Valida video ID
 * 
 * @param {string} videoId
 * @throws {ValidationError}
 */
export function validateVideoId(videoId) {
  if (!videoId) {
    throw new ValidationError('Video ID é obrigatório', 'videoId');
  }

  if (typeof videoId !== 'string') {
    throw new ValidationError('Video ID deve ser uma string', 'videoId');
  }

  if (videoId.length < SECURITY_LIMITS.MIN_VIDEO_ID_LENGTH) {
    throw new ValidationError(
      `Video ID deve ter no mínimo ${SECURITY_LIMITS.MIN_VIDEO_ID_LENGTH} caractere`,
      'videoId'
    );
  }

  if (videoId.length > SECURITY_LIMITS.MAX_VIDEO_ID_LENGTH) {
    throw new ValidationError(
      `Video ID não pode exceder ${SECURITY_LIMITS.MAX_VIDEO_ID_LENGTH} caracteres`,
      'videoId'
    );
  }

  if (!SECURITY_LIMITS.VIDEO_ID_PATTERN.test(videoId)) {
    throw new ValidationError(
      'Video ID contém caracteres inválidos. Use apenas: a-z, A-Z, 0-9, -, _, :, .',
      'videoId'
    );
  }
}

/**
 * Valida chunk size
 * 
 * @param {number} chunkSize
 * @throws {ValidationError}
 */
export function validateChunkSize(chunkSize) {
  if (!Number.isInteger(chunkSize)) {
    throw new ValidationError('Chunk size deve ser um número inteiro', 'chunkSize');
  }

  if (chunkSize < SECURITY_LIMITS.MIN_CHUNK_SIZE) {
    throw new ValidationError(
      `Chunk size deve ser no mínimo ${SECURITY_LIMITS.MIN_CHUNK_SIZE} bytes`,
      'chunkSize'
    );
  }

  if (chunkSize > SECURITY_LIMITS.MAX_CHUNK_SIZE) {
    throw new ValidationError(
      `Chunk size não pode exceder ${SECURITY_LIMITS.MAX_CHUNK_SIZE} bytes`,
      'chunkSize'
    );
  }
}

/**
 * Valida chunk index
 * 
 * @param {number} chunkIndex
 * @throws {ValidationError}
 */
export function validateChunkIndex(chunkIndex) {
  if (!Number.isInteger(chunkIndex)) {
    throw new ValidationError('Chunk index deve ser um número inteiro', 'chunkIndex');
  }

  if (chunkIndex < 0) {
    throw new ValidationError('Chunk index não pode ser negativo', 'chunkIndex');
  }

  if (chunkIndex > 0xFFFFFFFF) {
    throw new ValidationError('Chunk index excede uint32 máximo', 'chunkIndex');
  }

  if (chunkIndex > SECURITY_LIMITS.MAX_CHUNKS_PER_VIDEO) {
    throw new SecurityError(
      `Número de chunks excede o limite de segurança (${SECURITY_LIMITS.MAX_CHUNKS_PER_VIDEO})`,
      'TOO_MANY_CHUNKS'
    );
  }
}

/**
 * Valida buffer de dados
 * 
 * @param {Buffer} buffer
 * @param {string} fieldName
 * @throws {ValidationError}
 */
export function validateBuffer(buffer, fieldName = 'buffer') {
  if (!buffer) {
    throw new ValidationError(`${fieldName} é obrigatório`, fieldName);
  }

  if (!Buffer.isBuffer(buffer)) {
    throw new ValidationError(`${fieldName} deve ser um Buffer`, fieldName);
  }

  if (buffer.length === 0) {
    throw new ValidationError(`${fieldName} não pode estar vazio`, fieldName);
  }
}

/**
 * Valida encoding
 * 
 * @param {string} encoding
 * @throws {ValidationError}
 */
export function validateEncoding(encoding) {
  if (!encoding) {
    return; // Optional
  }

  if (typeof encoding !== 'string') {
    throw new ValidationError('Encoding deve ser uma string', 'encoding');
  }

  const validEncodings = ['binary', 'base64', 'hex'];
  if (!validEncodings.includes(encoding)) {
    throw new ValidationError(
      `Encoding inválido. Use: ${validEncodings.join(', ')}`,
      'encoding'
    );
  }
}

/**
 * Sanitiza video ID removendo caracteres perigosos
 * 
 * @param {string} videoId
 * @returns {string}
 */
export function sanitizeVideoId(videoId) {
  if (typeof videoId !== 'string') {
    return '';
  }

  // Remove caracteres não permitidos
  return videoId.replace(/[^a-zA-Z0-9\-_:.]/g, '');
}

/**
 * Valida caminho de arquivo (básico)
 * 
 * @param {string} filePath
 * @param {string} fieldName
 * @throws {ValidationError}
 */
export function validateFilePath(filePath, fieldName = 'filePath') {
  if (!filePath) {
    throw new ValidationError(`${fieldName} é obrigatório`, fieldName);
  }

  if (typeof filePath !== 'string') {
    throw new ValidationError(`${fieldName} deve ser uma string`, fieldName);
  }

  // Proteção básica contra path traversal
  if (filePath.includes('..')) {
    throw new SecurityError('Path traversal detectado', 'PATH_TRAVERSAL');
  }

  if (filePath.length > 4096) {
    throw new ValidationError('Caminho do arquivo muito longo', fieldName);
  }
}

/**
 * Proteção contra timing attacks na comparação de buffers
 * 
 * @param {Buffer} a
 * @param {Buffer} b
 * @returns {boolean}
 */
export function constantTimeCompare(a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

/**
 * Gera um delay aleatório para mitigar timing attacks
 * 
 * @param {number} minMs
 * @param {number} maxMs
 * @returns {Promise<void>}
 */
export function randomDelay(minMs = 10, maxMs = 50) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Limpa buffer sensível da memória
 * 
 * @param {Buffer} buffer
 */
export function secureWipe(buffer) {
  if (Buffer.isBuffer(buffer)) {
    buffer.fill(0);
  }
}

/**
 * Rate limiter simples (em memória)
 */
export class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  /**
   * Verifica se o request deve ser permitido
   * 
   * @param {string} key - Identificador (ex: IP, userId)
   * @returns {boolean}
   */
  check(key) {
    const now = Date.now();
    const requestData = this.requests.get(key);

    if (!requestData) {
      this.requests.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (now > requestData.resetAt) {
      // Reset window
      this.requests.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (requestData.count >= this.maxRequests) {
      return false;
    }

    requestData.count++;
    return true;
  }

  /**
   * Reset para uma chave específica
   * 
   * @param {string} key
   */
  reset(key) {
    this.requests.delete(key);
  }

  /**
   * Limpa entradas expiradas
   */
  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.requests.entries()) {
      if (now > data.resetAt) {
        this.requests.delete(key);
      }
    }
  }
}
