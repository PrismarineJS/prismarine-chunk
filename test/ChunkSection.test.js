/* eslint-env mocha */

const Vec3 = require('vec3').Vec3
const ChunkSection = require('../src/pc/1.13/ChunkSection')
const constants = require('../src/pc/common/constants')
const assert = require('assert')

describe('pc 1.13 ChunkSection', () => {
  it('insert into middle of palette', () => {
    const section = new ChunkSection()
    section.setBlock(new Vec3(0, 0, 0), 14)
    section.setBlock(new Vec3(0, 1, 0), 1)

    assert.strictEqual(section.getBlock(new Vec3(0, 0, 0)), 14)
    assert.strictEqual(section.getBlock(new Vec3(0, 1, 0)), 1)
  })

  it('switch to global palette', () => {
    // Test if we can write and read 4096 distinct stateId from the section
    const section = new ChunkSection()
    const p = { x: 0, y: 0, z: 0 }
    let i = 0
    for (p.y = 0; p.y < constants.SECTION_HEIGHT; p.y++) {
      for (p.z = 0; p.z < constants.SECTION_WIDTH; p.z++) {
        for (p.x = 0; p.x < constants.SECTION_WIDTH; p.x++) {
          section.setBlock(p, i++)
        }
      }
    }
    i = 0
    for (p.y = 0; p.y < constants.SECTION_HEIGHT; p.y++) {
      for (p.z = 0; p.z < constants.SECTION_WIDTH; p.z++) {
        for (p.x = 0; p.x < constants.SECTION_WIDTH; p.x++) {
          assert.strictEqual(section.getBlock(p), i++)
        }
      }
    }
  })
})
