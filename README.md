# prismarine-chunk

[![NPM version](https://img.shields.io/npm/v/prismarine-chunk.svg)](http://npmjs.com/package/prismarine-chunk)
[![Build Status](https://img.shields.io/circleci/project/github/PrismarineJS/prismarine-chunk/master.svg)](https://circleci.com/gh/PrismarineJS/prismarine-chunk)
[![Discord](https://img.shields.io/badge/chat-on%20discord-brightgreen.svg)](https://discord.gg/GsEFRM8)
[![Gitter](https://img.shields.io/badge/chat-on%20gitter-brightgreen.svg)](https://gitter.im/PrismarineJS/general)
[![Irc](https://img.shields.io/badge/chat-on%20irc-brightgreen.svg)](https://irc.gitter.im/)
[![Greenkeeper badge](https://badges.greenkeeper.io/PrismarineJS/prismarine-chunk.svg)](https://greenkeeper.io/)

A class to hold chunk data for Minecraft: PC 1.8, 1.9, 1.10, 1.11, 1.12 and 1.13 and Pocket Edition 0.14 and 1.0

## Usage

```js
const Chunk = require('prismarine-chunk')("1.8")
const Vec3 = require("vec3")

const chunk=new Chunk()

for (let x = 0; x < 16;x++) {
  for (let z = 0; z < 16; z++) {
    chunk.setBlockType(new Vec3(x, 50, z), 2)
    for (let y = 0; y < 256; y++) {
      chunk.setSkyLight(new Vec3(x, y, z), 15)
    }
  }
}

console.log(JSON.stringify(chunk.getBlock(new Vec3(3,50,3)),null,2))
```

## Test data

Test data can be generated with [minecraftChunkDumper](https://github.com/PrismarineJS/minecraft-chunk-dumper).

Install it globally with `npm install minecraft-chunk-dumper -g` then run :

`minecraftChunkDumper saveChunk 1.8.8 1.8/chunk.dump 1.8/chunk.meta`

## Benchmarking

Benchmarks may be run by using:
```bash
# run benchmarks once
npm run benchmark

# run benchmarks continuously, reloading changes as they are made
npm run benchmark -- --watch
```

The output of the benchmarking will be placed in the file `benchmarks/results/chunk-1.9.csv`

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

#### Chunk.getBlockStateId(pos)

Get the block state id at `pos`

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

#### Chunk.setBlockStateId(pos, stateId)

Set the block type `stateId` at `pos`

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

#### Chunk.load(data,bitmap=0xFFFF,skyLightSent = true)

Load raw `data` into the chunk
