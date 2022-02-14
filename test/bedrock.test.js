/* eslint-env mocha */
const fs = require('fs')
const { join } = require('path')
const versions = ['bedrock_1.16.220', 'bedrock_1.17.10', 'bedrock_1.18.0']
const assert = require('assert')

const { BlobEntry, BlobType } = require('prismarine-chunk')

const BlobStore = Map
const blobStore = new BlobStore()

for (const version of versions) {
  describe('bedrock network chunks on ' + version, () => {
    const registry = require('prismarine-registry')(version)
    const ChunkColumn = require('prismarine-chunk')(registry)

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

      it('can re-encode subchunk packet without caching', async () => {
        const packet = require(join(__dirname, version, packetSubChunkWithoutCaching))
        const column = new ChunkColumn({ x: packet.x, z: packet.z })
        const payload = Buffer.from(packet.data)
        column.networkDecodeSubChunkNoCache(packet.y, payload)

        const encoded = await column.networkEncodeSubChunkNoCache(packet.y)
        if (!encoded.equals(payload)) {
          dbdiff(payload, encoded)
          throw new Error('Encoded payload does not match original')
        }
      })

      it('can re-encode subchunk packet with caching', async () => {
        const packet = require(join(__dirname, version, packetSubChunkWithCaching))
        assert(packet.cache_enabled, "you didn't dump packets correctly")

        const column = new ChunkColumn({ x: packet.x, z: packet.z })
        const payload = Buffer.from(packet.data)
        const misses = await column.networkDecodeSubChunk([packet.blob_id], blobStore, payload)
        assert(misses.length > 0, 'Blob cache should be empty, so networkDecode() should return the missing blob hashes')

        const missResponse = require(join(__dirname, version, packetSubChunkCacheMissReponse))

        for (const [hash, buffer] of Object.entries(missResponse.blobs)) {
          blobStore.set(hash, new BlobEntry({ type: BlobType.ChunkSection, buffer: Buffer.from(buffer) }))
        }

        // Run this function again, now that all blobs are in the store
        const nowMissing = await column.networkDecodeSubChunk([packet.blob_id], blobStore)
        assert(nowMissing.length === 0, 'Blob cache should be full, networkDecode() should return empty missing hashes')

        // Try re-encoding the cached packet data, make sure the hashes match
        const [hash, extraPayload] = await column.networkEncodeSubChunk(packet.y, blobStore)
        const extraneousBlobs = hash.toString() !== packet.blob_id ? hash : null
        // console.log('Encoded blobs', hash, extraneousBlobs, 'expected', packet.blob_id)
        if (extraneousBlobs) {
          throw new Error('Encoded payload contains extraneous blobs')
        }

        if (!payload.equals(extraPayload)) {
          throw new Error('Encoded payload (contianing block entities) did not match original')
        }
        // OK
      })
    }
  })
}

const dbdiff = (last, now) => {
  for (let i = 0; i < last.length; i++) {
    if (last[i] !== now[i]) {
      console.log('Difference at', i, last.slice(i - 5, i + 5).toString('hex'), now.slice(i - 5, i + 5).toString('hex'))
      break
    }
  }
}
