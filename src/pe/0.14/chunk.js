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
  return BLOCK_DATA_SIZE+getArrayPosition(pos) * 0.5;
};

var getBlockLightCursor = function(pos) {
  return BLOCK_DATA_SIZE+REGULAR_DATA_SIZE+getArrayPosition(pos) * 0.5;
};

var getSkyLightCursor = function(pos) {
  return BLOCK_DATA_SIZE+REGULAR_DATA_SIZE+SKYLIGHT_DATA_SIZE+getArrayPosition(pos) * 0.5;
};

var getHeightMapCursor = function (pos) {
  return BLOCK_DATA_SIZE+REGULAR_DATA_SIZE+SKYLIGHT_DATA_SIZE+BLOCKLIGHT_DATA_SIZE+(pos.z * w) + pos.x;
};

var getBiomeCursor = function (pos) {
  return BLOCK_DATA_SIZE+REGULAR_DATA_SIZE+SKYLIGHT_DATA_SIZE+BLOCKLIGHT_DATA_SIZE+ADDITIONAL_DATA_SIZE_DIRTY+((pos.z * w) + pos.x)*4;
};


class Chunk {
  constructor() {
    this.buffer = new Buffer(BUFFER_SIZE);

    this.buffer.fill(0);
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
    return this.buffer.readUInt8(getBlockCursor(pos));
  }

  setBlockType(pos, id) {
    this.buffer.writeUInt8(id,getBlockCursor(pos));
  }

  getBlockData(pos) {
    return readUInt4LE(this.buffer, getBlockDataCursor(pos));
  }

  setBlockData(pos, data) {
    writeUInt4LE(this.buffer, data, getBlockDataCursor(pos));
  }

  getBlockLight(pos) {
    return readUInt4LE(this.buffer, getBlockLightCursor(pos));
  }

  setBlockLight(pos, light) {
    writeUInt4LE(this.buffer, light, getBlockLightCursor(pos));
  }

  getSkyLight(pos) {
    return readUInt4LE(this.buffer, getSkyLightCursor(pos));
  }

  setSkyLight(pos, light) {
    writeUInt4LE(this.buffer, light, getSkyLightCursor(pos));
  }

  getBiomeColor(pos) {
    var color = this.buffer.readInt32BE(getBiomeCursor(pos)) & 0xFFFFFF;

    return {
      r: (color >> 16),
      g: ((color >> 8) & 0xFF),
      b: (color & 0xFF)
    }
  }

  setBiomeColor(pos, r, g, b) {
    this.buffer.writeInt32BE((this.buffer.readInt32BE(getBiomeCursor(pos)) & 0xFF000000)
      | ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0XFF), getBiomeCursor(pos));
  }

  getBiome(pos) {
    return (this.buffer.readInt32BE(getBiomeCursor(pos)) & 0xFF000000) >> 24;
  }

  setBiome(pos, id) {
    this.buffer.writeInt32BE((this.buffer.readInt32BE(getBiomeCursor(pos)) & 0xFFFFFF) | (id << 24), getBiomeCursor(pos));
  }

  getHeight(pos) {
    return this.buffer.readUInt8(getHeightMapCursor(pos,value));
  }

  setHeight(pos, value) {
    this.buffer.writeUInt8(value,getHeightMapCursor(pos));
  }

  load(data) {
    this.buffer=data;
  }

  dump() {
    return this.buffer;
  }
}
