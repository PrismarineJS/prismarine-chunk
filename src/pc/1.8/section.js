var { readUInt4LE, writeUInt4LE } = require('uint4');

const w=16;
const l=16;
const sh=16;//section height

const SECTION_SIZE=(w * l * sh * 3);


var getArrayPosition = function (pos) {
  return pos.x+w*(pos.z+l*pos.y);
};

var getBlockCursor = function (pos) {
  return getArrayPosition(pos) * 2.0;
};

var getBlockLightCursor = function(pos) {
  return getArrayPosition(pos) * 0.5 + w * l * sh*2;
};

var getSkyLightCursor = function(pos) {
  return getArrayPosition(pos) * 0.5 + w * l * sh/2*5;
};


class Section {

  constructor() {
    this.data=new Buffer(SECTION_SIZE);
    this.data.fill(0);
  }

  initialize(iniFunc) {
    const skylight=w * l * sh/2*5;
    const light=w * l * sh*2;
    let n=0;
    for(let y=0;y<sh;y++) {
      for(let z=0;z<w;z++) {
        for(let x=0;x<l;x++,n++) {
          const block=iniFunc(x,y,z,n);
          if(block==null)
            continue;
          this.data.writeUInt16LE(block.type<<4 | block.metadata,n*2);
          writeUInt4LE(this.data, block.light, n*0.5+light);
          writeUInt4LE(this.data, block.skyLight, n*0.5+skylight);
        }
      }
    }
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

  dump() {
    return this.data;
  }


  load(data) {
    if (!Buffer.isBuffer(data))
      throw(new Error('Data must be a buffer'));
    if (data.length != SECTION_SIZE)
      throw(new Error(`Data buffer not correct size \(was ${data.length}, expected ${SECTION_SIZE}\)`));
    this.data = data;
  }
}


Section.w=w;
Section.l=l;
Section.sh=sh;
Section.SECTION_SIZE=SECTION_SIZE;

module.exports=Section;
