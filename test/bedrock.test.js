/* eslint-env mocha */
const fs = require('fs')
const { join } = require('path')
const { Vec3 } = require('vec3')
const { bedrockVersions: versions } = require('./versions')
const assert = require('assert')

const { BlobEntry, BlobType } = require('prismarine-chunk')
const { StorageType } = require('prismarine-chunk/src/bedrock/common/constants')
const Stream = require('prismarine-chunk/src/bedrock/common/Stream')

const BlobStore = Map

for (const version of versions) {
  const registryForVersionCheck = require('prismarine-registry')(version)

  describe('bedrock network chunks on ' + version, () => {
    it('can re-encode level_chunk packet without caching, block block_network_ids_are_hashes = false', async () => {
      await reEncodeLevelChunkWithoutCaching(false)
    })

    it('can re-encode level_chunk with caching, block block_network_ids_are_hashes = false', async () => {
      await reEncodeLevelChunkWithCaching(false)
    })

    if (fs.existsSync(join(__dirname, version, getTestCaseName(false, true)))) {
      it('can re-encode level_chunk packet without caching, block_network_ids_are_hashes = true', async () => {
        await reEncodeLevelChunkWithoutCaching(true)
      })
    }

    if (fs.existsSync(join(__dirname, version, getTestCaseName(true, true)))) {
      it('can re-encode level_chunk with caching, block_network_ids_are_hashes = true', async () => {
        await reEncodeLevelChunkWithCaching(true)
      })
    }

    if (registryForVersionCheck.version['>=']('1.18')) {
      it('can re-encode subchunk packet without caching, block block_network_ids_are_hashes = false', async () => {
        await reEncodeSubChunkWithoutCaching(false)
      })

      it('can re-encode subchunk packet with caching, block block_network_ids_are_hashes = false', async () => {
        await reEncodeSubChunkWithCaching(false)
      })

      if (fs.existsSync(join(__dirname, version, getTestCaseName(false, true)))) {
        it('can re-encode subchunk packet without caching, block_network_ids_are_hashes = true', async () => {
          await reEncodeSubChunkWithoutCaching(true)
        })
      }

      if (fs.existsSync(join(__dirname, version, getTestCaseName(true, true)))) {
        it('can re-encode subchunk packet with caching, block_network_ids_are_hashes = true', async () => {
          await reEncodeSubChunkWithCaching(true)
        })
      }
    }

    function setup ({ version, cachingEnabled, blockNetworkIdsAreHashes }) {
      const registry = require('prismarine-registry')(version)
      const ChunkColumn = require('prismarine-chunk')(registry)
      const fixture = getFixture(version, cachingEnabled, blockNetworkIdsAreHashes)
      registry.handleStartGame({ block_network_ids_are_hashes: blockNetworkIdsAreHashes, itemstates: [] })
      return { registry, ChunkColumn, fixture }
    }

    function getFixture (version, cachingEnabled, blockNetworkIdsAreHashes) {
      const testCase = getTestCaseName(cachingEnabled, blockNetworkIdsAreHashes)
      const fixtures = fs
        .readdirSync(join(__dirname, version, testCase))
        .map((filename) => join(__dirname, version, testCase, filename))

      const levelChunk = fixtures.find(x => x.includes('level_chunk') && !x.includes('CacheMissResponse'))
      const levelChunkCacheMiss = fixtures.find(x => x.includes('level_chunk') && x.includes('CacheMissResponse'))

      const subChunks = fixtures.filter(x => x.includes('subchunk') && !x.includes('CacheMissResponse'))
      const subChunksCacheMiss = fixtures.filter(x => x.includes('subchunk') && x.includes('CacheMissResponse'))

      return {
        level_chunk: require(levelChunk),
        level_chunk_missResponse: levelChunkCacheMiss ? require(levelChunkCacheMiss) : undefined,
        subchunks: subChunks.map(x => require(x)),
        subchunks_cache_miss: subChunksCacheMiss ? subChunksCacheMiss.map(x => require(x)) : undefined
      }
    }

    async function reEncodeLevelChunkWithoutCaching (blockNetworkIdsAreHashes) {
      const { registry, ChunkColumn, fixture } = setup({ blockNetworkIdsAreHashes, version, cachingEnabled: false })
      const packet = fixture.level_chunk

      const column = new ChunkColumn({ x: packet.x, z: packet.z })
      const payload = Buffer.from(packet.payload)
      await column.networkDecodeNoCache(payload, packet.sub_chunk_count)

      if (registry.version['<']('1.18')) { // In 1.18+, with sectionCount as -1 we only get the biomes here
        assert(Object.keys(column.blockEntities).length > 0, 'block entities not found')
      }

      const encoded = await column.networkEncodeNoCache()
      if (!encoded.equals(payload)) {
        dbdiff(payload, encoded)
        throw new Error('Encoded payload does not match original')
      }
    }

    async function reEncodeLevelChunkWithCaching (blockNetworkIdsAreHashes) {
      const blobStore = new BlobStore()
      const { registry, ChunkColumn, fixture } = setup({ blockNetworkIdsAreHashes, version, cachingEnabled: true })
      const packet = fixture.level_chunk
      const column = new ChunkColumn({ x: packet.x, z: packet.z })
      const payload = Buffer.from(packet.payload)

      assert(packet.cache_enabled, "you didn't dump packets correctly")

      const misses = await column.networkDecode(packet.blobs.hashes, blobStore, payload)
      assert(misses.length > 0, 'Blob cache should be empty, so networkDecode() should return the missing blob hashes')

      const missResponse = fixture.level_chunk_missResponse

      for (const [hash, buffer] of Object.entries(missResponse.blobs)) {
        blobStore.set(hash, new BlobEntry({ type: registry.version['>=']('1.18') ? BlobType.Biomes : BlobType.ChunkSection, buffer: Buffer.from(buffer) }))
      }

      // Run this function again, now that all blobs are in the store
      const nowMissing = await column.networkDecode(packet.blobs.hashes, blobStore)

      assert(nowMissing.length === 0, 'Blob cache should be full, networkDecode() should return empty missing hashes')

      // Try re-encoding the cached packet data, make sure the hashes match
      const encoded = await column.networkEncode(blobStore)
      const extraneousBlobs = encoded.blobs.map(blob => blob.hash.toString()).find(blob => !packet.blobs.hashes.includes(blob))
      if (extraneousBlobs) {
        throw new Error('Encoded payload contains extraneous blobs')
      }
      // OK
    }

    async function reEncodeSubChunkWithoutCaching (blockNetworkIdsAreHashes) {
      const { ChunkColumn, fixture } = setup({ blockNetworkIdsAreHashes, version, cachingEnabled: false })

      for (const packet of fixture.subchunks) {
        if (packet.entries) {
          for (const entry of packet.entries) {
            if (entry.result === 'success') {
              await processSubChunk(packet.origin.x + entry.dx, packet.origin.y + entry.dy, packet.origin.z + entry.dz, Buffer.from(entry.payload))
            }
          }
        } else {
          await processSubChunk(packet.x, packet.y, packet.z, Buffer.from(packet.data))
        }
      }

      async function processSubChunk (x, y, z, payload) {
        const column = new ChunkColumn({ x, z })
        await column.networkDecodeSubChunkNoCache(y, payload)

        const encoded = await column.networkEncodeSubChunkNoCache(y)
        if (!encoded.equals(payload)) {
          dbdiff(payload, encoded)
          throw new Error('Encoded payload does not match original')
        }
      }
    }

    async function reEncodeSubChunkWithCaching (blockNetworkIdsAreHashes) {
      const blobStore = new BlobStore()
      const { ChunkColumn, fixture } = setup({ blockNetworkIdsAreHashes, version, cachingEnabled: true })

      for (const packet of fixture.subchunks) {
        assert(packet.cache_enabled, "you didn't dump packets correctly")

        if (packet.entries) {
          for (const entry of packet.entries) {
            if (entry.result !== 'success' || !fixture.subchunks_cache_miss.some(x => x.blobs[entry.blob_id])) { continue }

            await processCachedSubChunk(packet.origin.x + entry.dx, packet.origin.y + entry.dy, packet.origin.z + entry.dz, entry.blob_id, Buffer.from(entry.payload))
          }
        } else {
          await processCachedSubChunk(packet.x, packet.y, packet.z, packet.blob_id, Buffer.from(packet.data))
        }
      }

      async function processCachedSubChunk (x, y, z, blobId, extraData) {
        const column = new ChunkColumn({ x, z })
        const misses = await column.networkDecodeSubChunk([blobId], blobStore, extraData)
        assert(misses.length > 0, 'Blob cache should be empty, so networkDecode() should return the missing blob hashes')
        const missResponse = fixture.subchunks_cache_miss.find(x => x.blobs[blobId])

        for (const [hash, buffer] of Object.entries(missResponse.blobs)) {
          blobStore.set(hash, new BlobEntry({ type: BlobType.ChunkSection, buffer: Buffer.from(buffer) }))
        }

        // Run this function again, now that all blobs are in the store
        const nowMissing = await column.networkDecodeSubChunk([blobId], blobStore)
        assert(nowMissing.length === 0, 'Blob cache should be full, networkDecode() should return empty missing hashes')

        // Try re-encoding the cached packet data, make sure the hashes match
        const [hash, extraPayload] = await column.networkEncodeSubChunk(y, blobStore)
        const extraneousBlobs = hash.toString() !== blobId ? hash : null
        // console.log('Encoded blobs', hash, extraneousBlobs, 'expected', packet.blob_id)
        if (extraneousBlobs) {
          throw new Error('Encoded payload contains extraneous blobs')
        }

        if (!extraData.equals(extraPayload)) {
          throw new Error('Encoded payload (containing block entities) did not match original')
        }
        // OK
      }
    }
  })

  describe('bedrock subchunk tests on ' + version, () => {
    it(`compaction works on ${version}, block block_network_ids_are_hashes = false`, async () => {
      await compactChunkSectionWorks(false)
    })

    if (registryForVersionCheck.version['>=']('1.18')) {
      it(`compaction works on ${version}, block_network_ids_are_hashes = true`, async () => {
        await compactChunkSectionWorks(true)
      })
    }

    async function compactChunkSectionWorks (blockNetworkIdsAreHashes) {
      const registry = require('prismarine-registry')(version)
      registry.handleStartGame({ block_network_ids_are_hashes: blockNetworkIdsAreHashes, itemstates: [] })
      const ChunkColumn = require('prismarine-chunk')(registry)
      const cc = new ChunkColumn({ x: 0, z: 0 })
      const fakeBlocks = [registry.blocksByName.dirt.defaultState, registry.blocksByName.acacia_door.defaultState, registry.blocksByName.stone.defaultState, registry.blocksByName.bamboo.defaultState]
      let i = 0
      for (let y = 0; y < 4; y++) {
        const section = await cc.newSection(y)
        for (let l = 0; l < 4; l++) {
          for (let x = 0; x < 16; x++) {
            // Here we set some blocks and replace it with air right after
            for (let z = 0; z < 16; z++) {
              section.setBlockStateId(l, x, y, z, fakeBlocks[i++ % fakeBlocks.length])
              section.setBlockStateId(l, x, y, z, registry.blocksByName.air.defaultState)
            }
          }
          // Here we set some dirt. We don't replace it with air, so it should stay dirt
          section.setBlockStateId(l, 0, 10, 0, registry.blocksByName.dirt.defaultState)
        }
      }

      // Make sure palette size is 3
      for (let cy = 0; cy < 4; cy++) {
        for (let l = 0; l < 4; l++) {
          const subChunk = cc.getSectionAtIndex(cy)
          // Our blocks we put in + air = 5 states

          assert.strictEqual(subChunk.palette[l].length, 5, 'Palette size should be 4 on y=' + cy + ' layer=' + l)
          subChunk.compact(l)
          assert.strictEqual(subChunk.palette[l].length, 2, 'After compaction, palette size should be 2 on y=' + cy + ' layer=' + l)
        }
      }
    }
  })
}

describe('special bedrock tests', () => {
  // Test for some special cases that are not covered by the normal tests
  it('can load v1 subchunks in level_chunk', async () => {
    // SubChunk v1 is only sent by 3rd party servers
    const ChunkColumn = require('prismarine-chunk')('bedrock_1.17.10')
    const packet = require('./bedrock_1.17.10/subchunkv1.json').params
    const column = new ChunkColumn({ x: packet.x, z: packet.z })
    const payload = Buffer.from(packet.payload)
    await column.networkDecodeNoCache(payload, packet.sub_chunk_count)
    await column.networkEncodeNoCache()
    const blocks = column.getBlocks()
    assert(blocks.length > 0, 'No blocks in column')
    console.log('Unique blocks', blocks.map(e => e.name))
    // No error is OK
  })

  it('reads biomes of sections that repeat the previous section', () => {
    const ChunkColumn = require('prismarine-chunk')('bedrock_1.21.60')
    const source = new ChunkColumn({ x: 0, z: 0 })
    for (let i = 0; i < 4096; i++) source.setBiomeId(new Vec3(i & 15, -64 + (i >> 8), (i >> 4) & 15), 1 + (i % 3))
    const stream = new Stream()
    source.biomes[0].export(StorageType.Runtime, stream)
    const column = new ChunkColumn({ x: 0, z: 0 })
    column.networkDecodeNoCache(Buffer.concat([stream.getBuffer(), Buffer.from([0xff, 0])]), -2)

    for (let i = 0; i < 4096; i++) {
      const [x, y, z] = [i & 15, i >> 8, (i >> 4) & 15]
      assert.strictEqual(column.getBiomeId(new Vec3(x, -48 + y, z)), source.getBiomeId(new Vec3(x, -64 + y, z)), `biome at ${x},${-48 + y},${z}`)
    }
  })

  it('counts the blocks of single state sub chunks', async () => {
    const registry = require('prismarine-registry')('bedrock_1.21.60')
    const ChunkColumn = require('prismarine-chunk')(registry)
    const source = new ChunkColumn({ x: 0, z: 0 })
    for (let i = 0; i < 4096; i++) source.setBlockStateId(new Vec3(i & 15, -64 + (i >> 8), (i >> 4) & 15), registry.blocksByName.stone.defaultState)
    const buffer = await source.getSectionAtIndex(-4).encode(StorageType.Runtime, false, true)
    assert.strictEqual(buffer[3] >> 1, 0, 'single state storage')

    const column = new ChunkColumn({ x: 0, z: 0 })
    await column.networkDecodeSubChunkNoCache(-4, buffer)
    assert.deepStrictEqual(column.getBlocks().map(block => [block.name, block.count]), [['stone', 4096]])
    assert.deepStrictEqual(await column.getSectionAtIndex(-4).encode(StorageType.Runtime, false, true), buffer)
  })

  // a uniform sub chunk (all air, y=5) sent by a 1.17.30 server
  const singleStateSubChunks = {
    runtime: [StorageType.Runtime, Buffer.from('090105018c02', 'hex')],
    nbt: [StorageType.NetworkPersistence, Buffer.from('090105000a0008046e616d650d6d696e6563726166743a6169720a0673746174657300030776657273696f6e86c8861100', 'hex')]
  }
  for (const [name, [format, buffer]] of Object.entries(singleStateSubChunks)) {
    it(`can load and save single state (0 bit) ${name} sub chunks`, async () => {
      const ChunkColumn = require('prismarine-chunk')('bedrock_1.17.30')
      const column = new ChunkColumn({ x: 0, z: 0 })
      const section = column.newSection(0, format, buffer)
      assert.strictEqual(section.y, 5)
      assert.strictEqual(column.getBlock(new Vec3(3, 7, 3)).name, 'air')
      assert.deepStrictEqual(await section.encode(format, false, false), buffer)
    })
  }

  for (const blockNetworkIdsAreHashes of [false, true]) {
    it(`can save and load nbt palettes, block_network_ids_are_hashes = ${blockNetworkIdsAreHashes}`, async () => {
      const registry = require('prismarine-registry')('bedrock_1.21.60')
      registry.handleStartGame({ block_network_ids_are_hashes: blockNetworkIdsAreHashes, itemstates: [] })
      const ChunkColumn = require('prismarine-chunk')(registry)
      const column = new ChunkColumn({ x: 0, z: 0 })
      const log = registry.blocksByName.oak_log
      column.setBlockStateId(new Vec3(1, 1, 1), log.states[2])
      const properties = column.getBlock(new Vec3(1, 1, 1)).getProperties()
      assert.deepStrictEqual(properties, { pillar_axis: 'z' })

      for (const format of [StorageType.NetworkPersistence, StorageType.LocalPersistence]) {
        const decoded = new ChunkColumn({ x: 0, z: 0 })
        decoded.newSection(0, format, await column.getSectionAtIndex(0).encode(format, false, false))
        assert.strictEqual(decoded.getBlockStateId(new Vec3(1, 1, 1)), log.states[2])
        assert.deepStrictEqual(decoded.getBlock(new Vec3(1, 1, 1)).getProperties(), properties)
      }
    })
  }
})

describe('unknown runtime block hash falls back to air (#339)', () => {
  const SubChunk = require('../src/bedrock/1.18/SubChunk')
  const Stream = require('../src/bedrock/common/Stream')
  const { StorageType } = require('../src/bedrock/common/constants')
  const registry = require('prismarine-registry')('bedrock_1.19.1')
  registry.handleStartGame({ block_network_ids_are_hashes: false, itemstates: [] }) // populate blocksByRuntimeId
  const Block = require('prismarine-block')(registry)
  const airName = registry.blocksByName.air.name
  const UNKNOWN = 987654321 // a runtime id no block resolves to
  const readStreamOf = (writeFn) => { const w = new Stream(); writeFn(w); return new Stream(w.buffer.slice(0, w.writeOffset)) }

  it('a multi-entry runtime palette maps an unknown hash to air, keeping its runtimeId', () => {
    const sc = new SubChunk(registry, Block, { y: 0 })
    sc.loadRuntimePalette(0, readStreamOf(w => w.writeZigZagVarInt(UNKNOWN)), 1)
    assert.strictEqual(sc.palette[0][0].name, airName)
    assert.strictEqual(sc.palette[0][0].runtimeId, UNKNOWN)
  })

  it('a zero-bit runtime section maps an unknown hash to air instead of throwing', () => {
    const sc = new SubChunk(registry, Block, { y: 0 })
    // This path (loadPalettedBlocks with bitsPerBlock 0, Runtime) previously went through addToPalette and threw on an
    // unknown hash; it must now use the same air fallback as the multi-entry palette.
    assert.doesNotThrow(() => sc.loadPalettedBlocks(0, readStreamOf(w => w.writeZigZagVarInt(UNKNOWN)), 0, StorageType.Runtime))
    assert.strictEqual(sc.palette[0].length, 1)
    assert.strictEqual(sc.palette[0][0].name, airName)
    assert.strictEqual(sc.palette[0][0].runtimeId, UNKNOWN)
  })

  it('a known runtime id still resolves to its block on both paths', () => {
    const knownId = Number(Object.keys(registry.blocksByRuntimeId)[0])
    const expected = registry.blocksByRuntimeId[knownId].name
    const a = new SubChunk(registry, Block, { y: 0 })
    a.loadRuntimePalette(0, readStreamOf(w => w.writeZigZagVarInt(knownId)), 1)
    assert.strictEqual(a.palette[0][0].name, expected)
    assert.strictEqual(a.palette[0][0].runtimeId, undefined) // a resolved entry carries no bare runtimeId
    const b = new SubChunk(registry, Block, { y: 0 })
    b.loadPalettedBlocks(0, readStreamOf(w => w.writeZigZagVarInt(knownId)), 0, StorageType.Runtime)
    assert.strictEqual(b.palette[0][0].name, expected)
  })
})

const dbdiff = (last, now) => {
  for (let i = 0; i < last.length; i++) {
    if (last[i] !== now[i]) {
      console.log('Difference at', i, last.slice(i - 5, i + 5).toString('hex'), now.slice(i - 5, i + 5).toString('hex'))
      break
    }
  }
}

function getTestCaseName (cachingEnabled, blockNetworkIdsAreHashes) {
  let description = ''

  if (cachingEnabled) {
    description = 'cache'
  } else {
    description = 'no-cache'
  }

  if (blockNetworkIdsAreHashes) {
    description += ' hash'
  } else {
    description += ' no-hash'
  }

  return description
}
