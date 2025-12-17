import crypto from 'crypto';
import { CONFIG } from '../config.js';
import { validateMasterKey, validateVideoId } from './security.js';

/**
 * Deriva uma chave específica para um vídeo usando HKDF
 * 
 * @param {Buffer} masterKey - Chave mestra (32 bytes)
 * @param {string} videoId - Identificador único do vídeo
 * @returns {Buffer} - Chave derivada (32 bytes)
 */
export function deriveVideoKey(masterKey, videoId) {
  // Validações de segurança
  validateMasterKey(masterKey);
  validateVideoId(videoId);

  // Converte videoId em salt
  const salt = crypto.createHash('sha256').update(videoId).digest();

  // HKDF Extract
  const prk = crypto.createHmac(CONFIG.HKDF.HASH, salt)
    .update(masterKey)
    .digest();

  // HKDF Expand
  const info = Buffer.from(CONFIG.HKDF.INFO);
  const infoWithCounter = Buffer.concat([info, Buffer.from([0x01])]);
  
  const videoKey = crypto.createHmac(CONFIG.HKDF.HASH, prk)
    .update(infoWithCounter)
    .digest()
    .slice(0, CONFIG.CRYPTO.KEY_LENGTH);

  return videoKey;
}

/**
 * Gera uma master key aleatória
 * 
 * @returns {Buffer} - Master key (32 bytes)
 */
export function generateMasterKey() {
  const key = crypto.randomBytes(CONFIG.CRYPTO.KEY_LENGTH);
  
  // Validação adicional de segurança
  validateMasterKey(key);
  
  return key;
}

/**
 * Exporta master key como hex string
 * 
 * @param {Buffer} masterKey - Master key
 * @returns {string} - Hex string
 */
export function exportMasterKey(masterKey) {
  validateMasterKey(masterKey);
  return masterKey.toString('hex');
}

/**
 * Importa master key de hex string
 * 
 * @param {string} hexKey - Hex string
 * @returns {Buffer} - Master key
 */
export function importMasterKey(hexKey) {
  if (!hexKey || typeof hexKey !== 'string') {
    throw new Error('Hex key deve ser uma string não vazia');
  }
  
  if (!/^[0-9a-fA-F]+$/.test(hexKey)) {
    throw new Error('Hex key contém caracteres inválidos');
  }
  
  const key = Buffer.from(hexKey, 'hex');
  validateMasterKey(key);
  
  return key;
}
