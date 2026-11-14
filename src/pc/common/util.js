const neededBits = require('./neededBits')

// Bits needed to index every block state in this version's global palette (i.e. to hold the
// highest stateId). Constant per version, so a ChunkColumn computes it once rather than per chunk.
function neededBitsForBlocks (mcData) {
  let highestStateId = 0
  for (const block of Object.values(mcData.blocks)) {
    if (block.maxStateId > highestStateId) highestStateId = block.maxStateId
  }
  return neededBits(highestStateId)
}

// Bits needed to index every biome in this version's global palette.
function neededBitsForBiomes (mcData) {
  return neededBits(Object.values(mcData.biomes).length)
}

module.exports = { neededBitsForBlocks, neededBitsForBiomes }
