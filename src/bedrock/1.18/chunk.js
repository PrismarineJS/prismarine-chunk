const ChunkColumn = require('./ChunkColumn')

module.exports = registry => {
  const Block = require('prismarine-block')(registry)
  return class extends ChunkColumn {
    registry = registry
    Block = Block
    subChunkVersion = 9

    static fromJson (str) {
      return new this(JSON.parse(str), registry, Block)
    }
  }
}
