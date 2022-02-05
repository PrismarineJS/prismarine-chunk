const { StorageType } = require('../common/constants')
const { PalettedStorage } = require('../common/PalettedStorage')

class BiomeSection {
  constructor (registry, y) {
    this.Biome = require('prismarine-biome')(registry)
    this.y = y
    this.biomes = new PalettedStorage(1)
    this.palette = [0]
  }

  readLegacy2D (stream) {
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        this.setBiome(x, 15, z, stream.readByte())
      }
    }
  }

  copy (other) {
    this.biomes = PalettedStorage.copyFrom(other.biomes)
    this.palette = JSON.parse(JSON.stringify(other.palette))
    this.y = other.y
  }

  read (type, buf, previousSection) {
    const paletteType = buf.readByte()
    // below should always be 1, so we use IDs
    // const usingNetworkRuntimeIds = paletteType & 1
    const bitsPerBlock = paletteType >> 1

    if (bitsPerBlock === 0) {
      this.biomes.fill(0)
      this.palette.push(type === StorageType.LocalPersistence ? buf.readLInt() : (buf.readUnsignedVarInt() >> 1))
      return // short circuit
    }

    this.biomes = new PalettedStorage(bitsPerBlock)
    this.biomes.read(buf)

    // now read palette
    this.palette = []
    if (type === StorageType.NetworkPersistence) {
      // Shift 1 bit to un-zigzag (we cannot be negative)
      // ask mojang why these are signed at all...
      const biomePaletteLength = buf.readUnsignedVarInt() >> 1
      for (let i = 0; i < biomePaletteLength; i++) {
        this.palette.push(buf.readUnsignedVarInt() >> 1)
      }
    } else {
      const biomePaletteLength = buf.readLInt()
      for (let i = 0; i < biomePaletteLength; i++) {
        this.palette.push(buf.readLInt())
      }
    }
  }

  // TODO: handle resizing
  setBiomeId (x, y, z, biomeId) {
    if (!this.palette.includes(biomeId)) {
      this.palette.push(biomeId)
    }

    this.biomes[((x << 8) | (z << 4) | y)] = this.palette.indexOf(biomeId)
  }

  getBiomeId (x, y, z) {
    return this.palette[this.biomes[((x << 8) | (z << 4) | y)]]
  }

  getBiome (pos) {
    return new this.Biome(this.getBiomeId(pos.x, pos.y, pos.z))
  }

  setBiome (pos, biome) {
    this.setBiomeId(pos.x, pos.y, pos.z, biome.id)
  }

  export (type, stream) {
    const bitsPerBlock = Math.ceil(Math.log2(this.palette.length)) || 1
    stream.writeByte((bitsPerBlock << 1) | 1)
    this.biomes.write(stream)
    if (type === StorageType.NetworkPersistence) {
      stream.writeUnsignedVarInt(this.palette.length << 1)
      for (const biome of this.palette) {
        stream.writeUnsignedVarInt(biome << 1)
      }
    } else {
      stream.writeLInt(this.palette.length)
      for (const biome of this.palette) {
        stream.writeLInt(biome)
      }
    }
  }

  // Just write the top most layer biomes
  exportLegacy2D (stream) {
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const y = 15
        const biome = this.getBiomeId(x, y, z)
        stream.writeByte(biome)
      }
    }
  }
}

module.exports = BiomeSection
