'use strict';

const SubChunk = require('./subchunk');
const Vec3 = require('vec3');

const BIOME_ID_SIZE = 256;
const HEIGHT_SIZE = 256 * 2;

const BUFFER_SIZE = BIOME_ID_SIZE + HEIGHT_SIZE;

module.exports = loader;

function loader(mcVersion) {
  Block = require('prismarine-block')("0.15");
  Chunk.w = w;
  Chunk.l = l;
  Chunk.h = h;
  Chunk.BUFFER_SIZE = BUFFER_SIZE;
  return Chunk;
}

var Block;

class Chunk {
  construct() {
    this.chunks = new Array(16);
    this.chunks.fill(new SubChunk());

    this.data = new Buffer(BUFFER_SIZE);

    // init biome id
    for (var i = 0; i < 256; i++) {
      this.data[i] = 1;
    }
  }

  getBlock() {
    var block = new Block(this.getBlockType(pos), this.getBiome(pos), this.getBlockData(pos));
    block.light = this.getBlockLight(pos);
    block.skyLight = this.getSkyLight(pos);
    return block;
  }

  setBlock() {
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
    var chunk = this.chunks[pos.y >> 4]
    return chunk.getBlockType(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z));
  }

  setBlockType(pos, type) {
    var chunk = this.chunks[by >> 4];
    chunk.setBlockType(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z), type);
  }

  getBlockData(pos) {
    var chunk = this.chunks[pos.y >> 4]
    return chunk.getBlockData(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z));
  }

  setBlockData(pos, data) {
    var chunk = this.chunks[by >> 4];
    chunk.setBlockData(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z), data);
  }

  getBlockLight(pos) {
    var chunk = this.chunks[pos.y >> 4]
    return chunk.getBlockLight(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z));
  }

  setBlockLight(pos, light) {
    var chunk = this.chunks[by >> 4];
    chunk.setBlockLight(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z), light);
  }

  getSkyLight(pos) {
    var chunk = this.chunks[pos.y >> 4]
    return chunk.getSkyLight(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z));
  }

  setSkyLight(pos, light) {
    var chunk = this.chunks[by >> 4];
    chunk.setSkyLight(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z), light);
  }

  getBiomeColor(pos) {
    
  }

  setBiomeColor(pos, r, g, b) {
    
  }

  getBiome(pos) {
    
  }

  setBiome(pos, id) {
    
  }

  getHeight(pos) {
    
  }

  load(data) {

  }

  size() {
    var size = 1; // count of subchunks (byte)
    size += (this.chunks.length * 10240); // all of the chunks and their size
    size += HEIGHT_SIZE;
    size += BIOME_ID_SIZE; 
    size += 1; // border block count (byte)
    size += 1; // signed varint block extradata count

    return size;
  }

  dump() {
    var offset = 0;
    var data = new Buffer(this.size());
    data.writeUInt8(this.chunks.length, offset);
    offset += 1;
    for (var i = 0; i < this.chunks.length; i++) {
      var dump = this.chunks[i].dump();
      dump.copy(data, offset);
      offset += dump.length;
    }
    this.data.copy(data, offset);
    offset += this.data.length;
    data.writeUInt8(0, offset) // border block count
    offset += 1;
    data.writeUInt8(0, offset) // signed varint ?! (extdata count)
    offset += 1;
    return data;
  }
}