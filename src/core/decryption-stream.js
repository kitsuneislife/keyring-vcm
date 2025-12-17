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
    this.minChunkSize = CONFIG.HEADER.TOTAL_SIZE + 1;
  }

  _transform(chunk, encoding, callback) {
    try {
      this.buffer = Buffer.concat([this.buffer, chunk]);

      // Tenta extrair chunks completos
      // Nota: em produção real, seria melhor ter um delimitador ou tamanho prefixado
      // Para simplicidade, assumimos que cada write contém um chunk completo
      while (this.buffer.length >= this.minChunkSize) {
        try {
          const encryptedChunk = EncryptedChunk.fromBuffer(this.buffer);
          
          // Remove o chunk processado do buffer
          const chunkSize = encryptedChunk.size;
          this.buffer = this.buffer.slice(chunkSize);
          
          this.push(encryptedChunk);
        } catch (error) {
          // Se não conseguir parsear, espera mais dados
          break;
        }
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback) {
    if (this.buffer.length > 0) {
      callback(new Error('Buffer contém dados não processados'));
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
