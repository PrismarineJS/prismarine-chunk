/* eslint-env mocha */

const assert = require('assert')
const Vec3 = require('vec3').Vec3
const fs = require('fs')
const path = require('path')
const prismarineBlockLoader = require('prismarine-block')
const chunkLoader = require('../index')
const SingleValueContainer = require('../src/pc/common/PaletteContainer').SingleValueContainer
const constants = require('../src/pc/common/constants')
const { performance } = require('perf_hooks')
const expect = require('expect').default

const versions = ['bedrock_0.14', 'bedrock_1.0', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13.2', '1.14.4', '1.15.2', '1.16.1', '1.17', '1.18', '1.19', '1.20']
const cycleTests = ['1.8', '1.9', '1.10', '1.11', '1.12', '1.13.2', '1.14.4', '1.15.2', '1.16.1', '1.17', '1.18', '1.19', '1.20']

versions.forEach((version) => describe(`Chunk implementation for minecraft ${version}`, () => {
  const registry = require('prismarine-registry')(version)
  const Chunk = chunkLoader(registry)
  const Block = prismarineBlockLoader(registry)

  const isPostFlattening = version.startsWith('1.13') || version.startsWith('1.14') ||
    version.startsWith('1.15') || version.startsWith('1.16') || version.startsWith('1.17') ||
    version.startsWith('1.18') || version.startsWith('1.19') || version.startsWith('1.20')

  const serializesLightingDataSeparately = version.startsWith('1.14') || version.startsWith('1.15') ||
    version.startsWith('1.16') || version.startsWith('1.17') || version.startsWith('1.18') ||
    version.startsWith('1.19') || version.startsWith('1.20')

  const newLightingDataFormat = version.startsWith('1.17') || version.startsWith('1.18') || version.startsWith('1.19') ||
    version.startsWith('1.20')

  const serializesBiomesSeparately = version.startsWith('1.15') || version.startsWith('1.16') ||
    version.startsWith('1.17')

  const unifiedPaletteFormat = version.startsWith('1.18') || version.startsWith('1.19') || version.startsWith('1.20')
  const tallWorld = version.startsWith('1.18') || version.startsWith('1.19') || version.startsWith('1.20')

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

  if (registry.version.type === 'pc' && registry.version['==']('1.13.1')) {
    // Moved from ChunkColimn.test.js -- only tested on 1.13.1
    it('loading empty chunk sections becomes air', () => {
      const column = new Chunk()

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
  }

  it('Skylight set/get', function () {
    const chunk = new Chunk()
    chunk.setBlock(new Vec3(0, 0, 0), new Block(5, 0, 2)) // Birch planks, if you're wondering
    assert.strictEqual(5, chunk.getBlock(new Vec3(0, 0, 0)).type)
    chunk.setSkyLight(new Vec3(0, 0, 0), 15)
    assert.strictEqual(15, chunk.getSkyLight(new Vec3(0, 0, 0)))
    if (!serializesLightingDataSeparately && version !== '1.8') {
      const buffer = chunk.dump()
      const bitmap = chunk.getMask()
      const chunk2 = new Chunk()
      chunk2.load(buffer, bitmap, true)

      assert.strictEqual(15, chunk2.getSkyLight(new Vec3(0, 0, 0)))
    }
  })

  it('Block light set/get', function () {
    const chunk = new Chunk()

    chunk.setBlock(new Vec3(0, 0, 0), new Block(5, 0, 2)) // Birch planks, if you're wondering
    assert.strictEqual(5, chunk.getBlock(new Vec3(0, 0, 0)).type)
    chunk.setBlockLight(new Vec3(0, 0, 0), 15)
    assert.strictEqual(15, chunk.getBlockLight(new Vec3(0, 0, 0)))
    if (!serializesLightingDataSeparately && version !== '1.8') {
      const buffer = chunk.dump()
      const bitmap = chunk.getMask()
      const chunk2 = new Chunk()
      chunk2.load(buffer, bitmap, true)

      assert.strictEqual(15, chunk2.getBlockLight(new Vec3(0, 0, 0)))
    }
  })

  it('Overwrites blocks in place', function () {
    const chunk = new Chunk()

    chunk.setBlock(new Vec3(0, 1, 0), new Block(42, 0, 0)) // Iron block
    chunk.setBlock(new Vec3(0, 1, 0), new Block(41, 0, 0)) // Gold block
    assert.strictEqual(41, chunk.getBlock(new Vec3(0, 1, 0)).type)
    if (!isPostFlattening) {
      assert.strictEqual(0, chunk.getBlock(new Vec3(0, 1, 0)).metadata)
    }

    chunk.setBlock(new Vec3(5, 5, 5), new Block(35, 0, 1)) // Orange wool
    chunk.setBlock(new Vec3(5, 5, 5), new Block(35, 0, 14)) // Red wool
    assert.strictEqual(35, chunk.getBlock(new Vec3(5, 5, 5)).type)
    if (!isPostFlattening) {
      assert.strictEqual(14, chunk.getBlock(new Vec3(5, 5, 5)).metadata)
    }
  })

  if (version !== 'bedrock_1.0' && version !== '1.9') {
    it('Fails safely when loading bad input', function () {
      const chunk = new Chunk()

      const tooShort = Buffer.alloc(3)
      const notABuffer = []

      assert.throws(function () {
        chunk.load(tooShort)
      })

      assert.throws(function () {
        chunk.load(notABuffer)
      })
    })
  }

  function checkChunkAreTheSame (chunk1, chunk2) {
    const buf = chunk1.dump()
    const chunk1Mask = chunk1.getMask()

    const buf2 = chunk2.dump()
    const chunk2Mask = chunk2.getMask()

    if (version === '1.17') {
      assert.strictEqual(chunk1Mask.length, chunk2Mask.length)
      for (let i = 0; i < chunk1Mask.length; i++) {
        assert.strictEqual(chunk1Mask[i][0], chunk2Mask[i][0])
        assert.strictEqual(chunk1Mask[i][1], chunk2Mask[i][1])
      }
    } else if (!unifiedPaletteFormat) {
      assert.strictEqual(chunk1Mask, chunk2Mask)
    }

    if (!buf.equals(buf2)) {
      assert.strictEqual(buf, buf2)
    }
    assert(buf.equals(buf2))
  }

  if (version !== 'bedrock_1.0') {
    it('Loads and dumps fake data consistently', function () {
      const chunk = new Chunk()

      chunk.setBlock(new Vec3(0, 37, 0), new Block(42, 0, 0))
      assert.strictEqual(chunk.getBlock(new Vec3(0, 37, 0)).type, 42)
      if (!isPostFlattening) {
        assert.strictEqual(chunk.getBlock(new Vec3(0, 37, 0)).metadata, 0)
      }

      const buf = chunk.dump()
      const chunk1Mask = chunk.getMask()
      const chunk2 = new Chunk()

      chunk2.load(buf, chunk1Mask)

      assert.strictEqual(chunk2.getBlock(new Vec3(0, 37, 0)).type, 42)
      if (!isPostFlattening) {
        assert.strictEqual(chunk2.getBlock(new Vec3(0, 37, 0)).metadata, 0)
      }

      checkChunkAreTheSame(chunk, chunk2)
    })

    if (version !== 'bedrock_0.14') {
      it('Loads and dumps fake data consistently with 512 block types in one section', function () {
        const chunk = new Chunk()

        let i = 0
        for (let x = 0; x < 16; x++) {
          for (let z = 0; z < 16; z++) {
            for (let y = 0; y < 2; y++) {
              i += 1
              chunk.setBlock(new Vec3(x, y, z), new Block(i, 0, 0))
            }
          }
        }

        const buf = chunk.dump()
        const chunk1Mask = chunk.getMask()
        const chunk2 = new Chunk()

        chunk2.load(buf, chunk1Mask)

        checkChunkAreTheSame(chunk, chunk2)
      })
    }
  }

  if (cycleTests.includes(version)) {
    const folder = path.join(__dirname, version)
    const files = fs.readdirSync(folder)
    const chunkFiles = files.filter(file => file.includes('.dump') && !file.includes('light'))
    const dataFiles = files.filter(file => file.includes('.meta') && !file.includes('light'))
    const worldFiles = files.filter(file => file.includes('.world'))

    chunkFiles.forEach(chunkDump => {
      const name = chunkDump.substring(0, chunkDump.length - 5)
      const packetData = dataFiles.find(dataFile => dataFile.includes(name))
      const dump = fs.readFileSync(path.join(folder, chunkDump))
      const data = JSON.parse(
        fs.readFileSync(path.join(folder, packetData)).toString()
      )
      const worldFile = worldFiles.find(worldFile => worldFile.includes(name))
      const chunkOptions = {
        minY: tallWorld ? -64 : 0,
        worldHeight: tallWorld ? 384 : 256
      }
      if (worldFile) {
        const worldData = JSON.parse(
          fs.readFileSync(path.join(folder, worldFile)).toString()
        )
        chunkOptions.minY = worldData.minY
        chunkOptions.worldHeight = worldData.worldHeight
      }

      data.skylightSent = !packetData.includes('nether') && !packetData.includes('end')

      let lightData, lightDump

      if (unifiedPaletteFormat) {
        lightData = data
      } else if (serializesLightingDataSeparately) {
        lightData = JSON.parse(fs.readFileSync(path.join(folder, packetData.replace('chunk', 'chunk_light'))).toString())
        if (!newLightingDataFormat) {
          lightDump = fs.readFileSync(path.join(folder, chunkDump.replace('chunk', 'chunk_light')))
        }
      }

      it('Loads chunk buffers ' + chunkDump, () => {
        const chunk = new Chunk(chunkOptions)
        chunk.load(dump, data.bitMap, data.skyLightSent)
        if (serializesLightingDataSeparately) {
          if (newLightingDataFormat) {
            chunk.loadParsedLight(lightData.skyLight, lightData.blockLight, lightData.skyLightMask, lightData.blockLightMask, lightData.emptySkyLightMask, lightData.emptyBlockLightMask)
          } else {
            chunk.loadLight(lightDump, lightData.skyLightMask, lightData.blockLightMask, lightData.emptySkyLightMask, lightData.emptyBlockLightMask)
          }
        }
      })

      if (!chunkDump.includes('hypixel')) {
        it('Loads chunk buffers and histogram looks ok ' + chunkDump, () => {
          const chunk = new Chunk(chunkOptions)
          chunk.load(dump, data.bitMap, data.skyLightSent)
          if (serializesLightingDataSeparately) {
            if (newLightingDataFormat) {
              chunk.loadParsedLight(lightData.skyLight, lightData.blockLight, lightData.skyLightMask, lightData.blockLightMask, lightData.emptySkyLightMask, lightData.emptyBlockLightMask)
            } else {
              chunk.loadLight(lightDump, lightData.skyLightMask, lightData.blockLightMask, lightData.emptySkyLightMask, lightData.emptyBlockLightMask)
            }
          }

          const histogram = {}
          const p = new Vec3(0, chunkOptions.minY, 0)
          const maxHeight = chunkOptions.worldHeight + chunkOptions.minY
          let total = 0
          for (p.y = chunkOptions.minY; p.y < maxHeight; p.y++) {
            for (p.z = 0; p.z < 16; p.z++) {
              for (p.x = 0; p.x < 16; p.x++) {
                const b = chunk.getBlock(p)
                histogram[b.name] = histogram[b.name] === undefined ? 1 : histogram[b.name] + 1
                total += 1
              }
            }
          }
          Object.keys(histogram).forEach(k => { histogram[k] = histogram[k] / total })
          // console.log(histogram)
          const checkBlockKind = (name, value) => assert(histogram[name] > value, `${name} ${histogram[name]} <= ${value}`)
          const checkBlockKindSome = (thresholds) => assert(
            Object.keys(thresholds).some(name => histogram[name] > thresholds[name]),
            Object.keys(thresholds).map(name => `${name} ${histogram[name]} <= ${thresholds[name]}`).join(' && '))
          if (!chunkDump.includes('end') && !chunkDump.includes('nether')) {
            checkBlockKind('stone', 0.01)
            checkBlockKindSome({ dirt: 0.001, granite: 0.001, lava: 0.001 })
            checkBlockKindSome({ coal_ore: 0.0001, iron_ore: 0.0001, diamond_ore: 0.0001 })
          }
          checkBlockKind('air', 0.5)
        })
      }

      it('Correctly cycles through chunks ' + chunkDump, () => {
        const chunk = new Chunk(chunkOptions)
        chunk.load(dump, data.bitMap, data.skyLightSent)
        const buffer = chunk.dump()
        const bitmap = chunk.getMask()
        const chunk2 = new Chunk(chunkOptions)
        chunk2.load(buffer, bitmap, data.skyLightSent)

        if (serializesLightingDataSeparately) {
          if (newLightingDataFormat) {
            chunk.loadParsedLight(lightData.skyLight, lightData.blockLight, lightData.skyLightMask, lightData.blockLightMask, lightData.emptySkyLightMask, lightData.emptyBlockLightMask)

            const lightChunkData = chunk.dumpLight()
            chunk2.loadParsedLight(lightChunkData.skyLight, lightChunkData.blockLight, lightChunkData.skyLightMask, lightChunkData.blockLightMask, lightChunkData.emptySkyLightMask, lightChunkData.emptyBlockLightMask)
          } else {
            chunk.loadLight(lightDump, lightData.skyLightMask, lightData.blockLightMask, lightData.emptySkyLightMask, lightData.emptyBlockLightMask)
            const lightBuffer = chunk.dumpLight()
            chunk2.loadLight(lightBuffer, lightData.skyLightMask, lightData.blockLightMask, lightData.emptySkyLightMask, lightData.emptyBlockLightMask)
          }
        }

        if (serializesBiomesSeparately) {
          chunk.loadBiomes(data.biomes)
          const dumpedBiomes = chunk.dumpBiomes()
          chunk2.loadBiomes(dumpedBiomes)
        }

        function eqSet (as, bs) {
          if (as.size !== bs.size) return false
          for (const a of as) if (!bs.has(a)) return false
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

        const p = new Vec3(0, chunkOptions.minY, 0)
        const maxHeight = chunkOptions.worldHeight + chunkOptions.minY
        for (p.y = chunkOptions.minY; p.y < maxHeight; p.y++) {
          for (p.z = 0; p.z < 16; p.z++) {
            for (p.x = 0; p.x < 16; p.x++) {
              const b = chunk.getBlock(p)
              const b2 = chunk2.getBlock(p)
              assert.notStrictEqual(
                b.name,
                '',
                ' block state: ' +
                    b.stateId +
                    ' type: ' +
                    b.type +
                    " read, which doesn't exist"
              )
              assert.deepStrictEqual(b, b2)
            }
          }
        }

        // Work around bug in Mojang's buffer size calculation that causes
        // SingleValuePalettes for stateIds to report an extra byte of size
        let num = 0
        if (unifiedPaletteFormat) {
          for (const section of chunk.sections) {
            if (section.data instanceof SingleValueContainer) {
              num++
            }
          }
        }

        if (!version.startsWith('1.8') && !chunkDump.includes('hypixel')) {
          assert(Buffer.compare(dump.slice(0, dump.length - num), buffer) === 0, 'chunk buffers are not equal')
        }
      })

      it('Correctly cycles through chunks json ' + chunkDump, () => {
        const measurePerformance = false
        let a = performance.now()
        const chunk = new Chunk(chunkOptions)
        if (measurePerformance) {
          console.log('creation', version, performance.now() - a)
          a = performance.now()
        }
        chunk.load(dump, data.bitMap, data.skyLightSent)
        if (serializesLightingDataSeparately) {
          if (newLightingDataFormat) {
            chunk.loadParsedLight(lightData.skyLight, lightData.blockLight, lightData.skyLightMask, lightData.blockLightMask, lightData.emptySkyLightMask, lightData.emptyBlockLightMask)
          } else {
            chunk.loadLight(lightDump, lightData.skyLightMask, lightData.blockLightMask, lightData.emptySkyLightMask, lightData.emptyBlockLightMask)
          }
        }

        if (serializesBiomesSeparately) {
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

        const p = new Vec3(0, chunkOptions.minY, 0)
        const maxHeight = chunkOptions.worldHeight + chunkOptions.minY
        for (p.y = chunkOptions.minY; p.y < maxHeight; p.y++) {
          for (p.z = 0; p.z < 16; p.z++) {
            for (p.x = 0; p.x < 16; p.x++) {
              const b = chunk.getBlock(p)
              const b2 = chunk2.getBlock(p)
              assert.notStrictEqual(
                b.name,
                '',
                ' block state: ' +
                    b.stateId +
                    ' type: ' +
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
}))
