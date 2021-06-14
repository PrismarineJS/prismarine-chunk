const SmartBuffer = require('smart-buffer').SmartBuffer
const ChunkSection = require('./ChunkSection')
const constants = require('../common/constants')
const varInt = require('../common/varInt')
const BitArray = require('../common/BitArrayNoSpan')

// wrap with func to provide version specific Block
module.exports = (Block, mcData) => {
  return class ChunkColumn {
    constructor (options) {
      this.minWorldHeight = options.minWorldHeight ?? 0
      this.maxWorldHeight = options.maxWorldHeight ?? constants.CHUNK_HEIGHT

      this.sectionMask = 0
      this.sections = Array(this.countVerticalSections()).fill(null)
      this.biomes = Array(4 * 4 * this.countVerticalBiomeGridSize()).fill(0)
    }

    initialize (func) {
      const p = { x: 0, y: 0, z: 0 }
      for (p.y = this.minWorldHeight; p.y < this.maxWorldHeight; p.y++) {
        for (p.z = 0; p.z < constants.SECTION_WIDTH; p.z++) {
          for (p.x = 0; p.x < constants.SECTION_WIDTH; p.x++) {
            const block = func(p.x, p.y, p.z)
            if (block === null) {
              continue
            }
            this.setBlock(p, block)
          }
        }
      }
    }

    // Json serialization/deserialization methods
    toJson () {
      return JSON.stringify({
        minWorldHeight: this.minWorldHeight,
        maxWorldHeight: this.maxWorldHeight,
        biomes: this.biomes,
        sectionMask: this.sectionMask,
        sections: this.sections.map(section => section === null ? null : section.toJson())
      })
    }

    static fromJson (j) {
      const parsed = JSON.parse(j)
      const chunk = new ChunkColumn()
      chunk.biomes = parsed.biomes
      chunk.sectionMask = parsed.sectionMask
      chunk.sections = parsed.sections.map(s => s === null ? null : ChunkSection.fromJson(s))

      if (parsed.minWorldHeight) {
        chunk.minWorldHeight = parsed.minWorldHeight
      }
      if (parsed.maxWorldHeight) {
        chunk.maxWorldHeight = parsed.maxWorldHeight
      }
      return chunk
    }

    // Utility methods used for retrieving section indices and checking block positions
    getMask () {
      return this.sectionMask
    }

    countVerticalBiomeGridSize () {
      const worldTotalHeight = this.maxWorldHeight - this.minWorldHeight
      return Math.floor((worldTotalHeight + 3) / 4)
    }

    countVerticalSections () {
      return this.getTopSectionCoord() - this.getBottomSectionCoord()
    }

    getSectionIndex (blockY) {
      const sectionCoord = getSectionCoord(blockY)
      const bottomSectionCoord = this.getBottomSectionCoord()
      return sectionCoord - bottomSectionCoord
    }

    getBiomeIndex (pos) {
      const i = (pos.x >> 2) & 3
      const j = (pos.y >> 2) - (this.minWorldHeight >> 2)
      const k = (pos.z >> 2) & 3
      return j << 4 | k << 2 | i
    }

    getBottomSectionCoord () {
      return getSectionCoord(this.minWorldHeight)
    }

    getTopSectionCoord () {
      return getSectionCoord(this.maxWorldHeight - 1) + 1
    }

    isBlockPosValid (pos) {
      return pos.y >= this.minWorldHeight && pos.y < this.maxWorldHeight &&
        pos.x >= 0 && pos.x < constants.SECTION_WIDTH &&
        pos.z >= 0 && pos.z < constants.SECTION_WIDTH
    }

    // Block State retrieval methods
    getBlockStateId (pos) {
      if (this.isBlockPosValid(pos)) {
        const section = this.sections[this.getSectionIndex(pos.y)]
        return section ? section.getBlock(toSectionPos(pos)) : 0
      }
      return 0
    }

    setBlockStateId (pos, stateId) {
      if (!this.isBlockPosValid(pos)) {
        return
      }

      const sectionIndex = this.getSectionIndex(pos.y)
      let section = this.sections[sectionIndex]

      if (!section) {
        // if it's air, do not create a new section for it
        if (stateId === 0) {
          return
        }
        section = new ChunkSection()
        this.sectionMask |= 1 << sectionIndex
        this.sections[sectionIndex] = section
      }
      section.setBlock(toSectionPos(pos), stateId)
    }

    // Biome methods
    getBiome (pos) {
      if (this.isBlockPosValid(pos)) {
        return this.biomes[this.getBiomeIndex(pos)]
      }
      return 0
    }

    setBiome (pos, biome) {
      if (this.isBlockPosValid(pos)) {
        this.biomes[this.getBiomeIndex(pos)] = biome
      }
    }

    // Convenience methods returning Block object
    getBlock (pos) {
      const biome = this.getBiome(pos)
      const stateId = this.getBlockStateId(pos)

      return Block.fromStateId(stateId, biome)
    }

    setBlock (pos, block) {
      if (typeof block.stateId !== 'undefined') {
        this.setBlockStateId(pos, block.stateId)
      }
      if (typeof block.biome !== 'undefined') {
        this.setBiome(pos, block.biome.id)
      }
    }

    // Legacy conversion methods accepting block type + metadata
    getBlockType (pos) {
      const blockStateId = this.getBlockStateId(pos)
      return mcData.blocksByStateId[blockStateId].id
    }

    getBlockData (pos) {
      const blockStateId = this.getBlockStateId(pos)
      return mcData.blocksByStateId[blockStateId].metadata
    }

    setBlockType (pos, id) {
      this.setBlockStateId(pos, mcData.blocks[id].minStateId)
    }

    setBlockData (pos, data) {
      this.setBlockStateId(pos, mcData.blocksByStateId[this.getBlockStateId(pos)].minStateId + data)
    }

    // Skylight data has been removed in 1.17, now it is computed client-side automatically
    // and never synced from the server in chunk packets
    getBlockLight (pos) {
      return 0
    }

    getSkyLight (pos) {
      return 15
    }

    setBlockLight (pos, light) {
    }

    setSkyLight (pos, light) {
    }

    // This functionality is PE-only according to docs
    getBiomeColor (pos) {
      return { r: 0, g: 0, b: 0 }
    }

    setBiomeColor (pos, r, g, b) {
    }

    dump () {
      const smartBuffer = new SmartBuffer()
      this.sections.forEach((section, i) => {
        if (section !== null && !section.isEmpty()) {
          section.write(smartBuffer)
        }
      })
      return smartBuffer.toBuffer()
    }

    loadBiomes (biomes) {
      this.biomes = biomes
    }

    load (data, bitMap = 0xffff) {
      const reader = SmartBuffer.fromBuffer(data)
      this.sectionMask |= bitMap

      for (let y = 0; y < this.countVerticalSections(); ++y) {
        // skip sections not present in the data
        if (!((bitMap >> y) & 1)) {
          continue
        }

        const solidBlockCount = reader.readInt16BE()

        // get number of bits a palette item use
        const bitsPerBlock = reader.readUInt8()

        // determine palette used for the chunk
        let palette

        // check if the section uses a section palette
        if (bitsPerBlock <= constants.MAX_BITS_PER_BLOCK) {
          palette = []
          // get number of palette items
          const numPaletteItems = varInt.read(reader)

          // save each palette item
          for (let i = 0; i < numPaletteItems; ++i) {
            palette.push(varInt.read(reader))
          }
        } else {
          // global palette is used
          palette = null
        }

        // number of items in data array
        varInt.read(reader) // numLongs
        const dataArray = new BitArray({
          bitsPerValue: bitsPerBlock,
          capacity: 4096
        }).readBuffer(reader)

        this.sections[y] = new ChunkSection({
          data: dataArray,
          palette,
          solidBlockCount
        })
      }
    }
  }
}

function getSectionCoord (coord) {
  return coord >> 4
}

function toSectionPos (pos) {
  return { x: pos.x, y: pos.y & 15, z: pos.z }
}
