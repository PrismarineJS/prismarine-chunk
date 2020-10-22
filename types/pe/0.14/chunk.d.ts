import { Block } from "prismarine-block";
import { Vec3 } from "vec3";

export = loader;
declare function loader(mcVersion: number): typeof Chunk;
declare class Chunk {
    static fromJson(j: any): Chunk;
    data: Buffer;
    toJson(): string;
    initialize(iniFunc: any): void;
    getBlock(pos: Vec3): any;
    setBlock(pos: Vec3, block: Block): void;
    getBlockType(pos: Vec3): number;
    setBlockType(pos: Vec3, id: any): void;
    getBlockData(pos: Vec3): any;
    setBlockData(pos: Vec3, data: any): void;
    getBlockLight(pos: Vec3): any;
    setBlockLight(pos: Vec3, light: any): void;
    getSkyLight(pos: Vec3): any;
    setSkyLight(pos: Vec3, light: any): void;
    getBiomeColor(pos: Vec3): {
        r: number;
        g: number;
        b: number;
    };
    setBiomeColor(pos: Vec3, r: number, g: number, b: number): void;
    getBiome(pos: Vec3): number;
    setBiome(pos: Vec3, id: any): void;
    getHeight(pos: Vec3): number;
    setHeight(pos: Vec3, value: any): void;
    load(data: any): void;
    dumpBiomes(): void;
    dumpLight(): void;
    loadLight(): void;
    loadBiomes(): void;
    dump(): Buffer;
    getMask(): number;
}
