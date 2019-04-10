/* eslint-env mocha */

const assert = require('assert')
const Vec3 = require('vec3').Vec3
const fs = require('fs')
const path = require('path')

const versions = ['pe_0.14', 'pe_1.0', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13.2']
const cycleTests = ['1.8', '1.9', '1.10', '1.11', '1.12', '1.13.2']

versions.forEach(function (version) {
  const Chunk = require('../index.js')(version)
  const Block = require('prismarine-block')(version)

  describe(`Chunk implementation for minecraft ${version}`, () => {
    if (version === '1.8') {
      it('Handles {skylightSent: false}', () => {
        const chunk = new Chunk()

        chunk.load(Buffer.alloc(164096), 0xFFFF, false)
      })

      it('handles {skylightSent: true}', () => {
        const chunk = new Chunk()

        chunk.load(Buffer.alloc(196864), 0xFFFF, true)
      })
    }

    it('Initializes correctly', () => {
      const chunk = new Chunk()

      chunk.initialize((x, y, z, n) => new Block(0, 0, 0))
    })

    it('Defaults to all blocks being air', function () {
      const chunk = new Chunk()

      assert.strictEqual(0, chunk.getBlock(new Vec3(0, 0, 0)).type)
      assert.strictEqual(0, chunk.getBlock(new Vec3(15, Chunk.h - 1, 15)).type)
    })

    it('Should set a block at the given position', function () {
      const chunk = new Chunk()

      chunk.setBlock(new Vec3(0, 0, 0), new Block(5, 0, 2)) // Birch planks, if you're wondering
      assert.strictEqual(5, chunk.getBlock(new Vec3(0, 0, 0)).type)
      if (!version.startsWith('1.13')) {
        assert.strictEqual(2, chunk.getBlock(new Vec3(0, 0, 0)).metadata)
      }

      chunk.setBlock(new Vec3(0, 37, 0), new Block(42, 0, 0)) // Iron block
      assert.strictEqual(42, chunk.getBlock(new Vec3(0, 37, 0)).type)
      if (!version.startsWith('1.13')) {
        assert.strictEqual(0, chunk.getBlock(new Vec3(0, 37, 0)).metadata)
      }

      chunk.setBlock(new Vec3(1, 0, 0), new Block(35, 0, 1)) // Orange wool
      assert.strictEqual(35, chunk.getBlock(new Vec3(1, 0, 0)).type)
      if (!version.startsWith('1.13')) {
        assert.strictEqual(1, chunk.getBlock(new Vec3(1, 0, 0)).metadata)
      }
    })

    it('Overwrites blocks in place', function () {
      const chunk = new Chunk()

      chunk.setBlock(new Vec3(0, 1, 0), new Block(42, 0, 0)) // Iron block
      chunk.setBlock(new Vec3(0, 1, 0), new Block(41, 0, 0)) // Gold block
      assert.strictEqual(41, chunk.getBlock(new Vec3(0, 1, 0)).type)
      if (!version.startsWith('1.13')) {
        assert.strictEqual(0, chunk.getBlock(new Vec3(0, 1, 0)).metadata)
      }

      chunk.setBlock(new Vec3(5, 5, 5), new Block(35, 0, 1)) // Orange wool
      chunk.setBlock(new Vec3(5, 5, 5), new Block(35, 0, 14)) // Red wool
      assert.strictEqual(35, chunk.getBlock(new Vec3(5, 5, 5)).type)
      if (!version.startsWith('1.13')) {
        assert.strictEqual(14, chunk.getBlock(new Vec3(5, 5, 5)).metadata)
      }
    })

    if (version !== 'pe_1.0' && version !== '1.9') {
      it('Fails safely when loading bad input', function () {
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
      it('Loads and dumps fake data consistently', function () {
        const chunk = new Chunk()

        chunk.setBlock(new Vec3(0, 37, 0), new Block(42, 0, 0))
        assert.strictEqual(0, chunk.getBlock(new Vec3(0, 37, 0)).metadata)
        assert.strictEqual(42, chunk.getBlock(new Vec3(0, 37, 0)).type)
        const buf = chunk.dump()
        const chunk2 = new Chunk()

        chunk2.load(buf, 0xFFFF)
        assert.strictEqual(42, chunk2.getBlock(new Vec3(0, 37, 0)).type)
        assert.strictEqual(0, chunk2.getBlock(new Vec3(0, 37, 0)).metadata)

        const buf2 = chunk2.dump()

        if (!buf.equals(buf2)) {
          assert.strictEqual(buf, buf2)
        }

        assert(buf.equals(buf2))
      })
    }

    if (cycleTests.includes(version)) {
      const folder = path.join(__dirname, version)
      const files = fs.readdirSync(folder)
      const chunkFiles = files.filter(file => file.includes('.dump'))
      const dataFiles = files.filter(file => file.includes('.meta'))

      chunkFiles.forEach(chunkDump => {
        const packetData = dataFiles.find(dataFile => dataFile.includes(chunkDump.substr(0, chunkDump.length - 5)))
        const dump = fs.readFileSync(path.join(folder, chunkDump))
        const data = JSON.parse(fs.readFileSync(path.join(folder, packetData)).toString())
        it('Loads chunk buffers ' + chunkDump, () => {
          const chunk = new Chunk()
          chunk.load(dump, data.bitMap, data.skyLightSent)
        })

        it('Correctly cycles through chunks ' + chunkDump, () => {
          const chunk = new Chunk()
          chunk.load(dump, data.bitMap, data.skyLightSent)
          const buffer = chunk.dump()
          const chunk2 = new Chunk()
          chunk2.load(buffer, 0xFFFF, data.skyLightSent)

          const p = new Vec3(0, 0, 0)
          for (p.y = 0; p.y < 256; p.y++) {
            for (p.z = 0; p.z < 16; p.z++) {
              for (p.x = 0; p.x < 16; p.x++) {
                const b = chunk.getBlock(p)
                const b2 = chunk2.getBlock(p)
                assert.notStrictEqual(b.name, '', ' block state n° ' + b.stateId + ' type n°' + b.type + ' read, which doesn\'t exist')
                assert.deepStrictEqual(b, b2)
              }
            }
          }
        })
      })
    }
  })
})
