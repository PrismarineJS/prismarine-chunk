export = loader;
declare function loader(mcVersion: number): typeof Chunk;
declare class Chunk {
    static fromJson(j: any): Chunk;
    chunks: any[];
    data: Buffer;
    toJson(): string;
    initialize(iniFunc: any): void;
    getBlock(pos: any): any;
    setBlock(pos: any, block: any): void;
    getBlockType(pos: any): any;
    setBlockType(pos: any, type: any): any;
    getBlockData(pos: any): any;
    setBlockData(pos: any, data: any): any;
    getBlockLight(pos: any): any;
    setBlockLight(pos: any, light: any): any;
    getSkyLight(pos: any): any;
    setSkyLight(pos: any, light: any): any;
    getBiomeColor(pos: any): {
        x: number;
        y: number;
        z: number;
    };
    setBiomeColor(pos: any, r: any, g: any, b: any): void;
    getBiome(pos: any): number;
    setBiome(pos: any, id: any): void;
    getHeight(pos: any): number;
    setHeight(pos: any, height: any): void;
    load(newData: any): void;
    size(): number;
    dumpBiomes(): void;
    dumpLight(): void;
    loadLight(): void;
    loadBiomes(): void;
    dump(): Buffer;
    getMask(): number;
}
