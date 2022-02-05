const ChunkColumn13 = require('../1.3/ChunkColumn')
const SubChunk = require('../1.3/SubChunk')
const BiomeSection = require('./BiomeSection')
const { StorageType } = require('../common/constants')
const Stream = require('../common/Stream')
const nbt = require('prismarine-nbt')

class ChunkColumn180 extends ChunkColumn13 {
  minCY = -4
  maxCY = 20
  worldHeight = 384
  co = Math.abs(this.minCY)
  biomes = []

  getBiome (pos) {
    const Y = pos.y >> 4
    const sec = this.biomes[this.co + Y]
    return new this.Biome(sec.getBiomeId(pos.x, pos.y & 0xf, pos.z))
  }

  setBiome (pos, biome) {
    const Y = pos.y >> 4
    const sec = this.biomes[this.co + Y]
    if (!sec) {
      this.biomes[this.co + Y] = new BiomeSection(this.registry, Y)
    }
    sec.setBiomeId(pos.x, pos.y & 0xf, pos.z, biome.getId())
    this.biomesUpdated = true
  }

  // TODO: Figure out if these two functions have been updated for 1.18 biomes
  // /**
  //  * Encodes this chunk column for the network with no caching
  //  * @param buffer Full chunk buffer
  //  */
  // async _networkEncodeNoCache() {
  //   const tileBufs = []
  //   for (const key in this.tiles) {
  //     const tile = this.tiles[key]
  //     tileBufs.push(nbt.writeUncompressed(tile, 'littleVarint'))
  //   }

  //   const stream = new Stream()
  //   for (const biomeSection of this.biomes) {
  //     biomeSection.export(StorageType.NetworkPersistence, stream)
  //   }
  //   const biomeBuf = stream.getBuffer()

  //   const sectionBufs = []
  //   for (const section of this.sections) {
  //     sectionBufs.push(await section.encode(StorageType.Runtime))
  //   }
  //   return Buffer.concat([
  //     ...sectionBufs,
  //     biomeBuf,
  //     Buffer.from([0]), // border blocks count
  //     ...tileBufs // block entities
  //   ])
  // }

  // /**
  //  * Encodes this chunk column for use over network with caching enabled
  //  *
  //  * @param blobStore The blob store to write chunks in this section to
  //  * @returns {Promise<Buffer[]>} The blob hashes for this chunk, the last one is biomes, rest are sections
  //  */
  // async _networkEncodeBlobs(blobStore) {
  //   const blobHashes = []
  //   for (const section of this.sections) {
  //     // const key = `${this.x},${section.y},${this.z}`
  //     if (section.updated || !blobStore.read(section.hash)) {
  //       const buffer = await section.encode(StorageType.NetworkPersistence, true)
  //       const blob = new BlobEntry({ x: this.x, y: section.y, z: this.z, type: BlobType.ChunkSection, buffer })
  //       blobStore.write(section.hash, blob)
  //     }
  //     blobHashes.push({ hash: section.hash, type: BlobType.ChunkSection })
  //   }
  //   if (this.biomesUpdated || !this.biomesHash || !blobStore.read(this.biomesHash)) {
  //     const stream = new Stream()
  //     for (const biomeSection of this.biomes) {
  //       biomeSection.export(StorageType.NetworkPersistence, stream)
  //     }
  //     const biomeBuf = stream.getBuffer()
  //     await this.updateBiomeHash(biomeBuf)

  //     this.biomesUpdated = false
  //     blobStore.write(this.biomesHash, new BlobEntry({ x: this.x, z: this.z, type: BlobType.Biomes, buffer: this.biomes }))
  //   }
  //   blobHashes.push({ hash: this.biomesHash, type: BlobType.Biomes })
  //   return blobHashes
  // }

  // async _networkDecodeNoCache(buffer, sectionCount) {
  //   const stream = new Stream(buffer)

  //   if (sectionCount === -1) { // In 1.18+, with sectionCount as -1 we only get the biomes here
  //     return this.loadBiomes(stream, StorageType.NetworkPersistence)
  //   }

  //   this.sections = []
  //   for (let i = 0; i < sectionCount; i++) {
  //     // in 1.17.30+, chunk index is sent in payload
  //     const section = new SubChunk(i)
  //     await section.decode(StorageType.Runtime, stream)
  //     this.sections.push(section)
  //   }

  //   for (let i = 0; i < sectionCount; i++) {
  //     const section = this.sections[i]
  //     const biomeSection = new BiomeSection(section.y)
  //     biomeSection.read(StorageType.Runtime, stream)
  //     this.biomes.push(biomeSection)
  //   }

  //   const borderBlocksLength = stream.readVarInt()
  //   const borderBlocks = stream.read(borderBlocksLength)
  //   // Don't know how to handle this yet
  //   if (borderBlocks.length) throw Error(`Read ${borderBlocksLength} border blocks, expected 0`)

  //   const buf = stream.getBuffer()
  //   buf.startOffset = stream.getOffset()
  //   while (stream.peek() === 0x0A) {
  //     const { parsed, metadata } = await nbt.parse(buf, 'littleVarint')
  //     stream.offset += metadata.size
  //     buf.startOffset += metadata.size
  //     this.addBlockEntity(parsed)
  //   }
  // }

  async networkDecodeSubChunkNoCache (y, buffer) {
    const stream = new Stream(buffer)
    const section = new SubChunk(this.registry, this.Block, { y })
    await section.decode(StorageType.Runtime, stream)
    this.setSection(y, section)

    const buf = stream.getBuffer()
    buf.startOffset = stream.getOffset()
    while (stream.peekUInt8() === 0x0A) {
      const { parsed, metadata } = await nbt.parse(buf, 'littleVarint')
      stream.offset += metadata.size
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

  toObject () {
    return { ...super.toObject(), version: '1.18' }
  }
}

module.exports = ChunkColumn180
