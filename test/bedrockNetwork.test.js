/* eslint-env mocha */
// Regression tests for decoding bedrock chunk network packets
const assert = require('assert')
const { Vec3 } = require('vec3')
const { StorageType } = require('prismarine-chunk/src/bedrock/common/constants')

function setup (version, blockNetworkIdsAreHashes = false) {
  const registry = require('prismarine-registry')(version)
  registry.handleStartGame({ block_network_ids_are_hashes: blockNetworkIdsAreHashes, itemstates: [] })
  const ChunkColumn = require('prismarine-chunk')(registry)
  return { registry, ChunkColumn }
}

const pos = (x, y, z) => Object.assign(new Vec3(x, y, z), { l: 0 })

describe('bedrock 1.18+ network decoding', () => {
  it('keeps already loaded sections when decoding cached sub chunks one by one', async () => {
    const { registry, ChunkColumn } = setup('bedrock_1.21.60')
    const source = new ChunkColumn({ x: 0, z: 0 })
    source.setBlockStateId(pos(1, -64, 1), registry.blocksByName.stone.defaultState)
    source.setBlockStateId(pos(1, -48, 1), registry.blocksByName.dirt.defaultState)
    const blobStore = new Map()
    const [bottom] = await source.networkEncodeSubChunk(-4, blobStore)
    const [above] = await source.networkEncodeSubChunk(-3, blobStore)

    // like a client receiving SubChunk packet entries, one blob per call
    const column = new ChunkColumn({ x: 0, z: 0 })
    assert.deepStrictEqual(await column.networkDecodeSubChunk([bottom], blobStore), [])
    assert.deepStrictEqual(await column.networkDecodeSubChunk([above], blobStore), [])

    assert.strictEqual(column.getBlock(pos(1, -64, 1)).name, 'stone')
    assert.strictEqual(column.getBlock(pos(1, -48, 1)).name, 'dirt')
  })
})

describe('bedrock v9 single state storage', () => {
  // A uniform sub chunk (all air, y=5) as sent by a 1.17.30 server. Its block storage has 0 bits per block:
  // no storage words and no palette size, only the single palette entry.
  const runtime = Buffer.from('090105018c02', 'hex')
  const persistence = Buffer.from('090105000a0008046e616d650d6d696e6563726166743a6169720a0673746174657300030776657273696f6e86c8861100', 'hex')

  for (const [name, format, buffer] of [['runtime ids (level_chunk)', StorageType.Runtime, runtime], ['nbt palette (cached blob)', StorageType.NetworkPersistence, persistence]]) {
    it(`decodes ${name}`, () => {
      const { ChunkColumn } = setup('bedrock_1.17.30')
      const column = new ChunkColumn({ x: 0, z: 0 })
      const section = column.newSection(0, format, buffer)
      assert.strictEqual(section.y, 5)
      assert.strictEqual(column.getBlock(pos(3, 7, 3)).name, 'air')
    })
  }
})

describe('bedrock nbt block palettes', () => {
  for (const [version, hashes] of [['bedrock_1.16.220', false], ['bedrock_1.21.60', false], ['bedrock_1.21.60', true]]) {
    it(`writes the block state into nbt palettes on ${version}, block_network_ids_are_hashes = ${hashes}`, async () => {
      const { registry, ChunkColumn } = setup(version, hashes)
      const log = registry.blocksByName.oak_log ?? registry.blocksByName.log
      const stateId = log.states[log.states.length - 1]
      const column = new ChunkColumn({ x: 0, z: 0 })
      column.setBlockStateId(pos(1, 1, 1), stateId)
      const expected = column.getBlock(pos(1, 1, 1)).getProperties()
      assert(Object.keys(expected).length > 0)

      for (const format of [StorageType.NetworkPersistence, StorageType.LocalPersistence]) {
        const buffer = await column.getSectionAtIndex(0).encode(format, false, false)
        const decoded = new ChunkColumn({ x: 0, z: 0 })
        decoded.newSection(0, format, buffer)
        assert.strictEqual(decoded.getBlockStateId(pos(1, 1, 1)), stateId)
        assert.deepStrictEqual(decoded.getBlock(pos(1, 1, 1)).getProperties(), expected)
      }
    })
  }
})
