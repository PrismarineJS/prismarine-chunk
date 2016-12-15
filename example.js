var Chunk = require('./')("pe_1.0");
var Vec3 = require("vec3");
var Block = require("prismarine-block")("pe_1.0");

var chunk = new Chunk();
chunk.setBlock(new Vec3(0,0,0), new Block(5,0,2));
var dump = chunk.dump()
console.log(dump);

var chunk2 = new Chunk();
chunk2.load(dump);
console.log(chunk2.getBlock(new Vec3(0,0,0)));
console.log(chunk2.dump());
// for (var x = 0; x < Chunk.w;x++) {
//   for (var z = 0; z < Chunk.l; z++) {
//     chunk.setBlockType(new Vec3(x, 50, z), 2);
//     for (var y = 0; y < Chunk.h; y++) {
//       chunk.setSkyLight(new Vec3(x, y, z), 15);
//     }
//   }
// }
