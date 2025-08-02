const constants = require('./constants')
const paletteContainer = require('./PaletteContainer')
const varInt = require('../common/varInt')
const SingleValueContainer = paletteContainer.SingleValueContainer
const IndirectPaletteContainer = paletteContainer.IndirectPaletteContainer
const DirectPaletteContainer = paletteContainer.DirectPaletteContainer

function getBlockIndex (pos) {
  return (pos.y << 8) | (pos.z << 4) | pos.x
}

class ChunkSection {
  constructor (options) {
    this.noSizePrefix = options?.noSizePrefix // 1.21.5+ writes no size prefix before chunk containers, it's computed dynamically to save 1 byte
    this.data = options?.data
    if (!this.data) {
      const value = options?.singleValue ?? 0
      this.data = new SingleValueContainer({
        value,
        bitsPerValue: constants.MIN_BITS_PER_BLOCK,
        capacity: constants.BLOCK_SECTION_VOLUME,
        maxBits: constants.MAX_BITS_PER_BLOCK,
        maxBitsPerBlock: options?.maxBitsPerBlock ?? constants.GLOBAL_BITS_PER_BLOCK,
        noSizePrefix: this.noSizePrefix
      })
      this.solidBlockCount = value ? constants.BLOCK_SECTION_VOLUME : 0
    } else {
      this.solidBlockCount = options?.solidBlockCount ?? 0
      if (options?.solidBlockCount == null) {
        for (let i = 0; i < constants.BLOCK_SECTION_VOLUME; ++i) {
          if (this.data.get(i)) { this.solidBlockCount++ }
        }
      }
    }
    this.palette = this.data.palette
  }

  toJson () {
    return JSON.stringify({
      data: this.data.toJson(),
      solidBlockCount: this.solidBlockCount
    })
  }

  static fromJson (j) {
    const parsed = JSON.parse(j)
    return new ChunkSection({
      data: paletteContainer.fromJson(parsed.data),
      solidBlockCount: parsed.solidBlockCount
    })
  }

  get (pos) {
    return this.data.get(getBlockIndex(pos))
  }

  set (pos, stateId) {
    const blockIndex = getBlockIndex(pos)

    const oldBlock = this.get(pos)
    if (stateId === 0 && oldBlock !== 0) {
      this.solidBlockCount -= 1
    } else if (stateId !== 0 && oldBlock === 0) {
      this.solidBlockCount += 1
    }

    this.data = this.data.set(blockIndex, stateId)
    this.palette = this.data.palette
  }

  isEmpty () {
    return this.solidBlockCount === 0
  }

  write (smartBuffer) {
    smartBuffer.writeInt16BE(this.solidBlockCount)
    this.data.write(smartBuffer)
  }

  static fromLocalPalette ({ data, palette, noSizePrefix }) {
    return new ChunkSection({
      noSizePrefix,
      data: palette.length === 1
        ? new SingleValueContainer({
          noSizePrefix,
          value: palette[0],
          bitsPerValue: constants.MIN_BITS_PER_BLOCK,
          capacity: constants.BIOME_SECTION_VOLUME,
          maxBits: constants.MAX_BITS_PER_BLOCK
        })
        : new IndirectPaletteContainer({
          noSizePrefix,
          data,
          palette
        })
    })
  }

  static read (smartBuffer, maxBitsPerBlock = constants.GLOBAL_BITS_PER_BLOCK, noSizePrefix) {
    const solidBlockCount = smartBuffer.readInt16BE()
    const bitsPerBlock = smartBuffer.readUInt8()
    if (bitsPerBlock > 16) throw new Error(`Bits per block is too big: ${bitsPerBlock}`)
    // Case 1: Single Value Container (all blocks in the section are the same)
    if (bitsPerBlock === 0) {
      const section = new ChunkSection({
        noSizePrefix,
        solidBlockCount,
        singleValue: varInt.read(smartBuffer),
        maxBitsPerBlock
      })
      if (!noSizePrefix) smartBuffer.readUInt8()
      return section
    }

    // Case 2: Direct Palette (global palette)
    if (bitsPerBlock > constants.MAX_BITS_PER_BLOCK) {
      return new ChunkSection({
        noSizePrefix,
        solidBlockCount,
        data: new DirectPaletteContainer({
          noSizePrefix,
          bitsPerValue: maxBitsPerBlock,
          capacity: constants.BLOCK_SECTION_VOLUME
        }).readBuffer(smartBuffer, bitsPerBlock)
      })
    }

    // Case 3: Indirect Palette (local palette)
    const palette = []
    const paletteLength = varInt.read(smartBuffer)
    for (let i = 0; i < paletteLength; ++i) {
      palette.push(varInt.read(smartBuffer))
    }

    return new ChunkSection({
      noSizePrefix,
      solidBlockCount,
      data: new IndirectPaletteContainer({
        noSizePrefix,
        bitsPerValue: bitsPerBlock,
        capacity: constants.BLOCK_SECTION_VOLUME,
        maxBits: constants.MAX_BITS_PER_BLOCK,
        maxBitsPerBlock,
        palette
      }).readBuffer(smartBuffer, bitsPerBlock)
    })
  }
}

module.exports = ChunkSection
