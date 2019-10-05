const SmartBuffer = require('smart-buffer').SmartBuffer
const Vec3 = require('vec3').Vec3
const ChunkSection = require('./ChunkSection')
const constants = require('./constants')
const BitArray = require('./BitArray')
const varInt = require('./varInt')
const assert = require('assert')

// wrap with func to provide version specific Block
module.exports = (Block, mcData) => {
  return class ChunkColumn {
    constructor () {
      this.sections = Array(constants.NUM_SECTIONS).fill(null)
      this.biomes = Array(
        constants.SECTION_WIDTH * constants.SECTION_WIDTH
      ).fill(1)
    }

    initialize (func) {}

    getBlock (pos) {
      assertPos(pos)
      const section = this.sections[getSectionIndex(pos)]
      const biome = this.getBiome(pos)
      if (section === null) {
        return Block.fromStateId(0, biome)
      }
      const stateId = section.getBlock(toSectionPos(pos))
      const block = Block.fromStateId(stateId, biome)
      block.light = this.getBlockLight(pos)
      block.skyLight = this.getSkyLight(pos)
      return block
    }

    setBlock (pos, block) {
      assertPos(pos)
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

    getBlockType (pos) {
      assertPos(pos)
      const blockStateId = this.getBlock(pos)
      return mcData.blocksByStateId[blockStateId].id
    }

    getBlockStateId (pos) {
      assertPos(pos)
      return this.getBlock(pos)
    }

    getBlockData (pos) {
      // TODO
      return 0
    }

    getBlockLight (pos) {
      assertPos(pos)
      const section = this.sections[getSectionIndex(pos)]
      return section ? section.getBlockLight(toSectionPos(pos)) : 15
    }

    getSkyLight (pos) {
      assertPos(pos)
      const section = this.sections[getSectionIndex(pos)]
      return section ? section.getSkyLight(toSectionPos(pos)) : 15
    }

    getBiome (pos) {
      assertPos(pos)
      return this.biomes[getBiomeIndex(pos)]
    }

    getBiomeColor (pos) {
      assertPos(pos)
      // TODO
      return {
        r: 0,
        g: 0,
        b: 0
      }
    }

    setBlockStateId (pos, stateId) {
      assertPos(pos)
      const sectionIndex = getSectionIndex(pos)
      const chunkSection = this.sections[sectionIndex]
      let section

      if (chunkSection !== null) {
        section = chunkSection
      } else {
        // if it's air
        if (stateId === 0) {
          return
        }
        section = new ChunkSection()
        this.sections[sectionIndex] = section
      }

      section.setBlock(new Vec3(pos.x, pos.y % 16, pos.z), stateId)
    }

    setBlockType (pos, id) {
      assertPos(pos)
      this.setBlockStateId(pos, mcData.blocks[id].minStateId)
    }

    setBlockData (pos, data) {
      assertPos(pos)
      // TODO
    }

    setBlockLight (pos, light) {
      assertPos(pos)
      assertLight(light)
      const section = this.sections[getSectionIndex(pos)]
      return section && section.setBlockLight(toSectionPos(pos), light)
    }

    setSkyLight (pos, light) {
      assertPos(pos)
      assertLight(light)
      const section = this.sections[getSectionIndex(pos)]
      return section && section.setSkyLight(toSectionPos(pos), light)
    }

    setBiome (pos, biome) {
      assertPos(pos)
      this.biomes[(pos.z * 16) | pos.x] = biome
    }

    setBiomeColor (pos, r, g, b) {
      assertPos(pos)
      // TODO
    }

    getMask () {
      return this.sections.reduce((mask, section, index) => {
        if (section === null || section.isEmpty()) {
          return mask
        }
        return mask | (1 << index)
      }, 0)
    }

    dump () {
      const smartBuffer = new SmartBuffer()
      this.sections.forEach((section, i) => {
        if (section !== null && !section.isEmpty()) {
          section.write(smartBuffer)
        }
      })

      // write biome data
      this.biomes.forEach(biome => {
        smartBuffer.writeInt32LE(biome)
      })

      return smartBuffer.toBuffer()
    }

    load (data, bitMap = 0b1111111111111111, skyLightSent = true) {
      // make smartbuffer from node buffer
      // so that we doesn't need to maintain a cursor
      const reader = SmartBuffer.fromBuffer(data)

      for (let y = 0; y < constants.NUM_SECTIONS; ++y) {
        // does `data` contain this chunk?
        if (!((bitMap >> y) & 1)) {
          // we can skip write a section if it isn't requested
          continue
        }

        // keep temporary palette
        let palette
        let skyLight

        // get number of bits a palette item use
        const bitsPerBlock = reader.readUInt8()

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
        const numLongs = varInt.read(reader)
        const dataArray = new BitArray({
          bitsPerValue: Math.ceil((numLongs * 64) / 4096),
          capacity: 4096,
          data: [...Array(numLongs).keys()].map(() => reader.readBigUInt64BE())
        })

        const blockLight = new BitArray({
          bitsPerValue: 4,
          capacity: 4096,
          // we know it will always be 256 values since bitsPerValue is constant
          data: [...Array(256).keys()].map(() => reader.readBigUInt64LE())
        })

        if (skyLightSent) {
          skyLight = new BitArray({
            bitsPerValue: 4,
            capacity: 4096,
            // we know it will always be 256 values since bitsPerValue is constant
            data: [...Array(256).keys()].map(() => reader.readBigUInt64LE())
          })
        }

        const section = new ChunkSection({
          data: dataArray,
          palette,
          blockLight,
          ...(skyLightSent ? { skyLight } : {})
        })
        this.sections[y] = section
      }

      // read biomes
      for (let z = 0; z < constants.SECTION_WIDTH; z++) {
        for (let x = 0; x < constants.SECTION_WIDTH; x++) {
          this.setBiome(new Vec3(x, 0, z), reader.readInt32LE())
        }
      }
    }
  }
}

function assertPos (pos) {
  assert(pos.x >= 0 && pos.x < 256, 'pos.x lies outside the 0-255 range')
  assert(pos.y >= 0 && pos.y < 256, 'pos.y lies outside the 0-255 range')
  assert(pos.z >= 0 && pos.z < 256, 'pos.z lies outside the 0-255 range')
}

function assertLight (light) {
  assert(light >= 0 && light < 16, 'light lies outside the 0-15 range')
}

function getSectionIndex (pos) {
  return Math.floor(pos.y / 16)
}

function getBiomeIndex (pos) {
  return (pos.z * 16) | pos.x
}

function toSectionPos (pos) {
  return new Vec3(pos.x, pos.y % 16, pos.z)
}
