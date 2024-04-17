/* eslint-env mocha */
const { Vec3 } = require('vec3')
const assert = require('assert')
const { pcVersions } = require('./versions')

for (const version of pcVersions) {
  const registry = require('prismarine-registry')(version)
  if (!registry.supportFeature('usesPalettedChunks')) {
    continue
  }
  if (version === 'bedrock_0.14') continue // todo: remove after https://github.com/PrismarineJS/minecraft-data/pull/769

  describe('pc section tests ' + version, () => {
    const ChunkColumn = require('prismarine-chunk')(registry)

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
        const subChunk = column.getSectionAtIndex(cy)
        assert(subChunk.palette.length === 4, 'Palette size should be 4')
        console.log('Palette length', subChunk.palette.length)
      }
    })
  })
}
