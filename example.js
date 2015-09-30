var Chunk = require('./')("1.8");
var Vec3 = require("vec3");

var chunk=new Chunk();

for (var x = 0; x < 16;x++) {
  for (var z = 0; z < 16; z++) {
    chunk.setBlockType(new Vec3(x, 50, z), 2);
    for (var y = 0; y < 256; y++) {
      chunk.setSkyLight(new Vec3(x, y, z), 15);
    }
  }
}

console.log(JSON.stringify(chunk.getBlock(new Vec3(3,50,3)),null,2));