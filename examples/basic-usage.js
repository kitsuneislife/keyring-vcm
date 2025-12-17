import {
  generateMasterKey,
  exportMasterKey,
  encryptFile,
  decryptFile
} from '../src/index.js';

async function main() {
  console.log('🔐 Video Chunk Crypto - Exemplo Básico\n');

  // 1. Gera master key
  console.log('📌 Passo 1: Gerando master key...');
  const masterKey = generateMasterKey();
  const masterKeyHex = exportMasterKey(masterKey);
  console.log(`   Master Key: ${masterKeyHex.substring(0, 32)}...`);
  console.log('   ⚠️  IMPORTANTE: Guarde esta chave em local seguro!\n');

  // 2. Configurações
  const videoId = 'my-video-2024-001';
  const inputFile = 'examples/sample-video.mp4'; // Substitua pelo seu arquivo
  const encryptedFile = 'examples/output/encrypted.bin';
  const decryptedFile = 'examples/output/decrypted.mp4';

  try {
    // 3. Encripta
    console.log('📌 Passo 2: Encriptando arquivo...');
    console.log(`   Input: ${inputFile}`);
    console.log(`   Output: ${encryptedFile}`);
    
    const encStats = await encryptFile({
      inputPath: inputFile,
      outputPath: encryptedFile,
      masterKey,
      videoId,
      encoding: 'binary' // ou 'base64' para texto
    });

    console.log(`   ✅ Encriptado com sucesso!`);
    console.log(`   - Total de chunks: ${encStats.totalChunks}`);
    console.log(`   - Bytes processados: ${encStats.bytesProcessed.toLocaleString()}\n`);

    // 4. Decripta
    console.log('📌 Passo 3: Decriptando arquivo...');
    console.log(`   Input: ${encryptedFile}`);
    console.log(`   Output: ${decryptedFile}`);

    const decStats = await decryptFile({
      inputPath: encryptedFile,
      outputPath: decryptedFile,
      masterKey,
      videoId,
      encoding: 'binary'
    });

    console.log(`   ✅ Decriptado com sucesso!`);
    console.log(`   - Chunks processados: ${decStats.chunksProcessed}`);
    console.log(`   - Bytes processados: ${decStats.bytesProcessed.toLocaleString()}\n`);

    console.log('🎉 Processo completo! Arquivo restaurado com sucesso.');
    console.log(`\n💡 Dica: Compare os arquivos original e restaurado:`);
    console.log(`   - Original: ${inputFile}`);
    console.log(`   - Restaurado: ${decryptedFile}`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
