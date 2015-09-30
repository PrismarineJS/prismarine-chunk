# prismarine-chunk

[![Join the chat at https://gitter.im/dcbartlett/minecraftJS](https://img.shields.io/badge/Gitter-Chat-brightgreen.svg)]
(https://gitter.im/PrismarineJS/Prismarine-Server?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
 Come Chat with us.<br />
[![Circle CI](https://img.shields.io/circleci/project/PrismarineJS/prismarine-chunk.svg)]
(https://circleci.com/gh/PrismarineJS/prismarine-chunk)

## Usage

```js
var Chunk = require('prismarine-chunk')("1.8");
var Vec3 = require("vec3");

var chunk=new Chunk();

for (var x = 0; x < 16;x++) {
  for (var z = 0; z < 16; z++) {
    chunk.setBlockType(new Vec3(x, 50, z), 2);
    for (var y = 0; y < 256; y++) {
      chunk.setSkyLight(new Vec3(x, y, z), 15);
    }
  }
}

console.log(JSON.stringify(chunk.getBlock(new Vec3(3,50,3)),null,2));
```

## API

### Chunk

#### Chunk()

Build a new chunk

#### Chunk.getBlock(pos)

Get the [Block](https://github.com/PrismarineJS/prismarine-block) at [pos](https://github.com/andrewrk/node-vec3)

#### Chunk.setBlock(pos,block)

Set the [Block](https://github.com/PrismarineJS/prismarine-block) at [pos](https://github.com/andrewrk/node-vec3)

#### Chunk.getBlockType(pos)

Get the block type at `pos`

#### Chunk.getBlockData(pos)

Get the block data (metadata) at `pos`

#### Chunk.getBlockLight(pos)

Get the block light at `pos`

#### Chunk.getSkyLight(pos)

Get the block sky light at `pos`

#### Chunk.getBiome(pos)

Get the block biome id at `pos`

#### Chunk.setBlockType(pos, id)

Set the block type `id` at `pos`

#### Chunk.setBlockData(pos, data)

Set the block `data` (metadata) at `pos`

#### Chunk.setBlockLight(pos, light)

Set the block `light` at `pos`

#### Chunk.setSkyLight(pos, light)

Set the block sky `light` at `pos`

#### Chunk.setBiome(pos, biome)

Set the block `biome` id at `pos`

#### Chunk.dump()

Returns the chunk raw data

#### Chunk.load(data)

Load raw `data` into the chunk

## History

### 0.1.0

* First version, basic functionality
