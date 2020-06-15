/* globals describe test */
const assert = require('assert')
const BitArray = require('./BitArray')

describe('BitArray', () => {
  test('throws when instantiating BitArray with bad bitsPerValue', () => {
    assert.throws(() => {
      // eslint-disable-next-line
      new BitArray({
        bitsPerValue: -1,
        capacity: 1
      })
    })
    assert.throws(() => {
      // eslint-disable-next-line
      new BitArray({
        bitsPerValue: 0,
        capacity: 1
      })
    })
    assert.throws(() => {
      // eslint-disable-next-line
      new BitArray({
        bitsPerValue: 65,
        capacity: 1
      })
    })
    assert.doesNotThrow(() => {
      // eslint-disable-next-line
      new BitArray({
        bitsPerValue: 1,
        capacity: 1
      })
      // eslint-disable-next-line
      new BitArray({
        bitsPerValue: 32,
        capacity: 1
      })
    })
  })

  test('writes and reads values correctly', () => {
    const bitArr = new BitArray({
      bitsPerValue: 5,
      capacity: 4096
    })
    for (let i = 0; i < 4096; ++i) {
      bitArr.set(i, 8)
      assert.strictEqual(bitArr.get(i), 8)
    }
  })

  test('throws when writing out of bounds', () => {
    const bitArr = new BitArray({
      bitsPerValue: 4,
      capacity: 10
    })
    assert.throws(() => {
      bitArr.set(-1, 2)
    })
    assert.throws(() => {
      bitArr.set(10, 2)
    })
    assert.doesNotThrow(() => {
      bitArr.set(0, 2)
    })
    assert.doesNotThrow(() => {
      bitArr.set(9, 2)
    })
  })

  test('throws when reading out of bounds', () => {
    const bitArr = new BitArray({
      bitsPerValue: 4,
      capacity: 10
    })
    assert.throws(() => {
      bitArr.get(-1, 2)
    })
    assert.throws(() => {
      bitArr.get(10, 2)
    })
    assert.doesNotThrow(() => {
      bitArr.get(0, 2)
    })
    assert.doesNotThrow(() => {
      bitArr.get(9, 2)
    })
  })

  test('throws when setting a larger value than allowed', () => {
    const bitArr = new BitArray({
      bitsPerValue: 3,
      capacity: 10
    })
    assert.throws(() => {
      bitArr.set(0, 8)
    })
    assert.doesNotThrow(() => {
      bitArr.set(0, 7)
    })
  })

  test('succeeds with resizing', () => {
    const bitArr = new BitArray({
      bitsPerValue: 4,
      capacity: 10
    })
    bitArr.set(0, 7)
    assert.doesNotThrow(() => {
      bitArr.resizeTo(3)
    })
  })

  test('fails when resizing', () => {
    const bitArr = new BitArray({
      bitsPerValue: 4,
      capacity: 10
    })
    bitArr.set(0, 8)
    assert.throws(() => {
      bitArr.resizeTo(3)
    })
  })
})
