const ChunkDumper = require('minecraft-chunk-dumper')

const chunkDumper = new ChunkDumper('1.14.4')

async function run () {
  await chunkDumper.start()
  chunkDumper.on('chunk', (x, z, bitMap, chunkData) => console.log('I received a chunk at ' + x + ';' + z))
  await chunkDumper.saveChunks('dumps/', 100)
  await chunkDumper.stop()
}

run().then(() => console.log('All done !'))
