class BitArray {
  constructor ({ bitsPerValue, capacity, data } = {}) {
    this.bitsPerValue = bitsPerValue >>> 0
    this.capacity = capacity >>> 0
    this.data = data
      ? (data.buffer ? new Uint32Array(data.buffer) : Uint32Array.from(data))
      : new Uint32Array(Math.ceil((this.capacity * this.bitsPerValue) / 64) * 2)
    this.valueMask = (1 << this.bitsPerValue) - 1
  }

  length () { return this.data.length >>> 1 }
  getBitsPerValue () { return this.bitsPerValue }

  get (index) {
    // assert(index >= 0 && index < this.capacity, 'index is out of bounds')
    const bitIndex = index * this.bitsPerValue
    const startLongIndex = bitIndex >>> 5
    const indexInStartLong = bitIndex & 31
    let result = this.data[startLongIndex] >>> indexInStartLong
    if (indexInStartLong + this.bitsPerValue > 32) {
      // Value stretches across multiple longs
      result |= this.data[startLongIndex + 1] << (32 - indexInStartLong)
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
    const prevData = this.data[startLongIndex] & ~(this.valueMask << indexInStartLong)
    this.data[startLongIndex] = prevData | ((value & this.valueMask) << indexInStartLong) >>> 0
    const endBitOffset = indexInStartLong + this.bitsPerValue
    if (endBitOffset > 32) {
      // Value stretches across multiple longs
      const prevData2 = this.data[startLongIndex + 1] & ~((1 << (endBitOffset - 32)) - 1)
      this.data[startLongIndex + 1] = prevData2 | (value >>> (32 - indexInStartLong)) >>> 0
    }
  }

  toJSON () {
    return {
      data: Array.from(this.data),
      capacity: this.capacity,
      bitsPerValue: this.bitsPerValue,
      valueMask: this.valueMask
    }
  }

  static fromJSON (value) { return new BitArray(value) }
  toJson () { return JSON.stringify(this.toJSON()) }
  static fromJson (str) { return BitArray.fromJSON(JSON.parse(str)) }

  resizeTo (bitsPerValue) {
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
}

module.exports = BitArray
