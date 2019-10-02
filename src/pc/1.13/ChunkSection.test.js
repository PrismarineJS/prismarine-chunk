/* globals describe it */
const Vec3 = require('vec3').Vec3
const ChunkSection = require('./ChunkSection')
const assert = require('assert')
const BitArray = require('./BitArray')

describe('ChunkSection', () => {
  it('insert into middle of palette', () => {
    const section = new ChunkSection()
    section.setBlock(new Vec3(0, 0, 0), 14)
    section.setBlock(new Vec3(0, 1, 0), 1)

    assert.strictEqual(section.getBlock(new Vec3(0, 0, 0)), 14)
    assert.strictEqual(section.getBlock(new Vec3(0, 1, 0)), 1)
  })

  it('corrects data and palette correctly', () => {
    const data = new BitArray({ bitsPerValue: 4, capacity: 4096 })
    const palette = [0, 4, 2, 7, 3]
    ChunkSection.correctDataAndPalette(data, palette)
    assert.strictEqual(palette[0], 0)
    assert.strictEqual(palette[1], 2)
    assert.strictEqual(palette[2], 3)
    assert.strictEqual(palette[3], 4)
    assert.strictEqual(palette[4], 7)
  })
})
