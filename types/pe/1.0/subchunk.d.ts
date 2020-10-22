export = SubChunk;
declare class SubChunk {
    static fromJson(j: any): SubChunk;
    data: Buffer;
    toJson(): string;
    getBlockType(pos: any): number;
    setBlockType(pos: any, type: any): void;
    getBlockLight(pos: any): any;
    setBlockLight(pos: any, light: any): void;
    getSkyLight(pos: any): any;
    setSkyLight(pos: any, light: any): void;
    getBlockData(pos: any): any;
    setBlockData(pos: any, data: any): void;
    load(data: any): void;
    dump(): Buffer;
}
