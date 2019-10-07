/* globals describe test expect jest */
const Block = require('prismarine-block')('1.13')
const ChunkColumn = require('./ChunkColumn')(Block)
const constants = require('./constants')
const Vec3 = require('vec3').Vec3

describe('ChunkColumn', () => {
  test('use function to initialize the chunk column', () => {
    const stateId = 20
    const func = jest.fn().mockReturnValue(Block.fromStateId(stateId, 1))
    const column = new ChunkColumn()
    column.initialize(func)

    for (let x = 0; x < constants.SECTION_WIDTH; ++x) {
      for (let y = 0; y < constants.CHUNK_HEIGHT; ++y) {
        for (let z = 0; z < constants.SECTION_WIDTH; ++z) {
          expect(column.getBlock(new Vec3(x, y, z)).stateId).toBe(stateId)
        }
      }
    }
  })

  test('defaults to all air', () => {
    const column = new ChunkColumn()
    for (let x = 0; x < constants.SECTION_WIDTH; ++x) {
      for (let y = 0; y < constants.CHUNK_HEIGHT; ++y) {
        for (let z = 0; z < constants.SECTION_WIDTH; ++z) {
          expect(column.getBlock(new Vec3(x, y, z)).stateId).toBe(0)
        }
      }
    }
  })

  test('loading empty chunk sections becomes air', () => {
    const column = new ChunkColumn()

    // allocate data for biomes
    const buffer = Buffer.alloc(constants.SECTION_WIDTH * constants.SECTION_HEIGHT * 4)
    let offset = 0
    for (let x = 0; x < constants.SECTION_WIDTH; ++x) {
      for (let z = 0; z < constants.SECTION_WIDTH; ++z) {
        buffer.writeInt32LE(1, offset)
        offset += 4
      }
    }

    column.load(buffer, 0x0000)

    for (let x = 0; x < constants.SECTION_WIDTH; ++x) {
      for (let y = 0; y < constants.CHUNK_HEIGHT; ++y) {
        for (let z = 0; z < constants.SECTION_WIDTH; ++z) {
          expect(column.getBlock(new Vec3(x, y, z)).stateId).toBe(0)
        }
      }
    }
  })
})
