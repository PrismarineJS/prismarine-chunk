/* eslint-env mocha */

const Block = require('prismarine-block')('1.13')
const mcData = require('minecraft-data')('1.13.2')
const ChunkColumn = require('../src/pc/1.13/ChunkColumn')(Block, mcData)
const constants = require('../src/pc/common/constants')
const expect = require('expect')

describe('ChunkColumn', () => {
  it('use function to initialize the chunk column', () => {
    const stateId = 20
    const block = Block.fromStateId(stateId, 1)
    const column = new ChunkColumn()
    column.initialize(() => { return block })

    let different = 0
    const p = { x: 0, y: 0, z: 0 }
    for (p.x = 0; p.x < constants.SECTION_WIDTH; p.x++) {
      for (p.y = 0; p.y < constants.CHUNK_HEIGHT; p.y++) {
        for (p.z = 0; p.z < constants.SECTION_WIDTH; p.z++) {
          different += column.getBlock(p).stateId !== stateId
        }
      }
    }
    // this is expensive and doesn't allow proper measurement if in the loops
    expect(different).toBe(0)
  })

  it('defaults to all air', () => {
    const column = new ChunkColumn()

    let different = 0
    const p = { x: 0, y: 0, z: 0 }
    for (p.y = 0; p.y < constants.CHUNK_HEIGHT; p.y++) {
      for (p.z = 0; p.z < constants.SECTION_WIDTH; p.z++) {
        for (p.x = 0; p.x < constants.SECTION_WIDTH; p.x++) {
          different += column.getBlock(p).stateId !== 0
        }
      }
    }
    expect(different).toBe(0)
  })

  it('loading empty chunk sections becomes air', () => {
    const column = new ChunkColumn()

    // allocate data for biomes
    const buffer = Buffer.alloc(constants.SECTION_WIDTH * constants.SECTION_HEIGHT * 4)
    let offset = 0
    for (let x = 0; x < constants.SECTION_WIDTH; ++x) {
      for (let z = 0; z < constants.SECTION_WIDTH; ++z) {
        buffer.writeInt32BE(1, offset)
        offset += 4
      }
    }

    column.load(buffer, 0x0000)

    let different = 0
    const p = { x: 0, y: 0, z: 0 }
    for (p.y = 0; p.y < constants.CHUNK_HEIGHT; p.y++) {
      for (p.z = 0; p.z < constants.SECTION_WIDTH; p.z++) {
        for (p.x = 0; p.x < constants.SECTION_WIDTH; p.x++) {
          different += column.getBlock(p).stateId !== 0
        }
      }
    }
    expect(different).toBe(0)
  })

  const testTag = require('./testnbt.json')

  it('can handle block entities', () => {
    const column = new ChunkColumn()

    testTag.x = 102
    testTag.y = 44
    testTag.z = -1

    let i = 0
    const setAt = new Set()
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        for (let z = 0; z < 16; z++) {
          if (i++ % Math.random() < 0.1) {
            const fakeBlock = Block.fromStateId(mcData.blocksByName.anvil, 1)
            fakeBlock.entity = testTag
            column.setBlock({ x, y, z }, fakeBlock)
            setAt.add(`${x},${y},${z}`)
          }
        }
      }
    }

    const toJson = column.toJson()

    const next = ChunkColumn.fromJson(toJson)
    for (const entry of setAt) {
      const [x, y, z] = entry.split(',').map(Number)
      const block = next.getBlock({ x, y, z })
      if (!block.entity) throw new Error('missing block entity')
      expect(block.entity.x).toEqual(testTag.x)
      expect(block.entity.y).toEqual(testTag.y)
      expect(block.entity.z).toEqual(testTag.z)
    }
  })
})
