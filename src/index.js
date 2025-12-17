// Export configuration
export { CONFIG } from './config.js';

// Export key management
export {
  generateMasterKey,
  deriveVideoKey,
  exportMasterKey,
  importMasterKey
} from './utils/hkdf.js';

// Export chunk cryptography
export {
  EncryptedChunk,
  encryptChunk,
  decryptChunk
} from './core/chunk-crypto.js';

// Export streams
export {
  EncryptionStream,
  ChunkSerializationStream,
  TextEncodingStream
} from './core/encryption-stream.js';

export {
  DecryptionStream,
  ChunkDeserializationStream,
  TextDecodingStream
} from './core/decryption-stream.js';

// Export high-level file operations
export {
  encryptFile,
  decryptFile,
  encryptBuffer,
  decryptBuffer
} from './core/file-crypto.js';

// Export utilities
export { createAAD, validateAAD } from './utils/aad.js';

// Export security utilities
export {
  validateMasterKey,
  validateVideoId,
  validateChunkSize,
  validateChunkIndex,
  validateBuffer,
  validateEncoding,
  sanitizeVideoId,
  constantTimeCompare,
  secureWipe,
  RateLimiter,
  ValidationError,
  SecurityError,
  SECURITY_LIMITS
} from './utils/security.js';

// Export integrity utilities
export {
  calculateFileHash,
  calculateBufferHash,
  createManifest,
  validateManifest,
  verifyFileIntegrity,
  generateIntegrityReport,
  HashStream
} from './utils/integrity.js';
