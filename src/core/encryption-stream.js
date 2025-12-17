import { Transform } from 'stream';
import { CONFIG } from '../config.js';
import { encryptChunk, EncryptedChunk } from './chunk-crypto.js';

/**
 * Transform stream que divide dados em chunks e criptografa
 */
export class EncryptionStream extends Transform {
  constructor(videoKey, videoId, options = {}) {
    super({ ...options, objectMode: true });

    this.videoKey = videoKey;
    this.videoId = videoId;
    this.chunkSize = options.chunkSize || CONFIG.CHUNK_SIZE;
    
    this.buffer = Buffer.alloc(0);
    this.chunkIndex = 0;
    this.bytesProcessed = 0;
  }

  _transform(chunk, encoding, callback) {
    try {
      // Acumula dados no buffer
      this.buffer = Buffer.concat([this.buffer, chunk]);

      // Processa chunks completos
      while (this.buffer.length >= this.chunkSize) {
        const chunkData = this.buffer.slice(0, this.chunkSize);
        this.buffer = this.buffer.slice(this.chunkSize);

        const encryptedChunk = encryptChunk(
          chunkData,
          this.videoKey,
          this.videoId,
          this.chunkIndex
        );

        this.push(encryptedChunk);
        this.chunkIndex++;
        this.bytesProcessed += chunkData.length;
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback) {
    try {
      // Processa último chunk (pode ser menor)
      if (this.buffer.length > 0) {
        const encryptedChunk = encryptChunk(
          this.buffer,
          this.videoKey,
          this.videoId,
          this.chunkIndex
        );

        this.push(encryptedChunk);
        this.chunkIndex++;
        this.bytesProcessed += this.buffer.length;
        this.buffer = Buffer.alloc(0);
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Retorna estatísticas do processo
   */
  getStats() {
    return {
      totalChunks: this.chunkIndex,
      bytesProcessed: this.bytesProcessed
    };
  }
}

/**
 * Transform stream que serializa EncryptedChunk para Buffer
 */
export class ChunkSerializationStream extends Transform {
  constructor(options = {}) {
    super({ ...options, objectMode: true });
  }

  _transform(encryptedChunk, encoding, callback) {
    try {
      if (!(encryptedChunk instanceof EncryptedChunk)) {
        throw new Error('Entrada deve ser EncryptedChunk');
      }

      this.push(encryptedChunk.toBuffer());
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

/**
 * Transform stream que converte Buffer para texto
 */
export class TextEncodingStream extends Transform {
  constructor(encoding = 'base64', options = {}) {
    super(options);
    this.encoding = encoding;
  }

  _transform(chunk, encoding, callback) {
    try {
      const text = chunk.toString(this.encoding);
      this.push(text + '\n'); // Adiciona newline para separação
      callback();
    } catch (error) {
      callback(error);
    }
  }
}
