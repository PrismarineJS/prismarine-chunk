export = BitArray;
declare class BitArray {
    static fromJson(j: any): BitArray;
    constructor(options: any);
    data: any;
    capacity: any;
    bitsPerValue: any;
    valueMask: number;
    toJson(): string;
    get(index: any): number;
    set(index: any, value: any): void;
    resizeTo(newBitsPerValue: any): BitArray;
    length(): number;
    readBuffer(smartBuffer: any): BitArray;
    writeBuffer(smartBuffer: any): BitArray;
    getBitsPerValue(): any;
}
