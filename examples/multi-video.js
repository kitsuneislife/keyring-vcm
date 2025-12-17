import {
  generateMasterKey,
  exportMasterKey,
  importMasterKey,
  encryptFile,
  decryptFile
} from '../src/index.js';
import fs from 'fs';

async function multiVideoExample() {
  console.log('🎬 Exemplo: Múltiplos Vídeos com Uma Master Key\n');

  // 1. Gera uma única master key para toda a aplicação
  const masterKey = generateMasterKey();
  const masterKeyHex = exportMasterKey(masterKey);
  
  console.log('🔑 Master Key gerada:');
  console.log(`   ${masterKeyHex}\n`);
  console.log('   💾 Salve esta chave em: variável de ambiente, vault, KMS, etc.\n');

  // 2. Diferentes vídeos
  const videos = [
    { id: 'user-123-video-1', name: 'Tutorial.mp4' },
    { id: 'user-123-video-2', name: 'Apresentação.mp4' },
    { id: 'user-456-video-1', name: 'Demo.mp4' }
  ];

  // Cria arquivos de teste
  console.log('📝 Criando arquivos de teste...\n');
  for (const video of videos) {
    const testData = Buffer.from(`Conteúdo do ${video.name} - ID: ${video.id}`.repeat(1000));
    fs.writeFileSync(`examples/output/${video.name}`, testData);
  }

  try {
    // 3. Encripta cada vídeo
    console.log('🔐 Encriptando vídeos...\n');
    for (const video of videos) {
      const inputPath = `examples/output/${video.name}`;
      const outputPath = `examples/output/${video.name}.enc`;

      console.log(`   📹 ${video.name}`);
      console.log(`      ID: ${video.id}`);

      const stats = await encryptFile({
        inputPath,
        outputPath,
        masterKey,
        videoId: video.id
      });

      console.log(`      ✅ ${stats.totalChunks} chunks | ${stats.bytesProcessed} bytes\n`);
    }

    // 4. Simula perda da master key e recuperação
    console.log('🔄 Simulando recuperação da master key...\n');
    const recoveredMasterKey = importMasterKey(masterKeyHex);
    console.log('   ✅ Master key recuperada com sucesso!\n');

    // 5. Decripta um vídeo específico
    console.log('🔓 Decriptando um vídeo específico...\n');
    const targetVideo = videos[1];
    
    await decryptFile({
      inputPath: `examples/output/${targetVideo.name}.enc`,
      outputPath: `examples/output/${targetVideo.name}.dec`,
      masterKey: recoveredMasterKey,
      videoId: targetVideo.id
    });

    console.log(`   ✅ ${targetVideo.name} decriptado!\n`);

    // 6. Verifica
    const original = fs.readFileSync(`examples/output/${targetVideo.name}`);
    const decrypted = fs.readFileSync(`examples/output/${targetVideo.name}.dec`);

    if (Buffer.compare(original, decrypted) === 0) {
      console.log('✅ Verificação: Arquivo IDÊNTICO ao original!');
      console.log('\n💡 Observações:');
      console.log('   - Uma única master key protege todos os vídeos');
      console.log('   - Cada vídeo tem uma chave derivada única (via HKDF)');
      console.log('   - Impossível descriptografar sem o videoId correto');
      console.log('   - Perfeito para rotação de chaves e gestão centralizada');
    }

    // Cleanup
    console.log('\n🧹 Limpando arquivos de teste...');
    for (const video of videos) {
      fs.unlinkSync(`examples/output/${video.name}`);
      fs.unlinkSync(`examples/output/${video.name}.enc`);
    }
    fs.unlinkSync(`examples/output/${targetVideo.name}.dec`);
    console.log('   ✅ Concluído!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

multiVideoExample();
