/* eslint-env mocha */
const assert = require('assert')

describe('bedrock ChunkColumn', () => {
  for (const version of ['bedrock_1.16.220', 'bedrock_1.17.40', 'bedrock_1.18.0', 'bedrock_1.26.51']) {
    it(`initialize covers the world height on ${version}`, () => {
      const registry = require('prismarine-registry')(version)
      const ChunkColumn = require('prismarine-chunk')(registry)
      const column = new ChunkColumn({ x: 0, z: 0 })
      const stone = registry.blocksByName.stone.defaultState
      const ys = []
      column.initialize((x, y, z) => {
        if (x === 0 && z === 0) ys.push(y)
        return { stateId: stone }
      })
      assert.deepStrictEqual([ys[0], ys[ys.length - 1], ys.length], [column.minY, column.maxY - 1, column.maxY - column.minY])
      for (const y of [column.minY, -1, 0, column.maxY - 1]) {
        if (y < column.minY) continue
        assert.strictEqual(column.getBlockStateId({ x: 3, y, z: 3, l: 0 }), stone, `block at y=${y}`)
      }
      assert.strictEqual(column.sections.length, column.maxCY - column.minCY, 'no sections outside the world')
    })
  }
})

describe('bedrock ChunkColumn outside the world height', () => {
  for (const version of ['bedrock_1.16.220', 'bedrock_1.18.0', 'bedrock_1.26.51']) {
    it(`ignores blocks set outside the world on ${version}, like pc`, async () => {
      const registry = require('prismarine-registry')(version)
      const ChunkColumn = require('prismarine-chunk')(registry)
      const column = new ChunkColumn({ x: 0, z: 0 })
      const stone = registry.blocksByName.stone.defaultState
      column.setBlockStateId({ x: 1, y: column.minY, z: 1, l: 0 }, stone)
      const sections = column.sections.slice()
      const encoded = await column.networkEncodeNoCache()

      for (const y of [column.minY - 1, column.minY - 16, column.maxY, column.maxY + 16]) {
        column.setBlockStateId({ x: 1, y, z: 1, l: 0 }, stone)
        column.setBlock({ x: 2, y, z: 2, l: 0 }, column.getBlock({ x: 1, y: column.minY, z: 1, l: 0 }))
        assert.strictEqual(column.getBlock({ x: 1, y, z: 1, l: 0 }).name, 'air', `block at y=${y}`)
      }
      assert.deepStrictEqual(column.sections, sections, 'no sections were added')
      assert.deepStrictEqual(Object.keys(column.sections), Object.keys(sections))
      assert.deepStrictEqual(await column.networkEncodeNoCache(), encoded)
    })
  }
})
