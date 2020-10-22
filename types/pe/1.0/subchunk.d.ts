import { Vec3 } from "vec3";

export = SubChunk;
declare class SubChunk {
    static fromJson(j: any): SubChunk;
    data: Buffer;
    toJson(): string;
    getBlockType(pos: Vec3): number;
    setBlockType(pos: Vec3, type: any): void;
    getBlockLight(pos: Vec3): any;
    setBlockLight(pos: Vec3, light: any): void;
    getSkyLight(pos: Vec3): any;
    setSkyLight(pos: Vec3, light: any): void;
    getBlockData(pos: Vec3): any;
    setBlockData(pos: Vec3, data: any): void;
    load(data: any): void;
    dump(): Buffer;
}
