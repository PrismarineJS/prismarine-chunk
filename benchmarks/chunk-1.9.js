const blocks = require('minecraft-data')('1.12.2').blocks
const chunk = require('../src/pc/1.9/chunk.js')
const Block = require('prismarine-block')('1.12.2')

const blockCounts = Object.keys(blocks).length
const Chunk = chunk('1.12.1')

const blockCache = {}
function initBlock (x, y, z) {
  const type = (x + y + z) % blockCounts
  return blockCache[type] || (blockCache[type] = new Block(type, 0, 0))
}

function benchmark () {
  for (let i = 0; i < 1000; i++) {
    const c = new Chunk()

    c.initialize(initBlock)
    const block = c.getBlock({ x: 0, y: 0, z: 0 })
    c.setBlock({ x: 0, y: 0, z: 0 }, block)

    const buffer = c.dump()
    const c2 = new Chunk()
    c2.load(buffer, 0, 0)
  }
}

module.exports = benchmark
