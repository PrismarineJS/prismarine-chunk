import ChunkLoader from "./chunk";

export {ChunkInterface as Chunk} from "./chunk";
export {Section} from "./section"
export declare function loader(mcVersion: number): typeof ChunkLoader;
