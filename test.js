var Chunk = require('./')("1.9");
var Vec3 = require("vec3");
var fs = require('fs');

var dump = fs.readFileSync('chunk_-10_-1.dump');
var data = JSON.parse(fs.readFileSync('packet_-10_-1.data').toString());

var chunk = new Chunk();
chunk.load(dump, data.bitMap);
console.log(chunk.getBlock(new Vec3(3,50,3)));
console.log(chunk.dump());