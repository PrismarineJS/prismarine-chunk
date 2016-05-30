'use strict';

const w=16;
const l=16;
const h=128;
const BLOCK_DATA_SIZE = w * l * h;
const REGULAR_DATA_SIZE = BLOCK_DATA_SIZE/2;
const SKYLIGHT_DATA_SIZE = BLOCK_DATA_SIZE/2;
const BLOCKLIGHT_DATA_SIZE = BLOCK_DATA_SIZE/2;
const ADDITIONAL_DATA_SIZE_DIRTY = w*l;
const ADDITIONAL_DATA_SIZE_COLOR = w*l*4;
const BUFFER_SIZE = BLOCK_DATA_SIZE + REGULAR_DATA_SIZE + SKYLIGHT_DATA_SIZE + BLOCKLIGHT_DATA_SIZE + ADDITIONAL_DATA_SIZE_COLOR + ADDITIONAL_DATA_SIZE_DIRTY;

const readUInt4LE = require('uint4').readUInt4LE;
const writeUInt4LE = require('uint4').writeUInt4LE;

module.exports = loader;

function loader(mcVersion) {
  Block = require('prismarine-block')(mcVersion);
  Chunk.w=w;
  Chunk.l=l;
  Chunk.h=h;
  return Chunk;
}

var Block;

function exists(val) {
  return val !== undefined;
}


var getArrayPosition = function (pos) {
  return pos.x+w*(pos.z+l*pos.y);
};

var getBlockCursor = function (pos) {
  return getArrayPosition(pos);
};

var getBlockDataCursor = function(pos) {
  return getArrayPosition(pos) * 0.5;
};

var getBlockLightCursor = function(pos) {
  return getArrayPosition(pos) * 0.5;
};

var getSkyLightCursor = function(pos) {
  return getArrayPosition(pos) * 0.5;
};

var getBiomeCursor = function (pos) {
  return ((pos.z * w) + pos.x)*4;
};

var getHeightMapCursor = function (pos) {
  return (pos.z * w) + pos.x;
};

class Chunk {
  constructor() {
    this.blocks = new Buffer(BLOCK_DATA_SIZE);
    this.data = new Buffer(REGULAR_DATA_SIZE);
    this.skyLight = new Buffer(SKYLIGHT_DATA_SIZE);
    this.blockLight = new Buffer(BLOCKLIGHT_DATA_SIZE);
    this.heightMap = new Buffer(ADDITIONAL_DATA_SIZE_DIRTY);
    this.biomeColors = new Buffer(ADDITIONAL_DATA_SIZE_COLOR);

    this.blocks.fill(0);
    this.data.fill(0);
    this.skyLight.fill(0);
    this.blockLight.fill(0);
    this.heightMap.fill(0);
    this.biomeColors.fill(0);
  }

  getBlock(pos) {
    var block = new Block(this.getBlockType(pos), this.getBiome(pos), this.getBlockData(pos));
    block.light = this.getBlockLight(pos);
    block.skyLight = this.getSkyLight(pos);
    return block;
  }

  setBlock(pos, block) {
    if (exists(block.type))
      this.setBlockType(pos, block.type);
    if (exists(block.metadata))
      this.setBlockData(pos, block.metadata);
    if (exists(block.biome))
      this.setBiome(pos, block.biome.id);
    if (exists(block.skyLight))
      this.setSkyLight(pos, block.skyLight);
    if (exists(block.light))
      this.setBlockLight(pos, block.light);
  }

  getBlockType(pos) {
    return this.blocks.readUInt8(getBlockCursor(pos));
  }

  setBlockType(pos, id) {
    this.blocks.writeUInt8(id,getBlockCursor(pos));
  }

  getBlockData(pos) {
    return readUInt4LE(this.data, getBlockDataCursor(pos));
  }

  setBlockData(pos, data) {
    writeUInt4LE(this.data, data, getBlockDataCursor(pos));
  }

  getBlockLight(pos) {
    return readUInt4LE(this.blockLight, getBlockLightCursor(pos));
  }

  setBlockLight(pos, light) {
    writeUInt4LE(this.blockLight, light, getBlockLightCursor(pos));
  }

  getSkyLight(pos) {
    return readUInt4LE(this.skyLight, getSkyLightCursor(pos));
  }

  setSkyLight(pos, light) {
    writeUInt4LE(this.skyLight, light, getSkyLightCursor(pos));
  }

  getBiomeColor(pos) {
    var color = this.biomeColors.readInt32BE(getBiomeCursor(pos)) & 0xFFFFFF;

    return {
      r: (color >> 16),
      g: ((color >> 8) & 0xFF),
      b: (color & 0xFF)
    }
  }

  setBiomeColor(pos, r, g, b) {
    this.biomeColors.writeInt32BE((this.biomeColors.readInt32BE(getBiomeCursor(pos)) & 0xFF000000) | ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0XFF), ((pos.z << 4) + pos.x) * 4);
  }

  getBiome(pos) {
    return (this.biomeColors.readInt32BE(getBiomeCursor(pos)) & 0xFF000000) >> 24;
  }

  setBiome(pos, id) {
    this.biomeColors.writeInt32BE((this.biomeColors.readInt32BE(getBiomeCursor(pos)) & 0xFFFFFF) | (id << 24), ((pos.z << 4) + pos.x) * 4);
  }

  getHeight(pos) {
    return this.heightMap.readUInt8(getHeightMapCursor(pos,value));
  }

  setHeight(pos, value) {
    this.heightMap.writeUInt8(value,getHeightMapCursor(pos));
  }

  load(data) {
    var offset = 0;

    this.blocks = data.slice(0, BLOCK_DATA_SIZE);
    offset += BLOCK_DATA_SIZE;

    this.data = data.slice(offset, REGULAR_DATA_SIZE + offset);
    offset += REGULAR_DATA_SIZE;

    this.skyLight = data.slice(offset, SKYLIGHT_DATA_SIZE + offset);
    offset += SKYLIGHT_DATA_SIZE;

    this.blockLight = data.slice(offset, BLOCKLIGHT_DATA_SIZE + offset);
    offset += BLOCKLIGHT_DATA_SIZE;

    this.heightMap = data.slice(offset, ADDITIONAL_DATA_SIZE_DIRTY + offset);
    offset += ADDITIONAL_DATA_SIZE_DIRTY;

    this.biomeColors = data.slice(offset, ADDITIONAL_DATA_SIZE_COLOR + offset);
    offset += ADDITIONAL_DATA_SIZE_COLOR;

    return offset;
  }

  dump() {
    return Buffer.concat([
      this.blocks,
      this.data,
      this.skyLight,
      this.blockLight,
      this.heightMap,
      this.biomeColors
    ], BUFFER_SIZE);
  }
}
