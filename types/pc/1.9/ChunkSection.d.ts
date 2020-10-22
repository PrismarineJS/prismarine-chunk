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
    getBlock(pos: any): any;
    setBlock(pos: any, stateId: any): void;
    getBlockLight(pos: any): any;
    getSkyLight(pos: any): any;
    setBlockLight(pos: any, light: any): any;
    setSkyLight(pos: any, light: any): any;
    isEmpty(): boolean;
    write(smartBuffer: any): void;
}
