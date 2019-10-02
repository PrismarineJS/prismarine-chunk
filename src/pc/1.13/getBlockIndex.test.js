/* globals it */
const assert = require('assert')
const Vec3 = require('vec3').Vec3
const getBlockIndex = require('./getBlockIndex')

it('returns correct index from position vector', () => {
  assert.strictEqual(getBlockIndex(new Vec3(0, 1, 0)), 256)
  assert.strictEqual(getBlockIndex(new Vec3(1, 1, 1)), 256 + 16 + 1)
})
