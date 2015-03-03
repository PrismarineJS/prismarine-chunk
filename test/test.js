var assert = require('assert');

var Chunk = require('../index.js');

describe('chunk', function() {
    it('should default to having all blocks be air', function() {
        var chunk = new Chunk();

        assert.equal(0, chunk.getBlock(0, 0, 0).id);
        assert.equal(0, chunk.getBlock(15, 255, 15).id);
    });
    it('should set a block at the given position', function() {
        var chunk = new Chunk();

        chunk.setBlock(0, 0, 0, { id: 5, data: 2 }); // Birch planks, if you're wondering
        assert.equal(5, chunk.getBlock(0, 0, 0).id);
        assert.equal(2, chunk.getBlock(0, 0, 0).data);

        chunk.setBlock(0, 1, 0, { id: 42, data: 0 }); // Iron block
        assert.equal(42, chunk.getBlock(0, 1, 0).id);
        assert.equal(0,  chunk.getBlock(0, 1, 0).data);

        chunk.setBlock(1, 0, 0, { id: 35, data: 1 }); // Orange wool
        assert.equal(35, chunk.getBlock(1, 0, 0).id);
        assert.equal(1,  chunk.getBlock(1, 0, 0).data);
    });
    it('should overwrite blocks in place', function() {
        var chunk = new Chunk();

        chunk.setBlock(0, 1, 0, { id: 42, data: 0 }); // Iron block
        chunk.setBlock(0, 1, 0, { id: 41, data: 0 }); // Gold block
        assert.equal(41, chunk.getBlock(0, 1, 0).id);
        assert.equal(0,  chunk.getBlock(0, 1, 0).data);

        chunk.setBlock(5, 5, 5, { id: 35, data: 1 });  // Orange wool
        chunk.setBlock(5, 5, 5, { id: 35, data: 14 }); // Red wool
        assert.equal(35, chunk.getBlock(5, 5, 5).id);
        assert.equal(14, chunk.getBlock(5, 5, 5).data);
    });
    it('should return the internal buffer when calling #save()', function() {
        var chunk = new Chunk();

        chunk.setBlock(0, 0, 0, { id: 5, data: 2 }); // Birch planks

        var buffer = chunk.save();
        assert.equal(0x00, buffer[0]);
        assert.equal(0x05, buffer[1]);
        assert.equal(0x02, buffer[2]);
    });
    it('should replace the inner buffer when calling #load()', function() {
        var chunk = new Chunk();

        var buffer = new Buffer(196608);
        buffer[0] = 0x00;
        buffer[1] = 0x05;
        buffer[2] = 0x02;

        chunk.load(buffer);

        assert.equal(5, chunk.getBlock(0, 0, 0).id);
        assert.equal(2, chunk.getBlock(0, 0, 0).data);
    });
    it('should fail savely when load is given bad input', function() {
        var chunk = new Chunk();

        var tooShort = new Buffer(3);
        var notABuffer = [];

        assert.throws(function() {
            chunk.load(tooShort);
        });

        assert.throws(function() {
            chunk.load(notABuffer);
        });
    });
});
