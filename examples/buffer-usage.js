import {
  generateMasterKey,
  encryptBuffer,
  decryptBuffer
} from '../src/index.js';

async function main() {
  console.log('🔐 Exemplo: Encriptação em Memória (Buffer)\n');

  // Dados de exemplo
  const originalData = Buffer.from('Este é um vídeo secreto! 🎥🔒'.repeat(10000));
  console.log(`📦 Tamanho dos dados: ${originalData.length.toLocaleString()} bytes\n`);

  // Gera chave
  const masterKey = generateMasterKey();
  const videoId = 'buffer-example-001';

  try {
    // Encripta
    console.log('🔐 Encriptando...');
    const startEnc = Date.now();
    const encryptedChunks = await encryptBuffer({
      data: originalData,
      masterKey,
      videoId
    });
    const encTime = Date.now() - startEnc;

    console.log(`✅ Encriptado em ${encTime}ms`);
    console.log(`   - Chunks gerados: ${encryptedChunks.length}`);
    
    const totalEncSize = encryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const overhead = ((totalEncSize - originalData.length) / originalData.length * 100).toFixed(2);
    console.log(`   - Tamanho total: ${totalEncSize.toLocaleString()} bytes`);
    console.log(`   - Overhead: ${overhead}%\n`);

    // Decripta
    console.log('🔓 Decriptando...');
    const startDec = Date.now();
    const decryptedData = await decryptBuffer({
      chunks: encryptedChunks,
      masterKey,
      videoId
    });
    const decTime = Date.now() - startDec;

    console.log(`✅ Decriptado em ${decTime}ms`);
    console.log(`   - Tamanho: ${decryptedData.length.toLocaleString()} bytes\n`);

    // Verifica integridade
    if (Buffer.compare(originalData, decryptedData) === 0) {
      console.log('✅ Verificação: Dados são IDÊNTICOS (bit-by-bit)');
      console.log('🎉 Processo completo com sucesso!');
    } else {
      console.log('❌ ERRO: Dados são diferentes!');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
