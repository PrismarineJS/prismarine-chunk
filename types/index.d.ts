import ChunkLoader from "./chunk";

export {ChunkInterface as Chunk} from "./chunk";
export * from "./section"
export declare function loader(mcVersion: number): typeof ChunkLoader;
