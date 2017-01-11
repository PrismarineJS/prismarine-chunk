	var assert = require('assert');
var Vec3 = require("vec3");

const versions=['pe_0.14', 'pe_1.0', '1.8', '1.9'];
versions.forEach(function(version) {
  var Chunk = require('../index.js')(version);
  var Block = require('prismarine-block')(version);
  describe('chunk '+version, function () {
    it('should default to having all blocks be air', function () {
      var chunk = new Chunk();

      assert.equal(0, chunk.getBlock(new Vec3(0, 0, 0)).type);
      assert.equal(0, chunk.getBlock(new Vec3(15, Chunk.h - 1, 15)).type);
    });
    it('should set a block at the given position', function () {
      var chunk = new Chunk();

      chunk.setBlock(new Vec3(0, 0, 0), new Block(5, 0, 2)); // Birch planks, if you're wondering
      assert.equal(5, chunk.getBlock(new Vec3(0, 0, 0)).type);
      assert.equal(2, chunk.getBlock(new Vec3(0, 0, 0)).metadata);

      chunk.setBlock(new Vec3(0, 37, 0), new Block(42, 0, 0)); // Iron block
      assert.equal(42, chunk.getBlock(new Vec3(0, 37, 0)).type);
      assert.equal(0, chunk.getBlock(new Vec3(0, 37, 0)).metadata);

      chunk.setBlock(new Vec3(1, 0, 0), new Block(35, 0, 1)); // Orange wool
      assert.equal(35, chunk.getBlock(new Vec3(1, 0, 0)).type);
      assert.equal(1, chunk.getBlock(new Vec3(1, 0, 0)).metadata);
    });
    it('should overwrite blocks in place', function () {
      var chunk = new Chunk();

      chunk.setBlock(new Vec3(0, 1, 0), new Block(42, 0, 0)); // Iron block
      chunk.setBlock(new Vec3(0, 1, 0), new Block(41, 0, 0)); // Gold block
      assert.equal(41, chunk.getBlock(new Vec3(0, 1, 0)).type);
      assert.equal(0, chunk.getBlock(new Vec3(0, 1, 0)).metadata);

      chunk.setBlock(new Vec3(5, 5, 5), new Block(35, 0, 1));  // Orange wool
      chunk.setBlock(new Vec3(5, 5, 5), new Block(35, 0, 14)); // Red wool
      assert.equal(35, chunk.getBlock(new Vec3(5, 5, 5)).type);
      assert.equal(14, chunk.getBlock(new Vec3(5, 5, 5)).metadata);
    });
    if(version!="pe_1.0" && version!="1.9") it('should fail safely when load is given bad input', function () {
      var chunk = new Chunk();

      var tooShort = new Buffer(3);
      var notABuffer = [];

      assert.throws(function () {
        chunk.load(tooShort);
      });

      assert.throws(function () {
        chunk.load(notABuffer, 0xFFFF);
      });
    });

    if(version!="pe_1.0") it('should load/dump consistently',function() {
      var chunk = new Chunk();


      chunk.setBlock(new Vec3(0, 37, 0), new Block(42, 0, 0)); // Iron block
      assert.equal(0, chunk.getBlock(new Vec3(0, 37, 0)).metadata);
      assert.equal(42, chunk.getBlock(new Vec3(0, 37, 0)).type);
      var buf=chunk.dump();
      var chunk2 = new Chunk();

      chunk2.load(buf, 0xFFFF);
      assert.equal(42, chunk2.getBlock(new Vec3(0, 37, 0)).type);
      assert.equal(0, chunk2.getBlock(new Vec3(0, 37, 0)).metadata);

      var buf2=chunk2.dump();

      if(!buf.equals(buf2)) {
        assert.equal(buf,buf2);
      }

      assert(buf.equals(buf2));
    });
  });
});
