import { Vec3 } from "vec3";

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
    getBiomeColor(pos: Vec3): {
        r: number;
        g: number;
        b: number;
    };
    setBiomeColor(pos: Vec3, r: number, g: number, b: any): void;
    getBlockStateId(pos: Vec3): number;
    getBlockType(pos: Vec3): number;
    getBlockData(pos: Vec3): number;
    getBlockLight(pos: Vec3): any;
    getSkyLight(pos: Vec3): any;
    setBlockStateId(pos: Vec3, stateId: any): void;
    setBlockType(pos: Vec3, id: any): void;
    setBlockData(pos: Vec3, data: any): void;
    setBlockLight(pos: Vec3, light: any): void;
    setSkyLight(pos: Vec3, light: any): void;
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
