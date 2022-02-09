const ChunkColumn13 = require('../1.3/ChunkColumn')
const SubChunk = require('../1.3/SubChunk')
const BiomeSection = require('./BiomeSection')
const { StorageType } = require('../common/constants')
const Stream = require('../common/Stream')
const { BlobType, BlobEntry } = require('../common/BlobCache')
const nbt = require('prismarine-nbt')
const ProxyBiomeSection = require('./ProxyBiomeSection')
const { getChecksum } = require('../common/util')

class ChunkColumn180 extends ChunkColumn13 {
  minCY = -4
  maxCY = 20
  worldHeight = 384
  co = Math.abs(this.minCY)
  biomes = []
  terrainAndBlockEntityHash = []

  getBiome (pos) {
    return new this.Biome(this.getBiomeId(pos))
  }

  setBiome (pos, biome) {
    this.setBiomeId(pos, biome.id)
  }

  getBiomeId (pos) {
    const Y = pos.y >> 4
    const sec = this.biomes[this.co + Y]
    return sec.getBiomeId(pos.x, pos.y & 0xf, pos.z)
  }

  setBiomeId (pos, biomeId) {
    const Y = pos.y >> 4
    const sec = this.biomes[this.co + Y]
    if (!sec) {
      this.biomes[this.co + Y] = new BiomeSection(this.registry, Y)
    } else if (!sec.setBiomeId) {
      this.biomes[this.co + Y] = sec.promote(Y)
    }
    sec.setBiomeId(pos.x, pos.y & 0xf, pos.z, biomeId)
    this.biomesUpdated = true
  }

  // Load 3D biome data
  loadBiomes (buf, storageType) {
    if (buf instanceof Buffer) buf = new Stream(buf)
    this.biomes = []
    let last
    for (let y = this.minCY; buf.peek(); y++) {
      if (buf.peek() === 0xff) { // re-use the last data
        if (!last) throw new Error('No last biome')
        const biome = new ProxyBiomeSection(this.registry, last)
        this.biomes.push(biome)
        // skip peek'ed
        buf.readByte()
      } else {
        const biome = new BiomeSection(this.registry, y)
        biome.read(storageType, buf)
        last = biome
        this.biomes.push(biome)
      }
    }
  }

  /// BLOCK ENTITY CACHING

  setBlockEntity (pos, tag) {
    super.setBlockEntity(pos, tag)
    this.terrainAndBlockEntityHash[this.co + (pos.y >> 4)] = null
  }

  removeBlockEntity (pos) {
    super.removeBlockEntity(pos)
    delete this.terrainAndBlockEntityHash[this.co + (pos.y >> 4)]
  }

  moveBlockEntity (pos, newPos) {
    super.moveBlockEntity(pos, newPos)
    this.terrainAndBlockEntityHash[this.co + (pos.y >> 4)] = null
  }

  // 1.18+, these two hashes are combined
  getTerrainAndBlockEntityHash (y) {
    return this.terrainAndBlockEntityHash[this.co + y]
  }

  setTerrainAndBlockEntityHash (y, hash) {
    this.terrainAndBlockEntityHash[this.co + y] = hash
  }

  /// BLOB CACHING

  // TODO: Figure out if these two functions have been updated for 1.18 biomes
  /**
   * Encodes this chunk column for the network with no caching
   * @param buffer Full chunk buffer
   */
  async networkEncodeNoCache () {
    const stream = new Stream()
    for (const biomeSection of this.biomes) {
      biomeSection.export(StorageType.NetworkPersistence, stream)
    }
    const biomeBuf = stream.getBuffer()
    return Buffer.concat([
      biomeBuf,
      Buffer.from([0]) // border blocks count
    ])
  }

  /**
   * Encodes this chunk column for use over network with caching enabled
   *
   * @param blobStore The blob store to write chunks in this section to
   * @returns {Promise<Buffer[]>} The blob hashes for this chunk, the last one is biomes, rest are sections
   */
  async networkEncodeBlobs (blobStore, includeBiomes, includeTerrain) {
    const blobHashes = []
    if (includeBiomes) {
      if (this.biomesUpdated || !this.biomesHash || !blobStore.get(this.biomesHash.toString())) {
        const stream = new Stream()
        for (const biomeSection of this.biomes) {
          biomeSection.export(StorageType.NetworkPersistence, stream)
        }
        const biomeBuf = stream.getBuffer()
        await this.updateBiomeHash(biomeBuf)

        this.biomesUpdated = false
        blobStore.set(this.biomesHash.toString(), new BlobEntry({ x: this.x, z: this.z, type: BlobType.Biomes, buffer: this.biomes }))
      }
      blobHashes.push({ hash: this.biomesHash, type: BlobType.Biomes })
    }

    // if (includeTerrain) {
    //   for (const section of this.sections) {
    //     // const key = `${this.x},${section.y},${this.z}`
    //     if (section.updated || !blobStore.read(section.hash)) {
    //       const buffer = await section.encode(StorageType.Runtime, true) // note Runtime, not NetworkPersistence
    //       const blob = new BlobEntry({ x: this.x, y: section.y, z: this.z, type: BlobType.ChunkSection, buffer })
    //       blobStore.write(section.hash, blob)
    //     }
    //     blobHashes.push({ hash: section.hash, type: BlobType.ChunkSection })
    //   }
    // }

    return blobHashes
  }

  async networkEncode (blobStore) {
    const blobs = await this.networkEncodeBlobs(blobStore, true, false)

    return {
      blobs, // cache blobs
      payload: Buffer.concat([ // non-cached stuff
        Buffer.from([0]) // border blocks
      ])
    }
  }

  async networkDecodeNoCache (buffer, sectionCount) {
    const stream = new Stream(buffer)

    if (sectionCount === -1) { // In 1.18+, with sectionCount as -1 we only get the biomes here
      return this.loadBiomes(stream, StorageType.NetworkPersistence)
    } else {
      console.warn('ChunkColumn.networkDecodeNoCache: sectionCount is not -1, this is not supported')
      super.networkDecodeNoCache(stream, sectionCount)
    }
  }

  /**
   * Decodes cached chunks sent over the network
   * @param blobs The blob hashes sent in the Chunk packet
   * @param blobStore Our blob store for cached data
   * @param {Buffer} payload The rest of the non-cached data
   * @returns {CCHash[]} A list of hashes we don't have and need. If len > 0, decode failed.
   */
  async networkDecode (blobs, blobStore, payload) {
    const stream = new Stream(payload)
    const borderblocks = stream.readBuffer(stream.readByte())

    if (borderblocks.length) {
      throw new Error('cannot handle border blocks (read length: ' + borderblocks.length + ')')
    }

    // Block NBT data is now inside individual sections

    const misses = []
    for (const blob of blobs) {
      if (!blobStore.has(blob.toString())) {
        misses.push(blob)
      }
    }
    if (misses.length > 0) {
      // missing stuff, call this again once the server replies with our MISSing
      // blobs and don't try to load this column until we have all the data
      return misses
    }

    // Reset the sections & length, when we add a section, it will auto increment
    this.sections = []
    for (const blob of blobs) {
      const entry = blobStore.get(blob.toString())
      if (entry.type === BlobType.Biomes) {
        const stream = new Stream(entry.buffer)
        this.loadBiomes(stream, StorageType.NetworkPersistence)
      } else if (entry.type === BlobType.ChunkSection) {
        throw new Error("Can't accept chunk sections in networkDecode, these Blobs should be sent as individual sections")
      } else {
        throw Error('Unknown blob type: ' + entry.type)
      }
    }

    return misses // return empty array if everything was loaded
  }

  async networkDecodeSubChunkNoCache (y, buffer) {
    const stream = new Stream(buffer)
    const section = new SubChunk(this.registry, this.Block, { y, subChunkVersion: this.subChunkVersion })
    await section.decode(StorageType.Runtime, stream)
    this.setSection(y, section)

    const buf = stream.buffer
    buf.startOffset = stream.readOffset
    while (stream.peekUInt8() === 0x0A) {
      const { parsed, metadata } = await nbt.parse(buf, 'littleVarint')
      stream.readOffset += metadata.size
      buf.startOffset += metadata.size
      this.addBlockEntity(parsed)
    }
  }

  async networkEncodeSubChunkNoCache (y) {
    const tiles = this.getSectionBlockEntities(y)

    const section = this.getSection(y)
    const subchunk = await section.encode(StorageType.Runtime)

    const tileBufs = []
    for (const tile of tiles) {
      tileBufs.push(nbt.writeUncompressed(tile, 'littleVarint'))
    }

    return Buffer.concat([subchunk, ...tileBufs])
  }

  async networkDecodeSubChunk (blobs, blobStore, payload) {
    const misses = []
    for (const blob of blobs) {
      if (!blobStore.has(blob.toString())) {
        misses.push(blob)
      }
    }
    if (misses.length > 0) {
      // missing stuff, call this again once the server replies with our MISSing
      // blobs and don't try to load this column until we have all the data
      return misses
    }

    // Reset the sections & length, when we add a section, it will auto increment
    this.sections = []
    this.sectionsLen = 0
    for (const blob of blobs) {
      const entry = blobStore.get(blob.toString())
      if (entry.type === BlobType.Biomes) {
        // This can't happen, biomes should be sent in LevelChunk
        const stream = new Stream(entry.buffer)
        this.loadBiomes(stream, StorageType.NetworkPersistence)
      } else if (entry.type === BlobType.ChunkSection) {
        const stream = new Stream(entry.buffer)
        const subchunk = new SubChunk(this.registry, this.Block, { y: blob.y, subChunkVersion: this.subChunkVersion })
        await subchunk.decode(StorageType.Runtime, stream)
        this.setSection(blob.y, subchunk)

        const buf = stream.buffer
        buf.startOffset = stream.readOffset
        while (stream.peekUInt8() === 0x0A) {
          const { parsed, metadata } = await nbt.parse(buf, 'littleVarint')
          stream.readOffset += metadata.size
          buf.startOffset += metadata.size
          this.addBlockEntity(parsed)
        }
      } else {
        throw Error('Unknown blob type: ' + entry.type)
      }
    }

    return misses // return empty array if everything was loaded
  }

  async networkEncodeSubChunk (y, blobStore) {
    const tiles = this.getSectionBlockEntities(y)
    const section = this.getSection(y)

    if (section.updated || !this.getTerrainAndBlockEntityHash(y)) {
      const terrainBuffer = await section.encode(StorageType.Runtime) // note Runtime, not NetworkPersistence

      const tileBufs = []
      for (const tile of tiles) {
        tileBufs.push(nbt.writeUncompressed(tile, 'littleVarint'))
      }

      const combinedBuffer = Buffer.concat([terrainBuffer, ...tileBufs])
      const hash = await getChecksum(combinedBuffer)
      this.setTerrainAndBlockEntityHash(y, hash)
      const blob = new BlobEntry({ x: this.x, y: section.y, z: this.z, type: BlobType.ChunkSection, buffer: combinedBuffer })
      blobStore.set(hash.toString(), blob)
    }

    const hash = this.getTerrainAndBlockEntityHash(y)
    return hash
  }

  toObject () {
    return { ...super.toObject(), version: '1.18' }
  }
}

module.exports = ChunkColumn180
