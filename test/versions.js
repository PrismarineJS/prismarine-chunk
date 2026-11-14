const fs = require('fs')
const pcVersions = ['bedrock_0.14', 'bedrock_1.0', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13.2', '1.14.4', '1.15.2', '1.16.1', '1.17', '1.18', '1.19', '1.20', '26.1']
const bedrockVersions = ['bedrock_1.16.220', 'bedrock_1.17.10', 'bedrock_1.17.30', 'bedrock_1.17.40', 'bedrock_1.18.0', 'bedrock_1.19.1', 'bedrock_1.21.60']
const allVersions = [...bedrockVersions, ...pcVersions]
const bedrockNetworkVersions = [...new Set(require('minecraft-data').versions.bedrock.map(v => 'bedrock_' + v.minecraftVersion))]
  .filter(version => {
    const registry = require('prismarine-registry')(version)
    return registry.supportFeature('usesPalettedChunks') && registry.blockStates
  })
  .reverse()

const pcCycleTests = pcVersions.filter(v => fs.existsSync(v))
const bedrockCycleTests = bedrockVersions.filter(v => fs.existsSync(v))
module.exports = { pcVersions, pcCycleTests, bedrockVersions, bedrockCycleTests, bedrockNetworkVersions, allVersions }
