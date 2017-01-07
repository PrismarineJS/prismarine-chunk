const w = 16;
const l = 16;
const h = 256;

const BUFFER_SIZE = (w * l * h * 3) + w * l;

const ProtoDef = require('protodef').ProtoDef;
var { readUInt4LE, writeUInt4LE } = require('uint4');

module.exports = loader;

function loader(mcVersion) {
  Block = require('prismarine-block')(mcVersion);
  
  // MC counts the longs, protodef wants the bytes. This is responsible for that conversion.
  let longToByte = [
    function (buffer, offset, typeArgs) { //readLongToByte
      var results = this.read(buffer, offset, typeArgs.type, {});
      return {
        value: Math.ceil(results.value * 8),
        size: results.size
      };
    },
    function (value, buffer, offset, typeArgs) { //writeLongToByte
      return this.write(value / 8, buffer, offset, typeArgs.type, {});
    },
    function (value, typeArgs) { //sizeOfLongToByte
      return this.sizeOf(value / 8, typeArgs.type, {});
    }
  ];

  let p = ["container", [{
      "name": "bitsPerBlock",
      "type": "u8"
    },
    {
      "name": "palette",
      "type": ["array", {
        "type": "varint",
        "countType": "varint"
      }]
    },
    {
      "name": "dataArray",
      "type": ["buffer", {
        "countType": "longToByte",
        "countTypeArgs": {
          "type": "varint"
        }
      }]
    },
    {
      "name": "blockLight",
      "type": ["buffer", {
        "count": 16 * 16 * 16 / 2
      }]
    },
    {
      "name": "skyLight",
      "type": ["buffer", {
        "count": 16 * 16 * 16 / 2
      }]
    }
  ]];

  Chunk.packingProtocol = new ProtoDef();
  Chunk.packingProtocol.addType('longToByte', longToByte);
  Chunk.packingProtocol.addType('section', p);


  Chunk.w = w;
  Chunk.l = l;
  Chunk.h = h;
  Chunk.BUFFER_SIZE = BUFFER_SIZE;
  return Chunk;
}

var Block;

var exists = function(val) {
  return val !== undefined;
};


var getArrayPosition = function(pos) {
  return pos.x + w * (pos.z + l * pos.y);
};

var getBlockCursor = function(pos) {
  return getArrayPosition(pos) * 2.0;
};

var getBlockLightCursor = function(pos) {
  return getArrayPosition(pos) * 0.5 + w * l * h * 2;
};

var getSkyLightCursor = function(pos) {
  return getArrayPosition(pos) * 0.5 + w * l * h / 2 * 5;
};

var getBiomeCursor = function(pos) {
  return (w * l * h * 3) + (pos.z * w) + pos.x;
};


class Chunk {

  constructor() {
    this.data = new Buffer(BUFFER_SIZE);
    this.data.fill(0);
  }

  initialize(iniFunc) {
    const skylight = w * l * h / 2 * 5;
    const light = w * l * h * 2;
    let biome = (w * l * h * 3) - 1;
    let n = 0;
    for (let y = 0; y < h; y++) {
      for (let z = 0; z < w; z++) {
        for (let x = 0; x < l; x++, n++) {
          if (y == 0)
            biome++;
          const block = iniFunc(x, y, z, n);
          if (block == null)
            continue;
          this.data.writeUInt16LE(block.type << 4 | block.metadata, n * 2);
          writeUInt4LE(this.data, block.light, n * 0.5 + light);
          writeUInt4LE(this.data, block.skyLight, n * 0.5 + skylight);
          if (y == 0) {
            this.data.writeUInt8(block.biome.id || 0, biome);
          }
        }
      }
    }
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

  getBiomeColor(pos) {
    // polyfill
    return {
      r: 0,
      g: 0,
      b: 0
    }
  }

  setBiomeColor(pos, r, g, b) {
    // polyfill
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

  load(data, bitMap) {
    let unpackeddata = this.unpackChunkData(data, bitMap);
    if (!Buffer.isBuffer(unpackeddata))
      throw (new Error('Data must be a buffer'));
    if (unpackeddata.length != BUFFER_SIZE)
      throw (new Error(`Data buffer not correct size \(was ${data.length}, expected ${BUFFER_SIZE}\)`));
    this.data = unpackeddata;
  }

  unpackChunkData(chunk, bitMap) {
    let offset = 0;
    let blocks = Buffer.alloc(0); //byte buffer containing shorts
    let blocklights = Buffer.alloc(0); //byte buffer containing half-bytes
    let skylights = Buffer.alloc(0); //byte buffer containing half-bytes
    let biomes;

    for (let y = 0; y < 16; y++) {
      if (((bitMap >> y) & 1) == 1) {
        const {
          size,
          value
        } = this.readSection(chunk.slice(offset));
        offset += size;
        blocks = Buffer.concat([blocks, this.eatPackedBlockLongs(value.dataArray, value.palette, value.bitsPerBlock)])
        blocklights = Buffer.concat([blocklights, value.blockLight]);
        skylights = Buffer.concat([skylights, value.skyLight]);
      } else { //Old format expects *all* blocks to be present, so if the new format omits a section, we must fill with zeroes.
        blocks = Buffer.concat([blocks, Buffer.alloc(16 * 16 * 16 * 2)]);
        blocklights = Buffer.concat([blocklights, Buffer.alloc(16 * 16 * 16 / 2)]);
        skylights = Buffer.concat([skylights, Buffer.alloc(16 * 16 * 16 / 2)]);
      }
      biomes = chunk.slice(offset, offset + 256); //Does this really generate valid biome data?
    }
    //Desired output format:
    //{Blocks as shorts}{Block Light as half-bytes}{Sky Light as half-bytes}{biomes as bytes}
    return Buffer.concat([blocks, blocklights, skylights, biomes]);
  }

  readSection(section) {
    try {
      return Chunk.packingProtocol.read(section, 0, 'section', {});
    } catch (e) {
      e.message = `Read error for ${e.field} : ${e.message}`;
      throw e;
    }
  }

  eatPackedBlockLongs(rawBuffer, palette, bitsPerBlock) {
    let blockCount = rawBuffer.length * 8 / bitsPerBlock;
    let resultantBuffer = Buffer.alloc(blockCount * 2)
    let localBit = 0;

    for (let block = 0; block < blockCount; block++) {
      //Determine the start-bit for the block.
      let bit = block * bitsPerBlock;
      //Determine the start-byte for that bit.
      let targetbyte = Math.floor(bit / 8);

      //Read a 32-bit section surrounding the targeted block
      let datatarget = rawBuffer.readUInt32BE(targetbyte, true);

      //Determine the start bit local to the datatarget.
      let localbit = bit % 8;

      //Chop off uninteresting bits, then shift to that start bit:
      let paletteid = (datatarget << (32 - localbit - bitsPerBlock)) >>> (32 - bitsPerBlock);

      //Grab the data from the pallette
      let data = palette[paletteid] & 0b1111;
      let id = palette[paletteid] >>> 4;
      resultantBuffer.writeUInt16LE((id << 4) | data, block * 2);
    }
    return resultantBuffer;
  }
}