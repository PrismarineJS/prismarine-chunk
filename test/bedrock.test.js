/* eslint-env mocha */
const fs = require('fs')
const { join } = require('path')
const versions = ['bedrock_1.16.220', 'bedrock_1.17.10', 'bedrock_1.18.0', 'bedrock_1.19.1']
const assert = require('assert')

const { BlobEntry, BlobType } = require('prismarine-chunk')

const BlobStore = Map
const blobStore = new BlobStore()

for (const version of versions) {
  const registry = require('prismarine-registry')(version)
  const ChunkColumn = require('prismarine-chunk')(registry)

  describe('bedrock network chunks on ' + version, () => {
    const fixtures = fs.readdirSync(join(__dirname, version))
    const packetLevelChunkWithoutCaching = fixtures.find(f => f.includes('level_chunk') && !f.toLowerCase().includes('cache'))
    const packetLevelChunkWithCaching = fixtures.find(f => f.includes('level_chunk') && f.includes('cached'))
    const packetLevelChunkCacheMissReponse = fixtures.find(f => f.includes('level_chunk') && f.includes('CacheMiss'))

    it('can re-encode level_chunk packet without caching', async () => {
      const packet = require(join(__dirname, version, packetLevelChunkWithoutCaching))

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
    })

    it('can re-encode level_chunk with caching', async () => {
      const packet = require(join(__dirname, version, packetLevelChunkWithCaching))
      const column = new ChunkColumn({ x: packet.x, z: packet.z })
      const payload = Buffer.from(packet.payload)

      assert(packet.cache_enabled, "you didn't dump packets correctly")

      const misses = await column.networkDecode(packet.blobs.hashes, blobStore, payload)
      assert(misses.length > 0, 'Blob cache should be empty, so networkDecode() should return the missing blob hashes')

      const missResponse = require(join(__dirname, version, packetLevelChunkCacheMissReponse))

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
    })

    if (registry.version['>=']('1.18')) {
      const packetSubChunkWithoutCaching = fixtures.find(f => f.includes('subchunk') && !f.toLowerCase().includes('cache'))
      const packetSubChunkWithCaching = fixtures.find(f => f.includes('subchunk') && f.includes('cached'))
      const packetSubChunkCacheMissReponse = fixtures.find(f => f.includes('subchunk') && f.includes('CacheMiss'))

      async function processSubChunk (x, y, z, payload) {
        const column = new ChunkColumn({ x, z })
        column.networkDecodeSubChunkNoCache(y, payload)

        const encoded = await column.networkEncodeSubChunkNoCache(y)
        if (!encoded.equals(payload)) {
          dbdiff(payload, encoded)
          throw new Error('Encoded payload does not match original')
        }
      }

      it('can re-encode subchunk packet without caching', async () => {
        const packet = require(join(__dirname, version, packetSubChunkWithoutCaching))
        if (packet.entries) {
          for (const entry of packet.entries) {
            processSubChunk(packet.origin.x + entry.dx, packet.origin.y + entry.dy, packet.origin.z + entry.dz, packet.blob_id, Buffer.from(entry.payload))
          }
        } else {
          processSubChunk(packet.x, packet.y, packet.z, Buffer.from(packet.data))
        }
      })

      async function processCachedSubChunk (x, y, z, blobId, extraData) {
        const column = new ChunkColumn({ x, z })
        const misses = await column.networkDecodeSubChunk([blobId], blobStore, extraData)
        assert(misses.length > 0, 'Blob cache should be empty, so networkDecode() should return the missing blob hashes')

        const missResponse = require(join(__dirname, version, packetSubChunkCacheMissReponse))

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

      it('can re-encode subchunk packet with caching', async () => {
        const packet = require(join(__dirname, version, packetSubChunkWithCaching))
        assert(packet.cache_enabled, "you didn't dump packets correctly")

        if (packet.entries) {
          for (const entry of packet.entries) {
            processCachedSubChunk(packet.origin.x + entry.dx, packet.origin.y + entry.dy, packet.origin.z + entry.dz, packet.blob_id, Buffer.from(entry.payload))
          }
        } else {
          processCachedSubChunk(packet.x, packet.y, packet.z, packet.blob_id, Buffer.from(packet.data))
        }
      })
    }
  })

  describe('bedrock subchunk tests on ' + version, () => {
    it('compaction works on ' + version, async () => {
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
