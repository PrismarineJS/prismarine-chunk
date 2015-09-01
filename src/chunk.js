const BUFFER_SIZE = ((16 * 16 * 16) * 16 * 3) + 256;

var { readUInt4LE, writeUInt4LE } = require('uint4');

var exists = function(val) {
    return val !== undefined;
};

var getArrayPosition = function(pos) {
    var n = pos.y >> 4;
        var y = pos.y % 16;
    return ((n * 4096) + (y * 256) + (pos.z * 16) + (pos.x));
};

var getBlockCursor = function(pos) {
    return getArrayPosition(pos) * 2.0 + 0;
};

var getBlockLightCursor = function(pos) {
    return getArrayPosition(pos) * 0.5 + 131072;
};

var getSkyLightCursor = function(pos) {
    return getArrayPosition(pos) * 0.5 + 163840;
};

var getBiomeCursor = function(pos) {
    return ((16 * 16 * 16) * 16 * 3) + (pos.z * 16) + pos.x; // X and Z may need to be flipped
};

class Chunk {

    constructor() {
        this.data = new Buffer(BUFFER_SIZE);
        this.data.fill(0);
    }

    getBlock(pos) {
        return {
            id:         this.getBlockType(pos),
            data:       this.getBlockData(pos),
            light: {
                sky:    this.getSkyLight(pos),
                block:  this.getBlockLight(pos)
            },
            biome:      this.getBiome(pos)
        };
    }

    setBlock(pos, block) {
        if(exists(block.id))
            this.setBlockType(pos, block.id);
        if(exists(block.data))
            this.setBlockData(pos, block.data);
        if(exists(block.biome))
            this.setBiome(pos, block.biome);
        if(!exists(block.light))
            return;
        if(exists(block.light.sky))
            this.setSkyLight(pos, block.light.sky);
        if(exists(block.light.block))
            this.setBlockLight(pos, block.light.block);
    }

    getBlockType(pos) {
        var cursor = getBlockCursor(pos);
        return this.data.readUInt16LE(cursor) >> 4;
    }

    getBlockData(pos) {
        var cursor = getBlockCursor(pos);
        return this.data.readUInt16LE(cursor) & 15;
    }

    getBlockLight(pos) {
        var cursor = getBlockLightCursor(pos);
        return readUInt4LE(this.data, cursor);
    }

    getSkyLight(pos) {
        var cursor = getSkyLightCursor(pos);
        return readUInt4LE(this.data, cursor);
    }

    getBiome(pos) {
        var cursor = getBiomeCursor(pos);
        return this.data.readUInt8(cursor);
    }

    setBlockType(pos, id) {
        var cursor = getBlockCursor(pos);
        var data = this.getBlockData(pos);
        this.data.writeUInt16LE((id << 4) | data, cursor);
    }

    setBlockData(pos, data) {
        var cursor = getBlockCursor(pos);
        var id = this.getBlockType(pos);
        this.data.writeUInt16LE((id << 4) | data, cursor);
    }

    setBlockLight(pos, light) {
        var cursor = getBlockLightCursor(pos);
        writeUInt4LE(this.data, light, cursor);
    }

    setSkyLight(pos, light) {
        var cursor =  getSkyLightCursor(pos);
        writeUInt4LE(this.data, light, cursor);
    }

    setBiome(pos, biome) {
        var cursor = getBiomeCursor(pos);
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
