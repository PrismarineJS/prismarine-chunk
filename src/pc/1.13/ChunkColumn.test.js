/* globals describe test expect jest */
const Block = require('prismarine-block')('1.13')
const ChunkColumn = require('./ChunkColumn')(Block)
const constants = require('./constants')
const Vec3 = require('vec3').Vec3

describe('ChunkColumn', () => {
  test('use function to initialize the chunk column', () => {
    const stateId = 20
    const func = jest.fn().mockReturnValue(new Block(stateId))
    const column = new ChunkColumn()
    column.initialize(func)

    for (let x = 0; x < constants.SECTION_WIDTH; ++x) {
      for (let y = 0; y < constants.CHUNK_HEIGHT; ++y) {
        for (let z = 0; z < constants.SECTION_WIDTH; ++z) {
          expect(func).toHaveBeenCalledWith(x, y, z)
          expect(column.getBlock(new Vec3(x, y, z)).stateId).toBe(stateId)
        }
      }
    }
  })
})
