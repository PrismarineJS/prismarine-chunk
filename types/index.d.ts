import Chunk = require("./chunk");

export = loader;
declare function loader(mcVersion: number): typeof Chunk;
