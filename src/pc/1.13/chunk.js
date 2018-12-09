const w = 16
const l = 16
const h = 256

const CHUNK_VOLUME = w * l * h
const CHUNK_CROSS_SECTION = w * l

const X3_CHUNK_VOLUME = 3 * CHUNK_VOLUME

const BUFFER_SIZE = (CHUNK_VOLUME * 3) + CHUNK_CROSS_SECTION

const ProtoDef = require('protodef').ProtoDef
const { readUInt4LE, writeUInt4LE } = require('uint4')
const { reverseBits16, reverseBits32, reverseBits } = require('../../reverse-bits')

module.exports = loader

function loader (mcVersion) {
  Block = require('prismarine-block')(mcVersion)
  mcData = require('minecraft-data')(mcVersion)

  // MC counts the longs, protodef wants the bytes. This is responsible for that conversion.
  const longToByte = [
    function (buffer, offset, typeArgs) { // readLongToByte
      const results = this.read(buffer, offset, typeArgs.type, {})
      return {
        value: Math.ceil(results.value << 3),
        size: results.size
      }
    },
    function (value, buffer, offset, typeArgs) { // writeLongToByte
      return this.write(value >>> 3, buffer, offset, typeArgs.type, {})
    },
    function (value, typeArgs) { // sizeOfLongToByte
      return this.sizeOf(value >>> 3, typeArgs.type, {})
    }
  ]

  const p = ['container', [{
    'name': 'bitsPerBlock',
    'type': 'u8'
  },
  {
    'name': 'palette',
    'type': ['switch', {
      'compareTo': 'bitsPerBlock',
      'fields': {
        '0': 'indirectPalette',
        '1': 'indirectPalette',
        '2': 'indirectPalette',
        '3': 'indirectPalette',
        '4': 'indirectPalette',
        '5': 'indirectPalette',
        '6': 'indirectPalette',
        '7': 'indirectPalette',
        '8': 'indirectPalette'
      },
      'default': 'void'
    }
    ]
  },
  {
    'name': 'dataArray',
    'type': ['buffer', {
      'countType': ['longToByte', {
        'type': 'varint'
      }]
    }]
  },
  {
    'name': 'blockLight',
    'type': ['buffer', {
      'count': 16 * 16 * 16 / 2
    }]
  },
  {
    'name': 'skyLight',
    'type': ['buffer', {
      'count': 16 * 16 * 16 / 2
    }]
  }
  ]]

  const pns = ['container', [{
    'name': 'bitsPerBlock',
    'type': 'u8'
  },
  {
    'name': 'palette',
    'type': [
      'switch',
      {
        'compareTo': 'bitsPerBlock',
        'fields': {
          '0': 'indirectPalette',
          '1': 'indirectPalette',
          '2': 'indirectPalette',
          '3': 'indirectPalette',
          '4': 'indirectPalette',
          '5': 'indirectPalette',
          '6': 'indirectPalette',
          '7': 'indirectPalette',
          '8': 'indirectPalette'
        },
        'default': 'void'
      }
    ]
  },
  {
    'name': 'dataArray',
    'type': ['buffer', {
      'countType': ['longToByte', {
        'type': 'varint'
      }]
    }]
  },
  {
    'name': 'blockLight',
    'type': ['buffer', {
      'count': 16 * 16 * 16 / 2
    }]
  }
  ]]

  const indirectPalette = ['array', {
    'type': 'varint',
    'countType': 'varint'
  }]

  Chunk.packingProtocol = new ProtoDef()
  Chunk.packingProtocol.addType('indirectPalette', indirectPalette)
  Chunk.packingProtocol.addType('longToByte', longToByte)
  Chunk.packingProtocol.addType('section', p)
  Chunk.packingProtocol.addType('sectionNoSkylight', pns)

  Chunk.w = w
  Chunk.l = l
  Chunk.h = h
  Chunk.BUFFER_SIZE = BUFFER_SIZE
  return Chunk
}

let Block, mcData

const exists = val => val !== undefined
const getArrayPosition = (pos) => pos.x + w * (pos.z + l * pos.y)
const getBlockCursor = (pos) => getArrayPosition(pos) << 1
const getBlockLightCursor = (pos) => (getArrayPosition(pos) >>> 1) + (CHUNK_VOLUME << 1)
const getSkyLightCursor = (pos) => (getArrayPosition(pos) >>> 1) + (CHUNK_VOLUME >>> 1) * 5
const getBiomeCursor = (pos) => X3_CHUNK_VOLUME + (pos.z * w) + pos.x

class Chunk {
  constructor () {
    this.data = Buffer.alloc(BUFFER_SIZE)
  }

  initialize (iniFunc) {
    const skylight = (CHUNK_VOLUME >>> 1) * 5
    const light = CHUNK_VOLUME << 1

    let biome = X3_CHUNK_VOLUME - 1

    const data = this.data
    let y
    for (let n = 0; n < CHUNK_VOLUME; n++) {
      // x = n & 15;
      // z = (n & 255) >>> 4;
      y = n >>> 8
      const block = iniFunc(n & 15, y, (n & 255) >>> 4, n)
      if (block !== null) {
        data.writeUInt16LE(block.stateId, n << 1)
        writeUInt4LE(data, block.light, (n >>> 3) + light)
        writeUInt4LE(data, block.skyLight, (n >>> 3) + skylight)
        if (y === 0) {
          biome++
          data.writeUInt8(block.biome.id || 0, biome)
        }
      } else if (y === 0) {
        biome++
      }
    }
  }

  getBlock (pos) {
    const block = Block.fromStateId(this.getBlockStateId(pos), this.getBiome(pos))
    block.light = this.getBlockLight(pos)
    block.skyLight = this.getSkyLight(pos)
    return block
  }

  setBlock (pos, block) {
    if (exists(block.stateId)) { this.setBlockStateId(pos, block.stateId) }
    if (exists(block.biome)) { this.setBiome(pos, block.biome.id) }
    if (exists(block.skyLight)) { this.setSkyLight(pos, block.skyLight) }
    if (exists(block.light)) { this.setBlockLight(pos, block.light) }
  }

  getBiomeColor (pos) {
    // polyfill
    return {
      r: 0,
      g: 0,
      b: 0
    }
  }

  setBiomeColor (pos, r, g, b) {
    // polyfill
  }

  getBlockType (pos) {
    const blockStateId = this.getBlockStateId(pos)
    return mcData.blocksByStateId[blockStateId].id
  }

  getBlockStateId (pos) {
    const cursor = getBlockCursor(pos)
    return this.data.readUInt16LE(cursor) % 8192
  }

  getBlockData (pos) {
    return 0
  }

  getBlockLight (pos) {
    const cursor = getBlockLightCursor(pos)
    return readUInt4LE(this.data, cursor)
  }

  getSkyLight (pos) {
    const cursor = getSkyLightCursor(pos)
    return readUInt4LE(this.data, cursor)
  }

  getBiome (pos) {
    const cursor = getBiomeCursor(pos)
    return this.data.readUInt8(cursor)
  }

  setBlockType (pos, id) {
    const cursor = getBlockCursor(pos)
    this.data.writeUInt16LE(id, cursor)
    this.setBlockStateId(pos, mcData.blocks[id].minStateId)
  }

  setBlockStateId (pos, id) {
    const cursor = getBlockCursor(pos)
    this.data.writeUInt16LE(id, cursor)
  }

  setBlockData (pos, data) {

  }

  setBlockLight (pos, light) {
    const cursor = getBlockLightCursor(pos)
    writeUInt4LE(this.data, light, cursor)
  }

  setSkyLight (pos, light) {
    const cursor = getSkyLightCursor(pos)
    writeUInt4LE(this.data, light, cursor)
  }

  setBiome (pos, biome) {
    const cursor = getBiomeCursor(pos)
    this.data.writeUInt8(biome, cursor)
  }

  dump () {
    // OLD/INTERNAL FORMAT:
    // The first w*l*h*2 bytes are blocks, each of which are shorts.
    // After that, the first w*l*h*0.5 bytes are block-light-levels, each half-bytes.
    // Next, the first w*l*h*0.5 bytes are sky-light-levels, each half-bytes.
    // Finally, the next w*l bytes are biomes.

    const chunkBlocks = Chunk.l * Chunk.w << 4
    const twiceChunkBlocks = chunkBlocks << 1
    const halfChunkBlocks = chunkBlocks >>> 1

    let currentDataIndex = 0
    let currentBlockLightIndex = CHUNK_VOLUME << 1
    let currentSkyLightIndex = currentBlockLightIndex + (CHUNK_VOLUME >>> 1)
    let biomeStart = currentSkyLightIndex + (CHUNK_VOLUME >>> 1)

    let outputBuffers = []

    for (let y = 0; y < 16; y++) {
      outputBuffers.push(Chunk.packingProtocol.createPacketBuffer('section', {
        bitsPerBlock: 13,
        palette: [],
        dataArray: this.packBlockData(this.data.slice(currentDataIndex, currentDataIndex + twiceChunkBlocks), 13),
        blockLight: this.data.slice(currentBlockLightIndex, currentBlockLightIndex + halfChunkBlocks),
        skyLight: this.data.slice(currentSkyLightIndex, currentSkyLightIndex + halfChunkBlocks)
      }))

      currentDataIndex += twiceChunkBlocks
      currentBlockLightIndex += halfChunkBlocks
      currentSkyLightIndex += halfChunkBlocks
    }

    outputBuffers.push(this.data.slice(biomeStart, biomeStart + Chunk.l * Chunk.w))

    return Buffer.concat(outputBuffers)
  }

  packBlockData (rawdata, bitsPerBlock) {
    let blockCount = l * w << 4
    let resultantBuffer = Buffer.alloc((blockCount * bitsPerBlock >>> 3) + 4)

    // We have to write very slightly past the end of the file, so we tack on 4 bytes.
    // We'll drop them at the end.
    for (let block = 0; block < blockCount; block++) {
      // Gather and reverse the block data
      let reversedblockdata = reverseBits16(rawdata.readUInt16LE(block << 1)) >>> 3
      // Determine the start-bit for the block.
      let startbit = block * bitsPerBlock
      // Determine the start-byte for that bit.
      let startbyte = Math.floor(startbit >>> 3)
      // Read 4 bytes after that start byte.
      let existingdata = resultantBuffer.readUInt32BE(startbyte)
      // Where are we writing to, in the current bit?
      let localbit = startbit % 8
      // Bit-shift the raw data into alignment:
      let aligneddata = reversedblockdata << (32 - bitsPerBlock - localbit)
      // Paste aligned data onto existing data
      let newdata = existingdata | aligneddata
      // Write data back into buffer:
      resultantBuffer.writeUInt32BE(newdata >>> 0, startbyte)
    }

    // Reverses all bits in the buffer in 64 bit chunks
    // Pretty sure this can be done by using a smaller buffer in the loop above that flushes whenever more than 8 bytes are pushed into it
    for (let l = 0; l < resultantBuffer.length - 4; l += 8) {
      // Load the long
      let longleftjumbled = resultantBuffer.readUInt32BE(l)
      let longrightjumbled = resultantBuffer.readUInt32BE(l + 4)
      // Write in reverse order -- flip bits by using little endian.
      resultantBuffer.writeInt32BE(reverseBits32(longrightjumbled), l)
      resultantBuffer.writeInt32BE(reverseBits32(longleftjumbled), l + 4)
    }

    // drop the last 4 bytes (memory is shared)
    return resultantBuffer.slice(0, resultantBuffer.length - 4)
  }

  load (data, bitMap = 0xFFFF, skyLightSent = true) {
    let unpackeddata = this.unpackChunkData(data, bitMap, skyLightSent)
    if (!Buffer.isBuffer(unpackeddata)) { throw (new Error('Data must be a buffer')) }
    if (unpackeddata.length !== BUFFER_SIZE) { throw (new Error('Data buffer not correct size (was ' + unpackeddata.length + ', expected ' + BUFFER_SIZE + ')')) }
    this.data = unpackeddata
  }

  unpackChunkData (chunk, bitMap, skyLightSent) {
    let offset = 0
    let chunkBlocks = Chunk.l * Chunk.w * 16
    let blockLightStart = Chunk.l * Chunk.w * Chunk.h * 2
    let skyLightSize = Chunk.l * Chunk.w * Chunk.h / 2
    let skyLightStart = blockLightStart + skyLightSize
    let biomestart = skyLightStart + Chunk.l * Chunk.w * Chunk.h / 2

    let newBuffer = Buffer.alloc(BUFFER_SIZE)

    for (let y = 0; y < 16; y++) {
      let blocksAddition
      let blocklightsAddition
      let skylightsAddition
      if ((bitMap >> y) & 1) {
        const {
          size,
          value
        } = this.readSection(chunk.slice(offset), skyLightSent)

        offset += size
        blocksAddition = this.eatPackedBlockLongs(value.dataArray, value.palette, value.bitsPerBlock)
        blocklightsAddition = value.blockLight

        skylightsAddition = skyLightSent ? value.skyLight : Buffer.alloc(skyLightSize)
      } else { // If a chunk is skipped, we'll just fill with existing data.
        blocksAddition = this.data.slice(y * chunkBlocks << 1, (y + 1) * chunkBlocks << 1)
        blocklightsAddition = this.data.slice(blockLightStart + ((y * chunkBlocks) >>> 1), blockLightStart + (((y + 1) * chunkBlocks) >>> 1))
        skylightsAddition = this.data.slice(skyLightStart + ((y * chunkBlocks) >>> 1), skyLightStart + (((y + 1) * chunkBlocks) >>> 1))
      }

      blocksAddition.copy(newBuffer, y * chunkBlocks << 1)
      blocklightsAddition.copy(newBuffer, blockLightStart + ((y * chunkBlocks) >>> 1))
      skylightsAddition.copy(newBuffer, skyLightStart + ((y * chunkBlocks) >>> 1))
    }

    if (bitMap === 0xFFFF) {
      chunk.slice(chunk.length - 256).copy(newBuffer, biomestart)
    }

    return newBuffer
  }

  readSection (section, skyLightSent) {
    try {
      return Chunk.packingProtocol.read(section, 0, skyLightSent ? 'section' : 'sectionNoSkylight', {})
    } catch (e) {
      e.message = `Read error for ${e.field} : ${e.message}`
      throw e
    }
  }

  // Simplified eatPackedBlockLongs Algorithm
  eatPackedBlockLongs (rawBuffer, palette, bitsPerBlock) {
    // The critical problem is that the internal order of each long is opposite to the organizational order of the longs
    // This is easily fixed by flipping the order of the longs.
    // Therefore, we will read 4 bytes at a time, bit-flip them, and write them into a new buffer.
    // From there, the old algorithm for reading will work just fine, we don't even have to consider the existence of the longs anymore.
    // A major side-effect, though, is that all of the internal block-datas will be flipped, so we have to flip them again before extracting data.
    // 3 bytes added to be able to read ints (4 bytes) from the buffer, even if some bytes are missing
    let unjumbledBuffer = Buffer.alloc(rawBuffer.length + 3)
    for (let l = 0; l < rawBuffer.length; l += 8) {
      // Load the long
      let longleftjumbled = rawBuffer.readUInt32BE(l)
      let longrightjumbled = rawBuffer.readUInt32BE(l + 4)

      // Write in reverse order
      unjumbledBuffer.writeInt32BE(reverseBits32(longrightjumbled), l)
      unjumbledBuffer.writeInt32BE(reverseBits32(longleftjumbled), l + 4)
    }

    const blockCount = (rawBuffer.length << 3) / bitsPerBlock
    const resultantBuffer = Buffer.alloc(blockCount << 1)

    for (let block = 0; block < blockCount; block++) {
      // Determine the start-bit for the block.
      let bit = block * bitsPerBlock
      // Determine the start-byte for that bit.
      let targetByte = bit >>> 3

      // Read a 32-bit section surrounding the targeted block
      let datatarget = unjumbledBuffer.readUInt32BE(targetByte)

      // Determine the start bit local to the datatarget.
      let localbit = bit & 0b111

      // Chop off uninteresting bits, then shift interesting region to the end of the bit-buffer. Reverse the bits when done
      let paletteId = reverseBits((datatarget << localbit) >>> (32 - bitsPerBlock), bitsPerBlock)

      // Grab the data from the palette
      let paletteData = (palette && palette.length) ? palette[paletteId] : paletteId

      resultantBuffer.writeUInt16LE(paletteData, block << 1)
    }

    return resultantBuffer
  }
}
