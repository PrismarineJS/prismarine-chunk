/* eslint-env mocha */
const { Vec3 } = require('vec3')
const assert = require('assert')
const nbt = require('prismarine-nbt')
const { BlobEntry, BlobType } = require('prismarine-chunk')
const { StorageType } = require('prismarine-chunk/src/bedrock/common/constants')
const { bedrockNetworkVersions } = require('./versions')

const VALID_BITS_PER_BLOCK = [0, 1, 2, 3, 4, 5, 6, 8, 16]
const PALETTE_SIZES = [2, 4, 8, 16, 32, 64, 256, 4096]

class BlobStore extends Map {
  set (key, value) { return super.set(key.toString(), value) }
  get (key) { return super.get(key.toString()) }
  has (key) { return super.has(key.toString()) }
}

// A column with every block state of the version, sections needing each storage width, a uniform section,
// a second storage layer, block entities and biomes
function buildColumn (registry, ChunkColumn) {
  const column = new ChunkColumn({ x: 3, z: -5 })
  const stateIds = registry.blockStates.map((state, index) => state.stateId ?? index)
  const sections = [[registry.blocksByName.stone.defaultState]]
  for (const size of PALETTE_SIZES) sections.push(stateIds.slice(0, size))
  for (let i = 0; i < stateIds.length; i += 4096) sections.push(stateIds.slice(i, i + 4096))

  for (let s = 0; s < sections.length; s++) {
    const y = (column.minCY + s) * 16
    for (let i = 0; i < 4096; i++) {
      column.setBlockStateId(new Vec3(i & 15, y + (i >> 8), (i >> 4) & 15), sections[s][i % sections[s].length])
    }
    if (s % 2) column.setBlockStateId(Object.assign(new Vec3(1, y + 2, 3), { l: 1 }), registry.blocksByName.water.defaultState)
    if (s % 4 === 1) {
      const pos = new Vec3(4, y + 7, 9)
      column.setBlockEntity(pos, nbt.comp({ id: nbt.string('Chest'), x: nbt.int(column.x * 16 + pos.x), y: nbt.int(pos.y), z: nbt.int(column.z * 16 + pos.z) }))
    }
    column.setBiomeId(new Vec3(0, y, 0), 1 + s % 3)
  }
  return { column, sectionCount: sections.length }
}

function assertSameBlocks (actual, expected, sectionCount) {
  for (let s = 0; s < sectionCount; s++) {
    const y = expected.minCY + s
    const actualSection = actual.getSectionAtIndex(y)
    const expectedSection = expected.getSectionAtIndex(y)
    assert(actualSection, `section ${y} is missing`)
    for (let l = 0; l < expectedSection.blocks.length; l++) {
      for (let i = 0; i < 4096; i++) {
        const [a, e] = [actualSection, expectedSection].map(section => section.getBlockStateId(l, i & 15, i >> 8, (i >> 4) & 15))
        if (a !== e) assert.fail(`section ${y} layer ${l} block ${i}: ${a} !== ${e}`)
      }
    }
  }
}

function assertSameBiomesAndBlockEntities (actual, expected, sectionCount) {
  for (let s = 0; s < sectionCount; s++) {
    const pos = new Vec3(0, (expected.minCY + s) * 16, 0)
    assert.strictEqual(actual.getBiomeId(pos), expected.getBiomeId(pos), `biome at y=${pos.y}`)
  }
  assert.deepStrictEqual(actual.blockEntities, expected.blockEntities)
}

function assertBlockStates (registry, column, sectionCount) {
  const checked = new Set()
  for (let s = 0; s < sectionCount; s++) {
    for (const { stateId } of column.getSectionAtIndex(column.minCY + s).palette[0]) {
      if (checked.has(stateId)) continue
      checked.add(stateId)
      const state = registry.blockStatesByStateId[stateId]
      const block = column.Block.fromStateId(stateId, 0)
      assert.strictEqual(block.name, state.name.replace('minecraft:', ''), `name of state ${stateId}`)
      const properties = Object.fromEntries(Object.entries(state.states).map(([name, { value }]) => [name, value]))
      assert.deepStrictEqual(block.getProperties(), properties, `properties of ${state.name} (${stateId})`)
    }
  }
}

function assertValidStorageWidths (column, sectionCount) {
  for (let s = 0; s < sectionCount; s++) {
    const section = column.getSectionAtIndex(column.minCY + s)
    for (let l = 0; l < section.blocks.length; l++) {
      const bits = section.palette[l].length === 1 && section.subChunkVersion >= 9 ? 0 : section.blocks[l].bitsPerBlock
      assert(VALID_BITS_PER_BLOCK.includes(bits), `section ${section.y} layer ${l} has ${bits} bits per block`)
    }
  }
}

for (const version of bedrockNetworkVersions) {
  const { supportFeature, version: { '<': olderThan } } = require('prismarine-registry')(version)
  for (const blockNetworkIdsAreHashes of supportFeature('blockHashes') ? [false, true] : [false]) {
    describe(`bedrock network round trip on ${version}, block_network_ids_are_hashes = ${blockNetworkIdsAreHashes}`, () => {
      const registry = require('prismarine-registry')(version)
      let ChunkColumn, source, sectionCount
      before(() => {
        registry.handleStartGame({ block_network_ids_are_hashes: blockNetworkIdsAreHashes, itemstates: [] })
        ChunkColumn = require('prismarine-chunk')(registry)
        ;({ column: source, sectionCount } = buildColumn(registry, ChunkColumn))
      })
      const newColumn = () => new ChunkColumn({ x: source.x, z: source.z })

      if (olderThan('1.18')) {
        it('level_chunk', async () => {
          const column = newColumn()
          column.networkDecodeNoCache(await source.networkEncodeNoCache(), sectionCount)
          assertValidStorageWidths(source, sectionCount)
          assertSameBlocks(column, source, sectionCount)
          assertSameBiomesAndBlockEntities(column, source, sectionCount)
          assertBlockStates(registry, column, sectionCount)
        })

        it('cached level_chunk', async () => {
          const blobStore = new BlobStore()
          const { blobs, payload } = await source.networkEncode(blobStore)
          const column = newColumn()
          assert.deepStrictEqual(await column.networkDecode(blobs.map(blob => blob.hash), blobStore, payload), [])
          assertSameBlocks(column, source, sectionCount)
          assertSameBiomesAndBlockEntities(column, source, sectionCount)
          assertBlockStates(registry, column, sectionCount)
        })
        return
      }

      const sendSubChunks = async (column, blobStore) => {
        for (let s = 0; s < sectionCount; s++) {
          const y = source.minCY + s
          if (!blobStore) {
            await column.networkDecodeSubChunkNoCache(y, await source.networkEncodeSubChunkNoCache(y))
            continue
          }
          source.getSectionAtIndex(y).updated = true
          const [hash, payload] = await source.networkEncodeSubChunk(y, blobStore)
          assert.deepStrictEqual(await column.networkDecodeSubChunk([hash], blobStore, payload), [])
        }
      }
      const sendCachedLevelChunk = async (column, blobStore) => {
        const { blobs, payload } = await source.networkEncode(blobStore)
        assert.deepStrictEqual(await column.networkDecode(blobs.map(blob => blob.hash), blobStore, payload), [])
      }

      it('sub chunks and level_chunk', async () => {
        const column = newColumn()
        await sendSubChunks(column)
        column.networkDecodeNoCache(await source.networkEncodeNoCache(), -2)
        assertValidStorageWidths(source, sectionCount)
        assertSameBlocks(column, source, sectionCount)
        assertSameBiomesAndBlockEntities(column, source, sectionCount)
        assertBlockStates(registry, column, sectionCount)
      })

      it('cached level_chunk, then cached sub chunks', async () => {
        const blobStore = new BlobStore()
        const column = newColumn()
        await sendCachedLevelChunk(column, blobStore)
        await sendSubChunks(column, blobStore)
        assertSameBlocks(column, source, sectionCount)
        assertSameBiomesAndBlockEntities(column, source, sectionCount)
        assertBlockStates(registry, column, sectionCount)
      })

      it('cached sub chunks, then cached level_chunk', async () => {
        const blobStore = new BlobStore()
        const column = newColumn()
        await sendSubChunks(column, blobStore)
        await sendCachedLevelChunk(column, blobStore)
        assertSameBlocks(column, source, sectionCount)
        assertSameBiomesAndBlockEntities(column, source, sectionCount)
      })

      it('level_chunk with sections', async () => {
        const sections = []
        for (let s = 0; s < sectionCount; s++) {
          sections.push(await source.getSectionAtIndex(source.minCY + s).encode(StorageType.Runtime, false, false))
        }
        const column = newColumn()
        column.networkDecodeNoCache(Buffer.concat([...sections, await source.networkEncodeNoCache()]), sectionCount)
        assertSameBlocks(column, source, sectionCount)
      })

      it('cached level_chunk with section blobs', async () => {
        const blobStore = new BlobStore()
        const hashes = []
        for (let s = 0; s < sectionCount; s++) {
          const section = source.getSectionAtIndex(source.minCY + s)
          const buffer = await section.encode(StorageType.Runtime, true, false)
          blobStore.set(section.hash, new BlobEntry({ type: BlobType.ChunkSection, buffer }))
          hashes.push(section.hash)
        }
        const { blobs, payload } = await source.networkEncode(blobStore)
        const column = newColumn()
        assert.deepStrictEqual(await column.networkDecode([...hashes, ...blobs.map(blob => blob.hash)], blobStore, payload), [])
        assertSameBlocks(column, source, sectionCount)
      })
    })
  }
}
