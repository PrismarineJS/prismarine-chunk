const ChunkColumn = require('./ChunkColumn')

module.exports = registry => {
  return class extends ChunkColumn {
    registry = registry
    Block = require('prismarine-block')(registry)
    subChunkVersion = 8
  }
}
