var Chunk = require('./')("1.0");
var Vec3 = require("vec3");

var chunk=new Chunk();
for (var x = 0; x < Chunk.w;x++) {
  for (var z = 0; z < Chunk.l; z++) {
    chunk.setBlockType(new Vec3(x, 50, z), 2);
    for (var y = 0; y < Chunk.h; y++) {
      chunk.setSkyLight(new Vec3(x, y, z), 15);
    }
  }
}
