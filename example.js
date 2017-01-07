var Chunk = require('./')("1.9");
var Vec3 = require("vec3");
var fs = require('fs');

var dump = fs.readFileSync('chunk_-10_-1.dump');
var data = JSON.parse(fs.readFileSync('packet_-10_-1.data').toString());

var chunk = new Chunk();
chunk.load(dump, data.bitMap);
console.log(chunk.getBlock(new Vec3(3,50,3)));


// for (var x = 0; x < Chunk.w;x++) {
//   for (var z = 0; z < Chunk.l; z++) {
//     chunk.setBlockType(new Vec3(x, 50, z), 2);
//     for (var y = 0; y < Chunk.h; y++) {
//       chunk.setSkyLight(new Vec3(x, y, z), 15);
//     }
//   }
// }

//console.log(JSON.stringify(chunk.getBlock(new Vec3(3,50,3)),null,2));
// console.log(chunk.dump().length);