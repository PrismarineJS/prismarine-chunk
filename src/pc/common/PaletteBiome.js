const constants = require('./constants')
const paletteContainer = require('./PaletteContainer')
const varInt = require('../common/varInt')
const SingleValueContainer = paletteContainer.SingleValueContainer
const IndirectPaletteContainer = paletteContainer.IndirectPaletteContainer
const DirectPaletteContainer = paletteContainer.DirectPaletteContainer

function getBiomeIndex (pos) {
  return (pos.y << 4) | (pos.z << 2) | pos.x
}

class BiomeSection {
  constructor (options) {
    this.noSizePrefix = options?.noSizePrefix // 1.21.5+ writes no size prefix before chunk containers, it's computed dynamically to save 1 byte
    this.data = options?.data ?? new SingleValueContainer({
      noSizePrefix: this.noSizePrefix,
      value: options?.singleValue ?? 0,
      bitsPerValue: constants.MIN_BITS_PER_BIOME,
      capacity: constants.BIOME_SECTION_VOLUME,
      maxBits: constants.MAX_BITS_PER_BIOME
    })
  }

  toJson () {
    return this.data.toJson()
  }

  static fromJson (j) {
    return new BiomeSection({
      data: paletteContainer.fromJson(j)
    })
  }

  get (pos) {
    return this.data.get(getBiomeIndex(pos))
  }

  set (pos, biomeId) {
    this.data = this.data.set(getBiomeIndex(pos), biomeId)
  }

  static fromLocalPalette ({ palette, data, noSizePrefix }) {
    return new BiomeSection({
      noSizePrefix,
      data: palette.length === 1
        ? new SingleValueContainer({
          noSizePrefix,
          value: palette[0],
          bitsPerValue: constants.MIN_BITS_PER_BIOME,
          capacity: constants.BIOME_SECTION_VOLUME,
          maxBits: constants.MAX_BITS_PER_BIOME
        })
        : new IndirectPaletteContainer({
          noSizePrefix,
          palette,
          data
        })
    })
  }

  write (smartBuffer) {
    this.data.write(smartBuffer)
  }

  static read (smartBuffer, maxBitsPerBiome = constants.GLOBAL_BITS_PER_BIOME, noSizePrefix) {
    const bitsPerBiome = smartBuffer.readUInt8()
    if (bitsPerBiome > 8) throw new Error(`Bits per biome is too big: ${bitsPerBiome}`)

    // Case 1: Single Value Container (all biomes in the section are the same)
    if (bitsPerBiome === 0) {
      const section = new BiomeSection({
        noSizePrefix,
        singleValue: varInt.read(smartBuffer)
      })
      if (!noSizePrefix) smartBuffer.readUInt8()
      return section
    }

    // Case 2: Direct Palette (global palette)
    if (bitsPerBiome > constants.MAX_BITS_PER_BIOME) {
      return new BiomeSection({
        noSizePrefix,
        data: new DirectPaletteContainer({
          noSizePrefix,
          bitsPerValue: maxBitsPerBiome,
          capacity: constants.BIOME_SECTION_VOLUME
        }).readBuffer(smartBuffer, bitsPerBiome)
      })
    }

    // Case 3: Indirect Palette (local palette)
    const palette = []
    const paletteLength = varInt.read(smartBuffer)
    for (let i = 0; i < paletteLength; ++i) {
      palette.push(varInt.read(smartBuffer))
    }

    return new BiomeSection({
      data: new IndirectPaletteContainer({
        noSizePrefix,
        bitsPerValue: bitsPerBiome,
        capacity: constants.BIOME_SECTION_VOLUME,
        maxBits: constants.MAX_BITS_PER_BIOME,
        palette
      }).readBuffer(smartBuffer, bitsPerBiome)
    })
  }
}

module.exports = BiomeSection
