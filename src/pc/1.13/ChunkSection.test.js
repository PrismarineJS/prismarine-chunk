/* globals describe it */
const Vec3 = require('vec3').Vec3
const ChunkSection = require('./ChunkSection')
const assert = require('assert')

describe('ChunkSection', () => {
  test('insert into middle of palette', () => {
    const section = new ChunkSection()
    section.setBlock(new Vec3(0, 0, 0), 14)
    section.setBlock(new Vec3(0, 1, 0), 1)

    assert.strictEqual(section.getBlock(new Vec3(0, 0, 0)), 14)
    assert.strictEqual(section.getBlock(new Vec3(0, 1, 0)), 1)
  })
})
