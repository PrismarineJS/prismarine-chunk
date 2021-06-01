// const assert = require('assert')
const neededBits = require('./neededBits')

class BitArray {
  constructor (options) {
    if (options === null) {
      return
    }
    // assert(options.bitsPerValue > 0, 'bits per value must at least 1')
    // assert(options.bitsPerValue <= 32, 'bits per value exceeds 32')

    if (!options.data) {
      options.data = new Uint32Array(Math.ceil((options.capacity * options.bitsPerValue) / 64) * 2)
    }
    const valueMask = (1 << options.bitsPerValue) - 1

    this.data = options.data.buffer ? new Uint32Array(options.data.buffer) : Uint32Array.from(options.data)
    this.capacity = options.capacity
    this.bitsPerValue = options.bitsPerValue
    this.valueMask = valueMask
  }

  toJson () {
    return JSON.stringify({
      data: Array.from(this.data),
      capacity: this.capacity,
      bitsPerValue: this.bitsPerValue,
      valueMask: this.valueMask
    })
  }

  static fromJson (j) {
    return new BitArray(JSON.parse(j))
  }

  toArray () {
    const array = []
    for (let i = 0; i < this.capacity; i++) {
      array.push(this.get(i))
    }
    return array
  }

  static fromArray (array, bitsPerValue) {
    const data = []
    let i = 0
    let curLong = 0
    let curBit = 0
    while (i < array.length) {
      curLong |= array[i] << curBit
      curBit += bitsPerValue
      if (curBit > 32) {
        data.push(curLong & 0xffffffff)
        curBit -= 32
        curLong = array[i] >>> (bitsPerValue - curBit)
      }
      i++
    }
    if (curBit > 0) {
      data.push(curLong)
    }
    const bitarray = new BitArray(null)
    bitarray.data = data
    bitarray.capacity = array.length
    bitarray.bitsPerValue = bitsPerValue
    bitarray.valueMask = (1 << bitsPerValue) - 1
    return bitarray
  }

  get (index) {
    // assert(index >= 0 && index < this.capacity, 'index is out of bounds')

    const bitIndex = index * this.bitsPerValue
    const startLongIndex = bitIndex >>> 5
    const startLong = this.data[startLongIndex]
    const indexInStartLong = bitIndex & 31
    let result = startLong >>> indexInStartLong
    const endBitOffset = indexInStartLong + this.bitsPerValue
    if (endBitOffset > 32) {
      // Value stretches across multiple longs
      const endLong = this.data[startLongIndex + 1]
      result |= endLong << (32 - indexInStartLong)
    }
    return result & this.valueMask
  }

  set (index, value) {
    // assert(index >= 0 && index < this.capacity, 'index is out of bounds')
    // assert(value <= this.valueMask, 'value does not fit into bits per value')

    const bitIndex = index * this.bitsPerValue
    const startLongIndex = bitIndex >>> 5
    const indexInStartLong = bitIndex & 31

    // Clear bits of this value first
    this.data[startLongIndex] =
      ((this.data[startLongIndex] & ~(this.valueMask << indexInStartLong)) |
      ((value & this.valueMask) << indexInStartLong)) >>> 0
    const endBitOffset = indexInStartLong + this.bitsPerValue
    if (endBitOffset > 32) {
      // Value stretches across multiple longs
      this.data[startLongIndex + 1] =
        ((this.data[startLongIndex + 1] &
          ~((1 << (endBitOffset - 32)) - 1)) |
        (value >> (32 - indexInStartLong))) >>> 0
    }
  }

  resizeTo (newBitsPerValue) {
    // assert(newBitsPerValue > 0, 'bits per value must at least 1')
    // assert(newBitsPerValue <= 32, 'bits per value exceeds 32')

    const newArr = new BitArray({
      bitsPerValue: newBitsPerValue,
      capacity: this.capacity
    })
    for (let i = 0; i < this.capacity; ++i) {
      const value = this.get(i)
      if (neededBits(value) > newBitsPerValue) {
        throw new Error(
          "existing value in BitArray can't fit in new bits per value"
        )
      }
      newArr.set(i, value)
    }

    return newArr
  }

  length () {
    return this.data.length / 2
  }

  readBuffer (smartBuffer) {
    for (let i = 0; i < this.data.length; i += 2) {
      this.data[i + 1] = smartBuffer.readUInt32BE()
      this.data[i] = smartBuffer.readUInt32BE()
    }
    return this
  }

  writeBuffer (smartBuffer) {
    for (let i = 0; i < this.data.length; i += 2) {
      smartBuffer.writeUInt32BE(this.data[i + 1])
      smartBuffer.writeUInt32BE(this.data[i])
    }
    return this
  }

  getBitsPerValue () {
    return this.bitsPerValue
  }
}

module.exports = BitArray
