/* eslint-env mocha */
// Encode a constructed chunk through every network path of every bedrock version (and block hash mode), decode it
// into a new column and compare. The chunk holds every block state of the version, sections whose palettes need each
// storage width, a uniform section, a second storage layer, block entities and biomes.
const assert = require('assert')
const { Vec3 } = require('vec3')
const { Versions } = require('bedrock-protocol/src/options')
const minecraftData = require('minecraft-data')

// storage widths a bedrock client accepts (0 = single state, v9 network only)
const VALID_BITS = [0, 1, 2, 3, 4, 5, 6, 8, 16]
// distinct states per section to need each width: 1, 2, 3, 4, 5, 6, 8 and 16 bits
const PALETTE_SIZES = [2, 4, 8, 16, 32, 64, 256, 4096]

const versions = [...new Set(minecraftData.versions.bedrock.map(v => v.minecraftVersion))]
  .filter(v => v in Versions)
  .filter(v => require('prismarine-registry')('bedrock_' + v).blockStates) // npm minecraft-data lacks blockStates for some
  .reverse()

const pos = (x, y, z, l = 0) => Object.assign(new Vec3(x, y, z), { l })

function setup (version, hashes) {
  const registry = require('prismarine-registry')('bedrock_' + version)
  registry.handleStartGame({ block_network_ids_are_hashes: hashes, itemstates: [] })
  return { registry, ChunkColumn: require('prismarine-chunk')(registry) }
}

// the source column, and what each position is expected to hold
function buildColumn (registry, ChunkColumn) {
  const column = new ChunkColumn({ x: 3, z: -5 })
  const stateIds = registry.blockStates.map((state, index) => state.stateId ?? index)
  const sections = []
  let next = 0
  const fill = (count) => { // one section with `count` distinct states, taken in turn from all states
    const ids = []
    for (let i = 0; i < count; i++) ids.push(stateIds[next++ % stateIds.length])
    sections.push(i => ids[i % ids.length])
  }
  sections.push(() => registry.blocksByName.stone.defaultState) // uniform: single state storage
  for (const size of PALETTE_SIZES) fill(size)
  while (next < stateIds.length) fill(4096) // the remaining states
  assert(sections.length <= column.maxCY - column.minCY, 'world is too low for all block states')

  const water = registry.blocksByName.water.defaultState
  for (let s = 0; s < sections.length; s++) {
    const cy = column.minCY + s
    for (let i = 0; i < 4096; i++) {
      column.setBlockStateId(pos(i & 15, cy * 16 + (i >> 8), (i >> 4) & 15), sections[s](i))
    }
    if (s % 2) column.setBlockStateId(pos(1, cy * 16 + 2, 3, 1), water) // second storage layer
    if (s === 2 || s === 5) {
      const [x, y, z] = [4, cy * 16 + 7, 9]
      column.setBlockEntity(pos(x, y, z), { type: 'compound', name: '', value: { id: { type: 'string', value: 'Chest' }, x: { type: 'int', value: column.x * 16 + x }, y: { type: 'int', value: y }, z: { type: 'int', value: column.z * 16 + z } } })
    }
    column.setBiomeId(pos(0, cy * 16, 0), 1 + (s % 3))
  }
  return { column, sectionCount: sections.length }
}

function assertSameColumn (actual, expected, sectionCount, { blocks = true, biomes = true, blockEntities = true } = {}) {
  for (let s = 0; s < (blocks ? sectionCount : 0); s++) {
    const cy = expected.minCY + s
    const a = actual.getSectionAtIndex(cy)
    const e = expected.getSectionAtIndex(cy)
    assert(a, `section ${cy} missing`)
    for (let l = 0; l < e.blocks.length; l++) {
      for (let i = 0; i < 4096; i++) {
        const [x, y, z] = [i & 15, i >> 8, (i >> 4) & 15]
        if (a.getBlockStateId(l, x, y, z) !== e.getBlockStateId(l, x, y, z)) {
          assert.fail(`section ${cy} layer ${l} at ${x},${y},${z}: ${a.getBlockStateId(l, x, y, z)} !== ${e.getBlockStateId(l, x, y, z)}`)
        }
      }
    }
  }
  if (biomes) {
    for (let s = 0; s < sectionCount; s++) {
      const p = pos(0, (expected.minCY + s) * 16, 0)
      assert.strictEqual(actual.getBiomeId(p), expected.getBiomeId(p), `biome at y ${p.y}`)
    }
  }
  if (blockEntities) assert.deepStrictEqual(actual.blockEntities, expected.blockEntities)
}

// every distinct state decodes to its block state: name and properties
function assertBlockStates (registry, column, sectionCount) {
  const seen = new Set()
  for (let s = 0; s < sectionCount; s++) {
    const section = column.getSectionAtIndex(column.minCY + s)
    for (const entry of section.palette[0]) {
      if (seen.has(entry.stateId)) continue
      seen.add(entry.stateId)
      const state = registry.blockStatesByStateId[entry.stateId]
      const block = column.Block.fromStateId(entry.stateId, 0)
      assert.strictEqual(block.name, state.name.replace('minecraft:', ''), `name of state ${entry.stateId}`)
      assert.deepStrictEqual(block.getProperties(), Object.fromEntries(Object.entries(state.states).map(([k, v]) => [k, v.value])), `properties of ${state.name} ${entry.stateId}`)
    }
  }
}

function assertValidStorageWidths (column, sectionCount) {
  for (let s = 0; s < sectionCount; s++) {
    const section = column.getSectionAtIndex(column.minCY + s)
    for (let l = 0; l < section.blocks.length; l++) {
      const bits = section.palette[l].length === 1 && section.subChunkVersion >= 9 ? 0 : section.blocks[l].bitsPerBlock
      assert(VALID_BITS.includes(bits), `section ${section.y} layer ${l} is written with ${bits} bits per block (palette ${section.palette[l].length})`)
    }
  }
}

class BlobStore extends Map {
  set (k, v) { return super.set(k.toString(), v) }
  get (k) { return super.get(k.toString()) }
  has (k) { return super.has(k.toString()) }
}

for (const version of versions) {
  const supportsHashes = require('prismarine-registry')('bedrock_' + version).supportFeature('blockHashes')
  for (const hashes of supportsHashes ? [false, true] : [false]) {
    describe(`bedrock ${version} network round trip, block_network_ids_are_hashes = ${hashes}`, function () {
      this.timeout(120 * 1000)
      let registry, ChunkColumn, source, sectionCount
      before(() => {
        ({ registry, ChunkColumn } = setup(version, hashes))
        ;({ column: source, sectionCount } = buildColumn(registry, ChunkColumn))
      })
      const fresh = () => new ChunkColumn({ x: source.x, z: source.z })

      if (!require('prismarine-registry')('bedrock_' + version).version['>=']('1.18')) {
        it('level_chunk without caching', async () => {
          const column = fresh()
          column.networkDecodeNoCache(await source.networkEncodeNoCache(), sectionCount)
          assertValidStorageWidths(source, sectionCount)
          assertSameColumn(column, source, sectionCount)
          assertBlockStates(registry, column, sectionCount)
        })

        it('level_chunk with caching (nbt palette blobs)', async () => {
          const store = new BlobStore()
          const { blobs, payload } = await source.networkEncode(store)
          const column = fresh()
          assert.deepStrictEqual(await column.networkDecode(blobs.map(b => b.hash), store, payload), [])
          assertSameColumn(column, source, sectionCount)
          assertBlockStates(registry, column, sectionCount)
        })
      } else {
        it('sub chunks without caching, then level_chunk biomes', async () => {
          const column = fresh()
          for (let s = 0; s < sectionCount; s++) {
            const y = source.minCY + s
            await column.networkDecodeSubChunkNoCache(y, await source.networkEncodeSubChunkNoCache(y))
          }
          column.networkDecodeNoCache(await source.networkEncodeNoCache(), -2)
          assertValidStorageWidths(source, sectionCount)
          assertSameColumn(column, source, sectionCount)
          assertBlockStates(registry, column, sectionCount)
        })

        it('level_chunk biome blob, then sub chunks with caching', async () => {
          const store = new BlobStore()
          const column = fresh()
          const { blobs, payload } = await source.networkEncode(store)
          assert.deepStrictEqual(await column.networkDecode(blobs.map(b => b.hash), store, payload), [])
          for (let s = 0; s < sectionCount; s++) {
            const y = source.minCY + s
            source.getSectionAtIndex(y).updated = true
            const [hash, payload] = await source.networkEncodeSubChunk(y, store)
            assert.deepStrictEqual(await column.networkDecodeSubChunk([hash], store, payload), [])
          }
          assertSameColumn(column, source, sectionCount)
          assertBlockStates(registry, column, sectionCount)
        })

        it('sub chunks with caching, then level_chunk biome blob', async () => {
          // the client cache miss for the biome blob can be answered after the SubChunk packets
          const store = new BlobStore()
          const column = fresh()
          for (let s = 0; s < sectionCount; s++) {
            const y = source.minCY + s
            source.getSectionAtIndex(y).updated = true
            const [hash, payload] = await source.networkEncodeSubChunk(y, store)
            assert.deepStrictEqual(await column.networkDecodeSubChunk([hash], store, payload), [])
          }
          const { blobs, payload } = await source.networkEncode(store)
          assert.deepStrictEqual(await column.networkDecode(blobs.map(b => b.hash), store, payload), [])
          assertSameColumn(column, source, sectionCount)
        })
      }
    })
  }
}
