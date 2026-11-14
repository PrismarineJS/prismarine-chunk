const posKey = (pos) => `${pos.x},${pos.y},${pos.z}`

class CommonChunkColumn {
  constructor (registry) {
    this.registry = registry
    // Just a collection of deserialized NBTs
    this.blockEntities = {}
    this.minY = 0
  }

  // Some section getters, used by anvil-provider

  getSection (pos) {
    return this.sections[(pos.y - this.minY) >> 4]
  }

  getSectionAtIndex (index) {
    const minY = this.minY >> 4
    return this.sections[index - minY]
  }

  // Biomes

  getBiomeId (pos) {
    return this.getBiome(pos)
  }

  setBiomeId (pos, biome) {
    this.setBiome(pos, biome)
  }

  getBiomeData (pos) {
    const biome = this.getBiome(pos)
    return this.registry[biome]
  }

  getBiomeColor (pos) {
    const { color } = this.getBiomeData(pos)
    const r = color >> 16
    const g = (color >> 8) & 0xff
    const b = color & 0xff
    return { r, g, b }
  }

  setBiomeColor () {
    throw new Error('Cannot change biome color, update the biome instead')
  }

  // Block entities

  // blockEntities is exposed as an accessor so the entry count stays in sync no matter how the map is
  // populated: every wholesale assignment (fromJson, constructor options, future call sites) routes
  // through the setter, while setBlockEntity/removeBlockEntity keep it current on incremental edits.
  get blockEntities () {
    return this._blockEntities
  }

  set blockEntities (entities) {
    this._blockEntities = entities
    this._blockEntityCount = entities ? Object.keys(entities).length : 0
  }

  getBlockEntity (pos) {
    // Fast path: getBlock() calls this for every block, but most columns are plain terrain with no
    // block entities, so skip building the position key string when there are none.
    if (this._blockEntityCount === 0) return undefined
    return this._blockEntities[posKey(pos)]
  }

  setBlockEntity (pos, tag) {
    // Note: `pos` is relative to the chunk, not the world, tag's XYZ is
    const key = posKey(pos)
    if (!(key in this._blockEntities)) this._blockEntityCount++
    this._blockEntities[key] = tag
  }

  removeBlockEntity (pos) {
    const key = posKey(pos)
    if (key in this._blockEntities) {
      delete this._blockEntities[key]
      this._blockEntityCount--
    }
  }

  loadBlockEntities (entities) {
    for (const entity of entities) {
      this.setBlockEntity({ x: entity.x.value >> 4, y: entity.y.value, z: entity.z.value >> 4 }, entity)
    }
  }
}

module.exports = CommonChunkColumn
