const { Vec3 } = require('vec3')
const keyFromLocalPos = pos => `${pos.x},${pos.y},${pos.z}`
const keyFromGlobalPos = (x, y, z) => `${x & 0xf},${y},${z & 0xf}`

class CommonChunkColumn {
  minCY = 0
  maxCY = 16
  worldHeight = 256
  co = 0

  constructor (options = {}) {
    this.x = options.x || 0
    this.z = options.z || 0
    this.chunkVersion = options.chunkVersion
    this.blockEntities = options.blockEntities || {}
    this.sections = []
    this.entitites = []
  }

  initialize (func) {
    const p = new Vec3()
    for (p.y = 0; p.y < this.worldHeight; p.y++) {
      for (p.z = 0; p.z < 16; p.z++) {
        for (p.x = 0; p.x < 16; p.x++) {
          const block = func(p.x, p.y, p.z)
          if (block) this.setBlock(p, block)
        }
      }
    }
  }

  // Blocks

  getBlock (vec4, full = true) {
    const Y = vec4.y >> 4
    const sec = this.sections[this.co + Y]
    if (!sec) return this.Block.fromStateId(this.registry.blocksByName.air.defaultState, 0)
    const block = sec.getBlock(vec4.l, vec4.x, vec4.y & 0xf, vec4.z)
    if (full) {
      block.entity = this.blockEntities[keyFromLocalPos(vec4)]
    }
    return block
  }

  setBlock (pos, block) {
    const Y = pos.y >> 4
    let sec = this.sections[this.co + Y]
    if (!sec) {
      sec = new this.Section(this.registry, this.Block, { y: Y, subChunkVersion: this.subChunkVersion })
      this.sections[this.co + Y] = sec
    }
    sec.setBlock(pos.l, pos.x, pos.y & 0xf, pos.z, block)
    if (block.entity) {
      this.setBlockEntity(pos, block.entity)
    }
  }

  getBlockStateId (pos) {
    const Y = pos.y >> 4
    const sec = this.sections[this.co + Y]
    if (!sec) { return }
    return sec.getBlockStateId(pos.l, pos.x, pos.y & 0xf, pos.z)
  }

  setBlockStateId (pos, stateId) {
    const Y = pos.y >> 4
    let sec = this.sections[this.co + Y]
    if (!sec) {
      sec = new this.Section(this.registry, this.Block, { y: Y, subChunkVersion: this.subChunkVersion })
      this.sections[this.co + Y] = sec
    }
    sec.setBlockStateId(pos.l, pos.x, pos.y & 0xf, pos.z, stateId)
  }

  // Block entities

  setBlockEntity (pos, tag) {
    this.blockEntities[keyFromLocalPos(pos)] = tag
  }

  addBlockEntity (tag) {
    const lPos = keyFromGlobalPos(tag.value.x.value, tag.value.y.value, tag.value.z.value)
    this.blockEntities[lPos] = tag
    // console.log('Add block entity', lPos, tag.value.y.value, tag)
  }

  removeBlockEntity (pos) {
    delete this.blockEntities[keyFromLocalPos(pos)]
  }

  // This is only capable of moving block entities within the same chunk ... prismarine-world should implement this
  moveBlockEntity (pos, newPos) {
    const oldKey = keyFromLocalPos(pos)
    const newKey = keyFromLocalPos(newPos)
    const tag = this.blockEntities[oldKey]
    delete this.blockEntities[oldKey]
    this.blockEntities[newKey] = tag
  }

  // Section management

  getSection (y) {
    return this.sections[this.co + y]
  }

  setSection (y, section) {
    this.sections[this.co + y] = section
  }

  async newSection (y, storageFormat, buffer) {
    const n = new this.Section(this.registry, this.Block, { y, subChunkVersion: this.subChunkVersion })
    await n.decode(storageFormat, buffer)
    this.setSection(y, n)
    return n
  }

  getSectionBlockEntities (sectionY) {
    const found = []
    for (const key in this.blockEntities) {
      const y = parseInt(key.split(',')[1]) >> 4
      if (y === sectionY) {
        found.push(this.blockEntities[key])
      }
    }
    return found
  }

  getSections () {
    return this.sections
  }

  // Entities

  getEntities () {
    return this.entities
  }

  loadEntities (tags) {
    this.entities = tags
  }

  toObject () {
    const sections = this.sections.map(sec => sec.toObject())
    const { x, z, chunkVersion, blockEntities } = this
    return { x, z, chunkVersion, blockEntities, sections }
  }
}

module.exports = CommonChunkColumn
