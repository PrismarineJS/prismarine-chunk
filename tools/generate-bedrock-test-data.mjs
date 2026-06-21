import { createServer } from 'net'
import { startServerAndWait2 } from 'minecraft-bedrock-server'
import { createClient } from 'bedrock-protocol'
import PrismarineRegistry from 'prismarine-registry'
import PrismarineChunk, { BlobEntry, BlobType } from 'prismarine-chunk'
import assert from 'assert'
import path, { dirname } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))

class BlobStore extends Map {
  pending = {}
  wanted = []

  set (key, value) {
    const ret = super.set(key.toString(), value)
    this.wanted.forEach(wanted => {
      wanted[0] = wanted[0].filter(hash => hash.toString() !== key.toString())
    })
    for (const i in this.wanted) {
      const [outstandingBlobs, cb] = this.wanted[i]
      if (!outstandingBlobs.length) {
        cb()
        delete this.wanted[i]
      }
    }
    return ret
  }

  get (key) {
    return super.get(key.toString())
  }

  has (key) {
    return super.has(key.toString())
  }

  addPending (hash, blob) {
    this.pending[hash.toString()] = blob
  }

  updatePending (hash, value) {
    const name = hash.toString()
    if (this.pending[name]) {
      this.set(name, Object.assign(this.pending[name], value))
    } else {
      throw new Error('No pending blob for hash ' + name)
    }
  }

  once (wantedBlobs, cb) {
    const outstanding = []
    for (const wanted of wantedBlobs) {
      if (!this.has(wanted)) outstanding.push(wanted)
    }

    if (outstanding.length) {
      this.wanted.push([outstanding, cb])
    } else {
      cb()
    }
  }
}

if (process.argv.length !== 6) {
  console.error('Usage: node tools/generate-bedrock-test-data.mjs <version> <chunkX> <chunkZ> <levelSeed>')
  console.error('Example: node tools/generate-bedrock-test-data.mjs 1.21.60 -7 10 8403237569561413924')
  process.exit(1)
}

const [, , version, chunkXStr, chunkZStr, levelSeed] = process.argv

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Invalid version format. Must be x.y.z (e.g., 1.21.60)')
  process.exit(1)
}

const chunkX = parseInt(chunkXStr)
const chunkZ = parseInt(chunkZStr)
if (isNaN(chunkX) || isNaN(chunkZ)) {
  console.error('Chunk coordinates must be integers')
  process.exit(1)
}

await main(version, chunkX, chunkZ, levelSeed)

async function main (version, chunkX, chunkZ, levelSeed) {
  const registry = PrismarineRegistry('bedrock_' + version)

  for (const blockNetworkIdsAreHashes of registry.supportFeature('blockHashes') ? [false, true] : [false]) {
    for (const cachingEnabled of [false, true]) {
      await generateTestData(version, chunkX, chunkZ, cachingEnabled, blockNetworkIdsAreHashes, registry, levelSeed)
    }
  }
}

async function generateTestData (version, chunkX, chunkZ, cachingEnabled, blockNetworkIdsAreHashes, registry, levelSeed) {
  const random = (Math.random() * 1000) | 0
  const [port, v6] = [await getPort(), await getPort()]

  const ChunkColumn = PrismarineChunk(registry)
  const blobStore = new BlobStore()

  const bedrockServers = path.resolve(__dirname, '..', 'tools', 'bedrock_servers', version)
  mkdirSync(bedrockServers, { recursive: true })

  const handle = await startServerAndWait2(version, 1000 * 120, {
    'server-port': port,
    'server-portv6': v6,
    'level-seed': levelSeed,
    'block-network-ids-are-hashes': blockNetworkIdsAreHashes,
    path: bedrockServers
  })
  const ccs = {}
  let subChunkMissHashes = []

  const client = createClient({
    host: '127.0.0.1',
    port,
    version,
    username: 'Packet' + random,
    offline: true
  })

  await waitFor(120_000, () => saveChunkData()).finally(() => {
    client.close()
    handle.kill()
  })

  async function saveChunkData () {
    let timeoutId

    client.on('start_game', (params) => {
      registry.handleStartGame({ ...params, itemstates: [] })
    })
    client.on('join', () => {
      resetTimeout()
      client.queue('client_cache_status', { enabled: cachingEnabled })
    })

    client.on('level_chunk', (params) => {
      resetTimeout()
      saveLevelChunk(params)
      processLevelChunk(params)
    })

    client.on('subchunk', (params) => {
      resetTimeout()
      saveSubChunk(params)
      processSubChunk(params)
    })
    client.on('client_cache_miss_response', (params) => {
      processCacheMiss(params)
    })

    function resetTimeout () {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        handle.kill()
        client.close()
        done()
      }, 5000)
    }

    let done
    const donePromise = new Promise((resolve) => {
      done = resolve
    })
    return donePromise
  }

  async function processLevelChunk (packet) {
    const cc = new ChunkColumn({ x: packet.x, z: packet.z })
    if (!cachingEnabled) {
      await cc.networkDecodeNoCache(packet.payload, packet.sub_chunk_count)
    } else if (cachingEnabled) {
      const misses = await cc.networkDecode(packet.blobs.hashes, blobStore, packet.payload)
      if (!packet.blobs.hashes.length) { return }

      client.queue('client_cache_blob_status', {
        misses: misses.length,
        haves: 0,
        have: [],
        missing: misses
      })

      if (packet.sub_chunk_count < 0) {
        for (const miss of misses) {
          blobStore.addPending(miss, new BlobEntry({ type: BlobType.Biomes, x: packet.x, z: packet.z }))
        }
      } else {
        const lastBlob = packet.blobs.hashes[packet.blobs.hashes.length - 1]
        for (const miss of misses) {
          blobStore.addPending(miss, new BlobEntry({
            type: miss === lastBlob
              ? BlobType.Biomes
              : BlobType.ChunkSection,
            x: packet.x,
            z: packet.z
          }))
        }
      }

      blobStore.once(misses, async () => {
        const now = await cc.networkDecode(packet.blobs.hashes, blobStore, packet.payload)

        if (packet.x === chunkX && packet.z === chunkZ) {
          saveLevelChunkCacheMiss(packet, version, cachingEnabled, blockNetworkIdsAreHashes)
        }

        assert.strictEqual(now.length, 0)
        client.queue('client_cache_blob_status', {
          misses: 0,
          haves: packet.blobs.hashes.length,
          have: packet.blobs.hashes,
          missing: []
        })
      })
    }

    if (packet.sub_chunk_count < 0) {
      const maxSubChunkCount = packet.highest_subchunk_count || 5 // field is set if sub_chunk_count=-2 (1.18.10+)

      if (registry.version['>=']('1.18.11')) {
        const requests = []
        for (let i = 0; i <= maxSubChunkCount; i++) {
          requests.push({ dx: 0, dz: 0, dy: cc.minCY + i })
        }
        client.queue('subchunk_request', { origin: { x: packet.x, z: packet.z, y: 0 }, requests, dimension: 0 })
      } else if (registry.version['>=']('1.18')) {
        for (let i = cc.minCY; i < maxSubChunkCount; i++) {
          client.queue('subchunk_request', { x: packet.x, z: packet.z, y: i, dimension: 0 })
        }
      }
    }

    ccs[packet.x + ',' + packet.z] = cc
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

  async function processSubChunk (packet) {
    if (packet.entries) { // 1.18.10+ handling
      for (const entry of packet.entries) {
        const x = packet.origin.x + entry.dx
        const y = packet.origin.y + entry.dy
        const z = packet.origin.z + entry.dz
        const cc = ccs[x + ',' + z]
        if (entry.result === 'success') {
          if (packet.cache_enabled) {
            await loadCached(cc, x, y, z, entry.blob_id, entry.payload)
          } else {
            await cc.networkDecodeSubChunkNoCache(y, entry.payload)
          }
        }
      }
    } else {
      if (packet.request_result !== 'success') {
        return
      }
      const cc = ccs[packet.x + ',' + packet.z]
      if (packet.cache_enabled) {
        await loadCached(cc, packet.x, packet.y, packet.z, packet.blob_id, packet.data)
      } else {
        await cc.networkDecodeSubChunkNoCache(packet.y, packet.data)
      }
    }
  }

  async function loadCached (cc, x, y, z, blobId, extraData) {
    const misses = await cc.networkDecodeSubChunk([blobId], blobStore, extraData)
    subChunkMissHashes.push(...misses)

    for (const miss of misses) {
      blobStore.addPending(miss, new BlobEntry({ type: BlobType.ChunkSection, x, z, y }))
    }

    if (subChunkMissHashes.length >= 10) {
      const r = {
        misses: subChunkMissHashes.length,
        haves: 0,
        have: [],
        missing: subChunkMissHashes
      }

      client.queue('client_cache_blob_status', r)
      subChunkMissHashes = []
    }

    if (misses.length) {
      const [missed] = misses
      // Once we get this blob, try again
      blobStore.once([missed], async () => {
        saveSubchunkCacheMiss(missed, x, y, z)
        // Call this again, ignore the payload since that's already been decoded
        const misses = await cc.networkDecodeSubChunk([missed], blobStore)
        assert(!misses.length, 'Should not have missed anything')

        const [hash] = await cc.networkEncodeSubChunk(y, blobStore)
        assert(hash.toString() === missed.toString(), 'Should not have missed anything')
      })
    }
  }

  async function processCacheMiss (packet) {
    const acks = []
    for (const { hash, payload } of packet.blobs) {
      const name = hash.toString()
      blobStore.updatePending(name, { buffer: payload })
      acks.push(hash)
    }

    // Send back an ACK
    client.queue('client_cache_blob_status', {
      misses: 0,
      haves: acks.length,
      have: [],
      missing: acks
    })
  }

  function serialize (obj) {
    return JSON.stringify(obj, (k, v) => typeof v?.valueOf?.() === 'bigint' ? v.toString() : v)
  }

  function saveSubchunkCacheMiss (missed, x, y, z) {
    if (x !== chunkX || z !== chunkZ) {
      return
    }
    const data = { blobs: Object.fromEntries([[missed.toString(), blobStore.get(missed).buffer]]) }
    const directory = path.resolve(__dirname, '..', 'test', `bedrock_${version}`, getTestCaseName(cachingEnabled, blockNetworkIdsAreHashes))
    const filename = `subchunk CacheMissResponse ${x},${z},${y}.json`.replace(/\s\s+/g, ' ')
    mkdirSync(directory, { recursive: true })
    writeFileSync(path.resolve(directory, filename), serialize(data))
  }

  function saveLevelChunkCacheMiss (packet, version, cachingEnabled, blockNetworkIdsAreHashes) {
    if (packet.x !== chunkX || packet.z !== chunkZ) {
      return
    }
    const data = { blobs: Object.fromEntries(packet.blobs.hashes.map(h => [h.toString(), blobStore.get(h).buffer])) }
    const directory = path.resolve(__dirname, '..', 'test', `bedrock_${version}`, getTestCaseName(cachingEnabled, blockNetworkIdsAreHashes))
    const filename = `level_chunk CacheMissResponse ${packet.x},${packet.z}.json`.replace(/\s\s+/g, ' ')
    mkdirSync(directory, { recursive: true })
    writeFileSync(path.resolve(directory, filename), serialize(data, 1))
  }

  function saveLevelChunk (params) {
    if (params.x !== chunkX || params.z !== chunkZ) {
      return
    }

    const data = params
    const directory = path.resolve(__dirname, '..', 'test', `bedrock_${version}`, getTestCaseName(cachingEnabled, blockNetworkIdsAreHashes))
    const filename = `level_chunk ${params.x},${params.z}.json`.replace(/\s\s+/g, ' ')
    mkdirSync(directory, { recursive: true })
    writeFileSync(path.resolve(directory, filename), serialize(data))
  }

  function saveSubChunk (params) {
    if (params.origin) {
      if (params.origin.x !== chunkX || params.origin.z !== chunkZ) {
        return
      }
      const data = params
      const directory = path.resolve(__dirname, '..', 'test', `bedrock_${version}`, getTestCaseName(cachingEnabled, blockNetworkIdsAreHashes))
      const filename = `subchunk ${params.origin.x},${params.origin.z},${params.origin.y}.json`.replace(/\s\s+/g, ' ')
      mkdirSync(directory, { recursive: true })
      writeFileSync(path.resolve(directory, filename), serialize(data))
    } else {
      if (params.x !== chunkX || params.z !== chunkZ) {
        return
      }
      const data = params
      const directory = path.resolve(__dirname, '..', 'test', `bedrock_${version}`, getTestCaseName(cachingEnabled, blockNetworkIdsAreHashes))
      const filename = `subchunk ${params.x},${params.z},${params.y}.json`.replace(/\s\s+/g, ' ')
      mkdirSync(directory, { recursive: true })
      writeFileSync(path.resolve(directory, filename), serialize(data))
    }
  }

  function getPort () {
    return new Promise(resolve => {
      const server = createServer()
      server.listen(0, '127.0.0.1')
      server.on('listening', () => {
        const { port } = server.address()
        server.close(() => {
          // Wait a bit for port to free as we try to bind right after freeing it
          setTimeout(() => { resolve(port) }, 200)
        })
      })
    })
  }

  async function waitFor (withTimeout, cb) {
    let t
    const ret = await Promise.race([
      cb(),
      new Promise((resolve, reject) => {
        t = setTimeout(() => reject(new Error('timeout')), withTimeout)
      })
    ]).then(() => {
      clearTimeout(t)
    })

    return ret
  }
}
