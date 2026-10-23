/* eslint-env mocha */

const assert = require('assert')
const { Vec3 } = require('vec3')
const { pcVersions } = require('./versions')
const loadChunk = require('../index')

for (const version of pcVersions.filter(version => !version.startsWith('bedrock_'))) {
  describe('edited chunk serialization on ' + version, () => {
    let registry, Chunk, air, stone, dirt

    before(() => {
      registry = require('prismarine-registry')(version)
      Chunk = loadChunk(registry)
      air = registry.blocksByName.air.defaultState
      stone = registry.blocksByName.stone.defaultState
      dirt = registry.blocksByName.dirt.defaultState
    })

    function roundTrip (chunk) {
      // A caller may obtain the mask before serializing the payload.
      const mask = chunk.getMask()
      const before = chunk.toJson()
      const data = chunk.dump()
      assert.deepStrictEqual(chunk.getMask(), mask, 'dump must preserve the section mask')
      assert.strictEqual(chunk.toJson(), before, 'dump must not change the source chunk')
      const restored = new Chunk()
      restored.load(data, mask)
      assert.deepStrictEqual(restored.getMask(), mask)
      return restored
    }

    function assertBlocks (chunk, expected) {
      // The oracle comes from the authored edits, not another serialization path.
      for (let y = 0; y < 256; y++) {
        for (let z = 0; z < 16; z++) {
          for (let x = 0; x < 16; x++) {
            const pos = new Vec3(x, y, z)
            const state = expected.get(`${x},${y},${z}`) ?? air
            assert.strictEqual(chunk.getBlockStateId(pos), state, `block at ${pos}`)
          }
        }
      }
    }

    it('round-trips a chunk with no placed blocks', () => {
      assertBlocks(roundTrip(new Chunk()), new Map())
    })

    it('round-trips a chunk after mining its last block', () => {
      const chunk = new Chunk()
      const pos = new Vec3(3, 255, 5)
      chunk.setBlockStateId(pos, stone)
      chunk.setBlockStateId(pos, air)
      assertBlocks(roundTrip(chunk), new Map())
    })

    it('preserves section heights when empty sections surround populated ones', () => {
      const chunk = new Chunk()
      const expected = new Map()
      const edits = [
        [0, 0, 0, air],
        [1, 16, 2, stone],
        [15, 31, 15, dirt],
        [3, 128, 5, air],
        [4, 224, 6, dirt],
        [15, 255, 15, air]
      ]
      for (const [x, y, z, state] of edits) {
        const pos = new Vec3(x, y, z)
        chunk.setBlockStateId(pos, stone)
        chunk.setBlockStateId(pos, state)
        expected.set(`${x},${y},${z}`, state)
      }
      assertBlocks(roundTrip(chunk), expected)
    })

    it('supports editing and mining again after repeated round trips', () => {
      let chunk = new Chunk()
      const expected = new Map()
      for (const y of [0, 128, 255]) {
        const pos = new Vec3(4, y, 6)
        chunk.setBlockStateId(pos, stone)
        expected.set(`4,${y},6`, stone)
        chunk = roundTrip(chunk)
        assertBlocks(chunk, expected)
        chunk.setBlockStateId(pos, air)
        expected.set(`4,${y},6`, air)
        chunk = roundTrip(chunk)
        assertBlocks(chunk, expected)
      }
    })

    it('preserves in-band light data in an emptied section', function () {
      if (registry.supportFeature('lightSentSeparately')) this.skip()
      const chunk = new Chunk()
      const pos = new Vec3(3, 128, 5)
      chunk.setBlockStateId(pos, stone)
      chunk.setBlockLight(pos, 11)
      chunk.setSkyLight(pos, 7)
      chunk.setBlockStateId(pos, air)
      const restored = roundTrip(chunk)
      assert.strictEqual(restored.getBlockStateId(pos), air)
      assert.strictEqual(restored.getBlockLight(pos), 11)
      assert.strictEqual(restored.getSkyLight(pos), 7)
    })
  })
}
