const { ChunkVersion } = require('../common/constants')
const ChunkColumn = require('./ChunkColumn')
// The v9 subchunk (zero-bit runtime palettes, Bedrock 1.17.30+) is implemented under 1.18/; load it here for >= 1.17.30.
const SubChunkV9 = require('../1.18/SubChunk')

module.exports = (version) => {
  // Require once here to avoid requiring() on every new chunk instance
  const registry = version.blockRegistry || version
  const usesZeroBitRuntimePalettes = registry.version['>=']('1.17.30')
  const Block = require('prismarine-block')(registry)
  const Biome = require('prismarine-biome')(registry)
  return class Chunk extends ChunkColumn {
    constructor (options) {
      super(options, registry, Block, Biome)
      this.chunkVersion = this.chunkVersion || ChunkVersion.v1_16_0
      if (usesZeroBitRuntimePalettes) {
        this.Section = SubChunkV9
        this.subChunkVersion = 9
      } else {
        this.subChunkVersion = 8
      }
    }

    static fromJson (str) {
      return new this(JSON.parse(str))
    }
  }
}
