import { Block } from "prismarine-block";
import { Vec3 } from "vec3";
import Section from "../../../src/pc/1.8/section";

export = loader;
declare function loader(mcVersion: number): typeof Chunk;
declare class Chunk {
    static fromJson(j: any): Chunk;
    skyLightSent: boolean;
    sections: Section[]; 
    biome: Buffer;
    toJson(): string;
    initialize(iniFunc: any): void;
    getBlock(pos: Vec3): Block;
    setBlock(pos: Vec3, block: Block): void;
    getBiomeColor(pos: Vec3): {
        r: number;
        g: number;
        b: number;
    };
    setBiomeColor(pos: Vec3, r: number, g: number, b: number): void;
    _getSection(pos: Vec3): Section;
    getBlockStateId(pos: Vec3): Section;
    getBlockType(pos: Vec3): any;
    getBlockData(pos: Vec3): any;
    getBlockLight(pos: Vec3): any;
    getSkyLight(pos: Vec3): any;
    getBiome(pos: Vec3): number;
    setBlockStateId(pos: Vec3, stateId: any): any;
    setBlockType(pos: Vec3, id: any): void;
    setBlockData(pos: Vec3, data: any): void;
    setBlockLight(pos: Vec3, light: any): any;
    setSkyLight(pos: Vec3, light: any): any;
    setBiome(pos: Vec3, biome: any): void;
    dumpBiomes(): void;
    dumpLight(): void;
    loadLight(): void;
    loadBiomes(): void;
    dump(bitMap?: number, skyLightSent?: boolean): Buffer;
    load(data: any, bitMap?: number, skyLightSent?: boolean, fullChunk?: boolean): void;
    getMask(): number;
}
