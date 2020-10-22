export = Section;
declare class Section {
    static fromJson(j: any): Section;
    static sectionSize(skyLightSent?: boolean): number;
    constructor(skyLightSent?: boolean);
    data: Buffer;
    toJson(): {
        type: "Buffer";
        data: number[];
    };
    initialize(iniFunc: any): void;
    getBiomeColor(pos: any): {
        r: number;
        g: number;
        b: number;
    };
    setBiomeColor(pos: any, r: any, g: any, b: any): void;
    getBlockStateId(pos: any): number;
    getBlockType(pos: any): number;
    getBlockData(pos: any): number;
    getBlockLight(pos: any): any;
    getSkyLight(pos: any): any;
    setBlockStateId(pos: any, stateId: any): void;
    setBlockType(pos: any, id: any): void;
    setBlockData(pos: any, data: any): void;
    setBlockLight(pos: any, light: any): void;
    setSkyLight(pos: any, light: any): void;
    dump(): Buffer;
    load(data: any, skyLightSent?: boolean): void;
}
declare namespace Section {
    export { w };
    export { l };
    export { sh };
}
declare const w: 16;
declare const l: 16;
declare const sh: 16;
