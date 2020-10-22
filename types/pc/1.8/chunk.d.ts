export = loader;
declare function loader(mcVersion: number): typeof Chunk;
declare class Chunk {
    static fromJson(j: any): Chunk;
    skyLightSent: boolean;
    sections: any[];
    biome: Buffer;
    toJson(): string;
    initialize(iniFunc: any): void;
    getBlock(pos: any): any;
    setBlock(pos: any, block: any): void;
    getBiomeColor(pos: any): {
        r: number;
        g: number;
        b: number;
    };
    setBiomeColor(pos: any, r: any, g: any, b: any): void;
    _getSection(pos: any): any;
    getBlockStateId(pos: any): any;
    getBlockType(pos: any): any;
    getBlockData(pos: any): any;
    getBlockLight(pos: any): any;
    getSkyLight(pos: any): any;
    getBiome(pos: any): number;
    setBlockStateId(pos: any, stateId: any): any;
    setBlockType(pos: any, id: any): void;
    setBlockData(pos: any, data: any): void;
    setBlockLight(pos: any, light: any): any;
    setSkyLight(pos: any, light: any): any;
    setBiome(pos: any, biome: any): void;
    dumpBiomes(): void;
    dumpLight(): void;
    loadLight(): void;
    loadBiomes(): void;
    dump(bitMap?: number, skyLightSent?: boolean): Buffer;
    load(data: any, bitMap?: number, skyLightSent?: boolean, fullChunk?: boolean): void;
    getMask(): number;
}
