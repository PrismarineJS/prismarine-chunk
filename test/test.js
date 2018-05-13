/* eslint-env mocha */

const assert = require('assert')
const Vec3 = require('vec3')

const versions = ['pe_0.14', 'pe_1.0', '1.8', '1.9']

describe('chunk 1.8', () => {
  const Chunk = require('../index.js')('1.8')
  it('should handle skylightSent = false', () => {
    const chunk = new Chunk()

    chunk.load(Buffer.alloc(164096), 0xFFFF, false)
  })

  it('should handle skylightSent = true', () => {
    const chunk = new Chunk()

    chunk.load(Buffer.alloc(196864), 0xFFFF, true)
  })
})

versions.forEach(function (version) {
  const Chunk = require('../index.js')(version)
  const Block = require('prismarine-block')(version)

  describe('chunk ' + version, function () {
    it("shouldn't break initialize", () => {
      const chunk = new Chunk()

      chunk.initialize((x, y, z, n) => new Block(0, 0, 0))
    })

    it('should default to having all blocks be air', function () {
      const chunk = new Chunk()

      assert.equal(0, chunk.getBlock(new Vec3(0, 0, 0)).type)
      assert.equal(0, chunk.getBlock(new Vec3(15, Chunk.h - 1, 15)).type)
    })
    it('should set a block at the given position', function () {
      const chunk = new Chunk()

      chunk.setBlock(new Vec3(0, 0, 0), new Block(5, 0, 2)) // Birch planks, if you're wondering
      assert.equal(5, chunk.getBlock(new Vec3(0, 0, 0)).type)
      assert.equal(2, chunk.getBlock(new Vec3(0, 0, 0)).metadata)

      chunk.setBlock(new Vec3(0, 37, 0), new Block(42, 0, 0)) // Iron block
      assert.equal(42, chunk.getBlock(new Vec3(0, 37, 0)).type)
      assert.equal(0, chunk.getBlock(new Vec3(0, 37, 0)).metadata)

      chunk.setBlock(new Vec3(1, 0, 0), new Block(35, 0, 1)) // Orange wool
      assert.equal(35, chunk.getBlock(new Vec3(1, 0, 0)).type)
      assert.equal(1, chunk.getBlock(new Vec3(1, 0, 0)).metadata)
    })
    it('should overwrite blocks in place', function () {
      const chunk = new Chunk()

      chunk.setBlock(new Vec3(0, 1, 0), new Block(42, 0, 0)) // Iron block
      chunk.setBlock(new Vec3(0, 1, 0), new Block(41, 0, 0)) // Gold block
      assert.equal(41, chunk.getBlock(new Vec3(0, 1, 0)).type)
      assert.equal(0, chunk.getBlock(new Vec3(0, 1, 0)).metadata)

      chunk.setBlock(new Vec3(5, 5, 5), new Block(35, 0, 1)) // Orange wool
      chunk.setBlock(new Vec3(5, 5, 5), new Block(35, 0, 14)) // Red wool
      assert.equal(35, chunk.getBlock(new Vec3(5, 5, 5)).type)
      assert.equal(14, chunk.getBlock(new Vec3(5, 5, 5)).metadata)
    })
    if (version !== 'pe_1.0' && version !== '1.9') {
      it('should fail safely when load is given bad input', function () {
        const chunk = new Chunk()

        const tooShort = Buffer.alloc(3)
        const notABuffer = []

        assert.throws(function () {
          chunk.load(tooShort)
        })

        assert.throws(function () {
          chunk.load(notABuffer, 0xFFFF)
        })
      })
    }

    if (version !== 'pe_1.0') {
      it('should load/dump consistently', function () {
        const chunk = new Chunk()

        chunk.setBlock(new Vec3(0, 37, 0), new Block(42, 0, 0)) // Iron block
        assert.equal(0, chunk.getBlock(new Vec3(0, 37, 0)).metadata)
        assert.equal(42, chunk.getBlock(new Vec3(0, 37, 0)).type)
        const buf = chunk.dump()
        const chunk2 = new Chunk()

        chunk2.load(buf, 0xFFFF)
        assert.equal(42, chunk2.getBlock(new Vec3(0, 37, 0)).type)
        assert.equal(0, chunk2.getBlock(new Vec3(0, 37, 0)).metadata)

        const buf2 = chunk2.dump()

        if (!buf.equals(buf2)) {
          assert.equal(buf, buf2)
        }

        assert(buf.equals(buf2))
      })
    }
  })
})
