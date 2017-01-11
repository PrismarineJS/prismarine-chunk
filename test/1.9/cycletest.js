var Chunk = require('../../index')("1.9");
var Vec3 = require("vec3");
var fs = require('fs');
var Block = require('prismarine-block')("1.9");

var dump = fs.readFileSync(__dirname+'/chunk_-10_-1.dump');
var data = JSON.parse(fs.readFileSync(__dirname+'/packet_-10_-1.data').toString());

const ProtoDef = require('protodef').ProtoDef;

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

 let packingProtocol = new ProtoDef();
packingProtocol.addType('longToByte', longToByte);
packingProtocol.addType('section', p);




packed = packingProtocol.createPacketBuffer('section', {
        bitsPerBlock: 13,
        palette: [],
        dataArray: Buffer.alloc(6656),
        blockLight: Buffer.alloc(16 * 16 * 16 / 2),
        skyLight: Buffer.alloc(16 * 16 * 16 / 2),
      });

console.log("pckl:" + packed.length);
console.log(packingProtocol.read(Buffer.concat([packed, packed]), 0, 'section', {}));


var chunk = new Chunk();
chunk.load(dump, data.bitMap);
/*
for (var x = 0; x < 16;x++) {
	  for (var z = 0; z < 16; z++) {
		for (var y = 0; y < 256; y++) {
		  chunk.setBlock(new Vec3(x, y, z), new Block(42, 0, 0));
		}
	  }
	}
*/


console.log(chunk.getBlock(new Vec3(0, 37, 0)));

console.time("load");
for (var i = 0; i < 10; i++)
{

	var histogram={};
	var total = 0;
	
	for (var x = 0; x < 16;x++) {
	  for (var z = 0; z < 16; z++) {
		for (var y = 0; y < 256; y++) {
		  let blocktype = chunk.getBlockType(new Vec3(x, y, z));
		  if (!(blocktype in histogram)) {
			histogram[blocktype] = 0;
		  }
		  histogram[blocktype]+=(100.0/(16 * 16 * 256));
		  total++;
		}
	  }
	}
	
	console.log(histogram);
	console.log(total);
	/*
	for (let i = 0; i < 256; i++)
	{
		console.log(i + ", " + chunk.getBlock(new Vec3(3,i,3)).displayName);
	}
	*/
	nchunk = new Chunk();
	console.log("Dump/Load Cycle");
	nchunk.load(chunk.dump(), 0xffff);
	chunk = nchunk;
	//console.log(chunk.getBlock(new Vec3(0, 37, 0)));
}
console.timeEnd("load");


/*
var testChunk=new Chunk();
var histogram={};
var total = 0;
testChunk.load(dump, data.bitMap);
for (var x = 0; x < 16;x++) {
  for (var z = 0; z < 16; z++) {
    for (var y = 0; y < 256; y++) {
      let blocktype = testChunk.getBlockType(new Vec3(x, y, z));
      if (!(blocktype in histogram)) {
      	histogram[blocktype] = 0;
      }
      histogram[blocktype]+=(100.0/(16 * 16 * 256));
      total++;
    }
  }
}
console.log(histogram);
console.log(total);
*/