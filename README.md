# prismarine-chunk

[![NPM version](https://img.shields.io/npm/v/prismarine-chunk.svg)](http://npmjs.com/package/prismarine-chunk)
[![Build Status](https://img.shields.io/circleci/project/PrismarineJS/prismarine-chunk/master.svg)]
(https://circleci.com/gh/PrismarineJS/prismarine-chunk)
[![Join the chat at https://gitter.im/PrismarineJS/prismarine-chunk]
(https://img.shields.io/badge/gitter-join%20chat-brightgreen.svg)]
(https://gitter.im/PrismarineJS/prismarine-chunk)

A class to hold chunk data for Minecraft: PC 1.8, 1.9 and Pocket Edition 0.14 and 1.0

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

#### Chunk.initialize(iniFunc)

Initialize a chunk.
* `iniFunc` is a function(x,y,z) returning a prismarine-block.

That function is faster than iterating and calling the setBlock* manually. It is useful to generate a whole chunk and load a whole chunk.

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

#### Chunk.getBiomeColor(pos)

Get the block biome color at `pos`. Does nothing for PC.

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

#### Chunk.setBiomeColor(pos, biomeColor)

Set the block `biomeColor` at `pos`. Does nothing for PC.

#### Chunk.dump(bitmap=0xFFFF)

Returns the chunk raw data

#### Chunk.load(data,bitmap=0xFFFF)

Load raw `data` into the chunk

## History

### 1.4.0

* supports mcpc 1.9 (thanks @Flynnn)

### 1.3.0

* supports bitmap in load and dump in 1.8, default to bitmap == 0xFFFF

### 1.2.0

* support MCPE 1.0 chunks

### 1.1.0

* support MCPE 0.14 chunks

### 1.0.1

* update to babel6

### 1.0.0

* bump dependencies

### 0.3.2

* simplify and fix initialize

### 0.3.1

* fix iniPos in initialize

### 0.3.0

* add Chunk.initialize, useful for fast generation

### 0.2.1

 * fix the badge

### 0.2.0

 * use vec3
 * add an example + doc
 * use prismarine-block

### 0.1.0

* First version, basic functionality
