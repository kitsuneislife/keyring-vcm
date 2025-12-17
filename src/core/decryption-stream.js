import { Transform } from 'stream';
import { CONFIG } from '../config.js';
import { decryptChunk, EncryptedChunk } from './chunk-crypto.js';

/**
 * Transform stream que deserializa buffers em EncryptedChunks
 */
export class ChunkDeserializationStream extends Transform {
  constructor(options = {}) {
    super({ ...options, objectMode: true });
    this.buffer = Buffer.alloc(0);
  }

  _transform(chunk, encoding, callback) {
    try {
      this.buffer = Buffer.concat([this.buffer, chunk]);

      // Tenta extrair chunks completos
      // Formato: [tamanho(4 bytes)][chunk data]
      while (this.buffer.length >= 4) {
        // Lê o tamanho do próximo chunk
        const chunkSize = this.buffer.readUInt32BE(0);
        
        // Verifica se temos o chunk completo no buffer
        if (this.buffer.length < 4 + chunkSize) {
          break; // Espera mais dados
        }
        
        // Extrai o chunk
        const chunkData = this.buffer.slice(4, 4 + chunkSize);
        this.buffer = this.buffer.slice(4 + chunkSize);
        
        // Deserializa
        const encryptedChunk = EncryptedChunk.fromBuffer(chunkData);
        this.push(encryptedChunk);
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback) {
    if (this.buffer.length > 0) {
      callback(new Error(`Buffer contém ${this.buffer.length} bytes não processados`));
    } else {
      callback();
    }
  }
}

/**
 * Transform stream que descriptografa chunks
 */
export class DecryptionStream extends Transform {
  constructor(videoKey, videoId, options = {}) {
    super({ ...options, objectMode: true });

    this.videoKey = videoKey;
    this.videoId = videoId;
    this.chunksProcessed = 0;
    this.bytesProcessed = 0;
    this.errors = [];
  }

  _transform(encryptedChunk, encoding, callback) {
    try {
      if (!(encryptedChunk instanceof EncryptedChunk)) {
        throw new Error('Entrada deve ser EncryptedChunk');
      }

      const plaintext = decryptChunk(encryptedChunk, this.videoKey, this.videoId);

      this.push(plaintext);
      this.chunksProcessed++;
      this.bytesProcessed += plaintext.length;

      callback();
    } catch (error) {
      this.errors.push({
        chunkIndex: encryptedChunk?.index,
        error: error.message
      });
      
      // Opção: falhar ou continuar
      // Para segurança, melhor falhar
      callback(error);
    }
  }

  /**
   * Retorna estatísticas do processo
   */
  getStats() {
    return {
      chunksProcessed: this.chunksProcessed,
      bytesProcessed: this.bytesProcessed,
      errors: this.errors
    };
  }
}

/**
 * Transform stream que decodifica texto para buffer
 */
export class TextDecodingStream extends Transform {
  constructor(encoding = 'base64', options = {}) {
    super(options);
    this.encoding = encoding;
    this.lineBuffer = '';
  }

  _transform(chunk, encoding, callback) {
    try {
      // Adiciona ao buffer de linha
      this.lineBuffer += chunk.toString();

      // Processa linhas completas
      const lines = this.lineBuffer.split('\n');
      this.lineBuffer = lines.pop() || ''; // Guarda última linha incompleta

      for (const line of lines) {
        if (line.trim()) {
          const buffer = Buffer.from(line.trim(), this.encoding);
          this.push(buffer);
        }
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback) {
    try {
      // Processa última linha
      if (this.lineBuffer.trim()) {
        const buffer = Buffer.from(this.lineBuffer.trim(), this.encoding);
        this.push(buffer);
      }
      callback();
    } catch (error) {
      callback(error);
    }
  }
}
