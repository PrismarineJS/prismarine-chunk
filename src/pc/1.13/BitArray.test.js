/* globals describe it BigInt */
const assert = require('assert')
const BitArray = require('./BitArray')

describe('BitArray', () => {
  it('throws when instantiating BitArray with bad bitsPerValue', () => {
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
        bitsPerValue: 64,
        capacity: 1
      })
    })
  })

  it('writes and reads values correctly', () => {
    const bitArr = new BitArray({
      bitsPerValue: 5,
      capacity: 4096
    })
    for (let i = BigInt(0); i < BigInt(4096); ++i) {
      bitArr.set(i, BigInt(8))
      assert.strictEqual(bitArr.get(i), BigInt(8))
    }
  })

  it('throws when writing out of bounds', () => {
    const bitArr = new BitArray({
      bitsPerValue: 4,
      capacity: 10
    })
    assert.throws(() => {
      bitArr.set(BigInt(-1), BigInt(2))
    })
    assert.throws(() => {
      bitArr.set(BigInt(10), BigInt(2))
    })
    assert.doesNotThrow(() => {
      bitArr.set(BigInt(0), BigInt(2))
    })
    assert.doesNotThrow(() => {
      bitArr.set(BigInt(9), BigInt(2))
    })
  })

  it('throws when reading out of bounds', () => {
    const bitArr = new BitArray({
      bitsPerValue: 4,
      capacity: 10
    })
    assert.throws(() => {
      bitArr.get(BigInt(-1), BigInt(2))
    })
    assert.throws(() => {
      bitArr.get(BigInt(10), BigInt(2))
    })
    assert.doesNotThrow(() => {
      bitArr.get(BigInt(0), BigInt(2))
    })
    assert.doesNotThrow(() => {
      bitArr.get(BigInt(9), BigInt(2))
    })
  })

  it('throws when setting a larger value than allowed', () => {
    const bitArr = new BitArray({
      bitsPerValue: 3,
      capacity: 10
    })
    assert.throws(() => {
      bitArr.set(BigInt(0), BigInt(8))
    })
    assert.doesNotThrow(() => {
      bitArr.set(BigInt(0), BigInt(7))
    })
  })

  it('succeeds with resizing', () => {
    const bitArr = new BitArray({
      bitsPerValue: 4,
      capacity: 10
    })
    bitArr.set(BigInt(0), BigInt(7))
    assert.doesNotThrow(() => {
      bitArr.resizeTo(3)
    })
  })

  it('fails when resizing', () => {
    const bitArr = new BitArray({
      bitsPerValue: 4,
      capacity: 10
    })
    bitArr.set(BigInt(0), BigInt(8))
    assert.throws(() => {
      bitArr.resizeTo(3)
    })
  })
})
