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
    function(buffer, offset, typeArgs) { //readLongToByte
      var results = this.read(buffer, offset, typeArgs.type, {});
      return {
        value: Math.ceil(results.value * 8),
        size: results.size
      };
    },
    function(value, buffer, offset, typeArgs) { //writeLongToByte
      return this.write(value / 8, buffer, offset, typeArgs.type, {});
    },
    function(value, typeArgs) { //sizeOfLongToByte
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
    //OLD/INTERNAL FORMAT:
    //The first w*l*h*2 bytes are blocks, each of which are shorts.
    //After that, the first w*l*h*0.5 bytes are block-light-levels, each half-bytes.
    //Next, the first w*l*h*0.5 bytes are sky-light-levels, each half-bytes.
    //Finally, the next w*l bytes are biomes.

    let outputBuffer = Buffer.alloc(0);
    let chunkBlocks = Chunk.l * Chunk.w * 16;
    let blockLightStart = Chunk.l * Chunk.w * Chunk.h * 2;
    let skyLightStart = blockLightStart + Chunk.l * Chunk.w * Chunk.h / 2;
    let biomestart = skyLightStart + Chunk.l * Chunk.w * Chunk.h / 2;

	


    for (let y = 0; y < 16; y++) {
      let chunkapp = Chunk.packingProtocol.createPacketBuffer('section', {
        bitsPerBlock: 13,
        palette: [],
        dataArray: this.packBlockData(this.data.slice(y * chunkBlocks * 2, (y + 1) * chunkBlocks * 2), 13),
        blockLight: this.data.slice(blockLightStart + y * chunkBlocks / 2, blockLightStart + (y + 1) * chunkBlocks / 2),
        skyLight: this.data.slice(skyLightStart + y * chunkBlocks / 2, skyLightStart + (y + 1) * chunkBlocks / 2),
      });
      outputBuffer = Buffer.concat([outputBuffer, chunkapp]);
    }

    let ret = Buffer.concat([outputBuffer, this.data.slice(biomestart, biomestart + Chunk.l * Chunk.w)]);
    //console.log(ret.length);
    return ret;
  }
  packBlockData(rawdata, bitsPerBlock) {
    let blockCount = Chunk.l * Chunk.w * 16;
    let resultantBuffer = Buffer.alloc(blockCount * bitsPerBlock / 8 + 4);
    //We have to write very slightly past the end of the file, so we tack on 4 bytes.
    //We'll drop them at the end.
    for (let block = 0; block < blockCount; block++) {
      //Gather and reverse the block data
      let reversedblockdata = this.reverseBits(rawdata.readUInt16LE(block * 2), 16) >>> 3;
      //Determine the start-bit for the block.
      let startbit = block * bitsPerBlock;
      //Determine the start-byte for that bit.
      let startbyte = Math.floor(startbit / 8);
      //Read 4 bytes after that start byte.
      let existingdata = resultantBuffer.readUInt32BE(startbyte);
      //if (reversedblockdata == 0b0000100000000000)
      //	console.log("existing: " + this.padbin(existingdata, 32));
	  //Where are we writing to, in the current bit?
      let localbit = startbit % 8;
      //Bit-shift the raw data into alignment:
      let aligneddata = reversedblockdata << (32 - bitsPerBlock - localbit);
      //if (reversedblockdata == 0b0000100000000000)
      //	console.log("aligned: " + this.padbin(aligneddata, 32));
      //Paste aligned data onto existing data
      let newdata = existingdata | aligneddata;
      //Write data back into buffer:
      resultantBuffer.writeUInt32BE(newdata>>>0, startbyte);
    }

    //now, we jumble: (and we're sure to drop those extra 4 bytes!)
    let jumbledBuffer = Buffer.alloc(resultantBuffer.length - 4);
    for (let l = 0; l < jumbledBuffer.length; l += 8) {
      //Load the long
      let longleftjumbled = resultantBuffer.readUInt32BE(l);
      let longrightjumbled = resultantBuffer.readUInt32BE(l + 4);
      //Write in reverse order -- flip bits by using little endian.
      jumbledBuffer.writeInt32BE(this.reverseBits(longrightjumbled, 32), l);
      jumbledBuffer.writeInt32BE(this.reverseBits(longleftjumbled, 32), l + 4);
    }
    return jumbledBuffer;
  }
  
  reverseBits(data, n) {
   let datau = data >>> 0;//Coerce unsigned.
   let storage = 0;
   for (let i = 0; i < n; i++) {
     storage = storage | (datau & 1);
     if (i != n - 1) {
       storage = storage << 1;
       datau = datau >>> 1;
     }
   }
   return storage;
 }

  /*Debuggery
  padbin(num, len=32) {
    var s = (num >>> 0).toString(2);
    while (s.length < len) s = "0" + s;
    return s;
   }
   */

  load(data, bitMap=0xFFFF) {
    let unpackeddata = this.unpackChunkData(data, bitMap);
    if (!Buffer.isBuffer(unpackeddata))
      throw (new Error('Data must be a buffer'));
    if (unpackeddata.length != BUFFER_SIZE)
      throw (new Error('Data buffer not correct size (was ' + unpackeddata.length + ', expected ' + BUFFER_SIZE + ')'));
    this.data = unpackeddata;
  }

  unpackChunkData(chunk, bitMap) {
    let offset = 0;
    let chunkBlocks = Chunk.l * Chunk.w * 16;
    let blockLightStart = Chunk.l * Chunk.w * Chunk.h * 2;
    let skyLightStart = blockLightStart + Chunk.l * Chunk.w * Chunk.h / 2;
    let biomestart = skyLightStart + Chunk.l * Chunk.w * Chunk.h / 2;
    
    let newBuffer = Buffer.alloc(BUFFER_SIZE);

    for (let y = 0; y < 16; y++) {
      let blocksAddition;
      let blocklightsAddition;
      let skylightsAddition;
      if (((bitMap >> y) & 1) == 1) {
        const {
          size,
          value
        } = this.readSection(chunk.slice(offset));
        offset += size;
        blocksAddition = this.eatPackedBlockLongs(value.dataArray, value.palette, value.bitsPerBlock);
        blocklightsAddition = value.blockLight;
        skylightsAddition = value.skyLight;
      } else { //If a chunk is skipped, we'll just fill with existing data.
        blocksAddition = this.data.slice(y * chunkBlocks * 2, (y + 1) * chunkBlocks * 2);
        blocklightsAddition = this.data.slice(blockLightStart + y * chunkBlocks / 2, blockLightStart + (y + 1) * chunkBlocks / 2);
        skylightsAddition = this.data.slice(skyLightStart + y * chunkBlocks / 2, skyLightStart + (y + 1) * chunkBlocks / 2);
      }
      blocksAddition.copy(newBuffer, y * chunkBlocks*2);
      blocklightsAddition.copy(newBuffer, blockLightStart + y * chunkBlocks/2);
      skylightsAddition.copy(newBuffer, skyLightStart + y * chunkBlocks/2);
    }
    if (bitMap == 0xFFFF){
      chunk.slice(chunk.length - 256).copy(newBuffer, biomestart);
    }
    return newBuffer;
  }

  readSection(section) {
    try {
      return Chunk.packingProtocol.read(section, 0, 'section', {});
    } catch (e) {
      e.message = `Read error for ${e.field} : ${e.message}`;
      throw e;
    }
  }

  
  //Simplified eatPackedBlockLongs Algorithm
  eatPackedBlockLongs(rawBuffer, palette, bitsPerBlock) {
    //The critical problem is that the internal order of each long is opposite to the organizational order of the longs
    //This is easily fixed by flipping the order of the longs.
    //Therefore, we will read 4 bytes at a time, bit-flip them, and write them into a new buffer.
    //From there, the old algorithm for reading will work just fine, we don't even have to consider the existence of the longs anymore.
    //A major side-effect, though, is that all of the internal block-datas will be flipped, so we have to flip them again before extracting data.
    let unjumbledBuffer = Buffer.alloc(rawBuffer.length);
    for (let l = 0; l < rawBuffer.length; l += 8) {
      //Load the long
      
      let longleftjumbled = rawBuffer.readUInt32BE(l);
      let longrightjumbled = rawBuffer.readUInt32BE(l + 4);
      //Write in reverse order
      
      unjumbledBuffer.writeInt32BE(this.reverseBits(longrightjumbled, 32), l);
      unjumbledBuffer.writeInt32BE(this.reverseBits(longleftjumbled, 32), l + 4);
    }


    let blockCount = unjumbledBuffer.length * 8 / bitsPerBlock;
    let resultantBuffer = Buffer.alloc(blockCount * 2);
    let localBit = 0;

    for (let block = 0; block < blockCount; block++) {
      //Determine the start-bit for the block.
      let bit = block * bitsPerBlock;
      //Determine the start-byte for that bit.
      let targetbyte = Math.floor(bit / 8);

      //Read a 32-bit section surrounding the targeted block

      let datatarget = unjumbledBuffer.readUInt32BE(targetbyte, true);
      //console.log(":");
      //console.log(this.padbin(aligneddata,32));

      //Determine the start bit local to the datatarget.
      let localbit = bit % 8;

      //Chop off uninteresting bits, then shift interesting region to the end of the bit-buffer. Reverse the bits when done
      
      let paletteid = this.reverseBits((datatarget << localbit) >>> (32 - bitsPerBlock), bitsPerBlock);
	  
      //console.log(this.padbin(paletteid, 32));


      //Grab the data from the palette
      let palettedata = paletteid;
      if (palette.length != 0)
        palettedata = palette[paletteid];
      let data = palettedata & 0b1111;
      let id = palettedata >>> 4;
      resultantBuffer.writeUInt16LE((id << 4) | data, block * 2);
    }
    return resultantBuffer;
  }
}