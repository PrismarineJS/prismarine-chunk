const BUFFER_SIZE = ((16 * 16 * 16) * 16 * 3) + 256;

var exists = require('is-js').existy;

var getBlockCursor = function(x, y, z) {
    var n = y >> 4;
        y = y % 16;
    return ((n * 4096) + (y * 256) + (z * 16) + (x)) * 2;
};

var getBlockLightCursor = function(x, y, z) {

};

var getSkyLightCursor = function(x, y, z) {

};

var getBiomeCursor = function(x, y, z) {

};

class Chunk {

    constructor() {
        this.data = new Buffer(BUFFER_SIZE);
        this.data.fill(0);
    }

    getBlock(x, y, z) {
        var cursor = getCursor(x, y, z);
        return {
            id:         getBlockType(x, y, z),
            data:       getBlockData(x, y, z),
            light: {
                sky:    getSkyLight(x, y, z),
                block:  getBlockLight(x, y, z)
            },
            biome:      getBiome(x, y, z)
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

    }

    getSkyLight(x, y, z) {
        var cursor = getSkyLightCursor(x, y, z);

    }

    getBiome(x, y, z) {
        var cursor = getBiomeCursor(x, y, z);
        return this.data.readUInt8(cursor);
    }

    setBlock(x, y, z, block) {
        if(exists(block.id))
            setBlockType(x, y, z, block.id);
        if(exists(block.data))
            setBlockData(x, y, z, block.data);
        if(exists(block.biome))
            setBiome(x, y, z, block.biome);
        if(!exists(block.light))
            return;
        if(exists(block.light.sky))
            setSkyLight(x, y, z, block.light.sky);
        if(exists(block.light.block))
            setBlockLight(x, y, z, block.light.block);
    }

    setBlockType(x, y, z, id) {
        var cursor = getBlockCursor(x, y, z);
        var data   = getBlockData(x, y, z);
        this.data.writeUInt16LE(cursor, (id << 4) | data);
    }

    setBlockData(x, y, z, data) {
        var cursor = getBlockCursor(x, y, z);
        var type = getBlockType(x, y, z);
        this.data.writeUInt16LE(cursor, (id << 4) | data);
    }

    setBlockLight(x, y, z, light) {
        var cursor  = getBlockLightCursor(x, y, z);

    }

    setSkyLight(x, y, z, light) {
        var cursor =  getSkyLightCursor(x, y, z);

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
            throw(new Error('Data buffer not correct size (was $`data.size()`, expected $`BUFFER_SIZE`)'));
        this.data = data;
    }

}

module.exports = Chunk;
