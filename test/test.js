/* eslint-env mocha */

const assert = require('assert')
const Vec3 = require('vec3').Vec3
const fs = require('fs')
const path = require('path')
const prismarineBlockLoader = require('prismarine-block')
const chunkLoader = require('../index')
const { performance } = require('perf_hooks')

const versions = ['pe_0.14', 'pe_1.0', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13.2', '1.14.4', '1.15.2', '1.16.1']
const cycleTests = ['1.8', '1.9', '1.10', '1.11', '1.12', '1.13.2', '1.14.4', '1.15.2', '1.16.1']

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

    assert.strictEqual(0, chunk.getBlock(new Vec3(0, 0, 0)).type)
    assert.strictEqual(0, chunk.getBlock(new Vec3(15, Chunk.h - 1, 15)).type)
  })

  test('Out of bounds blocks being air', function () {
    const chunk = new Chunk()

    assert.strictEqual(0, chunk.getBlock(new Vec3(8, -1, 8)).type)
    assert.strictEqual(0, chunk.getBlock(new Vec3(8, 256, 8)).type)
  })

  test('Should set a block at the given position', function () {
    const chunk = new Chunk()

    chunk.setBlock(new Vec3(0, 0, 0), new Block(5, 0, 2)) // Birch planks, if you're wondering
    assert.strictEqual(5, chunk.getBlock(new Vec3(0, 0, 0)).type)
    if (!version.startsWith('1.13') && !version.startsWith('1.14') && !version.startsWith('1.15') && !version.startsWith('1.16')) {
      assert.strictEqual(2, chunk.getBlock(new Vec3(0, 0, 0)).metadata)
    }

    chunk.setBlock(new Vec3(0, 37, 0), new Block(42, 0, 0)) // Iron block
    assert.strictEqual(42, chunk.getBlock(new Vec3(0, 37, 0)).type)
    if (!version.startsWith('1.13') && !version.startsWith('1.14') && !version.startsWith('1.15') && !version.startsWith('1.16')) {
      assert.strictEqual(0, chunk.getBlock(new Vec3(0, 37, 0)).metadata)
    }

    chunk.setBlock(new Vec3(1, 0, 0), new Block(35, 0, 1)) // Orange wool
    assert.strictEqual(35, chunk.getBlock(new Vec3(1, 0, 0)).type)
    if (!version.startsWith('1.13') && !version.startsWith('1.14') && !version.startsWith('1.15') && !version.startsWith('1.16')) {
      assert.strictEqual(1, chunk.getBlock(new Vec3(1, 0, 0)).metadata)
    }
  })

  test('Skylight set/get', function () {
    const chunk = new Chunk()

    chunk.setBlock(new Vec3(0, 0, 0), new Block(5, 0, 2)) // Birch planks, if you're wondering
    assert.strictEqual(5, chunk.getBlock(new Vec3(0, 0, 0)).type)
    chunk.setSkyLight(new Vec3(0, 0, 0), 15)
    assert.strictEqual(15, chunk.getSkyLight(new Vec3(0, 0, 0)))
    if (!version.startsWith('1.8') && !version.startsWith('1.14') && !version.startsWith('1.15') && !version.startsWith('1.16')) {
      const buffer = chunk.dump()
      const bitmap = chunk.getMask()
      const chunk2 = new Chunk()
      chunk2.load(buffer, bitmap, true)

      assert.strictEqual(15, chunk2.getSkyLight(new Vec3(0, 0, 0)))
    }
  })

  test('Block light set/get', function () {
    const chunk = new Chunk()

    chunk.setBlock(new Vec3(0, 0, 0), new Block(5, 0, 2)) // Birch planks, if you're wondering
    assert.strictEqual(5, chunk.getBlock(new Vec3(0, 0, 0)).type)
    chunk.setBlockLight(new Vec3(0, 0, 0), 15)
    assert.strictEqual(15, chunk.getBlockLight(new Vec3(0, 0, 0)))
    if (!version.startsWith('1.8') && !version.startsWith('1.14') && !version.startsWith('1.15') && !version.startsWith('1.16')) {
      const buffer = chunk.dump()
      const bitmap = chunk.getMask()
      const chunk2 = new Chunk()
      chunk2.load(buffer, bitmap, true)

      assert.strictEqual(15, chunk2.getBlockLight(new Vec3(0, 0, 0)))
    }
  })

  test('Overwrites blocks in place', function () {
    const chunk = new Chunk()

    chunk.setBlock(new Vec3(0, 1, 0), new Block(42, 0, 0)) // Iron block
    chunk.setBlock(new Vec3(0, 1, 0), new Block(41, 0, 0)) // Gold block
    assert.strictEqual(41, chunk.getBlock(new Vec3(0, 1, 0)).type)
    if (!version.startsWith('1.13') && !version.startsWith('1.14') && !version.startsWith('1.15') && !version.startsWith('1.16')) {
      assert.strictEqual(0, chunk.getBlock(new Vec3(0, 1, 0)).metadata)
    }

    chunk.setBlock(new Vec3(5, 5, 5), new Block(35, 0, 1)) // Orange wool
    chunk.setBlock(new Vec3(5, 5, 5), new Block(35, 0, 14)) // Red wool
    assert.strictEqual(35, chunk.getBlock(new Vec3(5, 5, 5)).type)
    if (!version.startsWith('1.13') && !version.startsWith('1.14') && !version.startsWith('1.15') && !version.startsWith('1.16')) {
      assert.strictEqual(14, chunk.getBlock(new Vec3(5, 5, 5)).metadata)
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

      chunk.setBlock(new Vec3(0, 37, 0), new Block(42, 0, 0))
      assert.strictEqual(chunk.getBlock(new Vec3(0, 37, 0)).metadata, 0)
      assert.strictEqual(chunk.getBlock(new Vec3(0, 37, 0)).type, 42)
      const buf = chunk.dump()
      const chunk1Mask = chunk.getMask()
      const chunk2 = new Chunk()

      chunk2.load(buf, chunk1Mask)

      assert.strictEqual(chunk2.getBlock(new Vec3(0, 37, 0)).type, 42)
      assert.strictEqual(chunk2.getBlock(new Vec3(0, 37, 0)).metadata, 0)

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
    const chunkFiles = files.filter(file => file.includes('.dump') && !file.includes('light'))
    const dataFiles = files.filter(file => file.includes('.meta') && !file.includes('light'))

    chunkFiles.forEach(chunkDump => {
      const name = chunkDump.substr(0, chunkDump.length - 5)
      const packetData = dataFiles.find(dataFile => dataFile.includes(name))
      const dump = fs.readFileSync(path.join(folder, chunkDump))
      const data = JSON.parse(
        fs.readFileSync(path.join(folder, packetData)).toString()
      )
      data.skylightSent = !packetData.includes('nether') && !packetData.includes('end')

      let lightDump, lightData
      if (version.startsWith('1.14') || version.startsWith('1.15') || version.startsWith('1.16')) {
        lightDump = fs.readFileSync(path.join(folder, chunkDump.replace('chunk', 'chunk_light')))
        lightData = JSON.parse(
          fs.readFileSync(path.join(folder, packetData.replace('chunk', 'chunk_light'))).toString()
        )
      }

      test('Loads chunk buffers ' + chunkDump, () => {
        const chunk = new Chunk()
        chunk.load(dump, data.bitMap, data.skyLightSent)
        if (version.startsWith('1.14') || version.startsWith('1.15') || version.startsWith('1.16')) {
          chunk.loadLight(lightDump, lightData.skyLightMask, lightData.blockLightMask, lightData.emptySkyLightMask, lightData.emptyBlockLightMask)
        }
      })

      test('Correctly cycles through chunks ' + chunkDump, () => {
        const chunk = new Chunk()
        chunk.load(dump, data.bitMap, data.skyLightSent)
        const buffer = chunk.dump()
        const bitmap = chunk.getMask()
        const chunk2 = new Chunk()
        chunk2.load(buffer, bitmap, data.skyLightSent)

        if (version.startsWith('1.14') || version.startsWith('1.15') || version.startsWith('1.16')) {
          chunk.loadLight(lightDump, lightData.skyLightMask, lightData.blockLightMask, lightData.emptySkyLightMask, lightData.emptyBlockLightMask)
          const lightBuffer = chunk.dumpLight()
          chunk2.loadLight(lightBuffer, lightData.skyLightMask, lightData.blockLightMask, lightData.emptySkyLightMask, lightData.emptyBlockLightMask)
        }

        if (version.startsWith('1.15') || version.startsWith('1.16')) {
          chunk.loadBiomes(data.biomes)
          const dumpedBiomes = chunk.dumpBiomes()
          chunk2.loadBiomes(dumpedBiomes)
        }

        function eqSet (as, bs) {
          if (as.size !== bs.size) return false
          for (var a of as) if (!bs.has(a)) return false
          return true
        }

        if (chunk.sections) {
          assert.strictEqual(chunk.sections.length, chunk2.sections.length)
          for (let i = 0; i < chunk.sections.length; i++) {
            if (chunk.sections[i] !== null && chunk.sections[i].palette !== undefined) {
              const s1 = new Set(chunk.sections[i].palette)
              const s2 = new Set(chunk2.sections[i].palette)
              assert(eqSet(s1, s2), `palettes are not equal ${[...s1]} != ${[...s2]}`)
            }
          }
        }

        const p = new Vec3(0, 0, 0)
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
        if (!version.startsWith('1.8')) {
          assert(Buffer.compare(dump, buffer) === 0, 'chunk buffers are not equal')
        }
      })

      test('Correctly cycles through chunks json ' + chunkDump, () => {
        const measurePerformance = false
        let a = performance.now()
        const chunk = new Chunk()
        if (measurePerformance) {
          console.log('creation', version, performance.now() - a)
          a = performance.now()
        }
        chunk.load(dump, data.bitMap, data.skyLightSent)
        if (version.startsWith('1.14') || version.startsWith('1.15') || version.startsWith('1.16')) {
          chunk.loadLight(lightDump, lightData.skyLightMask, lightData.blockLightMask, lightData.emptySkyLightMask, lightData.emptyBlockLightMask)
        }

        if (version.startsWith('1.15') || version.startsWith('1.16')) {
          chunk.loadBiomes(data.biomes)
        }
        if (measurePerformance) {
          console.log('loading', version, performance.now() - a)
          a = performance.now()
        }
        const j = chunk.toJson()
        if (measurePerformance) {
          console.log('seria json', version, performance.now() - a)
          a = performance.now()
        }
        const chunk2 = Chunk.fromJson(j)
        if (measurePerformance) {
          console.log('loading json', version, performance.now() - a)
        }

        const p = new Vec3(0, 0, 0)
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
