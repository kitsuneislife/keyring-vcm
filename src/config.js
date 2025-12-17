/**
 * Configurações do sistema de criptografia
 */

export const CONFIG = {
  // Tamanho padrão do chunk em bytes (512KB)
  CHUNK_SIZE: 524288, // 512 * 1024

  // Configurações AES-256-GCM
  CRYPTO: {
    ALGORITHM: 'aes-256-gcm',
    KEY_LENGTH: 32,      // 256 bits
    IV_LENGTH: 12,       // 96 bits (recomendado para GCM)
    AUTH_TAG_LENGTH: 16  // 128 bits
  },

  // Tamanhos do header do chunk
  HEADER: {
    INDEX_SIZE: 4,       // uint32
    IV_SIZE: 12,
    TAG_SIZE: 16,
    TOTAL_SIZE: 32       // 4 + 12 + 16
  },

  // Configurações HKDF
  HKDF: {
    HASH: 'sha256',
    INFO: '@kitsuneislife/keyring-vcm-v1',
    SALT_LENGTH: 32
  },

  // Encoding para texto
  ENCODING: {
    DEFAULT: 'base64',   // ou 'base85' se implementado
    SUPPORTED: ['base64', 'hex']
  }
};

export default CONFIG;
