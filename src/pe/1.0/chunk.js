'use strict';

const SubChunk = require('./subchunk');
const Vec3 = require('vec3');

const BIOME_ID_SIZE = 256;
const HEIGHT_SIZE = 256 * 2;

const BUFFER_SIZE = BIOME_ID_SIZE + HEIGHT_SIZE;

module.exports = loader;

function loader(mcVersion) {
  Block = require('prismarine-block')(mcVersion);
  Chunk.w = 16;
  Chunk.l = 16;
  Chunk.h = 256;
  Chunk.BUFFER_SIZE = 3 + 256 + 512 + (16 * 10240);
  return Chunk;
}

var Block;

function getOffset(pos) {
	return (pos.x * 16 + pos.z) * 256 + pos.y;
}

function exists(val) {
  return val !== undefined;
}

class Chunk {
  constructor() {
    this.chunks = new Array(16);
    this.chunks.fill(new SubChunk());

    this.data = new Buffer(BUFFER_SIZE);
    this.data.fill(0);

    // init biome id
    for (var i = 0; i < 256; i++) {
      this.data[i] = 1;
    }
  }

  getBlock(pos)  {
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
    var chunk = this.chunks[pos.y >> 4]
    return chunk.getBlockType(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z));
  }

  setBlockType(pos, type) {
	  //console.log(pos.y >> 4);
    var chunk = this.chunks[pos.y >> 4];
	  //console.log(chunk);
    chunk.setBlockType(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z), type);
  }

  getBlockData(pos) {
    var chunk = this.chunks[pos.y >> 4]
    return chunk.getBlockData(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z));
  }

  setBlockData(pos, data) {
    var chunk = this.chunks[pos.y >> 4];
    chunk.setBlockData(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z), data);
  }

  getBlockLight(pos) {
    var chunk = this.chunks[pos.y >> 4]
    return chunk.getBlockLight(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z));
  }

  setBlockLight(pos, light) {
    var chunk = this.chunks[pos.y >> 4];
    chunk.setBlockLight(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z), light);
  }

  getSkyLight(pos) {
    var chunk = this.chunks[pos.y >> 4]
    return chunk.getSkyLight(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z));
  }

  setSkyLight(pos, light) {
    var chunk = this.chunks[pos.y >> 4];
    chunk.setSkyLight(new Vec3(pos.x, pos.y - 16 * (pos.y >> 4), pos.z), light);
  }

  getBiomeColor(pos) {
    return { x: 0, y: 0, z: 0 }
  }

  setBiomeColor(pos, r, g, b) {
    // no longer a feature ;(
  }

  getBiome(pos) {
    return this.data.readUInt8((pos.z << 4) + (pos.x));
  }

  setBiome(pos, id) {
    this.data.writeUInt8(id, (pos.z << 4) + (pos.x));
  }

  getHeight(pos) {
    return this.data.readUInt8((pos.z << 4) + (pos.x));
  }

  setHeight(pos, height) {
    this.data.writeUInt8(height, (pos.z << 4) + (pos.x));
  }

  load(data) {
    if (!Buffer.isBuffer(data))
      throw(new Error('Data must be a buffer'));
    
    var offset = 0;
    var numberOfChunks = data.readUInt8(offset);
    offset += 1;
	  //console.log(numberOfChunks);
    
    for(var i = 0; i < numberOfChunks; i++) {
      this.chunks[i].load(data.slice(offset, offset + 10240));
      offset += 10240
    }
    // ignore the rest ??
  }

  size() {
    var size = 1; // count of subchunks (byte)
    size += this.chunks.length * 10240; // all of the chunks and their size
    size += HEIGHT_SIZE;
    size += BIOME_ID_SIZE; 
    size += 1; // border block count (byte)
    size += 1; // signed varint block extradata count
    //console.log(size);
    return size;
  }

  dump() {
    var offset = 0;
    var data = new Buffer(this.size());
    this.data.fill(0);

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
