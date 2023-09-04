const neededBits = require('./neededBits')
const constants = require('./constants')
const varInt = require('./varInt')

function getBlockIndex (pos) {
  return (pos.y << 8) | (pos.z << 4) | pos.x
}

module.exports = BitArray => {
  class ChunkSection {
    constructor (options = {}) {
      if (options === null) {
        return
      }

      if (typeof options.solidBlockCount === 'undefined') {
        options.solidBlockCount = 0
        if (options.data) {
          for (let i = 0; i < constants.BLOCK_SECTION_VOLUME; i++) {
            if (options.data.get(i) !== 0) {
              options.solidBlockCount += 1
            }
          }
        }
      }

      if (!options.data) {
        options.data = new BitArray({
          bitsPerValue: 4,
          capacity: constants.BLOCK_SECTION_VOLUME
        })
      }

      if (options.palette === undefined) { // dont create palette if its null
        options.palette = [0]
      }

      this.data = options.data
      this.palette = options.palette
      this.isDirty = false
      this.solidBlockCount = options.solidBlockCount
      this.maxBitsPerBlock = options.maxBitsPerBlock ?? constants.GLOBAL_BITS_PER_BLOCK
    }

    toJson () {
      return JSON.stringify({
        data: this.data.toJson(),
        palette: this.palette,
        isDirty: this.isDirty,
        solidBlockCount: this.solidBlockCount
      })
    }

    static fromJson (j) {
      const parsed = JSON.parse(j)
      return new ChunkSection({
        data: BitArray.fromJson(parsed.data),
        palette: parsed.palette,
        solidBlockCount: parsed.solidBlockCount
      })
    }

    getBlock (pos) {
      // index in palette or block id
      // depending on if the global palette or the section palette is used
      let stateId = this.data.get(getBlockIndex(pos))

      if (this.palette !== null) {
        stateId = this.palette[stateId]
      }

      return stateId
    }

    setBlock (pos, stateId) {
      const blockIndex = getBlockIndex(pos)
      let palettedIndex
      if (this.palette !== null) {
        // if necessary, add the block to the palette
        const indexInPalette = this.palette.indexOf(stateId) // binarySearch(this.palette, stateId, cmp)
        if (indexInPalette >= 0) {
          // block already in our palette
          palettedIndex = indexInPalette
        } else {
          // get new block palette index
          this.palette.push(stateId)
          palettedIndex = this.palette.length - 1

          // check if resize is necessary
          const bitsPerValue = neededBits(palettedIndex)

          // if new block requires more bits than the current data array
          if (bitsPerValue > this.data.getBitsPerValue()) {
            // is value still enough for section palette
            if (bitsPerValue <= constants.MAX_BITS_PER_BLOCK) {
              this.data = this.data.resizeTo(bitsPerValue)
            } else {
              // switches to the global palette
              const newData = new BitArray({
                bitsPerValue: this.maxBitsPerBlock,
                capacity: constants.BLOCK_SECTION_VOLUME
              })
              for (let i = 0; i < constants.BLOCK_SECTION_VOLUME; i++) {
                const stateId = this.palette[this.data.get(i)]
                newData.set(i, stateId)
              }

              this.palette = null
              palettedIndex = stateId
              this.data = newData
            }
          }
        }
      } else {
        // uses global palette
        palettedIndex = stateId
      }

      const oldBlock = this.getBlock(pos)
      if (stateId === 0 && oldBlock !== 0) {
        this.solidBlockCount -= 1
      } else if (stateId !== 0 && oldBlock === 0) {
        this.solidBlockCount += 1
      }

      this.data.set(blockIndex, palettedIndex)
    }

    isEmpty () {
      return this.solidBlockCount === 0
    }

    // writes the complete section into a smart buffer object
    write (smartBuffer) {
      // write solid block count
      smartBuffer.writeInt16BE(this.solidBlockCount)

      // write bits per block
      smartBuffer.writeUInt8(this.data.getBitsPerValue())

      // write palette
      if (this.palette !== null) {
        varInt.write(smartBuffer, this.palette.length)
        this.palette.forEach(paletteElement => {
          varInt.write(smartBuffer, paletteElement)
        })
      }

      // write block data
      varInt.write(smartBuffer, this.data.length())
      this.data.writeBuffer(smartBuffer)
    }
  }
  return ChunkSection
}
