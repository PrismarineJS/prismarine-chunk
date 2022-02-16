/* eslint-env mocha */

const versions = ['bedrock_1.18.0', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13.2', '1.14.4', '1.15.2', '1.16.1', '1.17', '1.18']
const constants = require('../src/pc/common/constants')
const { Vec3 } = require('vec3')
const assert = require('assert')
const expect = require('expect')

for (const version of versions) {
  const registry = require('prismarine-registry')(version)
  const Block = require('prismarine-block')(registry)
  const ChunkColumn = require('prismarine-chunk')(registry)

  describe('ChunkColumn on ' + version, () => {
    it('use function to initialize the chunk column', () => {
      const stateId = 20
      const block = Block.fromStateId(stateId, 1)
      const column = new ChunkColumn()
      column.initialize(() => { return block })

      const p = new Vec3(0, 0, 0)
      for (p.x = 0; p.x < constants.SECTION_WIDTH; p.x++) {
        for (p.y = 0; p.y < constants.CHUNK_HEIGHT; p.y++) {
          for (p.z = 0; p.z < constants.SECTION_WIDTH; p.z++) {
            if (column.getBlock(p).stateId !== stateId) {
              throw new Error('id mismatch: expected ' + stateId + ' got ' + column.getBlock(p).stateId)
            }
          }
        }
      }
    })

    it('defaults to all air', () => {
      const column = new ChunkColumn()

      let different = 0
      const p = new Vec3(0, 0, 0)
      for (p.y = 0; p.y < constants.CHUNK_HEIGHT; p.y++) {
        for (p.z = 0; p.z < constants.SECTION_WIDTH; p.z++) {
          for (p.x = 0; p.x < constants.SECTION_WIDTH; p.x++) {
            // 0 cannot be assumed as air, bedrock assigns stateIds alphabetically
            different += column.getBlock(p).stateId !== registry.blocksByName.air.defaultState
          }
        }
      }
      expect(different).toBe(0)
    })

    //

    it('Initializes correctly', () => {
      const chunk = new ChunkColumn()
      chunk.initialize((x, y, z, n) => new Block(0, 0, 0))
    })

    it('Initializes ignore null correctly', () => {
      const chunk = new ChunkColumn()
      chunk.initialize((x, y, z, n) => null)
    })

    it('Defaults to all blocks being air', function () {
      const chunk = new ChunkColumn()
      assert.strictEqual(0, chunk.getBlock(new Vec3(0, 0, 0)).type)
      assert.strictEqual(0, chunk.getBlock(new Vec3(15, constants.CHUNK_HEIGHT - 1, 15)).type)
    })

    it('Out of bounds blocks being air', function () {
      const chunk = new ChunkColumn()
      assert.strictEqual(0, chunk.getBlock(new Vec3(8, -1, 8)).type)
      assert.strictEqual(0, chunk.getBlock(new Vec3(8, 256, 8)).type)
    })

    it('Should set a block at the given position', function () {
      const chunk = new ChunkColumn()

      if (registry.type === 'pc') {
        const isPostFlattening = registry.version['>=']('1.13')
        chunk.setBlock(new Vec3(0, 0, 0), new Block(5, 0, 2)) // Birch planks, if you're wondering
        assert.strictEqual(5, chunk.getBlock(new Vec3(0, 0, 0)).type)

        if (!isPostFlattening) {
          assert.strictEqual(2, chunk.getBlock(new Vec3(0, 0, 0)).metadata)
        }

        chunk.setBlock(new Vec3(0, 37, 0), new Block(42, 0, 0)) // Iron block
        assert.strictEqual(42, chunk.getBlock(new Vec3(0, 37, 0)).type)
        if (!isPostFlattening) {
          assert.strictEqual(0, chunk.getBlock(new Vec3(0, 37, 0)).metadata)
        }

        chunk.setBlock(new Vec3(1, 0, 0), new Block(35, 0, 1)) // Orange wool
        assert.strictEqual(35, chunk.getBlock(new Vec3(1, 0, 0)).type)
        if (!isPostFlattening) {
          assert.strictEqual(1, chunk.getBlock(new Vec3(1, 0, 0)).metadata)
        }
      }

      // Everything should have a stateId
      {
        const birchPlanksId = registry.blocksByName.planks?.defaultState || registry.blocksByName.birch_planks.defaultState
        chunk.setBlock(new Vec3(0, 0, 0), Block.fromStateId(birchPlanksId))
        assert.strictEqual(birchPlanksId, chunk.getBlock(new Vec3(0, 0, 0)).stateId)

        const ironBlockId = registry.blocksByName.iron_block.defaultState
        chunk.setBlock(new Vec3(0, 37, 0), Block.fromStateId(ironBlockId))
        assert.strictEqual(ironBlockId, chunk.getBlock(new Vec3(0, 37, 0)).stateId)
      }
    })

    //

    const testTag = require('./testBlockEntity.json')

    it('can handle block entities', () => {
      const column = new ChunkColumn()

      testTag.x = 102
      testTag.y = 44
      testTag.z = -1

      const setAt = new Set()
      const fakeBlock = Block.fromStateId(registry.blocksByName.anvil.defaultState, 1)
      fakeBlock.entity = testTag
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
          for (let z = 0; z < 16; z++) {
            if (Math.random() < 0.1) {
              column.setBlock(new Vec3(x, y, z), fakeBlock)
              setAt.add(`${x},${y},${z}`)
            }
          }
        }
      }

      const toJson = column.toJson()

      const next = ChunkColumn.fromJson(toJson)
      for (const entry of setAt) {
        const [x, y, z] = entry.split(',').map(Number)
        const block = next.getBlock(new Vec3(x, y, z))
        if (!block.entity) {
          throw new Error('missing block entity')
        }
        expect(block.entity.x).toEqual(testTag.x)
        expect(block.entity.y).toEqual(testTag.y)
        expect(block.entity.z).toEqual(testTag.z)
      }
    })
  })
}
