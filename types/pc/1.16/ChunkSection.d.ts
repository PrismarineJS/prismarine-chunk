export = ChunkSection;
declare class ChunkSection {
    static fromJson(j: any): ChunkSection;
    constructor(options?: {});
    data: any;
    palette: any;
    isDirty: boolean;
    solidBlockCount: any;
    toJson(): string;
    getBlock(pos: any): any;
    setBlock(pos: any, stateId: any): void;
    isEmpty(): boolean;
    write(smartBuffer: any): void;
}
