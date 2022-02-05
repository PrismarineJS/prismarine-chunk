const BlobType = {
  ChunkSection: 0,
  Biomes: 1
}

class BlobEntry {
  x = 0
  y = 0
  z = 0
  type = BlobType.ChunkSection
  key // : string
  created = Date.now()
  constructor (args) {
    Object.assign(this, args)
  }
}

module.exports = { BlobType, BlobEntry }
