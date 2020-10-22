import { Block } from "prismarine-block";
import { Vec3 } from "vec3";

export = loader;
declare function loader(mcVersion: number): typeof Chunk;
declare class Chunk {
    static fromJson(j: any): Chunk;
    chunks: any[];
    data: Buffer;
    toJson(): string;
    initialize(iniFunc: any): void;
    getBlock(pos: Vec3): any;
    setBlock(pos: Vec3, block: Block): void;
    getBlockType(pos: Vec3): any;
    setBlockType(pos: Vec3, type: any): any;
    getBlockData(pos: Vec3): any;
    setBlockData(pos: Vec3, data: any): any;
    getBlockLight(pos: Vec3): any;
    setBlockLight(pos: Vec3, light: any): any;
    getSkyLight(pos: Vec3): any;
    setSkyLight(pos: Vec3, light: any): any;
    getBiomeColor(pos: Vec3): {
        x: number;
        y: number;
        z: number;
    };
    setBiomeColor(pos: Vec3, r: number, g: number, b: number): void;
    getBiome(pos: Vec3): number;
    setBiome(pos: Vec3, id: any): void;
    getHeight(pos: Vec3): number;
    setHeight(pos: Vec3, height: any): void;
    load(newData: any): void;
    size(): number;
    dumpBiomes(): void;
    dumpLight(): void;
    loadLight(): void;
    loadBiomes(): void;
    dump(): Buffer;
    getMask(): number;
}
