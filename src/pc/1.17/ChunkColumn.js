const SmartBuffer = require('smart-buffer').SmartBuffer
const ChunkSection = require('./ChunkSection')
const constants = require('../common/constants')
const varInt = require('../common/varInt')
const BitArray = require('../common/BitArrayNoSpan')
const BitSet = require('../common/BitSet')

// wrap with func to provide version specific Block
module.exports = (Block, mcData) => {
  return class ChunkColumn {
    constructor (options) {
      this.minWorldHeight = options?.minWorldHeight ?? 0
      this.maxWorldHeight = options?.maxWorldHeight ?? constants.CHUNK_HEIGHT
      this.sectionMask = new BitSet()

      const verticalSections = this.countVerticalSections()
      const biomeVerticalSections = Math.floor((this.maxWorldHeight - this.minWorldHeight + 3) / 4)

      this.sections = Array(verticalSections).fill(null)
      this.biomes = Array(4 * 4 * biomeVerticalSections).fill(0)

      this.skyLightSections = Array(verticalSections + 2).fill(null)
      this.blockLightSections = Array(verticalSections + 2).fill(null)
      this.skyLightMask = new BitSet()
      this.blockLightMask = new BitSet()
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
        sectionMask: this.sectionMask.toArray(),
        sections: this.sections.map(section => section === null ? null : section.toJson()),

        skyLightMask: this.skyLightMask.toArray(),
        blockLightMask: this.blockLightMask.toArray(),
        skyLightSections: this.skyLightSections.map(section => section === null ? null : section.toJson()),
        blockLightSections: this.blockLightSections.map(section => section === null ? null : section.toJson())
      })
    }

    static fromJson (j) {
      const parsed = JSON.parse(j)
      const chunk = new ChunkColumn()
      chunk.biomes = parsed.biomes
      chunk.sectionMask = BitSet.fromArray(parsed.sectionMask)
      chunk.sections = parsed.sections.map(s => s === null ? null : ChunkSection.fromJson(s))

      chunk.skyLightMask = BitSet.fromArray(parsed.skyLightMask)
      chunk.blockLightMask = BitSet.fromArray(parsed.blockLightMask)
      chunk.skyLightSections = parsed.skyLightSections.map(s => s === null ? null : BitArray.fromJson(s))
      chunk.blockLightSections = parsed.blockLightSections.map(s => s === null ? null : BitArray.fromJson(s))

      chunk.minWorldHeight = parsed.minWorldHeight
      chunk.maxWorldHeight = parsed.maxWorldHeight

      return chunk
    }

    // Utility methods used for retrieving section indices and checking block positions
    getMask () {
      return this.sectionMask.getWordAt(0)
    }

    getMaskArray () {
      return this.sectionMask.toArray()
    }

    countVerticalSections () {
      return (this.maxWorldHeight - this.minWorldHeight) >> 4
    }

    getSectionIndex (blockY) {
      const sectionCoord = getSectionCoord(blockY)
      const bottomSectionCoord = getSectionCoord(this.minWorldHeight)
      return sectionCoord - bottomSectionCoord
    }

    getLightSectionIndex (blockY) {
      const lightSectionCoord = getLightSectionCoord(blockY)
      const bottomSectionCoord = getSectionCoord(this.minWorldHeight)

      return lightSectionCoord - bottomSectionCoord
    }

    getBiomeIndex (pos) {
      const i = (pos.x >> 2) & 3
      const j = (pos.y >> 2) - (this.minWorldHeight >> 2)
      const k = (pos.z >> 2) & 3
      return j << 4 | k << 2 | i
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
        this.sectionMask.set(sectionIndex)
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

      const block = Block.fromStateId(stateId, biome)

      block.light = this.getBlockLight(pos)
      block.skyLight = this.getSkyLight(pos)

      return block
    }

    setBlock (pos, block) {
      if (typeof block.stateId !== 'undefined') {
        this.setBlockStateId(pos, block.stateId)
      }
      if (typeof block.biome !== 'undefined') {
        this.setBiome(pos, block.biome.id)
      }

      if (typeof block.skyLight !== 'undefined') {
        this.setSkyLight(pos, block.skyLight)
      }
      if (typeof block.light !== 'undefined') {
        this.setBlockLight(pos, block.light)
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

    // Lighting related functions
    getBlockLight (pos) {
      const section = this.blockLightSections[this.getLightSectionIndex(pos.y)]
      return section ? section.get(getSectionBlockIndex(pos)) : 0
    }

    getSkyLight (pos) {
      const section = this.skyLightSections[this.getLightSectionIndex(pos.y)]
      return section ? section.get(getSectionBlockIndex(pos)) : 0
    }

    setBlockLight (pos, light) {
      const sectionIndex = this.getLightSectionIndex(pos)
      let section = this.blockLightSections[sectionIndex]

      if (section === null) {
        if (light === 0) {
          return
        }
        section = new BitArray({
          bitsPerValue: 4,
          capacity: 4096
        })
        this.blockLightMask |= 1 << sectionIndex
        this.blockLightSections[sectionIndex] = section
      }

      section.set(getSectionBlockIndex(pos), light)
    }

    setSkyLight (pos, light) {
      const sectionIndex = this.getLightSectionIndex(pos)
      let section = this.skyLightSections[sectionIndex]

      if (section === null) {
        if (light === 0) {
          return
        }
        section = new BitArray({
          bitsPerValue: 4,
          capacity: 4096
        })
        this.skyLightMask |= 1 << sectionIndex
        this.skyLightSections[sectionIndex] = section
      }

      section.set(getSectionBlockIndex(pos), light)
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
      const packetBitSet = makeBitSetFromBitMap(bitMap)

      this.sectionMask.merge(packetBitSet)

      for (let y = 0; y < this.countVerticalSections(); ++y) {
        // skip sections not present in the data
        if (!packetBitSet.get(y)) {
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

    // Loads light from new package format first appearing in 1.17
    loadLightFromSectionData (skyLight, blockLight, skyLightMask, blockLightMask) {
      const skyLightBitSet = makeBitSetFromBitMap(skyLightMask)
      const blockLightBitSet = makeBitSetFromBitMap(blockLightMask)

      // Read sky light - skyLight is array of byte arrays, one per section, 2048 bytes each
      this.skyLightMask.merge(skyLightBitSet)
      let currentSectionIndex = 0

      for (let y = 0; y < this.countVerticalSections() + 2; y++) {
        if (!skyLightBitSet.get(y)) {
          continue
        }

        const sectionReader = Buffer.from(skyLight[currentSectionIndex++])
        this.skyLightSections[y] = new BitArray({
          bitsPerValue: 4,
          capacity: 4096
        }).readBuffer(SmartBuffer.fromBuffer(sectionReader))
      }

      // Read block light - same format like sky light
      this.blockLightMask.merge(blockLightBitSet)
      currentSectionIndex = 0

      for (let y = 0; y < this.countVerticalSections() + 2; y++) {
        if (!blockLightBitSet.get(y)) {
          continue
        }

        const sectionReader = Buffer.from(blockLight[currentSectionIndex++])
        this.blockLightSections[y] = new BitArray({
          bitsPerValue: 4,
          capacity: 4096
        }).readBuffer(SmartBuffer.fromBuffer(sectionReader))
      }
    }

    loadLight (data, skyLightMask, blockLightMask) {
      const reader = SmartBuffer.fromBuffer(data)
      const skyLightBitSet = makeBitSetFromBitMap(skyLightMask)
      const blockLightBitSet = makeBitSetFromBitMap(blockLightMask)

      // Read sky light
      this.skyLightMask |= skyLightMask
      for (let y = 0; y < this.countVerticalSections() + 2; y++) {
        if (!skyLightBitSet.get(y)) {
          continue
        }
        varInt.read(reader) // always 2048
        this.skyLightSections[y] = new BitArray({
          bitsPerValue: 4,
          capacity: 4096
        }).readBuffer(reader)
      }

      // Read block light
      this.blockLightMask |= blockLightMask
      for (let y = 0; y < this.countVerticalSections() + 2; y++) {
        if (!blockLightBitSet.get(y)) {
          continue
        }
        varInt.read(reader) // always 2048
        this.blockLightSections[y] = new BitArray({
          bitsPerValue: 4,
          capacity: 4096
        }).readBuffer(reader)
      }
    }

    dumpBiomes () {
      return this.biomes
    }

    dumpLight () {
      const smartBuffer = new SmartBuffer()

      this.skyLightSections.forEach((section) => {
        if (section !== null) {
          varInt.write(smartBuffer, 2048)
          section.writeBuffer(smartBuffer)
        }
      })

      this.blockLightSections.forEach((section) => {
        if (section !== null) {
          varInt.write(smartBuffer, 2048)
          section.writeBuffer(smartBuffer)
        }
      })

      return smartBuffer.toBuffer()
    }
  }
}

function makeBitSetFromBitMap (bitMap) {
  if (Array.isArray(bitMap)) {
    return BitSet.fromArray(bitMap)
  } else if (typeof bitMap === 'number') {
    return BitSet.fromArray([bitMap])
  } else {
    throw new Error('Unsupported type of bitMap: not an array or number')
  }
}

function getSectionBlockIndex (pos) {
  return ((pos.y & 15) << 8) | (pos.z << 4) | pos.x
}

function getLightSectionCoord (coord) {
  return Math.floor(coord / 16) + 1
}

function getSectionCoord (coord) {
  return coord >> 4
}

function toSectionPos (pos) {
  return { x: pos.x, y: pos.y & 15, z: pos.z }
}
