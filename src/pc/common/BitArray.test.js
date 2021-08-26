/* globals describe test */
const assert = require('assert')
const BitArraySpan = require('./BitArray')
const BitArrayNoSpan = require('./BitArrayNoSpan')
const bitarrays = {
  BitArraySpan,
  BitArrayNoSpan
}
Object.entries(bitarrays).forEach(([name, BitArray]) => {
  describe(name, () => {
    /*
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
    }) */

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

    test('does not overflow', () => {
      const bitArr = new BitArray({
        bitsPerValue: 4,
        capacity: 4096
      })
      for (let i = 0; i < 8; ++i) {
        bitArr.set(i, 15)
        assert.strictEqual(bitArr.get(i), 15)
      }
      assert(bitArr.data[0] > 0, `${bitArr.data[0]} is negative`)
    })

    /* test('throws when writing out of bounds', () => {
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
    }) */

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
    /*
    test('fails when resizing', () => {
      const bitArr = new BitArray({
        bitsPerValue: 4,
        capacity: 10
      })
      bitArr.set(0, 8)
      assert.throws(() => {
        bitArr.resizeTo(3)
      })
    }) */
    test('convert from array cycle', () => {
      const array = []
      for (let i = 0; i < 4096; i++) array.push(i % 32)
      const bitArr = BitArray.fromArray(array, 5)
      const array2 = bitArr.toArray()
      assert.strictEqual(array.length, array2.length)
      assert.strictEqual(array.length, bitArr.capacity)
      for (let i = 0; i < 4096; i++) {
        assert.strictEqual(bitArr.get(i), array[i])
        assert.strictEqual(array[i], array2[i])
      }
    })

    test('no side-effects Or', () => {
      const a = BitArrayNoSpan.fromLongArray([[0, 1]], 1)
      const b = BitArrayNoSpan.fromLongArray([[0, 2]], 1)
      const c = BitArrayNoSpan.or(a, b)
      assert.strictEqual(a.data[0], 1)
      assert.strictEqual(b.data[0], 2)
      assert.strictEqual(c.data[0], 3)
    })
  })
})
