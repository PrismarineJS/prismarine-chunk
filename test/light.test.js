/* eslint-env mocha */

const assert = require('assert')
const { Vec3 } = require('vec3')
const { pcVersions } = require('./versions')

// On the wire a light array is 2048 plain bytes: the value at section index i
// (y << 8 | z << 4 | x) is in byte i >> 1, low nibble for even i, high for odd.
// Light 1 at (0, 0, 0), 9 at (4, 1, 0) and 7 at (5, 1, 0) is therefore
// 0x01, then 129 zero bytes, then 0x79.
const expectedBytes = Buffer.alloc(131)
expectedBytes[0] = 0x01
expectedBytes[130] = 0x79

function dumpedBlockLight (registry, chunk) {
  if (!registry.version['>=']('1.14')) return chunk.dump() // before 1.14 light is inside the chunk data
  const light = chunk.dumpLight()
  if (Buffer.isBuffer(light)) return light // 1.14 - 1.16
  return Buffer.concat(light.blockLight.map(section => Buffer.from(section))) // 1.17+
}

function reloaded (registry, Chunk, chunk) {
  const copy = new Chunk()
  if (!registry.version['>=']('1.14')) {
    copy.load(chunk.dump(), chunk.getMask(), true)
  } else {
    const light = chunk.dumpLight()
    if (Buffer.isBuffer(light)) {
      copy.loadLight(light, chunk.skyLightMask, chunk.blockLightMask)
    } else {
      copy.loadParsedLight(light.skyLight, light.blockLight, light.skyLightMask, light.blockLightMask, light.emptySkyLightMask, light.emptyBlockLightMask)
    }
  }
  return copy
}

for (const version of pcVersions) {
  const registry = require('prismarine-registry')(version)
  if (registry.type !== 'pc') continue
  const Chunk = require('prismarine-chunk')(registry)

  describe('light wire format ' + version, () => {
    function litChunk () {
      const chunk = new Chunk()
      chunk.setBlockStateId(new Vec3(0, 0, 0), 1) // gives versions before 1.14 a section to dump
      chunk.setBlockLight(new Vec3(0, 0, 0), 1)
      chunk.setBlockLight(new Vec3(4, 1, 0), 9)
      chunk.setBlockLight(new Vec3(5, 1, 0), 7)
      return chunk
    }

    it('dumps light as nibble bytes, low nibble first', () => {
      const bytes = dumpedBlockLight(registry, litChunk())
      assert.notStrictEqual(bytes.indexOf(expectedBytes), -1, 'light bytes not in wire order')
    })

    it('loads the light it dumps at the same positions', () => {
      const copy = reloaded(registry, Chunk, litChunk())
      assert.strictEqual(copy.getBlockLight(new Vec3(0, 0, 0)), 1)
      assert.strictEqual(copy.getBlockLight(new Vec3(4, 1, 0)), 9)
      assert.strictEqual(copy.getBlockLight(new Vec3(5, 1, 0)), 7)
      assert.strictEqual(copy.getBlockLight(new Vec3(10, 1, 0)), 0)
    })
  })
}
