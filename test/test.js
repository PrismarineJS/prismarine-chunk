/* eslint-env mocha */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const prismarineBlockLoader = require('prismarine-block')
const chunkLoader = require('../index')
const { performance } = require('perf_hooks')

const versions = ['pe_0.14', 'pe_1.0', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13.2']
const cycleTests = ['1.8', '1.9', '1.10', '1.11', '1.12', '1.13.2']

const depsByVersion = versions.map((version) => {
  return [
    version, // version
    chunkLoader(version), // Chunk
    prismarineBlockLoader(version) // Block
  ]
})

describe.each(depsByVersion)('Chunk implementation for minecraft %s', (version, Chunk, Block) => {
  if (version === '1.8') {
    test('Handles {skylightSent: false}', () => {
      const chunk = new Chunk()

      chunk.load(Buffer.alloc(164096), 0xFFFF, false)
    })

    test('handles {skylightSent: true}', () => {
      const chunk = new Chunk()

      chunk.load(Buffer.alloc(196864), 0xFFFF, true)
    })
  }

  test('Initializes correctly', () => {
    const chunk = new Chunk()

    chunk.initialize((x, y, z, n) => new Block(0, 0, 0))
  })

  test('Defaults to all blocks being air', function () {
    const chunk = new Chunk()

    assert.strictEqual(0, chunk.getBlock({ x: 0, y: 0, z: 0 }).type)
    assert.strictEqual(0, chunk.getBlock({ x: 15, y: Chunk.h - 1, z: 15 }).type)
  })

  test('Should set a block at the given position', function () {
    const chunk = new Chunk()

    chunk.setBlock({ x: 0, y: 0, z: 0 }, new Block(5, 0, 2)) // Birch planks, if you're wondering
    assert.strictEqual(5, chunk.getBlock({ x: 0, y: 0, z: 0 }).type)
    if (!version.startsWith('1.13')) {
      assert.strictEqual(2, chunk.getBlock({ x: 0, y: 0, z: 0 }).metadata)
    }

    chunk.setBlock({ x: 0, y: 37, z: 0 }, new Block(42, 0, 0)) // Iron block
    assert.strictEqual(42, chunk.getBlock({ x: 0, y: 37, z: 0 }).type)
    if (!version.startsWith('1.13')) {
      assert.strictEqual(0, chunk.getBlock({ x: 0, y: 37, z: 0 }).metadata)
    }

    chunk.setBlock({ x: 1, y: 0, z: 0 }, new Block(35, 0, 1)) // Orange wool
    assert.strictEqual(35, chunk.getBlock({ x: 1, y: 0, z: 0 }).type)
    if (!version.startsWith('1.13')) {
      assert.strictEqual(1, chunk.getBlock({ x: 1, y: 0, z: 0 }).metadata)
    }
  })

  test('Overwrites blocks in place', function () {
    const chunk = new Chunk()

    chunk.setBlock({ x: 0, y: 1, z: 0 }, new Block(42, 0, 0)) // Iron block
    chunk.setBlock({ x: 0, y: 1, z: 0 }, new Block(41, 0, 0)) // Gold block
    assert.strictEqual(41, chunk.getBlock({ x: 0, y: 1, z: 0 }).type)
    if (!version.startsWith('1.13')) {
      assert.strictEqual(0, chunk.getBlock({ x: 0, y: 1, z: 0 }).metadata)
    }

    chunk.setBlock({ x: 5, y: 5, z: 5 }, new Block(35, 0, 1)) // Orange wool
    chunk.setBlock({ x: 5, y: 5, z: 5 }, new Block(35, 0, 14)) // Red wool
    assert.strictEqual(35, chunk.getBlock({ x: 5, y: 5, z: 5 }).type)
    if (!version.startsWith('1.13')) {
      assert.strictEqual(14, chunk.getBlock({ x: 5, y: 5, z: 5 }).metadata)
    }
  })

  if (version !== 'pe_1.0' && version !== '1.9') {
    test('Fails safely when loading bad input', function () {
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
    test('Loads and dumps fake data consistently', function () {
      const chunk = new Chunk()

      chunk.setBlock({ x: 0, y: 37, z: 0 }, new Block(42, 0, 0))
      assert.strictEqual(chunk.getBlock({ x: 0, y: 37, z: 0 }).metadata, 0)
      assert.strictEqual(chunk.getBlock({ x: 0, y: 37, z: 0 }).type, 42)
      const buf = chunk.dump()
      const chunk1Mask = chunk.getMask()
      const chunk2 = new Chunk()

      chunk2.load(buf, chunk1Mask)

      assert.strictEqual(chunk2.getBlock({ x: 0, y: 37, z: 0 }).type, 42)
      assert.strictEqual(chunk2.getBlock({ x: 0, y: 37, z: 0 }).metadata, 0)

      const buf2 = chunk2.dump()
      const chunk2Mask = chunk.getMask()
      assert.strictEqual(chunk1Mask, chunk2Mask)

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
      const packetData = dataFiles.find(dataFile =>
        dataFile.includes(chunkDump.substr(0, chunkDump.length - 5))
      )
      const dump = fs.readFileSync(path.join(folder, chunkDump))
      const data = JSON.parse(
        fs.readFileSync(path.join(folder, packetData)).toString()
      )
      test('Loads chunk buffers ' + chunkDump, () => {
        const chunk = new Chunk()
        chunk.load(dump, data.bitMap, data.skyLightSent)
      })

      test('Correctly cycles through chunks ' + chunkDump, () => {
        const chunk = new Chunk()
        chunk.load(dump, data.bitMap, data.skyLightSent)
        const buffer = chunk.dump()
        const bitmap = chunk.getMask()
        const chunk2 = new Chunk()
        chunk2.load(buffer, bitmap, data.skyLightSent)

        const p = { x: 0, y: 0, z: 0 }
        for (p.y = 0; p.y < 256; p.y++) {
          for (p.z = 0; p.z < 16; p.z++) {
            for (p.x = 0; p.x < 16; p.x++) {
              const b = chunk.getBlock(p)
              const b2 = chunk2.getBlock(p)
              assert.notStrictEqual(
                b.name,
                '',
                ' block state n° ' +
                    b.stateId +
                    ' type n°' +
                    b.type +
                    " read, which doesn't exist"
              )
              assert.deepStrictEqual(b, b2)
            }
          }
        }
      })

      test('Correctly cycles through chunks json ' + chunkDump, () => {
        let a = performance.now()
        const chunk = new Chunk()
        console.log('creation', version, performance.now() - a)
        a = performance.now()
        chunk.load(dump, data.bitMap, data.skyLightSent)
        console.log('loading', version, performance.now() - a)
        a = performance.now()
        const j = chunk.toJson()
        console.log('seria json', version, performance.now() - a)
        a = performance.now()
        const chunk2 = Chunk.fromJson(j)
        console.log('loading json', version, performance.now() - a)

        const p = { x: 0, y: 0, z: 0 }
        for (p.y = 0; p.y < 256; p.y++) {
          for (p.z = 0; p.z < 16; p.z++) {
            for (p.x = 0; p.x < 16; p.x++) {
              const b = chunk.getBlock(p)
              const b2 = chunk2.getBlock(p)
              assert.notStrictEqual(
                b.name,
                '',
                ' block state n° ' +
                    b.stateId +
                    ' type n°' +
                    b.type +
                    " read, which doesn't exist"
              )
              assert.deepStrictEqual(b, b2)
            }
          }
        }
      })
    })
  }
})
