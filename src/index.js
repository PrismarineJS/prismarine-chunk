var chunkImplementations={
  "pc":{
    "1.8":require("./pc/1.8/chunk")
  },
  "pe":{
    "0.14":require("./pe/0.14/chunk"),
    "1.0":require("./pe/1.0/chunk")
  }
};

module.exports = loader;

function loader(mcVersion) {
  // FIXME FIXME FIXME
  var mcData = require('minecraft-data')("pe_0.15");
  return chunkImplementations.pe["1.0"] //[mcData.type][mcData.version.majorVersion](mcVersion); FIXME
}
