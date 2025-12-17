import crypto from 'crypto';
import { CONFIG } from '../config.js';
import { createAAD } from '../utils/aad.js';
import {
  validateMasterKey,
  validateVideoId,
  validateChunkIndex,
  validateBuffer,
  ValidationError
} from '../utils/security.js';

/**
 * Representa um chunk criptografado
 * 
 * Estrutura binária:
 * [chunk_index]  4 bytes (uint32 BE)
 * [iv]          12 bytes
 * [tag]         16 bytes
 * [ciphertext]   N bytes
 */
export class EncryptedChunk {
  constructor(index, iv, tag, ciphertext) {
    this.index = index;
    this.iv = iv;
    this.tag = tag;
    this.ciphertext = ciphertext;
  }

  /**
   * Serializa o chunk para Buffer
   * 
   * @returns {Buffer}
   */
  toBuffer() {
    const indexBuffer = Buffer.allocUnsafe(4);
    indexBuffer.writeUInt32BE(this.index, 0);

    return Buffer.concat([
      indexBuffer,
      this.iv,
      this.tag,
      this.ciphertext
    ]);
  }

  /**
   * Deserializa um Buffer para EncryptedChunk
   * 
   * @param {Buffer} buffer
   * @returns {EncryptedChunk}
   */
  static fromBuffer(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < CONFIG.HEADER.TOTAL_SIZE) {
      throw new Error('Buffer inválido ou muito pequeno');
    }

    const index = buffer.readUInt32BE(0);
    const iv = buffer.slice(4, 16);
    const tag = buffer.slice(16, 32);
    const ciphertext = buffer.slice(32);

    return new EncryptedChunk(index, iv, tag, ciphertext);
  }

  /**
   * Converte para texto (base64)
   * 
   * @param {string} encoding - 'base64' ou 'hex'
   * @returns {string}
   */
  toText(encoding = 'base64') {
    return this.toBuffer().toString(encoding);
  }

  /**
   * Cria EncryptedChunk a partir de texto
   * 
   * @param {string} text
   * @param {string} encoding - 'base64' ou 'hex'
   * @returns {EncryptedChunk}
   */
  static fromText(text, encoding = 'base64') {
    const buffer = Buffer.from(text, encoding);
    return EncryptedChunk.fromBuffer(buffer);
  }

  /**
   * Retorna o tamanho total em bytes
   * 
   * @returns {number}
   */
  get size() {
    return CONFIG.HEADER.TOTAL_SIZE + this.ciphertext.length;
  }
}

/**
 * Criptografa um chunk de dados
 * 
 * @param {Buffer} plaintext - Dados a criptografar (até 512KB)
 * @param {Buffer} videoKey - Chave derivada do vídeo
 * @param {string} videoId - ID do vídeo
 * @param {number} chunkIndex - Índice do chunk
 * @returns {EncryptedChunk}
 */
export function encryptChunk(plaintext, videoKey, videoId, chunkIndex) {
  // Validações de segurança
  validateBuffer(plaintext, 'plaintext');
  validateMasterKey(videoKey); // videoKey tem mesmo tamanho que masterKey
  validateVideoId(videoId);
  validateChunkIndex(chunkIndex);

  // Gera IV aleatório (NUNCA reutilizar)
  const iv = crypto.randomBytes(CONFIG.CRYPTO.IV_LENGTH);

  // Cria AAD
  const aad = createAAD(videoId, chunkIndex);

  // Criptografa
  const cipher = crypto.createCipheriv(CONFIG.CRYPTO.ALGORITHM, videoKey, iv, {
    authTagLength: CONFIG.CRYPTO.AUTH_TAG_LENGTH
  });

  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return new EncryptedChunk(chunkIndex, iv, tag, ciphertext);
}

/**
 * Descriptografa um chunk
 * 
 * @param {EncryptedChunk} encryptedChunk - Chunk criptografado
 * @param {Buffer} videoKey - Chave derivada do vídeo
 * @param {string} videoId - ID do vídeo
 * @returns {Buffer} - Dados descriptografados
 * @throws {Error} - Se autenticação falhar
 */
export function decryptChunk(encryptedChunk, videoKey, videoId) {
  // Validações
  if (!(encryptedChunk instanceof EncryptedChunk)) {
    throw new ValidationError('encryptedChunk deve ser instância de EncryptedChunk', 'encryptedChunk');
  }

  validateMasterKey(videoKey);
  validateVideoId(videoId);

  // Recria AAD
  const aad = createAAD(videoId, encryptedChunk.index);

  // Descriptografa
  const decipher = crypto.createDecipheriv(
    CONFIG.CRYPTO.ALGORITHM,
    videoKey,
    encryptedChunk.iv,
    {
      authTagLength: CONFIG.CRYPTO.AUTH_TAG_LENGTH
    }
  );

  decipher.setAAD(aad);
  decipher.setAuthTag(encryptedChunk.tag);

  try {
    const plaintext = Buffer.concat([
      decipher.update(encryptedChunk.ciphertext),
      decipher.final()
    ]);

    return plaintext;
  } catch (error) {
    throw new Error(`Falha na autenticação do chunk ${encryptedChunk.index}: ${error.message}`);
  }
}
