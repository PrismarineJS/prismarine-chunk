function loader (mcVersion) {
  const Block = require('prismarine-block')(mcVersion)
  const mcData = require('minecraft-data')(mcVersion)

  return require('./ChunkColumn')(Block, mcData)
}

module.exports = loader
