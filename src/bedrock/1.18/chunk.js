const ChunkColumn = require('./ChunkColumn')

module.exports = registry => {
  return class extends ChunkColumn {
    registry = registry
    Block = require('prismarine-block')(registry)
    subChunkVersion = 9

    static fromJson (str) {
      return new this(JSON.parse(str))
    }
  }
}
