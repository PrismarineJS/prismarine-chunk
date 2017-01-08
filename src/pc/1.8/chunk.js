const Section=require('./section');
const Vec3 = require("vec3").Vec3;

const w=Section.w;
const l=Section.l;
const sh=Section.sh;//section height
const sectionCount=16;
const h=sh*sectionCount;

const SECTION_SIZE=Section.SECTION_SIZE;
const BIOME_SIZE=w*l;
const BUFFER_SIZE = SECTION_SIZE*sectionCount + BIOME_SIZE; // max

module.exports = loader;

function loader(mcVersion) {
  Block = require('prismarine-block')(mcVersion);
  Chunk.w=w;
  Chunk.l=l;
  Chunk.h=h;
  Chunk.BUFFER_SIZE=BUFFER_SIZE;
  return Chunk;
}

let Block;

const exists = function (val) {
  return val !== undefined;
};

const getBiomeCursor = function (pos) {
  return (pos.z * w) + pos.x;
};

function posInSection(pos) {
  return pos.modulus(new Vec3(w,l,sh))
}

function parseBitMap(bitMap) {
  const chunkIncluded = new Array(sectionCount);
  let chunkCount=0;
  for(let y = 0; y < sectionCount; ++y) {
    chunkIncluded[y] = bitMap & (1 << y);
    if(chunkIncluded[y]) chunkCount++;
  }
  return {chunkIncluded,chunkCount};
}

class Chunk {

  constructor() {
    this.sections=new Array(sectionCount);
    for(let i=0;i<sectionCount;i++)
      this.sections[i]=new Section()
    this.biome=new Buffer(BIOME_SIZE);
    this.biome.fill(0);
  }

  initialize(iniFunc) {
    let biome=-1;
    for(let i=0;i<sectionCount;i++) {
      this.sections.initialize((x,y,z,n) => {
        let block= iniFunc(x,y%sh,z,n);
        if(block==null)
          return;
        if(y==0) {
          biome++;
          this.biome.writeUInt8(block.biome.id || 0, biome);
        }
      });
    }
  }

  getBlock(pos) {
    const block = new Block(this.getBlockType(pos), this.getBiome(pos), this.getBlockData(pos));
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
    return {
      r: 0,
      g: 0,
      b: 0
    }
  }

  setBiomeColor(pos, r, g, b) {

  }

  _getSection(pos) {
    return this.sections[pos.y>>4];
  }

  getBlockType(pos) {
    return this._getSection(pos).getBlockType(posInSection(pos));
  }

  getBlockData(pos) {
    return this._getSection(pos).getBlockData(posInSection(pos));
  }

  getBlockLight(pos) {
    return this._getSection(pos).getBlockLight(posInSection(pos));
  }

  getSkyLight(pos) {
    return this._getSection(pos).getSkyLight(posInSection(pos));
  }

  getBiome(pos) {
    const cursor = getBiomeCursor(pos);
    return this.biome.readUInt8(cursor);
  }

  setBlockType(pos, id) {
    this._getSection(pos).setBlockType(posInSection(pos),id);
  }

  setBlockData(pos, data) {
    this._getSection(pos).setBlockData(posInSection(pos),data);
  }

  setBlockLight(pos, light) {
    this._getSection(pos).setBlockLight(posInSection(pos),light);
  }

  setSkyLight(pos, light) {
    this._getSection(pos).setSkyLight(posInSection(pos),light);
  }

  setBiome(pos, biome) {
    const cursor = getBiomeCursor(pos);
    this.biome.writeUInt8(biome, cursor);
  }

  dump(bitMap=0xFFFF) {
    const {chunkIncluded,chunkCount}=parseBitMap(bitMap);
    const bufferLength=chunkCount*SECTION_SIZE+BIOME_SIZE;
    const buffer=new Buffer(bufferLength);
    let offset=0;
    let offsetLight=w*l*sectionCount*chunkCount*2;
    let offsetSkyLight=w*l*sectionCount*chunkCount/2*5;
    for(let i=0;i<sectionCount;i++) {
      if(chunkIncluded[i]) {
        offset += this.sections[i].dump().copy(buffer, offset, 0, w * l * sh * 2);
        offsetLight += this.sections[i].dump().copy(buffer, offsetLight,w * l * sh*2, w * l * sh*2+w * l * sh/2);
        offsetSkyLight += this.sections[i].dump().copy(buffer, offsetSkyLight,w * l * sh/2*5, w * l * sh/2*5+w * l * sh/2);

      }
    }
    this.biome.copy(buffer,w * l * sectionCount*chunkCount * 3);
    return buffer;
  }


  load(data,bitMap=0xFFFF) {
    if (!Buffer.isBuffer(data))
      throw(new Error('Data must be a buffer'));
    const {chunkIncluded,chunkCount}=parseBitMap(bitMap);
    let offset=0;
    let offsetLight=w*l*sectionCount*chunkCount*2;
    let offsetSkyLight=w*l*sectionCount*chunkCount/2*5;
    for(let i=0;i<sectionCount;i++) {
      if(chunkIncluded[i]) {
        const sectionBuffer=new Buffer(SECTION_SIZE);
        offset+=data.copy(sectionBuffer,0,offset,offset+w*l*sh*2);
        offsetLight+=data.copy(sectionBuffer,w*l*sh*2,offsetLight,offsetLight+w*l*sh/2);
        offsetSkyLight+=data.copy(sectionBuffer,w*l*sh*5/2,offsetLight,offsetSkyLight+w*l*sh/2);
        this.sections[i].load(sectionBuffer);
      }
    }
    data.copy(this.biome,w*l*sectionCount*chunkCount*3);


    if (data.length != SECTION_SIZE*chunkCount+w*l)
      throw(new Error(`Data buffer not correct size \(was ${data.length}, expected ${BUFFER_SIZE}\)`));
  }
}

