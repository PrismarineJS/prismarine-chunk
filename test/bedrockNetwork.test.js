/* eslint-env mocha */
// Regression tests for decoding bedrock chunk network packets
const assert = require('assert')
const { Vec3 } = require('vec3')

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
