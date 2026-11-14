/* eslint-env mocha */
const { Vec3 } = require('vec3')
const assert = require('assert')
const { bedrockVersions } = require('./versions')

for (const version of bedrockVersions) {
  describe('bedrock ChunkColumn on ' + version, () => {
    const registry = require('prismarine-registry')(version)
    const ChunkColumn = require('prismarine-chunk')(registry)
    const stone = registry.blocksByName.stone.defaultState

    it('initializes the whole world height', () => {
      const column = new ChunkColumn({ x: 0, z: 0 })
      const heights = []
      column.initialize((x, y, z) => {
        if (x === 0 && z === 0) heights.push(y)
        return { stateId: stone }
      })
      assert.deepStrictEqual([heights[0], heights.length], [column.minY, column.maxY - column.minY])
      assert.strictEqual(column.getBlockStateId(new Vec3(3, column.minY, 3)), stone)
      assert.strictEqual(column.getBlockStateId(new Vec3(3, column.maxY - 1, 3)), stone)
      assert.strictEqual(column.sections.length, column.maxCY - column.minCY, 'no sections outside the world')
    })

    it('ignores blocks set outside the world height', async () => {
      const column = new ChunkColumn({ x: 0, z: 0 })
      column.setBlockStateId(new Vec3(1, column.minY, 1), stone)
      const sections = column.sections.slice()
      const encoded = await column.networkEncodeNoCache()

      for (const y of [column.minY - 1, column.minY - 16, column.maxY, column.maxY + 16]) {
        column.setBlockStateId(new Vec3(1, y, 1), stone)
        column.setBlock(new Vec3(2, y, 2), column.getBlock(new Vec3(1, column.minY, 1)))
        assert.strictEqual(column.getBlock(new Vec3(1, y, 1)).name, 'air', `block at y=${y}`)
      }
      assert.deepStrictEqual(Object.keys(column.sections), Object.keys(sections), 'no sections were added')
      assert.deepStrictEqual(await column.networkEncodeNoCache(), encoded)
    })

    it('throws on unknown block state ids and keeps the column unchanged', async () => {
      const column = new ChunkColumn({ x: 0, z: 0 })
      column.setBlockStateId(new Vec3(1, column.minY, 1), stone)
      const sections = column.sections.slice()
      const encoded = await column.networkEncodeNoCache()

      for (const y of [column.minY, column.minY + 16]) {
        assert.throws(() => column.setBlockStateId(new Vec3(1, y, 1), 123456789), /Unknown block state id 123456789/)
      }
      assert.strictEqual(column.getBlockStateId(new Vec3(1, column.minY, 1)), stone)
      assert.deepStrictEqual(Object.keys(column.sections), Object.keys(sections), 'no sections were added')
      assert.deepStrictEqual(await column.networkEncodeNoCache(), encoded)
    })
  })
}
