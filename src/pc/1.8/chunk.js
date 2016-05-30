const w=16;
const l=16;
const h=256;

const BUFFER_SIZE = (w * l * h * 3) + w*l;

var { readUInt4LE, writeUInt4LE } = require('uint4');

module.exports = loader;

function loader(mcVersion) {
  Block = require('prismarine-block')(mcVersion);
  Chunk.w=w;
  Chunk.l=l;
  Chunk.h=h;
  return Chunk;
}

var Block;

var exists = function (val) {
  return val !== undefined;
};


var getArrayPosition = function (pos) {
  return pos.x+w*(pos.z+l*pos.y);
};

var getBlockCursor = function (pos) {
  return getArrayPosition(pos) * 2.0;
};

var getBlockLightCursor = function(pos) {
    return getArrayPosition(pos) * 0.5 + w * l * h*2;
};

var getSkyLightCursor = function(pos) {
  return getArrayPosition(pos) * 0.5 + w * l * h/2*5;
};

var getBiomeCursor = function (pos) {
  return (w * l * h * 3) + (pos.z * w) + pos.x;
};


class Chunk {

  constructor() {
    this.data = new Buffer(BUFFER_SIZE);
    this.data.fill(0);
  }

  initialize(iniFunc) {
    const skylight=w * l * h/2*5;
    const light=w * l * h*2;
    let biome=(w * l * h * 3)-1;
    let n=0;
    for(let y=0;y<h;y++) {
      for(let z=0;z<w;z++) {
        for(let x=0;x<l;x++,n++) {
          if(y==0)
            biome++;
          const block=iniFunc(x,y,z,n);
          if(block==null)
            continue;
          this.data.writeUInt16LE(block.type<<4 | block.metadata,n*2);
          writeUInt4LE(this.data, block.light, n*0.5+light);
          writeUInt4LE(this.data, block.skyLight, n*0.5+skylight);
          if(y==0) {
            this.data.writeUInt8(block.biome.id || 0, biome);
          }
        }
      }
    }
  };

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
    var cursor = getBlockCursor(pos);
    return this.data.readUInt16LE(cursor) >> 4;
  }

  getBlockData(pos) {
    var cursor = getBlockCursor(pos);
    return this.data.readUInt16LE(cursor) & 15;
  }

  getBlockLight(pos) {
    var cursor = getBlockLightCursor(pos);
    return readUInt4LE(this.data, cursor);
  }

  getSkyLight(pos) {
    var cursor = getSkyLightCursor(pos);
    return readUInt4LE(this.data, cursor);
  }

  getBiome(pos) {
    var cursor = getBiomeCursor(pos);
    return this.data.readUInt8(cursor);
  }

  setBlockType(pos, id) {
    var cursor = getBlockCursor(pos);
    var data = this.getBlockData(pos);
    this.data.writeUInt16LE((id << 4) | data, cursor);
  }

  setBlockData(pos, data) {
    var cursor = getBlockCursor(pos);
    var id = this.getBlockType(pos);
    this.data.writeUInt16LE((id << 4) | data, cursor);
  }

  setBlockLight(pos, light) {
    var cursor = getBlockLightCursor(pos);
    writeUInt4LE(this.data, light, cursor);
  }

  setSkyLight(pos, light) {
    var cursor = getSkyLightCursor(pos);
    writeUInt4LE(this.data, light, cursor);
  }

  setBiome(pos, biome) {
    var cursor = getBiomeCursor(pos);
    this.data.writeUInt8(biome, cursor);
  }

  dump() {
    return this.data;
  }


  load(data) {
    if (!Buffer.isBuffer(data))
      throw(new Error('Data must be a buffer'));
    if (data.length != BUFFER_SIZE)
      throw(new Error(`Data buffer not correct size \(was ${data.length}, expected ${BUFFER_SIZE}\)`));
    this.data = data;
  }
}

