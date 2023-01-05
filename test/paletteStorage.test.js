/* eslint-env mocha */
const assert = require('assert')
const PalettedStorage = require('../src/bedrock/common/PalettedStorage')

describe('PalettedStorage works', function () {
  const storage = new PalettedStorage(4)
  // set some blocks to ID #3
  storage.set(0, 1, 0, 3)
  storage.set(19, 1, 20, 3)
  assert.strictEqual(storage.get(0, 0, 0), 0, 'Expected data at (0,0,0) to be 0')
  assert.strictEqual(storage.get(0, 1, 0), 3, 'Expected data at (0,1,0) to be 3')
  // create a palette
  const palette = []
  for (let i = 0; i < 2 ** 4; i++) palette.push({ count: 0 })
  // increment the palette
  storage.incrementPalette(palette)
  assert.strictEqual(palette[3].count, 2, 'Expected to find two instances of item #3')

  // check that resizing works (at least size 4 to hold #3)
  for (let size = 4; size < 16; size++) {
    const resized = storage.resize(size)
    assert.strictEqual(resized.bitsPerBlock, size)
    assert.strictEqual(resized.get(0, 0, 0), 0, 'Expected data at (0,0,0) to be 0 after resize to ' + size)
    assert.strictEqual(resized.get(0, 1, 0), 3, 'Expected data at (0,1,0) to be 3 after resize to ' + size)
    const palette2 = []
    for (let i = 0; i < 2 ** 4; i++) palette2.push({ count: 0 })
    resized.incrementPalette(palette2)
    assert.strictEqual(palette2[3].count, 2, 'Expected to find two instances of item #3 after resize to ' + size)
  }
})
