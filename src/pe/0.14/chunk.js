'use strict';

const BLOCK_DATA_SIZE = 16 * 16 * 128;
const REGULAR_DATA_SIZE = 16384;
const SKYLIGHT_DATA_SIZE = 16384;
const BLOCKLIGHT_DATA_SIZE = 16384;
const ADDITIONAL_DATA_SIZE_DIRTY = 256;
const ADDITIONAL_DATA_SIZE_COLOR = 1024;
const BUFFER_SIZE = BLOCK_DATA_SIZE + REGULAR_DATA_SIZE + SKYLIGHT_DATA_SIZE + BLOCKLIGHT_DATA_SIZE + ADDITIONAL_DATA_SIZE_COLOR + ADDITIONAL_DATA_SIZE_DIRTY;

const readUInt4LE = require('uint4').readUInt4LE;
const writeUInt4LE = require('uint4').writeUInt4LE;

module.exports = loader;

function loader(mcVersion) {
  Block = require('prismarine-block')(mcVersion);
  return Chunk;
}

var Block;

function exists(val) {
  return val !== undefined;
}


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
    return this.blocks[pos.x + 16 * (pos.z + 16 * pos.y)] & 0xff;
  }

  setBlockType(pos, id) {
    this.blocks[pos.x + 16 * (pos.z + 16 * pos.y)] = id;
  }

  getBlockData(pos) {
    return readUInt4LE(this.data, (pos.x + 16 * (pos.z + 16 * pos.y)) * 0.5);
  }

  setBlockData(pos, data) {
    writeUInt4LE(this.data, data, (pos.x + 16 * (pos.z + 16 * pos.y)) * 0.5);
  }

  getBlockLight(pos) {
    return readUInt4LE(this.blockLight, (pos.x + 16 * (pos.z + 16 * pos.y)) * 0.5);
  }

  setBlockLight(pos, light) {
    writeUInt4LE(this.blockLight, light, (pos.x + 16 * (pos.z + 16 * pos.y)) * 0.5);
  }

  getSkyLight(pos) {
    return readUInt4LE(this.skyLight, (pos.x + 16 * (pos.z + 16 * pos.y)) * 0.5);
  }

  setSkyLight(pos, light) {
    writeUInt4LE(this.skyLight, light, (pos.x + 16 * (pos.z + 16 * pos.y)) * 0.5);
  }

  getBiomeColor(pos) {
    var color = this.biomeColors.readInt32BE(((pos.z << 4) + pos.x) * 4) & 0xFFFFFF;

    return {
      r: (color >> 16),
      g: ((color >> 8) & 0xFF),
      b: (color & 0xFF)
    }
  }

  setBiomeColor(pos, r, g, b) {
    this.biomeColors.writeInt32BE((this.biomeColors.readInt32BE(((pos.z << 4) + pos.x) * 4) & 0xFF000000) | ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0XFF), ((pos.z << 4) + pos.x) * 4);
  }

  getBiome(pos) {
    return (this.biomeColors.readInt32BE(((pos.z << 4) + pos.x) * 4) & 0xFF000000) >> 24;
  }

  setBiome(pos, id) {
    this.biomeColors.writeInt32BE((this.biomeColors.readInt32BE(((pos.z << 4) + pos.x) * 4) & 0xFFFFFF) | (id << 24), ((pos.z << 4) + pos.x) * 4);
  }

  setHeight(pos, value) {
    this.heightMap[(pos.z << 4) + pos.x] = value;
  }

  getHeight(pos) {
    return this.heightMap[(pos.z << 4) + pos.x];
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


  static get height() {
    return 128;
  }

  static get length() {
    return 16;
  }

  static get width() {
    return 16;
  }
}
