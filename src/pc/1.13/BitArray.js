/* global BigInt */
const assert = require('assert')
const neededBits = require('./neededBits')

class BitArray {
  constructor (options) {
    assert(options.bitsPerValue > 0, 'bits per value must at least 1')
    assert(options.bitsPerValue <= 64, 'bits per value exceeds 64')

    const length = Math.ceil((options.capacity * options.bitsPerValue) / 64)
    if (!options.data) {
      options.data = Array(length).fill(BigInt(0))
    }
    const valueMask = BigInt((1 << options.bitsPerValue) - 1)

    this.data = options.data
    this.capacity = options.capacity
    this.bitsPerValue = BigInt(options.bitsPerValue)
    this.valueMask = valueMask
  }

  get (index) {
    assert(index >= 0 && index < this.capacity, 'index is out of bounds')

    const bitIndex = index * this.bitsPerValue
    const startLongIndex = bitIndex / BigInt(64)
    const startLong = this.data[startLongIndex]
    const indexInStartLong = bitIndex % BigInt(64)
    let result = startLong >> indexInStartLong
    const endBitOffset = indexInStartLong + this.bitsPerValue
    if (endBitOffset > 64) {
      // Value stretches across multiple longs
      const endLong = this.data[startLongIndex + BigInt(1)]
      result |= endLong << (BigInt(64) - indexInStartLong)
    }
    return result & this.valueMask
  }

  set (index, value) {
    assert(index >= 0 && index < this.capacity, 'index is out of bounds')
    assert(value <= this.valueMask, 'value does not fit into bits per value')

    const bitIndex = index * this.bitsPerValue
    const startLongIndex = bitIndex / BigInt(64)
    const indexInStartLong = bitIndex % BigInt(64)

    // Clear bits of this value first
    this.data[startLongIndex] =
      (this.data[startLongIndex] & ~(this.valueMask << indexInStartLong)) |
      ((value & this.valueMask) << indexInStartLong)
    const endBitOffset = indexInStartLong + this.bitsPerValue
    if (endBitOffset > 64) {
      // Value stretches across multiple longs
      this.data[startLongIndex + BigInt(1)] =
        (this.data[startLongIndex + BigInt(1)] &
          ~((BigInt(1) << (endBitOffset - BigInt(64))) - BigInt(1))) |
        (value >> (BigInt(64) - indexInStartLong))
    }
  }

  resizeTo (newBitsPerValue) {
    assert(newBitsPerValue > 0, 'bits per value must at least 1')
    assert(newBitsPerValue <= 64, 'bits per value exceeds 64')

    const newArr = new BitArray({
      bitsPerValue: newBitsPerValue,
      capacity: this.capacity
    })
    for (let i = BigInt(0); i < this.capacity; ++i) {
      const value = this.get(i)
      if (neededBits(Number(value)) > newArr.getBitsPerValue()) {
        throw new Error(
          "existing value in BitArray can't fit in new bits per value"
        )
      }
      newArr.set(i, value)
    }

    return newArr
  }

  length () {
    return this.data.length
  }

  getBuffer () {
    return this.data
  }

  getBitsPerValue () {
    return Number(this.bitsPerValue)
  }
}

module.exports = BitArray
