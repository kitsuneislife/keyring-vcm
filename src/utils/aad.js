import crypto from 'crypto';

/**
 * Cria AAD (Additional Authenticated Data) para um chunk
 * 
 * AAD = HASH(video_id || chunk_index)
 * 
 * Isso protege contra:
 * - Reordenação de chunks
 * - Substituição de chunks entre vídeos
 * - Ataques de replay
 * 
 * @param {string} videoId - ID do vídeo
 * @param {number} chunkIndex - Índice do chunk (uint32)
 * @returns {Buffer} - AAD (32 bytes)
 */
export function createAAD(videoId, chunkIndex) {
  if (typeof videoId !== 'string' || !videoId) {
    throw new Error('videoId deve ser uma string não vazia');
  }

  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 0xFFFFFFFF) {
    throw new Error('chunkIndex deve ser uint32 (0 a 4294967295)');
  }

  // Cria buffer com videoId + index
  const videoIdBuffer = Buffer.from(videoId, 'utf8');
  const indexBuffer = Buffer.allocUnsafe(4);
  indexBuffer.writeUInt32BE(chunkIndex, 0);

  const combined = Buffer.concat([videoIdBuffer, indexBuffer]);

  // Hash para tamanho fixo e maior segurança
  return crypto.createHash('sha256').update(combined).digest();
}

/**
 * Valida AAD
 * 
 * @param {Buffer} aad - AAD para validar
 * @returns {boolean} - True se válido
 */
export function validateAAD(aad) {
  return Buffer.isBuffer(aad) && aad.length === 32;
}
