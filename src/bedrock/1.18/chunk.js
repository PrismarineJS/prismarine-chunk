const { ChunkVersion } = require('../common/constants')
const ChunkColumn = require('./ChunkColumn')

module.exports = registry => {
  const Block = require('prismarine-block')(registry)
  return class extends ChunkColumn {
    registry = registry
    Block = Block
    chunkVersion = this.chunkVersion || ChunkVersion.v1_18_0
    subChunkVersion = 9

    static fromJson (str) {
      return new this(JSON.parse(str), registry, Block)
    }
  }
}
