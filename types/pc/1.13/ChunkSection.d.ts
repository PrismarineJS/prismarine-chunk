import { Vec3 } from "vec3";

export = ChunkSection;
declare class ChunkSection {
    static fromJson(j: any): ChunkSection;
    constructor(options?: {});
    data: any;
    palette: any;
    isDirty: boolean;
    blockLight: any;
    skyLight: any;
    solidBlockCount: any;
    toJson(): string;
    getBlock(pos: Vec3): any;
    setBlock(pos: Vec3, stateId: any): void;
    getBlockLight(pos: Vec3): any;
    getSkyLight(pos: Vec3): any;
    setBlockLight(pos: Vec3, light: any): any;
    setSkyLight(pos: Vec3, light: any): any;
    isEmpty(): boolean;
    write(smartBuffer: any): void;
}
