const SubChunk13 = require('../1.3/SubChunk')
const { StorageType } = require('../common/constants')
const PalettedStorage = require('../common/PalettedStorage')

class SubChunk118 extends SubChunk13 {
  // Resolve a network runtime id (a state hash on hashed versions, a sequential id otherwise) to a palette entry. An
  // unknown id - a block present in the server's version but missing from this data version (e.g. a newer release
  // resolving its block data from an older fallback) - falls back to air, keeping its runtimeId for diagnosis, so the
  // rest of the chunk still decodes instead of the layer going dark or the decode throwing.
  resolveRuntimeEntry (runtimeId) {
    const block = this.registry.blocksByRuntimeId[runtimeId]
    if (block) return { stateId: block.stateId, ...block, count: 0 }
    const air = this.registry.blocksByName && this.registry.blocksByName.air
    return { stateId: air ? air.defaultState : 0, name: air ? air.name : 'air', runtimeId, count: 0 }
  }

  loadRuntimePalette (storageLayer, stream, paletteSize) {
    this.palette[storageLayer] = []
    for (let i = 0; i < paletteSize; i++) {
      this.palette[storageLayer][i] = this.resolveRuntimeEntry(stream.readZigZagVarInt())
    }
  }

  loadPalettedBlocks (storageLayer, stream, bitsPerBlock, format) {
    if ((format === StorageType.Runtime) && (bitsPerBlock === 0)) {
      // Single-block (zero-bit) runtime section: one runtime id for the whole section. Resolve it the same way as the
      // multi-entry palette above - including the unknown-id air fallback - rather than indexing blockStates (which
      // throws on an unknown hash and bypasses the fallback).
      this.palette[storageLayer] = [this.resolveRuntimeEntry(stream.readVarInt() >> 1)]
      this.blocks[storageLayer] = new PalettedStorage(1)
      return
    }
    return super.loadPalettedBlocks(...arguments)
  }

  writeStorage (stream, storageLayer, format) {
    if ((format === StorageType.Runtime) && (this.palette[storageLayer].length === 1)) {
      stream.writeUInt8(1) // palette type
      stream.writeZigZagVarInt(this.palette[storageLayer][0].stateId)
      return
    }

    return super.writeStorage(...arguments)
  }
}

module.exports = SubChunk118
