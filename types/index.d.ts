import { Biome } from "prismarine-biome"
import { Block } from "prismarine-block"
import { Vec3 } from "vec3"
import Registry from 'prismarine-registry'
import Section from "./section"

declare class CommonChunk {
  static fromJson(j: any): typeof this
  toJson(): string

  initialize(iniFunc: any): void

  /** @deprecated This function only works on MCPE v0.14 */
  setBiomeColor(pos: Vec3, r: number, g: number, b: number): void
}

declare class PCChunk extends CommonChunk {
  constructor(initData: {
    // Only present on 1.18+
    minY?: number,
    worldHeight?: number
  } | null)

  skyLightSent: boolean
  sections: Section[]
  biome: Buffer

  getBlock(pos: Vec3): Block
  setBlock(pos: Vec3, block: Block): void

  getBlockStateId(pos: Vec3): number
  getBlockType(pos: Vec3): number
  getBlockData(pos: Vec3): number
  getBlockLight(pos: Vec3): number
  getSkyLight(pos: Vec3): number
  getBiome(pos: Vec3): number  
  setBlockStateId(pos: Vec3, stateId: number): number
  setBlockType(pos: Vec3, id: number): void
  setBlockData(pos: Vec3, data: Buffer): void
  setBlockLight(pos: Vec3, light: number): Section
  setSkyLight(pos: Vec3, light: number): Section
  setBiome(pos: Vec3, biome: number): void

  getBiomeColor(pos: Vec3): { r: number; g: number; b: number; }
  dumpBiomes(): Array<number>
  dumpLight(): Buffer
  loadLight(data: Buffer, skyLightMask: number, blockLightMask: number, emptySkyLightMask?: number, emptyBlockLightMask?: number): void
  loadLightParse(skyLight: Buffer[], blockLight: Buffer[], skyLightMask: number[][], blockLightMask: number[][], emptySkyLightMask: number[][], emptyBlockLightMask: number[][]): void
  loadBiomes(newBiomesArray: Array<number>): void;
  dump(bitMap?: number, skyLightSent?: boolean): Buffer
  load(data: Buffer, bitMap?: number, skyLightSent?: boolean, fullChunk?: boolean): void
  getMask(): number
}

//// Bedrock ////

interface IVec4 {
  x: number
  y: number
  z: number
  l?: number
}

// This manages the chunk cache
interface IBlobStore {
  read(key: string | Buffer[]): object
  write(key: string | Buffer[], value: object): boolean
  has(key: string | Buffer[]): boolean
}

declare const enum BlobType {
  ChunkBiomes = 0,
  Biomes = 1
}

type CCHash = { type: BlobType, hash: Buffer }

declare class BedrockChunk {
  constructor(x: number, z: number)

  getBlock(pos: IVec4): Block
  setBlock(pos: IVec4, block: Block): void

  setBlockStateId(pos: IVec4, stateId: number)
  getBlockStateId(pos: IVec4): number

  getBiome(pos: Vec3): Biome
  setBiome(pos: Vec3, biome: Biome): void

  // Encode this full chunk column without computing a checksum at the end
  networkEncodeNoCache(): Promise<Buffer>
  // Compute checksums only
  networkEncode(blobStore: IBlobStore): Promise<{ blobs: CCHash[] }>

  // Decode a full chunk column, not cached
  networkDecodeNoCache(buffer: Buffer, sectionCount: number): Promise<void>
  /**
   * Decodes cached chunks sent over the network
   * @param blobs The blob hashes sent in the Chunk packet
   * @param blobStore Our blob store for cached data
   * @param {Buffer} payload The rest of the non-cached data
   * @returns {CCHash[]} A list of hashes we don't have and need. If len > 0, decode failed.
   */
  networkDecode(blobs: CCHash[], blobStore: IBlobStore, payload: Buffer): Promise<CCHash[]>
}

export default function loader(mcVersionOrRegistry: number | ReturnType<typeof Registry>): typeof PCChunk | typeof BedrockChunk