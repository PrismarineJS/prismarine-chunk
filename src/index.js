var chunkImplementations={
  "pc":{
    "1.8":require("./pc/1.8/chunk")
  },
  "pe":{
    "0.14":require("./pe/0.14/chunk")
  }
};

module.exports = loader;

function loader(mcVersion) {
  var mcData = require('minecraft-data')(mcVersion);

  return chunkImplementations[mcData.type][mcData.version.majorVersion](mcVersion);
}