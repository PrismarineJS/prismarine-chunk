import loader = require('prismarine-chunk')
import defaultLoader, { StorageType, BedrockChunk as BedrockChunkClass } from 'prismarine-chunk'
import registryLoader = require('prismarine-registry')
import { Vec3 } from 'vec3'

const PCChunk = loader(registryLoader('1.20.4') as registryLoader.RegistryPc)
const pcChunk: loader.PCChunk = new PCChunk(null)
const stateId: number = pcChunk.getBlockStateId(new Vec3(0, 0, 0))
// @ts-expect-error state ids are numbers
const stateName: string = pcChunk.getBlockStateId(new Vec3(0, 0, 0))

const BedrockChunk = loader(registryLoader('bedrock_1.21.60') as registryLoader.RegistryBedrock)
// as bedrock-provider loads its chunk classes: an untyped registry gives either class
const untyped = { 1.18: defaultLoader({ version: { type: 'bedrock', majorVersion: '1.18' } } as any) } as Record<string, typeof BedrockChunkClass>
const bedrockChunk: loader.BedrockChunk = new BedrockChunk({ x: 0, z: 0 })
// @ts-expect-error bedrock chunks need a blob store
bedrockChunk.networkEncode()
const bedrockStateId: number | undefined = bedrockChunk.getBlockStateId({ x: 0, y: 0, z: 0 })
// @ts-expect-error there is no state id without a section
const bedrockStateIdNumber: number = bedrockChunk.getBlockStateId({ x: 0, y: 0, z: 0 })
// @ts-expect-error setBlockStateId returns nothing
const setStateIdResult: number = bedrockChunk.setBlockStateId({ x: 0, y: 0, z: 0, l: 0 }, 1)
const skyLight: number = bedrockChunk.getSkyLight({ x: 0, y: 0, z: 0 })
const section: loader.SubChunk | null | undefined = bedrockChunk.getSection({ y: 0 })
const newSection: loader.SubChunk = bedrockChunk.newSection(0)
const paletteEntry: loader.PaletteEntry | undefined = newSection.getPalette(0)[0]
const paletteEntryName: string | undefined = paletteEntry?.name
const paletteEntryCount: number | undefined = paletteEntry?.count
const compactable: boolean = newSection.isCompactable(0)
// @ts-expect-error compacting needs a layer
newSection.compact()
const blockNames: string[] = bedrockChunk.getBlocks().map(block => block.name)
const superimposed: string | undefined = bedrockChunk.getBlock({ x: 0, y: 0, z: 0 }).superimposed?.name
// @ts-expect-error bedrock 1.3+ has no biome colors
bedrockChunk.setBiomeColor(new Vec3(0, 0, 0), 0, 0, 0)
bedrockChunk.initialize(() => null)
bedrockChunk.loadEntities({})
const bedrockFromJson: loader.BedrockChunk = BedrockChunk.fromJson(new BedrockChunk().toJson())

async function bedrockNetwork (blobStore: loader.IBlobStore) {
  const { blobs, payload } = await bedrockChunk.networkEncode(blobStore)
  const misses: bigint[] = await bedrockChunk.networkDecode(blobs.map(blob => blob.hash), blobStore)
  const subChunkMisses: bigint[] = await bedrockChunk.networkDecodeSubChunk([1n], blobStore)
  const [hash, blockEntities] = await bedrockChunk.networkEncodeSubChunk(0, blobStore)
  // a const enum, as bedrock-provider uses it: no runtime value needed
  const runtime: loader.StorageType = StorageType.Runtime
  const disk: number = loader.StorageType.LocalPersistence
  const sectionBuffer: Buffer = await newSection.encode(runtime, true, false)
  newSection.decode(runtime, sectionBuffer)
  // @ts-expect-error decoding without the cache is synchronous
  bedrockChunk.networkDecodeNoCache(payload, 1).then(() => {})
  return [blobs, misses, subChunkMisses, hash + 1n, blockEntities, disk]
}

const chunk: InstanceType<ReturnType<typeof defaultLoader>> = Math.random() > 0.5 ? pcChunk : bedrockChunk
const blobType: loader.BlobType = loader.BlobType.Biomes
const blobEntry: loader.BlobEntry = new loader.BlobEntry({ type: blobType })
// @ts-expect-error unknown blob type
const unknownBlobType: loader.BlobType = 5
const blobStore = new Map<bigint | string, loader.BlobEntry>()
const blobBuffer: Buffer | undefined = blobStore.get(1n)?.buffer
bedrockNetwork(blobStore)

export { stateId, stateName, chunk, blobEntry, unknownBlobType, blobBuffer, bedrockStateId, bedrockStateIdNumber, setStateIdResult, skyLight, section, paletteEntryName, paletteEntryCount, compactable, blockNames, superimposed, bedrockFromJson, bedrockNetwork }
