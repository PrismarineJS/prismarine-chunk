/* eslint-env mocha */
const fs = require('fs')
const { join } = require('path')
const versions = ['bedrock_1.16.220', 'bedrock_1.17.10', 'bedrock_1.18.0', 'bedrock_1.19.1', 'bedrock_1.21.60']
const assert = require('assert')

const { BlobEntry, BlobType } = require('prismarine-chunk')

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
      const registry = require('prismarine-registry')(version)
      const ChunkColumn = require('prismarine-chunk')(registry)
      const fixture = getFixture(version, false, blockNetworkIdsAreHashes)
      registry.handleStartGame({ block_network_ids_are_hashes: blockNetworkIdsAreHashes, itemstates: [] })
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
      const registry = require('prismarine-registry')(version)
      const ChunkColumn = require('prismarine-chunk')(registry)
      const fixture = getFixture(version, true, blockNetworkIdsAreHashes)
      registry.handleStartGame({ block_network_ids_are_hashes: blockNetworkIdsAreHashes, itemstates: [] })
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
      const registry = require('prismarine-registry')(version)
      const ChunkColumn = require('prismarine-chunk')(registry)
      const fixture = getFixture(version, false, blockNetworkIdsAreHashes)
      registry.handleStartGame({ block_network_ids_are_hashes: blockNetworkIdsAreHashes, itemstates: [] })

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
        column.networkDecodeSubChunkNoCache(y, payload)

        const encoded = await column.networkEncodeSubChunkNoCache(y)
        if (!encoded.equals(payload)) {
          dbdiff(payload, encoded)
          throw new Error('Encoded payload does not match original')
        }
      }
    }

    async function reEncodeSubChunkWithCaching (blockNetworkIdsAreHashes) {
      const blobStore = new BlobStore()
      const registry = require('prismarine-registry')(version)
      const ChunkColumn = require('prismarine-chunk')(registry)
      const fixture = getFixture(version, true, blockNetworkIdsAreHashes)
      registry.handleStartGame({ block_network_ids_are_hashes: blockNetworkIdsAreHashes, itemstates: [] })

      for (const packet of fixture.subchunks) {
        assert(packet.cache_enabled, "you didn't dump packets correctly")

        if (packet.entries) {
          for (const entry of packet.entries) {
            if (entry.status !== 'success' || fixture.level_chunk_missResponse.blobs[entry.blob_id] === undefined) { continue }

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
  })

  describe('bedrock subchunk tests on ' + version, () => {
    it('compaction works on ' + version, async () => {
      const registry = require('prismarine-registry')(version)
      const ChunkColumn = require('prismarine-chunk')(registry)
      registry.handleStartGame({ block_network_ids_are_hashes: false, itemstates: [] })
      const cc = new ChunkColumn({ x: 0, z: 0 })
      const fakeBlocks = [1, 2, 3]
      let i = 0
      for (let y = 0; y < 4; y++) {
        const section = await cc.newSection(y)
        for (let l = 0; l < 4; l++) {
          for (let x = 0; x < 16; x++) {
            // Here we set some blocks and replace it with air right after
            for (let z = 0; z < 16; z++) {
              section.setBlockStateId(l, x, y, z, fakeBlocks[i++ % fakeBlocks.length])
              section.setBlockStateId(l, x, y, z, registryForVersionCheck.blocksByName.air.defaultState)
            }
          }
          // Here we set some dirt. We don't replace it with air, so it should stay dirt
          section.setBlockStateId(l, 0, 10, 0, registryForVersionCheck.blocksByName.dirt.defaultState)
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
    })
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
})

const dbdiff = (last, now) => {
  for (let i = 0; i < last.length; i++) {
    if (last[i] !== now[i]) {
      console.log('Difference at', i, last.slice(i - 5, i + 5).toString('hex'), now.slice(i - 5, i + 5).toString('hex'))
      break
    }
  }
}
