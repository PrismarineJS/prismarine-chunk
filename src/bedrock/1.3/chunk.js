const { ChunkVersion } = require('../common/constants')
const ChunkColumn = require('./ChunkColumn')

module.exports = registry => {
  const Block = require('prismarine-block')(registry)
  return class extends ChunkColumn {
    registry = registry
    Block = Block
    chunkVersion = this.chunkVersion || ChunkVersion.v1_16_0
    subChunkVersion = 8

    static fromJson (str) {
      return new this(JSON.parse(str), registry, Block)
    }
  }
}
