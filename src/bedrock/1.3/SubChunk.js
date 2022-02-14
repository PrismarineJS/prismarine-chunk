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

    // Not written or read
    this.blockLight = new PalettedStorage(4)
    this.skyLight = new PalettedStorage(4)
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

  decode (format, stream) {
    if (stream instanceof Buffer) stream = new Stream(stream)
    // version
    const version = stream.readByte()
    if (version !== 8 && version !== 9) throw new Error('Unsupported sub chunk version: ' + version)
    this.subChunkVersion = version

    let storageCount = 1
    if (version >= 8) {
      storageCount = stream.readByte()
      if (version >= 9) {
        this.y = stream.readByte() // Sub Chunk Index
      }
      if (storageCount > 2) {
        throw new Error('Expected storage count to be 1 or 2, got ' + storageCount)
      }
    }

    for (let i = 0; i < storageCount; i++) {
      const paletteType = stream.readByte()
      const usingNetworkRuntimeIds = paletteType & 1

      if (!usingNetworkRuntimeIds && (format === StorageType.Runtime)) {
        throw new Error(`Expected network encoding while decoding SubChunk at y=${this.y}`)
      }

      const bitsPerBlock = paletteType >> 1
      this.loadPalettedBlocks(i, stream, bitsPerBlock, format)
    }
  }

  loadPalettedBlocks (storageLayer, stream, bitsPerBlock, format) {
    // We always use at least 4 bits per block at minimum, match Java Edition
    const storage = new PalettedStorage(bitsPerBlock)
    storage.read(stream)
    this.blocks[storageLayer] = storage

    const paletteSize = format === StorageType.LocalPersistence ? stream.readUInt32LE() : stream.readZigZagVarInt()
    if (paletteSize > stream.buffer.length || paletteSize < 1) throw new Error(`Invalid palette size: ${paletteSize}`)

    if (format === StorageType.Runtime) {
      this.loadRuntimePalette(storageLayer, stream, paletteSize)
    } else {
      // Either "network persistent" (network with caching) or local disk
      this.loadLocalPalette(storageLayer, stream, paletteSize, format === StorageType.NetworkPersistence)
    }
  }

  loadRuntimePalette (storageLayer, stream, paletteSize) {
    this.palette[storageLayer] = []

    for (let i = 0; i < paletteSize; i++) {
      const index = stream.readZigZagVarInt()
      const block = this.registry.blockStates[index]
      this.palette[storageLayer][i] = { stateId: index, ...block }
    }
  }

  loadLocalPalette (storageLayer, stream, paletteSize, overNetwork) {
    this.palette[storageLayer] = []
    const buf = stream.buffer
    let startOffset = stream.readOffset
    let i
    for (i = 0; i < paletteSize; i++) {
      const { metadata, data } = nbt.protos[overNetwork ? 'littleVarint' : 'little'].parsePacketBuffer('nbt', buf, startOffset)
      stream.readOffset += metadata.size // BinaryStream
      startOffset += metadata.size // Buffer

      const { name, states, version } = nbt.simplify(data)

      let block = this.Block.fromProperties(name.replace('minecraft:', ''), states ?? {}, 0)

      if (!block) {
        // This is not a valid block
        debugger // eslint-disable-line
        block = this.Block.fromProperties('air', {}, 0)
      }

      this.palette[storageLayer][i] = { stateId: block.stateId, name, states: data.value.states.value, version }
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
    if (checksum) {
      this.hash = await getChecksum(buf)
      this.updated = false
    }
    return buf
  }

  // Encode sub chunk version 8+
  encodeV8 (stream, format) {
    stream.writeUInt8(this.subChunkVersion)
    stream.writeUInt8(this.blocks.length)
    if (this.subChunkVersion >= 9) { // Caves and cliffs (1.17-1.18)
      stream.writeUInt8(this.y)
    }
    for (let i = 0; i < this.blocks.length; i++) {
      this.writeStorage(stream, i, format)
    }
  }

  writeStorage (stream, storageLayer, format) {
    const storage = this.blocks[storageLayer]
    let paletteType = storage.bitsPerBlock << 1
    if (format === StorageType.Runtime) {
      paletteType |= 1
    }
    stream.writeUInt8(paletteType)
    storage.write(stream)

    if (format === StorageType.LocalPersistence) {
      stream.writeUInt32LE(this.palette[storageLayer].length)
    } else {
      stream.writeZigZagVarInt(this.palette[storageLayer].length)
    }

    if (format === StorageType.Runtime) {
      for (const block of this.palette[storageLayer]) {
        stream.writeZigZagVarInt(block.stateId)
      }
    } else {
      for (const block of this.palette[storageLayer]) {
        const { name, states, version } = block
        console.log('States', states)
        const tag = nbt.comp({ name: nbt.string(name), states: nbt.comp(states), version: nbt.int(version) })
        const buf = nbt.writeUncompressed(tag, format === StorageType.LocalPersistence ? 'little' : 'littleVarint')
        stream.writeBuffer(buf)
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
    const block = this.registry.blockStates[stateId]
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

  getPalette () {
    return this.palette
  }

  // Lighting - Not written or read, but computed during chunk loading
  getBlockLight (x, y, z) {
    return this.blockLight.get(x, y, z)
  }

  setBlockLight (x, y, z, value) {
    this.blockLight.set(x, y, z, value)
  }

  getSkyLight (x, y, z) {
    return this.skyLight.get(x, y, z)
  }

  setSkyLight (x, y, z, value) {
    this.skyLight.set(x, y, z, value)
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
