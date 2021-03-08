class BitArray {
  constructor ({ bitsPerValue, capacity, data } = {}) {
    // assert(options.bitsPerValue > 0, 'bits per value must at least 1')
    // assert(options.bitsPerValue <= 32, 'bits per value exceeds 32')
    this.bitsPerValue = bitsPerValue >>> 0
    this.capacity = capacity >>> 0
    this.valuesPerLong = (64 / this.bitsPerValue) >>> 0
    this.data = data
      ? (data.buffer ? new Uint32Array(data.buffer) : Uint32Array.from(data))
      : new Uint32Array(Math.ceil(this.capacity / this.valuesPerLong) * 2)
    this.valueMask = (1 << this.bitsPerValue) - 1
  }

  length () { return this.data.length >>> 1 }
  getBitsPerValue () { return this.bitsPerValue }

  toJson () {
    return JSON.stringify({
      bitsPerValue: this.bitsPerValue,
      capacity: this.capacity,
      data: Array.from(this.data)
    })
  }

  static fromJson (str) { return new BitArray(JSON.parse(str)) }

  get (index) {
    // assert(index >= 0 && index < this.capacity, 'index is out of bounds')
    const startLongIndex = (index / this.valuesPerLong) << 1
    const indexInLong = (index - (startLongIndex >>> 1) * this.valuesPerLong) * this.bitsPerValue
    if (indexInLong >= 32) {
      return (this.data[startLongIndex + 1] >>> (indexInLong - 32)) & this.valueMask
    }
    let result = this.data[startLongIndex] >>> indexInLong
    if (indexInLong + this.bitsPerValue > 32) {
      // Value stretches across multiple longs
      result |= this.data[startLongIndex + 1] << (32 - indexInLong)
    }
    return result & this.valueMask
  }

  set (index, value) {
    // assert(index >= 0 && index < this.capacity, 'index is out of bounds')
    // assert(value <= this.valueMask, 'value does not fit into bits per value')
    const startLongIndex = (index / this.valuesPerLong) << 1
    const indexInLong = (index - (startLongIndex >>> 1) * this.valuesPerLong) * this.bitsPerValue
    if (indexInLong >= 32) {
      const indexInStartLong = indexInLong - 32
      this.data[startLongIndex + 1] =
      ((this.data[startLongIndex + 1] & ~(this.valueMask << indexInStartLong)) |
      ((value & this.valueMask) << indexInStartLong)) >>> 0
      return
    }
    // Clear bits of this value first
    this.data[startLongIndex] =
      ((this.data[startLongIndex] & ~(this.valueMask << indexInLong)) |
      ((value & this.valueMask) << indexInLong)) >>> 0
    const endBitOffset = indexInLong + this.bitsPerValue
    if (endBitOffset > 32) {
      // Value stretches across multiple longs
      this.data[startLongIndex + 1] =
        ((this.data[startLongIndex + 1] &
          ~((1 << (endBitOffset - 32)) - 1)) |
        (value >> (32 - indexInLong))) >>> 0
    }
  }

  resizeTo (bitsPerValue) {
    // assert(bitsPerValue > 0, 'bits per value must at least 1')
    // assert(bitsPerValue <= 32, 'bits per value exceeds 32')
    bitsPerValue >>>= 0
    const newArr = new BitArray({ bitsPerValue, capacity: this.capacity })
    bitsPerValue = 32 - bitsPerValue
    for (let i = 0; i < this.capacity; i++) {
      const value = this.get(i)
      if (Math.clz32(value) < bitsPerValue) {
        throw new Error("existing value in BitArray can't fit in new bits per value")
      }
      newArr.set(i, value)
    }
    return newArr
  }

  toArray () {
    const array = []
    for (let i = 0; i < this.capacity; i++) {
      array.push(this.get(i))
    }
    return array
  }

  static fromArray (array, bitsPerValue) {
    const bitarray = new BitArray({
      capacity: array.length,
      bitsPerValue
    })
    for (let i = 0; i < array.length; i++) {
      bitarray.set(i, array[i])
    }
    return bitarray
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
}

module.exports = BitArray
