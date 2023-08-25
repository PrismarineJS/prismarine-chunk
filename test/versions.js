const fs = require('fs')
const pcVersions = ['bedrock_0.14', 'bedrock_1.0', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13.2', '1.14.4', '1.15.2', '1.16.1', '1.17', '1.18', '1.19', '1.20']
const bedrockVersions = ['bedrock_1.16.220', 'bedrock_1.17.40', 'bedrock_1.18.0']
const allVersions = [...bedrockVersions, ...pcVersions]

const pcCycleTests = pcVersions.filter(v => fs.existsSync(v))
const bedrockCycleTests = bedrockVersions.filter(v => fs.existsSync(v))
module.exports = { pcVersions, pcCycleTests, bedrockVersions, bedrockCycleTests, allVersions }
