/* eslint-env mocha */
const assert = require('assert')
const { StorageType } = require('prismarine-chunk/src/bedrock/common/constants')

// Sub chunks as Bedrock Dedicated Server saved them: an end sub chunk all of end stone. From 1.17.30 the server saves a
// uniform storage as single state (0 bit) storage: no words and no palette count, the one palette entry right after
// its header (sub chunk version 9, 1 storage, y 1, storage header 0, the entry's NBT).
const saved = {
  'bedrock_1.17.30': '090101000a00000804006e616d6513006d696e6563726166743a656e645f73746f6e650a06007374617465730003070076657273696f6e03d2100100',
  'bedrock_1.21.0': '090101000a00000804006e616d6513006d696e6563726166743a656e645f73746f6e650a06007374617465730003070076657273696f6e0300150100'
}

for (const [version, hex] of Object.entries(saved)) {
  describe('bedrock sub chunks saved by the server on ' + version, () => {
    const registry = require('prismarine-registry')(version)
    const ChunkColumn = require('prismarine-chunk')(registry)

    it('reads single state storage', () => {
      const column = new ChunkColumn({ x: 0, z: 0 })
      column.newSection(1, StorageType.LocalPersistence, Buffer.from(hex, 'hex'))
      const endStone = registry.blocksByName.end_stone.defaultState
      for (let i = 0; i < 4096; i++) {
        const pos = { l: 0, x: i & 15, y: 16 + (i >> 8), z: (i >> 4) & 15 }
        assert.strictEqual(column.getBlockStateId(pos), endStone, `block at ${pos.x},${pos.y},${pos.z}`)
      }
    })
  })
}
