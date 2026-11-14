const SubChunk13 = require('../1.3/SubChunk')
const { StorageType } = require('../common/constants')

class SubChunk118 extends SubChunk13 {
  // Resolve a network runtime id (a state hash on hashed versions, a sequential id otherwise) to a palette entry. An
  // unknown id - a block present in the server's version but missing from this data version (e.g. a newer release
  // resolving its block data from an older fallback) - falls back to air, keeping its runtimeId for diagnosis, so the
  // rest of the chunk still decodes instead of the layer going dark or the decode throwing.
  resolveRuntimeEntry (runtimeId) {
    const blockState = this.registry.blockStatesByStateId[runtimeId]
    if (blockState) return { ...blockState, stateId: runtimeId, count: 0 }
    const air = this.registry.blocksByName.air.defaultState
    return { ...this.registry.blockStatesByStateId[air], stateId: air, runtimeId, count: 0 }
  }

  loadRuntimePalette (storageLayer, stream, paletteSize) {
    this.palette[storageLayer] = []
    for (let i = 0; i < paletteSize; i++) {
      this.palette[storageLayer][i] = this.resolveRuntimeEntry(stream.readZigZagVarInt())
    }
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
