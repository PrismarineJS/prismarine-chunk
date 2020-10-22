import { Vec3 } from "vec3";

export = ChunkSection;
declare class ChunkSection {
    static fromJson(j: any): ChunkSection;
    constructor(options?: {});
    data: any;
    palette: any;
    isDirty: boolean;
    solidBlockCount: any;
    toJson(): string;
    getBlock(pos: Vec3): any;
    setBlock(pos: Vec3, stateId: any): void;
    isEmpty(): boolean;
    write(smartBuffer: any): void;
}
