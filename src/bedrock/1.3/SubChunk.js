const PalettedStorage = require('../common/PalettedStorage')
const { StorageType } = require('../common/constants')
const { getChecksum } = require('../common/util')
const neededBits = require('../../pc/common/neededBits')
const Stream = require('../common/Stream')
const nbt = require('prismarine-nbt')

class SubChunk {
  constructor (registry, Block, options = {}) {
    this.registry = registry
    this.Block = Block
    this.y = options.y
    this.palette = options.palette || []
    this.blocks = []
    if (options.blocks) {
      for (const block of options.blocks) {
        this.blocks.push(PalettedStorage.copyFrom(block))
      }
    }
    this.subChunkVersion = options.subChunkVersion || 8
    this.hash = options.hash || null
    this.updated = options.updated || true
  }

  // Creates an air chunk
  static create (registry, Block, y) {
    const subChunk = new this(registry, Block, { y })
    // Fill first layer with zero
    subChunk.blocks.push(new PalettedStorage(1))
    // Set zero to be air, Add to the palette
    subChunk.addToPalette(0, this.registry.blocksByName.air.defaultState)
    return subChunk
  }

  async decode (format, stream) {
    this.sectionVersion = 0

    // version
    const version = stream.readByte()

    let storageCount = 1
    if (version >= 8) {
      storageCount = stream.readByte()
      if (version >= 9) {
        this.y = stream.readByte() // Sub Chunk Index
      }
      if (storageCount >= 2) {
        throw new Error('Expected storage count to be 1 or 2')
      }
    }
    for (let i = 0; i < storageCount; i++) {
      const paletteType = stream.readByte()
      const usingNetworkRuntimeIds = paletteType & 1

      if (!usingNetworkRuntimeIds && (format === StorageType.Runtime)) {
        throw new Error(`Expected network encoding while decoding SubChunk at y=${this.y}`)
      }

      const bitsPerBlock = paletteType >> 1
      await this.loadPalettedBlocks(i, stream, bitsPerBlock, format)
    }
  }

  async loadPalettedBlocks (storageLayer, stream, bitsPerBlock, format) {
    // We always use at least 4 bits per block at minimum, match Java Edition
    const storage = new PalettedStorage(bitsPerBlock)
    storage.read(stream)
    this.blocks[storageLayer] = storage

    const paletteSize = format === StorageType.LocalPersistence ? stream.readInt32LE() : stream.readVarint()
    if (paletteSize > stream.getBuffer().length || paletteSize < 1) throw new Error(`Invalid palette size: ${paletteSize}`)

    if (format === StorageType.Runtime) {
      await this.loadRuntimePalette(storageLayer, stream, storage.paletteSize)
    } else {
      await this.loadLocalPalette(storage, stream, paletteSize, format === StorageType.NetworkPersistence)
    }
  }

  async loadRuntimePalette (storageLayer, stream, paletteSize) {
    this.palette[storageLayer] = []

    for (let i = 0; i < paletteSize; i++) {
      const index = stream.readZigZagVarint()
      const block = this.registry.blockStates[index]
      this.palette[storageLayer][i] = { stateId: block.stateId, ...block }
    }
  }

  async loadLocalPalette (storageLayer, stream, paletteSize, overNetwork) {
    this.palette[storageLayer] = []
    const buf = stream.buffer
    buf.startOffset = stream.readOffset
    let i
    for (i = 0; stream.peekUInt8() !== 0x0A; i++) {
      const { parsed, metadata } = await nbt.parse(buf, overNetwork ? 'littleVarint' : 'little')
      stream.readOffset += metadata.size // BinaryStream
      buf.startOffset += metadata.size // Buffer
      const { name, states, version } = nbt.simplify(parsed)

      let block = this.Block.fromProperties(name.replace('minecraft:', ''), states ?? {}, 0)

      if (!block) {
        // This is not a valid block
        debugger // eslint-disable-line
        block = this.Block.fromProperties('air', {}, 0)
      }

      this.palette[storageLayer][i] = { stateId: block.stateId, name, states: parsed.states, version }
    }
    delete buf.startOffset

    if (i !== paletteSize) {
      throw new Error(`Expected ${paletteSize} blocks, got ${i}`)
    }
  }

  async encode (format, checksum = false) {
    const stream = new Stream()

    if (this.subChunkVersion >= 8) {
      this.encodeV8(stream, format)
    } else {
      throw new Error('Unsupported sub chunk version')
    }

    const buf = stream.getBuffer()
    if (checksum && format === StorageType.NetworkPersistence) {
      this.hash = await getChecksum(buf)
      this.updated = false
    }
    return buf
  }

  // Encode sub chunk version 8+
  encodeV8 (stream, format) {
    stream.writeByte(this.subChunkVersion)
    stream.writeByte(this.blocks.length)
    if (this.subChunkVersion >= 9) { // Caves and cliffs (1.17-1.18)
      stream.writeByte(this.y)
    }
    for (let i = 0; i < this.blocks.length; i++) {
      const storage = this.blocks[i]
      let paletteType = storage.bitsPerBlock << 1
      if (format === StorageType.NetworkPersistence) {
        paletteType |= 1
      }
      stream.writeByte(paletteType)
      storage.write(stream)

      if (format === StorageType.LocalPersistence) {
        stream.writeUInt32LE(this.palette[i].length)
      } else {
        stream.writeVarInt(this.palette[i].length)
      }

      if (format === StorageType.NetworkPersistence) {
        for (const block of this.palette[i]) {
          stream.writeZigZagVarint(block.stateId)
        }
      } else {
        for (const block of this.palette[i]) {
          const { name, states, version } = block
          const tag = nbt.comp({ name: nbt.string(name), states, version: nbt.int(version) })
          const buf = nbt.writeUncompressed(tag, format === StorageType.LocalPersistence ? 'little' : 'littleVarint')
          stream.writeBuffer(buf)
        }
      }
    }
  }

  // Normal block access

  getBlock (l, x, y, z) {
    if (l !== undefined) {
      const stateId = this.getBlockStateId(l, x, y, z)
      return this.Block.fromStateId(stateId)
    } else {
      const layer1 = this.getBlockStateId(0, x, y, z)
      const layer2 = this.getBlockStateId(1, x, y, z)
      const block = this.Block.fromStateId(layer1)
      if (layer2) {
        block.superimposed = this.Block.fromStateId(layer2)
        const name = block.superimposed.name
        // TODO: Snowy blocks have to be handled in prismarine-viewer
        if (name.includes('water')) {
          block.computedStates.waterlogged = true
        }
      }
      return this.Block.fromStateId(layer1, layer2)
    }
  }

  setBlock (l, x, y, z, block) {
    if (l !== undefined) {
      this.setBlockStateId(l, x, y, z, block.stateId)
    } else {
      this.setBlockStateId(0, x, y, z, block.stateId)
      if (block.superimposed) {
        this.setBlockStateId(1, x, y, z, block.superimposed.stateId)
      }
    }
    this.updated = true
  }

  getBlockStateId (l = 0, x, y, z) {
    const blocks = this.blocks[l]
    if (!blocks) {
      return this.registry.blocksByName.air.defaultState
    }
    return this.palette[l][blocks.get(x, y, z)].stateId
  }

  // TODO: resize but dont downsize less than 4 bits per block
  setBlockStateId (l = 0, x, y, z, stateId) {
    if (!this.palette[l]) {
      const block = this.registry.blockStates[stateId]
      this.palette[l] = [{ stateId, name: block.name, states: block.states }]
      this.blocks[l] = new PalettedStorage(4) // Zero initialized
    } else {
      const ix = this.palette[l].findIndex(({ stateId: id }) => id === stateId)
      if (ix === -1) {
        this.addToPalette(l, stateId)
        this.blocks[l].set(x, y, z, this.palette.length - 1)
      } else {
        this.blocks[l].set(x, y, z, ix)
      }
    }
    this.updated = true
  }

  addToPalette (l, stateId) {
    const block = this.registry.blocksStates[stateId]
    this.palette[l].push({ stateId, name: block.name, states: block.states })
    if (neededBits(this.palette[l].length) > this.blocks[l].bitsPerBlock) {
      this.blocks[l] = this.blocks[l].resize(this.palette[l].length)
    }
  }

  /**
   * Gets the block runtime ID at the layer and position
   * @returns Global block palette (runtime) ID for the block
   */
  getPaletteEntry (l, x, y, z) {
    return this.palette[l][this.blocks[l].get(x, y, z)]
  }

  toObject () {
    return {
      y: this.y,
      palette: this.palette,
      blocks: this.blocks,
      subChunkVersion: this.subChunkVersion,
      hash: this.hash,
      updated: this.updated
    }
  }
}

module.exports = SubChunk
