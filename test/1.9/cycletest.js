const Chunk = require('../../index')('1.9')
const Vec3 = require('vec3')
const fs = require('fs')
const path = require('path')

const dump = fs.readFileSync(path.join(__dirname, '/chunk_-10_-1.dump'))
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '/packet_-10_-1.data')).toString())

const ProtoDef = require('protodef').ProtoDef

// MC counts the longs, protodef wants the bytes. This is responsible for that conversion.
let longToByte = [
  function (buffer, offset, typeArgs) { // readLongToByte
    const results = this.read(buffer, offset, typeArgs.type, {})
    return {
      value: Math.ceil(results.value * 8),
      size: results.size
    }
  },
  function (value, buffer, offset, typeArgs) { // writeLongToByte
    return this.write(value / 8, buffer, offset, typeArgs.type, {})
  },
  function (value, typeArgs) { // sizeOfLongToByte
    return this.sizeOf(value / 8, typeArgs.type, {})
  }
]

let p = ['container', [{
  'name': 'bitsPerBlock',
  'type': 'u8'
},
{
  'name': 'palette',
  'type': ['array', {
    'type': 'varint',
    'countType': 'varint'
  }]
},
{
  'name': 'dataArray',
  'type': ['buffer', {
    'countType': ['longToByte', {
      'type': 'varint'
    }]
  }]
},
{
  'name': 'blockLight',
  'type': ['buffer', {
    'count': 16 * 16 * 16 / 2
  }]
},
{
  'name': 'skyLight',
  'type': ['buffer', {
    'count': 16 * 16 * 16 / 2
  }]
}
]]

let packingProtocol = new ProtoDef()
packingProtocol.addType('longToByte', longToByte)
packingProtocol.addType('section', p)

const packed = packingProtocol.createPacketBuffer('section', {
  bitsPerBlock: 13,
  palette: [],
  dataArray: Buffer.alloc(6656),
  blockLight: Buffer.alloc(16 * 16 * 16 / 2),
  skyLight: Buffer.alloc(16 * 16 * 16 / 2)
})

console.log('pckl:' + packed.length)
console.log(packingProtocol.read(Buffer.concat([packed, packed]), 0, 'section', {}))

const chunk = new Chunk()
chunk.load(dump, data.bitMap)

console.log(chunk.getBlock(new Vec3(0, 37, 0)))

console.time('load')

for (let i = 0; i < 10; i++) {
  let histogram = {}
  let total = 0

  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) {
      for (let y = 0; y < 256; y++) {
        let blocktype = chunk.getBlockType(new Vec3(x, y, z))
        if (!(blocktype in histogram)) {
          histogram[blocktype] = 0
        }
        histogram[blocktype] += (100.0 / (16 * 16 * 256))
        total++
      }
    }
  }

  console.log(histogram)
  console.log(total)

  const nchunk = new Chunk()
  console.log('Dump/Load Cycle')
  nchunk.load(nchunk.dump(), 0xffff)
  // console.log(chunk.getBlock(new Vec3(0, 37, 0)));
}
console.timeEnd('load')
