const BUFFER_SIZE = ((16 * 16 * 16) * 16 * 3) + 256;

var { readUInt4LE, writeUInt4LE } = require('uint4');

var exists = function(val) {
    return val !== undefined;
};

var getArrayPosition = function(x, y, z) {
    var n = y >> 4;
        y = y % 16;
    return ((n * 4096) + (y * 256) + (z * 16) + (x));
};

var getBlockCursor = function(x, y, z) {
    return getArrayPosition(x, y, z) * 2.0 + 0;
};

var getBlockLightCursor = function(x, y, z) {
    return getArrayPosition(x, y, z) * 0.5 + 131072;
};

var getSkyLightCursor = function(x, y, z) {
    return getArrayPosition(x, y, z) * 0.5 + 163840;
};

var getBiomeCursor = function(x, y, z) {
    return ((16 * 16 * 16) * 16 * 3) + (z * 16) + x; // X and Z may need to be flipped
};

class Chunk {

    constructor() {
        this.data = new Buffer(BUFFER_SIZE);
        this.data.fill(0);
    }

    getBlock(x, y, z) {
        return {
            id:         this.getBlockType(x, y, z),
            data:       this.getBlockData(x, y, z),
            light: {
                sky:    this.getSkyLight(x, y, z),
                block:  this.getBlockLight(x, y, z)
            },
            biome:      this.getBiome(x, y, z)
        };
    }

    getBlockType(x, y, z) {
        var cursor = getBlockCursor(x, y, z);
        return this.data.readUInt16LE(cursor) >> 4;
    }

    getBlockData(x, y, z) {
        var cursor = getBlockCursor(x, y, z);
        return this.data.readUInt16LE(cursor) & 15;
    }

    getBlockLight(x, y, z) {
        var cursor = getBlockLightCursor(x, y, z);
        return readUInt4LE(this.data, cursor);
    }

    getSkyLight(x, y, z) {
        var cursor = getSkyLightCursor(x, y, z);
        return readUInt4LE(this.data, cursor);
    }

    getBiome(x, y, z) {
        var cursor = getBiomeCursor(x, y, z);
        return this.data.readUInt8(cursor);
    }

    setBlock(x, y, z, block) {
        if(exists(block.id))
            this.setBlockType(x, y, z, block.id);
        if(exists(block.data))
            this.setBlockData(x, y, z, block.data);
        if(exists(block.biome))
            this.setBiome(x, y, z, block.biome);
        if(!exists(block.light))
            return;
        if(exists(block.light.sky))
            this.setSkyLight(x, y, z, block.light.sky);
        if(exists(block.light.block))
            this.setBlockLight(x, y, z, block.light.block);
    }

    setBlockType(x, y, z, id) {
        var cursor = getBlockCursor(x, y, z);
        var data = this.getBlockData(x, y, z);
        this.data.writeUInt16LE((id << 4) | data, cursor);
    }

    setBlockData(x, y, z, data) {
        var cursor = getBlockCursor(x, y, z);
        var id = this.getBlockType(x, y, z);
        this.data.writeUInt16LE((id << 4) | data, cursor);
    }

    setBlockLight(x, y, z, light) {
        var cursor = getBlockLightCursor(x, y, z);;
        writeUInt4LE(this.data, light, cursor);
    }

    setSkyLight(x, y, z, light) {
        var cursor =  getSkyLightCursor(x, y, z);
        writeUInt4LE(this.data, light, cursor);
    }

    setBiome(x, y, z, biome) {
        var cursor = getBiomeCursor(x, y, z);
        this.data.writeUInt8(biome, cursor);
    }

    dump() {
        return this.data;
    }

    load(data) {
        if(!Buffer.isBuffer(data))
            throw(new Error('Data must be a buffer'));
        if(data.length != BUFFER_SIZE)
            throw(new Error(`Data buffer not correct size \(was ${data.size()}, expected ${BUFFER_SIZE}\)`));
        this.data = data;
    }

}

module.exports = Chunk;
