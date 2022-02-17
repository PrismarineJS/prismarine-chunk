/* eslint-env mocha */
const { Vec3 } = require('vec3')
const assert = require('assert')

const versions = ['1.8', '1.9', '1.10', '1.11', '1.12', '1.13.2', '1.14.4', '1.15.2', '1.16.1', '1.17', '1.18']

for (const version of versions) {
  describe('pc section tests ' + version, () => {
    const registry = require('prismarine-registry')(version)
    const ChunkColumn = require('prismarine-chunk')(registry)

    if (registry.version['<']('1.9')) {
      return
    }

    it('compaction works', () => {
      const column = new ChunkColumn()
      const fakeBlocks = [1, 2, 3]
      let i = 0
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 8; x++) {
          for (let z = 0; z < 8; z++) {
            column.setBlockStateId(new Vec3(x, y << 4, z), fakeBlocks[i++ % fakeBlocks.length])
            column.setBlockStateId(new Vec3(x, y << 4, z), registry.blocksByName.air.defaultState)
          }
        }
      }

      // Make sure palette size is 3
      for (let cy = 0; cy < 4; cy++) {
        const subChunk = column.getSection(cy)
        assert(subChunk.palette.length === 4, 'Palette size should be 4')
        console.log('Palette length', subChunk.palette.length)
      }
    })
  })
}
