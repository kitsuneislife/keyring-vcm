import fs from 'fs';
import {
  generateMasterKey,
  deriveVideoKey,
  EncryptionStream,
  ChunkSerializationStream,
  DecryptionStream,
  ChunkDeserializationStream
} from '../src/index.js';
import { pipeline } from 'stream/promises';

async function encryptWithProgress() {
  console.log('🔐 Exemplo: Streaming com Progresso\n');

  const masterKey = generateMasterKey();
  const videoId = 'streaming-example-001';
  const videoKey = deriveVideoKey(masterKey, videoId);

  // Cria arquivo de teste
  const inputFile = 'examples/output/test-stream.bin';
  const outputFile = 'examples/output/test-stream.enc';
  
  console.log('📝 Criando arquivo de teste (5MB)...');
  const testData = Buffer.alloc(5 * 1024 * 1024);
  for (let i = 0; i < testData.length; i++) {
    testData[i] = i % 256;
  }
  fs.writeFileSync(inputFile, testData);

  // Streams
  const inputStream = fs.createReadStream(inputFile, { highWaterMark: 64 * 1024 });
  const encryptionStream = new EncryptionStream(videoKey, videoId);
  const serializationStream = new ChunkSerializationStream();
  const outputStream = fs.createWriteStream(outputFile);

  // Monitor de progresso
  let totalBytes = 0;
  let chunkCount = 0;

  encryptionStream.on('data', () => {
    chunkCount++;
    const stats = encryptionStream.getStats();
    totalBytes = stats.bytesProcessed;
    
    const progress = (totalBytes / testData.length * 100).toFixed(1);
    process.stdout.write(`\r🔐 Progresso: ${progress}% | Chunks: ${chunkCount} | Bytes: ${totalBytes.toLocaleString()}`);
  });

  try {
    // Executa pipeline
    await pipeline(
      inputStream,
      encryptionStream,
      serializationStream,
      outputStream
    );

    console.log('\n✅ Encriptação completa!\n');

    // Agora decripta
    console.log('🔓 Decriptando...');

    const decInput = fs.createReadStream(outputFile);
    const deserializationStream = new ChunkDeserializationStream();
    const decryptionStream = new DecryptionStream(videoKey, videoId);
    const decOutput = fs.createWriteStream('examples/output/test-stream.dec');

    let decChunks = 0;
    decryptionStream.on('data', () => {
      decChunks++;
      process.stdout.write(`\r🔓 Decriptando... Chunks: ${decChunks}`);
    });

    await pipeline(
      decInput,
      deserializationStream,
      decryptionStream,
      decOutput
    );

    console.log('\n✅ Decriptação completa!\n');

    // Verifica
    const original = fs.readFileSync(inputFile);
    const decrypted = fs.readFileSync('examples/output/test-stream.dec');

    if (Buffer.compare(original, decrypted) === 0) {
      console.log('✅ Verificação: Arquivos IDÊNTICOS!');
      console.log('🎉 Streaming completo com sucesso!');
    } else {
      console.log('❌ ERRO: Arquivos diferentes!');
    }

    // Cleanup
    fs.unlinkSync(inputFile);
    fs.unlinkSync(outputFile);
    fs.unlinkSync('examples/output/test-stream.dec');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  }
}

encryptWithProgress();
