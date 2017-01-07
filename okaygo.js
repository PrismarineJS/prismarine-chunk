var Chunk = require('./')("1.9");
var Vec3 = require("vec3");
var fs = require('fs');

var dump = fs.readFileSync('chunk_-10_-1.dump');
var data = JSON.parse(fs.readFileSync('packet_-10_-1.data').toString());



/*
var chunk = new Chunk();
chunk.load(dump, data.bitMap);
//console.log(chunk.getBlock(new Vec3(3,50,3)));
//console.log(chunk.dump());
*/


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
