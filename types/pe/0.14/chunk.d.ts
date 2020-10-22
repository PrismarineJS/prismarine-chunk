export = loader;
declare function loader(mcVersion: number): typeof Chunk;
declare class Chunk {
    static fromJson(j: any): Chunk;
    data: Buffer;
    toJson(): string;
    initialize(iniFunc: any): void;
    getBlock(pos: any): any;
    setBlock(pos: any, block: any): void;
    getBlockType(pos: any): number;
    setBlockType(pos: any, id: any): void;
    getBlockData(pos: any): any;
    setBlockData(pos: any, data: any): void;
    getBlockLight(pos: any): any;
    setBlockLight(pos: any, light: any): void;
    getSkyLight(pos: any): any;
    setSkyLight(pos: any, light: any): void;
    getBiomeColor(pos: any): {
        r: number;
        g: number;
        b: number;
    };
    setBiomeColor(pos: any, r: any, g: any, b: any): void;
    getBiome(pos: any): number;
    setBiome(pos: any, id: any): void;
    getHeight(pos: any): number;
    setHeight(pos: any, value: any): void;
    load(data: any): void;
    dumpBiomes(): void;
    dumpLight(): void;
    loadLight(): void;
    loadBiomes(): void;
    dump(): Buffer;
    getMask(): number;
}
