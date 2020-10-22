export = loader;
declare function loader(mcVersion: number): {
    new (): {
        sectionMask: number;
        skyLightSent: boolean;
        sections: any[];
        biomes: any[];
        toJson(): string;
        initialize(func: any): void;
        getBlock(pos: any): any;
        setBlock(pos: any, block: any): void;
        getBlockType(pos: any): number;
        getBlockData(pos: any): number;
        getBlockStateId(pos: any): any;
        getBlockLight(pos: any): any;
        getSkyLight(pos: any): any;
        getBiome(pos: any): any;
        getBiomeColor(pos: any): {
            r: number;
            g: number;
            b: number;
        };
        setBlockType(pos: any, id: any): void;
        setBlockData(pos: any, data: any): void;
        setBlockStateId(pos: any, stateId: any): void;
        setBlockLight(pos: any, light: any): any;
        setSkyLight(pos: any, light: any): any;
        setBiome(pos: any, biome: any): void;
        setBiomeColor(pos: any, r: any, g: any, b: any): void;
        getMask(): number;
        dumpBiomes(): void;
        dumpLight(): void;
        loadLight(): void;
        loadBiomes(): void;
        dump(): Buffer;
        load(data: any, bitMap?: number, skyLightSent?: boolean, fullChunk?: boolean): void;
    };
    fromJson(j: any): {
        sectionMask: number;
        skyLightSent: boolean;
        sections: any[];
        biomes: any[];
        toJson(): string;
        initialize(func: any): void;
        getBlock(pos: any): any;
        setBlock(pos: any, block: any): void;
        getBlockType(pos: any): number;
        getBlockData(pos: any): number;
        getBlockStateId(pos: any): any;
        getBlockLight(pos: any): any;
        getSkyLight(pos: any): any;
        getBiome(pos: any): any;
        getBiomeColor(pos: any): {
            r: number;
            g: number;
            b: number;
        };
        setBlockType(pos: any, id: any): void;
        setBlockData(pos: any, data: any): void;
        setBlockStateId(pos: any, stateId: any): void;
        setBlockLight(pos: any, light: any): any;
        setSkyLight(pos: any, light: any): any;
        setBiome(pos: any, biome: any): void;
        setBiomeColor(pos: any, r: any, g: any, b: any): void;
        getMask(): number;
        dumpBiomes(): void;
        dumpLight(): void;
        loadLight(): void;
        loadBiomes(): void;
        dump(): Buffer;
        load(data: any, bitMap?: number, skyLightSent?: boolean, fullChunk?: boolean): void;
    };
};
