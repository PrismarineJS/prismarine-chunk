const CHUNK_SIZE   = 16;
const CHUNK_HEIGHT = 256;

const BUFFER_SIZE = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT * 3;

var getCursor = function(x, y, z) {
    return (x) + (z * CHUNK_SIZE) + (y * CHUNK_HEIGHT);
};

class Chunk {

    constructor() {
        this.data = new Buffer(BUFFER_SIZE);
    }

    getBlock(x, y, z) {
        var cursor = getCursor(x, y, z);
        return {
            id:   this.data.readInt16BE(cursor),
            data: this.data.readInt8(cursor + 2)
        };
    }

    setBlock(x, y, z, block) {
        var cursor = getCursor(x, y, z);
        this.data.writeInt16BE(block.id, cursor);
        this.data.writeInt8(block.data, cursor + 2);
    }

    save() {
        return this.data;
    }

    load(data) {
        if(!Buffer.isBuffer(data))
            throw(new Error('Data must be a buffer'));
        if(data.size() != BUFFER_SIZE)
            throw(new Error('Data buffer not correct size (was $`data.size()`, expected $`BUFFER_SIZE`)'));
        this.data = data;
    }

}

module.exports = Chunk;
