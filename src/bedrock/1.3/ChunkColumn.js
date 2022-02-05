const CommonChunkColumn = require('../common/CommonChunkColumn')
const SubChunk = require('./SubChunk')
const BiomeSection = require('../1.18/BiomeSection')
const { StorageType } = require('../common/constants')
const Stream = require('../common/Stream')
const { BlobType, BlobEntry } = require('../common/BlobCache')
const nbt = require('prismarine-nbt')

class ChunkColumn13 extends CommonChunkColumn {
  Section = SubChunk

  constructor (options = {}, registry, Block) {
    super(options)
    this.chunkVersion = options.version || 8
    this.sections = []
    this.biomes = []
    this.biomesUpdated = false
    if (options.sections?.length) {
      for (const section of options.sections) {
        console.log(section, options.sections)
        if (section) {
          this.sections.push(new this.Section(registry, Block, section))
        } else {
          this.sections.push(null)
        }
      }
    }
  }

  getBiome (pos) {
    return new this.Biome(this.biomes[0].getBiomeId(pos.x, 0, pos.z))
  }

  setBiome (pos, biome) {
    if (!this.biomes.length) this.biomes[0] = new BiomeSection(this.registry, 0)
    this.biomes[0].setBiomeId(pos.x, 0, pos.z, biome.id)
    this.biomesUpdated = true
  }

  /**
   * Encodes this chunk column for the network with no caching
   * @param buffer Full chunk buffer
   */
  async networkEncodeNoCache () {
    const tileBufs = []
    for (const key in this.tiles) {
      const tile = this.tiles[key]
      tileBufs.push(nbt.writeUncompressed(tile, 'littleVarint'))
    }

    // TODO: Investigate the heightmap
    // const heightmap = Buffer.alloc(512)
    let biomeBuf
    const stream = new Stream()
    if (this.biomes[0]) {
      this.biomes[0].exportLegacy2D(stream)
      biomeBuf = stream.getBuffer()
    } else {
      biomeBuf = Buffer.alloc(256)
    }

    const sectionBufs = []
    for (const section of this.sections) {
      sectionBufs.push(await section.encode(StorageType.Runtime))
    }
    return Buffer.concat([
      ...sectionBufs,
      // heightmap, // Looks like this is not written?
      biomeBuf,
      Buffer.from([0]), // border blocks count
      ...tileBufs // block entities
    ])
  }

  /**
   * Encodes this chunk column for use over network with caching enabled
   *
   * @param blobStore The blob store to write chunks in this section to
   * @returns {Promise<Buffer[]>} The blob hashes for this chunk, the last one is biomes, rest are sections
   */
  async networkEncodeBlobs (blobStore) {
    const blobHashes = []
    for (const section of this.sections) {
      // const key = `${this.x},${section.y},${this.z}`
      if (section.updated || !blobStore.read(section.hash)) {
        const buffer = await section.encode(StorageType.NetworkPersistence, true)
        const blob = new BlobEntry({ x: this.x, y: section.y, z: this.z, type: BlobType.ChunkSection, buffer })
        blobStore.write(section.hash, blob)
      }
      blobHashes.push({ hash: section.hash, type: BlobType.ChunkSection })
    }
    if (this.biomesUpdated || !this.biomesHash || !blobStore.read(this.biomesHash)) {
      if (this.biomes[0]) {
        const stream = new Stream()
        this.biomes[0].exportLegacy2D(stream)
        await this.updateBiomeHash(stream.getBuffer())
      } else {
        await this.updateBiomeHash(Buffer.alloc(256))
      }

      this.biomesUpdated = false
      blobStore.write(this.biomesHash, new BlobEntry({ x: this.x, z: this.z, type: BlobType.Biomes, buffer: this.biomes }))
    }
    blobHashes.push({ hash: this.biomesHash, type: BlobType.Biomes })
    return blobHashes
  }

  async networkEncode (blobStore) {
    const blobs = await this.networkEncodeBlobs(blobStore)
    const tileBufs = []
    for (const key in this.tiles) {
      const tile = this.tiles[key]
      tileBufs.push(nbt.writeUncompressed(tile, 'littleVarint'))
    }

    return {
      blobs, // cache blobs
      payload: Buffer.concat([ // non-cached stuff
        Buffer.from([0]), // border blocks
        ...tileBufs
      ])
    }
  }

  async networkDecodeNoCache (buffer, sectionCount) {
    const stream = new Stream(buffer)

    if (sectionCount === -1) { // In 1.18+, with sectionCount as -1 we only get the biomes here
      return this.loadBiomes(stream, StorageType.NetworkPersistence)
    }

    this.sections = []
    for (let i = 0; i < sectionCount; i++) {
      // in 1.17.30+, chunk index is sent in payload
      const section = new SubChunk(this.registry, this.Block, { y: i, subChunkVersion: this.subChunkVersion })
      await section.decode(StorageType.Runtime, stream)
      this.sections.push(section)
    }

    const biomes = new BiomeSection(0)
    biomes.readLegacy2D(stream)
    this.biomes = biomes

    const borderBlocksLength = stream.readVarInt()
    const borderBlocks = stream.read(borderBlocksLength)
    // Don't know how to handle this yet
    if (borderBlocks.length) throw Error(`Read ${borderBlocksLength} border blocks, expected 0`)

    const buf = stream.getBuffer()
    buf.startOffset = stream.getOffset()
    while (stream.peek() === 0x0A) {
      const { parsed, metadata } = await nbt.parse(buf, 'littleVarint')
      stream.offset += metadata.size
      buf.startOffset += metadata.size
      this.addBlockEntity(parsed)
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
    const borderblocks = stream.read(stream.readByte())
    if (borderblocks.length) {
      throw new Error('cannot handle border blocks (read length: ' + borderblocks.length + ')')
    }

    payload.startOffset = stream.getOffset()
    while (stream.peek() === 0x0A) {
      const { parsed, metadata } = await nbt.parse(payload, 'littleVarint')
      stream.offset += metadata.size
      payload.startOffset += metadata.size
      this.addBlockEntity(parsed)
    }

    const misses = []
    for (const blob of blobs) {
      if (!blobStore.has(blob.hash)) {
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
      const entry = blobStore.read(blob.hash)
      if (entry.type === BlobType.Biomes) {
        this.biomes = entry.buffer
      } else if (entry.type === BlobType.ChunkSection) {
        const subchunk = new SubChunk(this.registry, this.Block)
        await subchunk.decode(StorageType.NetworkPersistence, new Stream(entry.buffer))
        this.addSection(subchunk)
      } else {
        throw Error('Unknown blob type: ' + entry.type)
      }
    }

    return misses
  }

  toObject () {
    const biomes = this.biomes.map(b => b.toObject())
    return { ...super.toObject(), biomes, biomesUpdated: this.biomesUpdated, version: '1.16' }
  }

  toJson () {
    return JSON.stringify(this.toObject())
  }
}

module.exports = ChunkColumn13
