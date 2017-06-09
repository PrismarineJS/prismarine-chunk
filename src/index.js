var chunkImplementations={
  "pc":{
    "1.8":require("./pc/1.8/chunk"),
    "1.9":require("./pc/1.9/chunk"),
    "1.10":require("./pc/1.9/chunk"),
    "1.11":require("./pc/1.9/chunk"),
    "1.12":require("./pc/1.9/chunk")
  },
  "pe":{
    "0.14":require("./pe/0.14/chunk"),
    "1.0":require("./pe/1.0/chunk")
  }
};

module.exports = loader;

function loader(mcVersion) {
  var mcData = require('minecraft-data')(mcVersion);
  return chunkImplementations[mcData.type][mcData.version.majorVersion](mcVersion);
}
